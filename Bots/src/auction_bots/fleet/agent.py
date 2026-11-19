import asyncio
import logging
import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import TypeVar
from uuid import UUID

from auction_bots.api.budget import TokenBucket
from auction_bots.api.client import ApiError, MarketApi, Unauthorized
from auction_bots.api.models import UserItemDto
from auction_bots.config import Settings
from auction_bots.director.knobs import Knobs
from auction_bots.fleet.archetypes import ITEM_NAMES
from auction_bots.fleet.identity import BotSession
from auction_bots.fleet.persona import Persona
from auction_bots.fleet.policies.bidding import BidAction, decide_bid
from auction_bots.fleet.policies.listing import OwnedItem, decide_listing
from auction_bots.fleet.policies.valuation import value_of
from auction_bots.fleet.registry import FleetRegistry
from auction_bots.market.state import MarketChange, MarketState

OPEN_BID_TTL_S = 70.0
BID_GAP_S = 8.0
LIVE_STATUSES = ("Pending", "Active")
TERMINAL_CHANGES = ("finished", "cancelled")

T = TypeVar("T")

log = logging.getLogger("auction_bots.agent")


@dataclass
class OpenBid:
    auction_id: UUID
    amount: int
    valuation: Decimal
    placed_at: datetime
    confirmed: bool = False


class AuctionGate:
    """At most one fleet request in flight per auction, plus a quiet gap after a confirmed bid."""

    def __init__(self, bid_gap_s: float = BID_GAP_S) -> None:
        self._bid_gap_s = bid_gap_s
        self._in_flight: set[UUID] = set()
        self._quiet_until: dict[UUID, datetime] = {}

    def try_claim(self, auction_id: UUID, now: datetime) -> bool:
        if auction_id in self._in_flight:
            return False
        quiet = self._quiet_until.get(auction_id)
        if quiet is not None and now < quiet:
            return False
        self._in_flight.add(auction_id)
        return True

    def release(self, auction_id: UUID, confirmed_at: datetime | None) -> None:
        self._in_flight.discard(auction_id)
        if confirmed_at is not None:
            self._quiet_until[auction_id] = confirmed_at + timedelta(seconds=self._bid_gap_s)


