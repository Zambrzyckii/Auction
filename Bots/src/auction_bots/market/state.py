import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Literal
from uuid import UUID

from auction_bots.api.client import MarketApi
from auction_bots.api.models import AuctionDto, Rarity
from auction_bots.feed.events import (
    AuctionActivated,
    AuctionCancelled,
    AuctionFinished,
    BidPlaced,
    MarketEvent,
)
from auction_bots.market.ledger import OutcomeLedger, outcome_of


@dataclass
class AuctionView:
    auction_id: UUID
    seller_id: UUID | None
    leader_id: UUID | None
    current_price: Decimal
    official_price: Decimal | None
    rarity: Rarity | None
    item_name: str | None
    ends_on: datetime | None
    human_bids: int = 0
    last_confirmed_at: datetime | None = None


ChangeKind = Literal["activated", "bid", "finished", "cancelled", "resynced"]


@dataclass(frozen=True)
class MarketChange:
    auction_id: UUID
    kind: ChangeKind


class MarketState:
    def __init__(
        self,
        is_human: Callable[[UUID | None], bool],
        ledger: OutcomeLedger,
        clock: Callable[[], datetime],
        *,
        prune_after_s: float = 120.0,
        list_limit: int = 100,
    ) -> None:
        self._is_human = is_human
        self._ledger = ledger
        self._clock = clock
        self._prune_after_s = prune_after_s
        self._list_limit = list_limit
        self._views: dict[UUID, AuctionView] = {}
        self._subscribers: list[asyncio.Queue[MarketChange]] = []
        self._outcomes_enabled = False

    def subscribe(self) -> asyncio.Queue[MarketChange]:
        queue: asyncio.Queue[MarketChange] = asyncio.Queue(maxsize=256)
        self._subscribers.append(queue)
        return queue

    def enable_outcomes(self) -> None:
        self._outcomes_enabled = True

    def get(self, auction_id: UUID) -> AuctionView | None:
        return self._views.get(auction_id)

    def active(self) -> list[AuctionView]:
        return list(self._views.values())

    def apply(self, event: MarketEvent) -> None:
        match event:
            case AuctionActivated():
                self._apply_activated(event)
            case BidPlaced():
                self._apply_bid(event)
            case AuctionFinished():
                self._apply_finished(event)
            case AuctionCancelled():
                self._apply_cancelled(event)

    def _apply_activated(self, event: AuctionActivated) -> None:
        self._views[event.public_auction_id] = AuctionView(
            auction_id=event.public_auction_id,
            seller_id=event.seller_user_id,
            leader_id=None,
            current_price=event.current_price,
            official_price=event.item_official_price,
            rarity=event.item_rarity,
            item_name=event.item_name,
            ends_on=event.ends_on,
        )
        self._notify(event.public_auction_id, "activated")

    def _apply_bid(self, event: BidPlaced) -> None:
        view = self._views.get(event.public_auction_id)
        if view is None:
            view = AuctionView(
                auction_id=event.public_auction_id,
                seller_id=None,
                leader_id=event.new_winning_user_id,
                current_price=event.new_price,
                official_price=None,
                rarity=None,
                item_name=None,
                ends_on=None,
            )
            self._views[event.public_auction_id] = view
        else:
            if event.new_price <= view.current_price:
                return
            view.current_price = event.new_price
            view.leader_id = event.new_winning_user_id
        if self._is_human(event.new_winning_user_id):
            view.human_bids += 1
        view.last_confirmed_at = self._clock()
        self._notify(event.public_auction_id, "bid")

    def _apply_finished(self, event: AuctionFinished) -> None:
        view = self._views.pop(event.public_auction_id, None)
        if self._outcomes_enabled:
            outcome = outcome_of(view, event, self._is_human, self._clock())
            if outcome is not None:
                self._ledger.record(outcome)
        self._notify(event.public_auction_id, "finished")

    def _apply_cancelled(self, event: AuctionCancelled) -> None:
        self._views.pop(event.public_auction_id, None)
        self._notify(event.public_auction_id, "cancelled")

    async def resync(self, api: MarketApi) -> None:
        listed = await api.list_auctions(self._list_limit)
        seen: set[UUID] = set()
        for dto in listed:
            seen.add(dto.public_auction_id)
            view = self._views.get(dto.public_auction_id)
            if view is None:
                self._views[dto.public_auction_id] = self._view_from(dto)
            else:
                self._fill_from(view, dto)
            self._notify(dto.public_auction_id, "resynced")
        now = self._clock()
        horizon = timedelta(seconds=self._prune_after_s)
        for auction_id, view in list(self._views.items()):
            if auction_id in seen:
                continue
            if view.ends_on is not None and now - view.ends_on > horizon:
                del self._views[auction_id]

    @staticmethod
    def _view_from(dto: AuctionDto) -> AuctionView:
        return AuctionView(
            auction_id=dto.public_auction_id,
            seller_id=dto.seller_user_id,
            leader_id=dto.current_winning_user_id,
            current_price=dto.current_price,
            official_price=dto.item_official_price,
            rarity=dto.item_rarity,
            item_name=dto.item_name,
            ends_on=dto.ends_on,
        )

    @staticmethod
    def _fill_from(view: AuctionView, dto: AuctionDto) -> None:
        if view.official_price is None:
            view.official_price = dto.item_official_price
        if view.seller_id is None:
            view.seller_id = dto.seller_user_id
        if view.rarity is None:
            view.rarity = dto.item_rarity
        if view.item_name is None:
            view.item_name = dto.item_name
        view.ends_on = dto.ends_on
        if dto.current_price > view.current_price:
            view.current_price = dto.current_price
            view.leader_id = dto.current_winning_user_id

    def _notify(self, auction_id: UUID, kind: ChangeKind) -> None:
        change = MarketChange(auction_id, kind)
        for queue in self._subscribers:
            try:
                queue.put_nowait(change)
            except asyncio.QueueFull:
                queue.get_nowait()
                queue.put_nowait(change)
