import asyncio
import random
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from auction_bots.api.client import ApiError, BidInProgress
from auction_bots.api.models import Rarity
from auction_bots.market.state import MarketState
from sim.fake_market import PRICE_BY_RARITY, FakeMarket
from sim.scheduler import Scheduler

REACTION_DELAY_S = (2.0, 20.0)
RETRY_AFTER_S = 3.0
LISTING_INTERVAL_S = 60.0
ITEM_NAME = "Garage Find"


@dataclass(frozen=True)
class CappedBuyer:
    cap_fraction: float


@dataclass(frozen=True)
class Seller:
    start_range: tuple[float, float]
    duration_min: tuple[float, float] = (5.0, 30.0)
    rarity: Rarity = Rarity.Common


class SimHuman:
    """A scripted human account outside the fleet registry."""

    def __init__(
        self,
        user_id: UUID,
        token: str,
        policy: CappedBuyer | Seller,
        rng: random.Random,
        *,
        fake: FakeMarket,
        state: MarketState,
        scheduler: Scheduler,
    ) -> None:
        self.user_id = user_id
        self._token = token
        self._policy = policy
        self._rng = rng
        self._fake = fake
        self._state = state
        self._scheduler = scheduler
        self.auctions_bid: set[UUID] = set()
        self.listed: list[UUID] = []

    def start(self) -> asyncio.Task:
        if isinstance(self._policy, CappedBuyer):
            return asyncio.ensure_future(self._buy_loop(self._policy))
        return asyncio.ensure_future(self._sell_loop(self._policy))

    async def _buy_loop(self, policy: CappedBuyer) -> None:
        queue = self._state.subscribe()
        while True:
            change = await queue.get()
            if change.kind not in ("activated", "bid"):
                continue
            await self._scheduler.sleep(self._rng.uniform(*REACTION_DELAY_S))
            await self._consider(policy, change.auction_id)

    async def _consider(self, policy: CappedBuyer, auction_id: UUID) -> None:
        while True:
            view = self._state.get(auction_id)
            if view is None or view.official_price is None:
                return
            if view.seller_id == self.user_id or view.leader_id == self.user_id:
                return
            amount = int(view.current_price) + 1
            if amount > float(view.official_price) * policy.cap_fraction:
                return
            try:
                await self._fake.place_bid(self._token, auction_id, amount)
            except BidInProgress:
                await self._scheduler.sleep(RETRY_AFTER_S)
                continue
            except ApiError:
                return
            self.auctions_bid.add(auction_id)
            return

    async def _sell_loop(self, policy: Seller) -> None:
        while True:
            await self._scheduler.sleep(LISTING_INTERVAL_S)
            await self._list_once(policy)

    async def _list_once(self, policy: Seller) -> None:
        item_id = await self._fake.mint_item(self._token, ITEM_NAME, policy.rarity)
        official = PRICE_BY_RARITY[policy.rarity]
        start = max(1, round(float(official) * self._rng.uniform(*policy.start_range)))
        minutes = self._rng.uniform(*policy.duration_min)
        ends = self._scheduler.now() + timedelta(minutes=minutes)
        auction_id = await self._fake.create_auction(self._token, item_id, start, ends)
        self.listed.append(auction_id)


__all__ = ["CappedBuyer", "Seller", "SimHuman"]
