import base64
import json
import random
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from auction_bots.api.client import (
    BadRequest,
    BidInProgress,
    Conflict,
    EmailTaken,
    NotFound,
    Unauthorized,
    UsernameTaken,
)
from auction_bots.api.models import (
    AuctionDto,
    LoginResponse,
    ManifestItemDto,
    MyAuctionDto,
    Rarity,
    UserItemDto,
    WalletDto,
    WarehouseDetailsDto,
    WarehouseSummaryDto,
)
from auction_bots.feed.dedupe import RecentIds
from auction_bots.feed.events import AuctionActivated, AuctionFinished, BidPlaced, MarketEvent
from auction_bots.market.state import MarketState
from sim.scheduler import Scheduler

PRICE_BY_RARITY = {
    Rarity.Common: Decimal(100),
    Rarity.Rare: Decimal(300),
    Rarity.Epic: Decimal(1000),
    Rarity.Legendary: Decimal(5000),
}
SAGA_DELAY_S = (3.0, 9.0)
ACTIVATION_DELAY_S = (6.0, 9.0)
ANTI_SNIPING_S = 30.0
CLOSER_INTERVAL_S = 3.0
WAR_ENTRY_FEE = Decimal(500)
WAR_INCREMENTS = (Decimal(10), Decimal(50), Decimal(100))
WAR_MIN_PLAYERS = 3
WAR_MAX_PLAYERS = 5
WAR_JOIN_COUNTDOWN_S = 30.0
WAR_RAISE_WINDOW_S = 10.0
WAR_LOCK_DELAY_S = (1.0, 3.0)
ESTIMATE_VARIANTS = ((0.3, 0.7), (0.8, 1.2), (1.3, 2.5))


def _tens(value: Decimal) -> Decimal:
    return Decimal(round(float(value) / 10.0) * 10)


@dataclass
class BidRecord:
    auction_id: UUID
    user_id: UUID
    amount: int
    placed_at: datetime
    leader_before: UUID | None = None


@dataclass
class ErrorRecord:
    user_id: UUID | None
    status: int
    message: str


@dataclass
class _Item:
    item_id: UUID
    name: str
    rarity: Rarity
    official: Decimal
    status: str = "Available"


@dataclass
class _Account:
    user_id: UUID
    token: str
    available: Decimal
    locked: Decimal = Decimal(0)
    turnover: Decimal = Decimal(0)
    items: dict[UUID, _Item] = field(default_factory=dict)


@dataclass
class RaiseRecord:
    warehouse_id: UUID
    user_id: UUID
    increment: int
    price_after: Decimal


@dataclass
class _FakeWar:
    warehouse_id: UUID
    manifest: list[_Item]
    true_value: Decimal
    estimate_min: Decimal
    estimate_max: Decimal
    status: str = "Open"
    current: Decimal = Decimal(0)
    leader: UUID | None = None
    participants: dict[UUID, str] = field(default_factory=dict)
    bidding_starts_on: datetime | None = None
    window_ends_on: datetime | None = None
    cancellation_reason: str | None = None
    countdown_started: bool = False


@dataclass
class _FakeAuction:
    auction_id: UUID
    seller: UUID
    item: _Item
    starting_price: Decimal
    current: Decimal
    leader: UUID | None
    ends_on: datetime
    created_on: datetime
    status: str = "Pending"
    pending: tuple[UUID, int] | None = None


