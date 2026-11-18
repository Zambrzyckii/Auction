import random
from datetime import timedelta
from decimal import Decimal
from uuid import UUID

import pytest

from auction_bots.api.client import BidInProgress
from auction_bots.api.models import Rarity
from auction_bots.feed.dedupe import RecentIds
from auction_bots.fleet.registry import FleetRegistry
from auction_bots.market.ledger import OutcomeLedger
from auction_bots.market.state import MarketState
from sim.fake_market import FakeMarket
from sim.scheduler import Scheduler

BOT = UUID(int=1)
ALICE = UUID(int=2)
BERT = UUID(int=3)


def market(seed: int = 7) -> tuple[Scheduler, FakeMarket, MarketState]:
    scheduler = Scheduler()
    registry = FleetRegistry(expected=1)
    registry.add(0, BOT)
    state = MarketState(registry.is_human, OutcomeLedger(capacity=50), scheduler.now)
    fake = FakeMarket(scheduler, state, RecentIds(), random.Random(seed), duplicate_p=0.0)
    return scheduler, fake, state


async def listed_auction(
    scheduler: Scheduler,
    fake: FakeMarket,
    token: str,
    *,
    price: int = 100,
    lifetime_s: float = 120.0,
) -> UUID:
    item = await fake.mint_item(token, "Pocket TV", Rarity.Common)
    ends = scheduler.now() + timedelta(seconds=lifetime_s)
    auction_id = await fake.create_auction(token, item, price, ends)
    await scheduler.run_until(scheduler.now() + timedelta(seconds=10))
    return auction_id


async def test_second_bid_while_pending_is_409() -> None:
    scheduler, fake, state = market()
    seller = fake.register_human(ALICE, 10_000)
    rival = fake.register_human(BERT, 10_000)
    bot = fake.register_bot(BOT, 10_000)
    auction_id = await listed_auction(scheduler, fake, seller)

    await fake.place_bid(rival, auction_id, 150)

    with pytest.raises(BidInProgress):
        await fake.place_bid(bot, auction_id, 200)


async def test_bid_confirms_three_to_nine_seconds_later() -> None:
    scheduler, fake, state = market()
    seller = fake.register_human(ALICE, 10_000)
    rival = fake.register_human(BERT, 10_000)
    auction_id = await listed_auction(scheduler, fake, seller)
    placed_at = scheduler.now()

    await fake.place_bid(rival, auction_id, 150)
    await scheduler.run_until(placed_at + timedelta(seconds=2.9))

    assert state.get(auction_id) is not None
    assert state.get(auction_id).leader_id is None

    await scheduler.run_until(placed_at + timedelta(seconds=9.1))

    view = state.get(auction_id)
    assert view is not None
    assert view.leader_id == BERT
    assert view.current_price == Decimal(150)


async def test_late_bid_extends_ends_on_by_thirty_seconds() -> None:
    scheduler, fake, state = market()
    seller = fake.register_human(ALICE, 10_000)
    rival = fake.register_human(BERT, 10_000)
    auction_id = await listed_auction(scheduler, fake, seller, lifetime_s=60.0)
    ends = fake.ends_on(auction_id)

    await scheduler.run_until(ends - timedelta(seconds=28))
    await fake.place_bid(rival, auction_id, 150)
    await scheduler.run_until(ends + timedelta(seconds=1))

    assert state.get(auction_id) is not None
    assert fake.ends_on(auction_id) == ends + timedelta(seconds=30)

    await scheduler.run_until(ends + timedelta(seconds=40))

    assert state.get(auction_id) is None


async def test_rejected_lock_cancels_without_an_event() -> None:
    scheduler, fake, state = market()
    seller = fake.register_human(ALICE, 10_000)
    broke = fake.register_human(BERT, 100)
    auction_id = await listed_auction(scheduler, fake, seller)

    await fake.place_bid(broke, auction_id, 500)
    await scheduler.run_until(scheduler.now() + timedelta(seconds=15))

    view = state.get(auction_id)
    assert view is not None
    assert view.leader_id is None
    assert view.current_price == Decimal(100)

    richer = fake.register_human(UUID(int=9), 10_000)
    await fake.place_bid(richer, auction_id, 500)


async def test_closer_finishes_and_settles_money_and_items() -> None:
    scheduler, fake, state = market()
    seller = fake.register_human(ALICE, 10_000)
    rival = fake.register_human(BERT, 10_000)
    auction_id = await listed_auction(scheduler, fake, seller, lifetime_s=60.0)
    ends = fake.ends_on(auction_id)

    await fake.place_bid(rival, auction_id, 150)
    await scheduler.run_until(ends + timedelta(seconds=5))

    assert state.get(auction_id) is None
    seller_wallet = await fake.get_wallet(seller, ALICE)
    rival_wallet = await fake.get_wallet(rival, BERT)
    assert seller_wallet.available_funds == Decimal(10_150)
    assert rival_wallet.available_funds == Decimal(9_850)
    assert rival_wallet.locked_funds == Decimal(0)
    inventory = await fake.get_inventory(rival)
    assert [item.name for item in inventory] == ["Pocket TV"]
    assert inventory[0].status == "Available"