class BotAgent:
    def __init__(
        self,
        persona: Persona,
        session: BotSession,
        api: MarketApi,
        state: MarketState,
        registry: FleetRegistry,
        knobs: Callable[[], Knobs],
        saga_bucket: TokenBucket,
        gate: AuctionGate,
        rng: random.Random,
        clock: Callable[[], datetime],
        sleep: Callable[[float], Awaitable[None]],
        settings: Settings,
        relogin: Callable[[], Awaitable[BotSession]],
        *,
        on_saga_latency: Callable[[float], None] | None = None,
    ) -> None:
        self._on_saga_latency = on_saga_latency
        self._persona = persona
        self._session = session
        self._api = api
        self._state = state
        self._registry = registry
        self._knobs = knobs
        self._saga_bucket = saga_bucket
        self._gate = gate
        self._rng = rng
        self._clock = clock
        self._sleep = sleep
        self._settings = settings
        self._relogin = relogin
        self.open_bids: dict[UUID, OpenBid] = {}
        self.saga_latencies: list[float] = []
        self.bids_placed = 0
        self.topups_total = 0
        self._valuations: dict[UUID, Decimal] = {}
        self._wallet: Decimal | None = None
        self._last_topup: datetime | None = None
        self._tracked: dict[UUID, tuple[UUID, int]] = {}
        self._failed: dict[UUID, int] = {}
        self._last_price: dict[UUID, int] = {}
        self._sleeping: set[UUID] = set()
        self._placing = 0

    @property
    def persona(self) -> Persona:
        return self._persona

    @property
    def session(self) -> BotSession:
        return self._session

    def wallet_hint(self) -> Decimal:
        if self._wallet is not None:
            return self._wallet
        return Decimal(self._persona.bankroll)

    @property
    def tracked_listings(self) -> int:
        return len(self._tracked)

    async def react(self, change: MarketChange) -> None:
        if change.kind in TERMINAL_CHANGES:
            self._forget(change.auction_id)
            return
        if change.auction_id in self._sleeping:
            return
        self._sleeping.add(change.auction_id)
        try:
            await self._sleep(self._persona.reaction_delay_s)
        finally:
            self._sleeping.discard(change.auction_id)
        try:
            await self._consider(change.auction_id)
        except ApiError as error:
            log.warning("react failed", extra={"status": error.status, "bot": self._persona.index})
        except Exception:
            log.exception("react crashed", extra={"bot": self._persona.index})

    async def tick(self) -> None:
        self._expire_open_bids(self._clock())
        if self._rng.random() > self._persona.activity:
            return
        try:
            await self._refresh_wallet()
            await self._top_up(self._clock())
            await self._relist()
        except ApiError as error:
            log.warning("tick failed", extra={"status": error.status, "bot": self._persona.index})
        except Exception:
            log.exception("tick crashed", extra={"bot": self._persona.index})

    async def run(self, stop: asyncio.Event, *, first_tick_delay_s: float = 0.0) -> None:
        queue = self._state.subscribe()
        reactions: set[asyncio.Task[None]] = set()

        async def dispatch() -> None:
            while True:
                change = await queue.get()
                if change.kind in TERMINAL_CHANGES:
                    self._forget(change.auction_id)
                elif change.auction_id not in self._sleeping:
                    reaction = asyncio.ensure_future(self.react(change))
                    reactions.add(reaction)
                    reaction.add_done_callback(reactions.discard)

        async def ticks() -> None:
            if first_tick_delay_s > 0:
                await self._sleep(first_tick_delay_s)
            while True:
                await self._sleep(self._persona.tick_s)
                await self.tick()

        loops = [asyncio.ensure_future(dispatch()), asyncio.ensure_future(ticks())]
        await stop.wait()
        pending = [*loops, *reactions]
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)

    async def _consider(self, auction_id: UUID) -> None:
        view = self._state.get(auction_id)
        if view is None:
            return
        now = self._clock()
        me = self._session.user_id
        open_bid = self.open_bids.get(auction_id)
        if open_bid is not None and not open_bid.confirmed:
            if view.leader_id != me:
                return
            open_bid.confirmed = True
            confirmed_at = view.last_confirmed_at or now
            latency = (confirmed_at - open_bid.placed_at).total_seconds()
            self.saga_latencies.append(latency)
            if self._on_saga_latency is not None:
                self._on_saga_latency(latency)
            self._gate.release(auction_id, confirmed_at)
        elif open_bid is not None and view.leader_id != me:
            self.open_bids.pop(auction_id, None)
            await self._refresh_wallet()
        if view.official_price is None:
            return
        committed = len(self.open_bids) + self._placing
        if auction_id not in self.open_bids and committed >= self._persona.max_open_bids:
            return
        valuation = self._valuations.get(auction_id)
        if valuation is None:
            valuation = value_of(
                view.official_price,
                view.rarity,
                view.item_name or "",
                self._persona,
                self._knobs(),
                self._rng,
            )
            self._valuations[auction_id] = valuation
        decision = decide_bid(
            view,
            self._persona,
            await self._available(),
            self._knobs(),
            self._registry.is_human,
            now,
            self._rng,
            self_id=me,
            valuation=valuation,
        )
        if decision.action is not BidAction.BID or decision.amount is None:
            return
        if not self._gate.try_claim(auction_id, now):
            return
        self._placing += 1
        try:
            await self._saga_bucket.acquire()
            view = self._state.get(auction_id)
            if view is None:
                self._gate.release(auction_id, None)
                return
            decision = decide_bid(
                view,
                self._persona,
                await self._available(),
                self._knobs(),
                self._registry.is_human,
                self._clock(),
                self._rng,
                self_id=me,
                valuation=valuation,
            )
            if decision.action is not BidAction.BID or decision.amount is None:
                self._gate.release(auction_id, None)
                return
            amount = decision.amount
            placed_at = self._clock()
            await self._authorized(lambda token: self._api.place_bid(token, auction_id, amount))
        except ApiError as error:
            self._gate.release(auction_id, None)
            log.warning("bid rejected", extra={"status": error.status, "bot": self._persona.index})
            return
        finally:
            self._placing -= 1
        self.bids_placed += 1
        self.open_bids[auction_id] = OpenBid(auction_id, amount, valuation, placed_at)

    def _forget(self, auction_id: UUID) -> None:
        self._valuations.pop(auction_id, None)
        if self.open_bids.pop(auction_id, None) is not None:
            self._gate.release(auction_id, None)
            self._wallet = None

    def _expire_open_bids(self, now: datetime) -> None:
        for auction_id, open_bid in list(self.open_bids.items()):
            if open_bid.confirmed:
                if self._state.get(auction_id) is None:
                    del self.open_bids[auction_id]
                    self._gate.release(auction_id, None)
                    self._wallet = None
                continue
            if (now - open_bid.placed_at).total_seconds() > OPEN_BID_TTL_S:
                del self.open_bids[auction_id]
                self._gate.release(auction_id, None)
                self._wallet = None

    async def _top_up(self, now: datetime) -> None:
        target = Decimal(self._persona.bankroll)
        threshold = target * Decimal(str(self._settings.money.topup_fraction))
        if await self._available() >= threshold:
            return
        interval = self._settings.money.topup_interval_s
        if self._last_topup is not None and (now - self._last_topup).total_seconds() < interval:
            return
        amount = int(target - await self._available())
        await self._authorized(lambda token: self._api.add_funds(token, amount))
        self._last_topup = now
        self._wallet = target
        self.topups_total += amount

    async def _relist(self) -> None:
        mine = await self._authorized(self._api.my_auctions)
        inventory = await self._authorized(self._api.get_inventory)
        live = {a.public_auction_id for a in mine if a.status in LIVE_STATUSES}
        self._reconcile(live, {item.public_item_id: item for item in inventory})
        owned = [
            OwnedItem(
                item_id=item.public_item_id,
                name=item.name,
                rarity=item.rarity,
                official_price=item.official_price,
                available=item.status == "Available",
                failed_listings=self._failed.get(item.public_item_id, 0),
                last_start_price=self._last_price.get(item.public_item_id),
            )
            for item in inventory
        ]
        decision = decide_listing(
            self._persona, owned, len(live), self._knobs(), self._rng, allowance=self._allowance()
        )
        for rarity in decision.mint:
            name = self._rng.choice(ITEM_NAMES)
            await self._authorized(lambda token, n=name, r=rarity: self._api.mint_item(token, n, r))
        for listing in decision.listings:
            await self._saga_bucket.acquire()
            ends = self._clock() + listing.duration
            auction_id = await self._authorized(
                lambda token, li=listing, e=ends: self._api.create_auction(
                    token, li.item_id, li.starting_price, e
                )
            )
            self._tracked[auction_id] = (listing.item_id, listing.starting_price)
        for item_id in decision.sell_to_shop:
            await self._saga_bucket.acquire()
            await self._authorized(lambda token, i=item_id: self._api.sell_to_shop(token, i))
            self._failed.pop(item_id, None)
            self._last_price.pop(item_id, None)

    def _reconcile(self, live: set[UUID], inventory: dict[UUID, UserItemDto]) -> None:
        for auction_id, (item_id, price) in list(self._tracked.items()):
            if auction_id in live:
                continue
            del self._tracked[auction_id]
            item = inventory.get(item_id)
            if item is not None and item.status == "Available":
                self._failed[item_id] = self._failed.get(item_id, 0) + 1
                self._last_price[item_id] = price
            else:
                self._failed.pop(item_id, None)
                self._last_price.pop(item_id, None)

    def _allowance(self) -> int:
        per_tick = (
            self._knobs().listing_rate * self._persona.tick_s / 60.0 / self._settings.fleet.size
        )
        allowance = int(per_tick)
        if self._rng.random() < per_tick - allowance:
            allowance += 1
        return allowance

    async def _available(self) -> Decimal:
        if self._wallet is None:
            await self._refresh_wallet()
        assert self._wallet is not None
        return self._wallet

    async def _refresh_wallet(self) -> None:
        wallet = await self._authorized(
            lambda token: self._api.get_wallet(token, self._session.user_id)
        )
        self._wallet = wallet.available_funds

    async def _authorized(self, call: Callable[[str], Awaitable[T]]) -> T:
        try:
            return await call(self._session.token)
        except Unauthorized:
            self._session = await self._relogin()
            return await call(self._session.token)


__all__ = ["AuctionGate", "BotAgent", "OpenBid"]