class FakeMarket:
    """In-memory market speaking the MarketApi protocol on a virtual clock."""

    def __init__(
        self,
        scheduler: Scheduler,
        state: MarketState,
        recent: RecentIds,
        rng: random.Random,
        *,
        duplicate_p: float = 0.05,
    ) -> None:
        self._scheduler = scheduler
        self._state = state
        self._recent = recent
        self._rng = rng
        self._duplicate_p = duplicate_p
        self._by_token: dict[str, _Account] = {}
        self._by_user: dict[UUID, _Account] = {}
        self._by_email: dict[str, tuple[_Account, str]] = {}
        self._usernames: set[str] = set()
        self._auctions: dict[UUID, _FakeAuction] = {}
        self._by_seller: dict[UUID, list[_FakeAuction]] = defaultdict(list)
        self._wars: dict[UUID, _FakeWar] = {}
        self.bids: list[BidRecord] = []
        self.raises: list[RaiseRecord] = []
        self.errors: list[ErrorRecord] = []
        self._schedule_closer()

    # accounts

    def register_human(self, user_id: UUID, funds: int) -> str:
        return self._register(user_id, funds)

    def register_bot(self, user_id: UUID, funds: int) -> str:
        return self._register(user_id, funds)

    def set_available(self, user_id: UUID, amount: Decimal) -> None:
        self._by_user[user_id].available = amount

    def ends_on(self, auction_id: UUID) -> datetime:
        return self._auctions[auction_id].ends_on

    def _register(self, user_id: UUID, funds: int) -> str:
        token = f"token-{len(self._by_token)}"
        account = _Account(user_id=user_id, token=token, available=Decimal(funds))
        self._by_token[token] = account
        self._by_user[user_id] = account
        return token

    def user_count(self) -> int:
        return len(self._by_user)

    async def provision_bot(self, api_key: str, body: Mapping[str, str]) -> UUID:
        email = body["email"]
        username = body["username"]
        if email in self._by_email:
            raise EmailTaken(409, "This email is taken")
        if username in self._usernames:
            raise UsernameTaken(409, "This username is taken")
        user_id = uuid4()
        token = self._register(user_id, 300)
        self._by_email[email] = (self._by_token[token], body["password"])
        self._usernames.add(username)
        return user_id

    async def login(self, email: str, password: str) -> LoginResponse:
        entry = self._by_email.get(email)
        if entry is None or entry[1] != password:
            raise BadRequest(400, "invalid credentials")
        account, _ = entry
        expires = int((self._scheduler.now() + timedelta(hours=24)).timestamp())
        claims = json.dumps({"nameid": str(account.user_id), "exp": expires}).encode()
        payload = base64.urlsafe_b64encode(claims).rstrip(b"=").decode()
        token = f"header.{payload}.signature"
        account.token = token
        self._by_token[token] = account
        return LoginResponse(token=token)

    def _account(self, token: str) -> _Account:
        account = self._by_token.get(token)
        if account is None:
            self.errors.append(ErrorRecord(None, 401, "invalid token"))
            raise Unauthorized(401, "invalid token")
        return account

    # MarketApi

    async def add_funds(self, token: str, amount: int) -> None:
        account = self._account(token)
        account.available += Decimal(amount)
        account.turnover += Decimal(amount)

    async def get_wallet(self, token: str, user_id: UUID) -> WalletDto:
        self._account(token)
        account = self._by_user[user_id]
        return WalletDto(
            available_funds=account.available,
            locked_funds=account.locked,
            lifetime_turnover=account.turnover,
        )

    async def mint_item(self, token: str, name: str, rarity: Rarity) -> UUID:
        account = self._account(token)
        item = _Item(item_id=uuid4(), name=name, rarity=rarity, official=PRICE_BY_RARITY[rarity])
        account.items[item.item_id] = item
        return item.item_id

    async def get_inventory(self, token: str) -> list[UserItemDto]:
        account = self._account(token)
        return [
            UserItemDto(
                public_item_id=item.item_id,
                name=item.name,
                rarity=item.rarity,
                status=item.status,
                official_price=item.official,
            )
            for item in account.items.values()
        ]

    async def sell_to_shop(self, token: str, item_id: UUID) -> None:
        account = self._account(token)
        item = account.items.get(item_id)
        if item is None:
            raise NotFound(404, "item not found")
        if item.status != "Available":
            raise BadRequest(400, "item is not available")
        del account.items[item_id]
        account.available += item.official
        account.turnover += item.official

    async def create_auction(
        self, token: str, item_id: UUID, starting_price: int, ends_on: datetime
    ) -> UUID:
        account = self._account(token)
        item = account.items.get(item_id)
        if item is None:
            raise NotFound(404, "item not found")
        if item.status != "Available":
            raise BadRequest(400, "item is not available")
        item.status = "LockedForAuction"
        auction = _FakeAuction(
            auction_id=uuid4(),
            seller=account.user_id,
            item=item,
            starting_price=Decimal(starting_price),
            current=Decimal(starting_price),
            leader=None,
            ends_on=ends_on,
            created_on=self._scheduler.now(),
        )
        self._auctions[auction.auction_id] = auction
        self._by_seller[account.user_id].append(auction)
        delay = self._rng.uniform(*ACTIVATION_DELAY_S)
        when = self._scheduler.now() + timedelta(seconds=delay)
        self._scheduler.call_at(when, lambda: self._activate(auction))
        return auction.auction_id

    async def list_auctions(self, limit: int) -> list[AuctionDto]:
        active = [a for a in self._auctions.values() if a.status == "Active"]
        active.sort(key=lambda a: a.ends_on)
        return [self._dto(a) for a in active[:limit]]

    async def get_auction(self, auction_id: UUID) -> AuctionDto:
        auction = self._auctions.get(auction_id)
        if auction is None:
            raise NotFound(404, "auction not found")
        return self._dto(auction)

    async def my_auctions(self, token: str) -> list[MyAuctionDto]:
        account = self._account(token)
        mine = sorted(self._by_seller[account.user_id], key=lambda a: a.created_on)
        return [
            MyAuctionDto(**self._dto(a).model_dump(by_alias=True), created_on=a.created_on)
            for a in mine
        ]

    async def place_bid(self, token: str, auction_id: UUID, amount: int) -> None:
        account = self._account(token)
        auction = self._auctions.get(auction_id)
        if auction is None:
            raise NotFound(404, "auction not found")
        if auction.status != "Active":
            self._fail(account, BadRequest(400, "auction is not active"))
        if auction.seller == account.user_id:
            self._fail(account, BadRequest(400, "cannot bid on own auction"))
        if auction.pending is not None:
            self._fail(account, BidInProgress(409, "The bid is already being processed"))
        if Decimal(amount) <= auction.current:
            self._fail(account, BadRequest(400, "bid must be above the current price"))
        auction.pending = (account.user_id, amount)
        self.bids.append(
            BidRecord(auction_id, account.user_id, amount, self._scheduler.now(), auction.leader)
        )
        delay = self._rng.uniform(*SAGA_DELAY_S)
        when = self._scheduler.now() + timedelta(seconds=delay)
        self._scheduler.call_at(when, lambda: self._confirm(auction))

    # warehouses

    def open_warehouse(self, *, prices: list[int], variant: int = 0, status: str = "Open") -> UUID:
        manifest = [
            _Item(item_id=uuid4(), name="Crate Find", rarity=Rarity.Common, official=Decimal(p))
            for p in prices
        ]
        true_value = Decimal(sum(prices))
        low, high = ESTIMATE_VARIANTS[variant]
        war = _FakeWar(
            warehouse_id=uuid4(),
            manifest=manifest,
            true_value=true_value,
            estimate_min=_tens(true_value * Decimal(str(low))),
            estimate_max=_tens(true_value * Decimal(str(high))),
            status=status,
        )
        self._wars[war.warehouse_id] = war
        return war.warehouse_id

    def war_players(self, warehouse_id: UUID) -> int:
        return len(self._war(warehouse_id).participants)

    def war_current(self, warehouse_id: UUID) -> Decimal:
        return self._war(warehouse_id).current

    def participant_states(self, warehouse_id: UUID) -> dict[UUID, str]:
        return dict(self._war(warehouse_id).participants)

    async def list_warehouses(self, token: str, limit: int) -> list[WarehouseSummaryDto]:
        self._account(token)
        return [self._war_summary(war) for war in list(self._wars.values())[:limit]]

    async def get_warehouse(self, token: str, warehouse_id: UUID) -> WarehouseDetailsDto:
        account = self._account(token)
        war = self._war(warehouse_id)
        summary = self._war_summary(war)
        manifest = None
        if war.status == "Settled":
            manifest = [
                ManifestItemDto(name=item.name, rarity=item.rarity, price=item.official)
                for item in war.manifest
            ]
        return WarehouseDetailsDto(
            **summary.model_dump(by_alias=True),
            is_participant=account.user_id in war.participants,
            participant_state=war.participants.get(account.user_id),
            is_leader=war.leader == account.user_id,
            cancellation_reason=war.cancellation_reason,
            manifest=manifest,
            increments=list(WAR_INCREMENTS),
        )

    async def join_warehouse(self, token: str, warehouse_id: UUID) -> None:
        account = self._account(token)
        war = self._war(warehouse_id)
        if war.status != "Open":
            self._fail(account, Conflict(409, "Warehouse war is not open"))
        if account.user_id in war.participants:
            self._fail(account, Conflict(409, "User already joined this warehouse war"))
        if len(war.participants) >= WAR_MAX_PLAYERS:
            self._fail(account, Conflict(409, "Warehouse war lobby is full"))
        war.participants[account.user_id] = "PendingLock"
        delay = self._rng.uniform(*WAR_LOCK_DELAY_S)
        when = self._scheduler.now() + timedelta(seconds=delay)
        self._scheduler.call_at(when, lambda u=account.user_id: self._confirm_join(war, u))
        if not war.countdown_started and len(war.participants) >= WAR_MIN_PLAYERS:
            war.countdown_started = True
            start = self._scheduler.now() + timedelta(seconds=WAR_JOIN_COUNTDOWN_S)
            war.bidding_starts_on = start
            self._scheduler.call_at(start, lambda: self._start_bidding(war))

    async def leave_warehouse(self, token: str, warehouse_id: UUID) -> None:
        account = self._account(token)
        war = self._war(warehouse_id)
        if war.status != "Open":
            self._fail(account, BadRequest(400, "cannot leave now"))
        state = war.participants.pop(account.user_id, None)
        if state == "Active":
            account.locked -= WAR_ENTRY_FEE
            account.available += WAR_ENTRY_FEE

    async def raise_warehouse(self, token: str, warehouse_id: UUID, increment: int) -> None:
        account = self._account(token)
        war = self._war(warehouse_id)
        if war.status != "Bidding":
            self._fail(account, Conflict(409, "Warehouse war is not in bidding"))
        if war.participants.get(account.user_id) != "Active":
            self._fail(account, BadRequest(400, "not an active participant"))
        if war.leader == account.user_id:
            self._fail(account, Conflict(409, "caller already leads"))
        step = Decimal(increment)
        if step not in WAR_INCREMENTS:
            self._fail(account, BadRequest(400, "invalid increment"))
        if war.current + step > WAR_ENTRY_FEE:
            self._fail(account, BadRequest(400, "increment exceeds the budget"))
        war.current += step
        war.leader = account.user_id
        war.window_ends_on = self._scheduler.now() + timedelta(seconds=WAR_RAISE_WINDOW_S)
        self._scheduler.call_at(war.window_ends_on, lambda: self._check_window(war))
        self.raises.append(RaiseRecord(warehouse_id, account.user_id, increment, war.current))

    def _war(self, warehouse_id: UUID) -> _FakeWar:
        war = self._wars.get(warehouse_id)
        if war is None:
            raise NotFound(404, "warehouse not found")
        return war

    def _war_summary(self, war: _FakeWar) -> WarehouseSummaryDto:
        return WarehouseSummaryDto(
            public_warehouse_id=war.warehouse_id,
            tier="Small",
            status=war.status,
            estimate_min=war.estimate_min,
            estimate_max=war.estimate_max,
            entry_fee=WAR_ENTRY_FEE,
            current_price=war.current,
            item_count=len(war.manifest),
            players=len(war.participants),
            max_players=WAR_MAX_PLAYERS,
            bidding_starts_on=war.bidding_starts_on,
            bidding_ends_on=war.window_ends_on,
        )

    def _confirm_join(self, war: _FakeWar, user_id: UUID) -> None:
        if war.participants.get(user_id) != "PendingLock":
            return
        account = self._by_user[user_id]
        if account.available < WAR_ENTRY_FEE:
            del war.participants[user_id]
            return
        account.available -= WAR_ENTRY_FEE
        account.locked += WAR_ENTRY_FEE
        war.participants[user_id] = "Active"

    def _start_bidding(self, war: _FakeWar) -> None:
        if war.status != "Open":
            return
        war.status = "Bidding"
        war.window_ends_on = self._scheduler.now() + timedelta(seconds=WAR_RAISE_WINDOW_S)
        self._scheduler.call_at(war.window_ends_on, lambda: self._check_window(war))

    def _check_window(self, war: _FakeWar) -> None:
        if war.status != "Bidding" or war.window_ends_on is None:
            return
        now = self._scheduler.now()
        if now < war.window_ends_on:
            self._scheduler.call_at(war.window_ends_on, lambda: self._check_window(war))
            return
        self._settle_war(war)

    def _settle_war(self, war: _FakeWar) -> None:
        if war.leader is None:
            war.status = "Cancelled"
            war.cancellation_reason = "No bids placed"
        else:
            war.status = "Settled"
        for user_id, state in war.participants.items():
            if state != "Active":
                continue
            account = self._by_user[user_id]
            account.locked -= WAR_ENTRY_FEE
            if user_id == war.leader:
                account.available += WAR_ENTRY_FEE - war.current
                account.turnover += war.current
                for item in war.manifest:
                    account.items[item.item_id] = item
            else:
                account.available += WAR_ENTRY_FEE

    # internals

    def _fail(self, account: _Account, error: Exception) -> None:
        status = getattr(error, "status", 500)
        message = getattr(error, "message", str(error))
        self.errors.append(ErrorRecord(account.user_id, status, message))
        raise error

    def _dto(self, auction: _FakeAuction) -> AuctionDto:
        return AuctionDto(
            public_auction_id=auction.auction_id,
            seller_user_id=auction.seller,
            current_winning_user_id=auction.leader,
            status=auction.status,
            current_price=auction.current,
            ends_on=auction.ends_on,
            item_name=auction.item.name,
            item_rarity=auction.item.rarity,
            item_official_price=auction.item.official,
        )

    def _activate(self, auction: _FakeAuction) -> None:
        if auction.status != "Pending":
            return
        auction.status = "Active"
        self._emit(
            AuctionActivated(
                event_id=uuid4(),
                public_auction_id=auction.auction_id,
                seller_user_id=auction.seller,
                public_item_id=auction.item.item_id,
                item_name=auction.item.name,
                item_rarity=auction.item.rarity,
                item_official_price=auction.item.official,
                current_price=auction.current,
                ends_on=auction.ends_on,
            )
        )

    def _confirm(self, auction: _FakeAuction) -> None:
        if auction.pending is None or auction.status != "Active":
            auction.pending = None
            return
        user_id, amount = auction.pending
        auction.pending = None
        account = self._by_user[user_id]
        if account.available < Decimal(amount):
            return  # rejected lock cancels the bid without an event
        previous_leader = auction.leader
        previous_price = auction.current
        if previous_leader is not None:
            self._by_user[previous_leader].locked -= previous_price
            self._by_user[previous_leader].available += previous_price
        account.available -= Decimal(amount)
        account.locked += Decimal(amount)
        auction.leader = user_id
        auction.current = Decimal(amount)
        now = self._scheduler.now()
        if (auction.ends_on - now).total_seconds() <= ANTI_SNIPING_S:
            auction.ends_on += timedelta(seconds=ANTI_SNIPING_S)
        self._emit(
            BidPlaced(
                event_id=uuid4(),
                public_auction_id=auction.auction_id,
                new_winning_user_id=user_id,
                previous_winning_user_id=previous_leader,
                new_price=auction.current,
                previous_price=previous_price,
            )
        )

    def _schedule_closer(self) -> None:
        when = self._scheduler.now() + timedelta(seconds=CLOSER_INTERVAL_S)
        self._scheduler.call_at(when, self._close_due)

    def _close_due(self) -> None:
        now = self._scheduler.now()
        for auction in list(self._auctions.values()):
            if auction.status == "Active" and auction.ends_on <= now:
                self._finish(auction)
        self._schedule_closer()

    def _finish(self, auction: _FakeAuction) -> None:
        auction.status = "Closed"
        seller = self._by_user[auction.seller]
        final: Decimal | None = None
        if auction.leader is not None:
            final = auction.current
            winner = self._by_user[auction.leader]
            winner.locked -= final
            winner.turnover += final
            seller.available += final
            seller.turnover += final
            del seller.items[auction.item.item_id]
            auction.item.status = "Available"
            winner.items[auction.item.item_id] = auction.item
        else:
            auction.item.status = "Available"
        self._emit(
            AuctionFinished(
                event_id=uuid4(),
                public_auction_id=auction.auction_id,
                seller_user_id=auction.seller,
                winner_user_id=auction.leader,
                final_price=final,
            )
        )

    def _emit(self, event: MarketEvent) -> None:
        message_id = str(uuid4())
        deliveries = 2 if self._rng.random() < self._duplicate_p else 1
        for _ in range(deliveries):
            if not self._recent.seen(message_id):
                self._state.apply(event)
