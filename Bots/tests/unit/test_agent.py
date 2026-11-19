import asyncio
import random
from dataclasses import replace
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

from sim.fake_market import BidRecord, FakeMarket
from sim.scheduler import START, Scheduler

from auction_bots.api.budget import TokenBucket
from auction_bots.api.client import (
    ApiUnavailable,
    BadRequest,
    Conflict,
    Forbidden,
    NotFound,
    RateLimited,
)
from auction_bots.api.models import Rarity
from auction_bots.config import load_settings
from auction_bots.director.knobs import Knobs
from auction_bots.feed.dedupe import RecentIds
from auction_bots.feed.events import BidPlaced
from auction_bots.fleet.agent import AuctionGate, BotAgent
from auction_bots.fleet.archetypes import ArchetypeName
from auction_bots.fleet.identity import BotSession
from auction_bots.fleet.persona import Persona
from auction_bots.fleet.registry import FleetRegistry
from auction_bots.market.ledger import OutcomeLedger
from auction_bots.market.state import MarketChange, MarketState

KNOBS = Knobs.from_generosity(0.3, listing_rate=6.0)
SETTINGS = load_settings(
    Path(__file__).resolve().parents[2] / "bots.toml", {"BOTS_FLEET_SIZE": "1"}
)
BOT = UUID(int=1)
MATE = UUID(int=2)
ALICE = UUID(int=3)


def persona_of(
    *,
    reaction_delay_s: float = 5.0,
    tick_s: float = 30.0,
    multiplier_range: tuple[float, float] = (1.6, 2.0),
    bankroll: int = 10_000,
) -> Persona:
    return Persona(
        index=0,
        archetype=ArchetypeName.Collector,
        multiplier_range=multiplier_range,
        bankroll=bankroll,
        step_range=(0.03, 0.08),
        reaction_delay_s=reaction_delay_s,
        tick_s=tick_s,
        activity=1.0,
        rarity_taste={rarity: 1.0 for rarity in Rarity},
        favourite_rarities=frozenset(),
        name_taste=(),
        yield_bias=0.0,
        max_open_bids=4,
        max_listings=6,
        single_bid=False,
        bot_war_cap=0.6,
        list_batch=(1, 1),
        first_name="Kevin",
        surname="Mercer",
    )


def session_of(user_id: UUID, token: str, scheduler: Scheduler) -> BotSession:
    return BotSession(
        index=0,
        user_id=user_id,
        expires_at=scheduler.now() + timedelta(hours=8),
        relogin_at=scheduler.now() + timedelta(hours=7),
        token=token,
    )


def harness(persona: Persona | None = None, *, funds: int = 10_000) -> SimpleNamespace:
    scheduler = Scheduler()
    registry = FleetRegistry(expected=2)
    registry.add(0, BOT)
    registry.add(1, MATE)
    state = MarketState(registry.is_human, OutcomeLedger(capacity=50), scheduler.now)
    fake = FakeMarket(scheduler, state, RecentIds(), random.Random(7), duplicate_p=0.0)
    token = fake.register_bot(BOT, funds)
    session = session_of(BOT, token, scheduler)
    gate = AuctionGate()
    bucket = TokenBucket(
        1000.0, 1000, clock=lambda: (scheduler.now() - START).total_seconds(), sleep=scheduler.sleep
    )

    async def relogin() -> BotSession:
        return session

    agent = BotAgent(
        persona or persona_of(),
        session,
        fake,
        state,
        registry,
        lambda: KNOBS,
        bucket,
        gate,
        random.Random(11),
        scheduler.now,
        scheduler.sleep,
        SETTINGS,
        relogin,
    )
    return SimpleNamespace(
        scheduler=scheduler,
        registry=registry,
        state=state,
        fake=fake,
        token=token,
        session=session,
        gate=gate,
        bucket=bucket,
        agent=agent,
    )


async def listed(
    h: SimpleNamespace,
    token: str,
    *,
    rarity: Rarity = Rarity.Epic,
    price: int = 100,
    lifetime_s: float = 600.0,
) -> UUID:
    item = await h.fake.mint_item(token, "Pocket TV", rarity)
    ends = h.scheduler.now() + timedelta(seconds=lifetime_s)
    auction_id = await h.fake.create_auction(token, item, price, ends)
    await h.scheduler.run_until(h.scheduler.now() + timedelta(seconds=10))
    return auction_id


async def run_for(h: SimpleNamespace, seconds: float) -> None:
    await h.scheduler.run_until(h.scheduler.now() + timedelta(seconds=seconds))


def fleet_bids(h: SimpleNamespace) -> list[BidRecord]:
    return [bid for bid in h.fake.bids if bid.user_id in (BOT, MATE)]


async def test_bid_in_progress_is_not_retried_until_the_next_event() -> None:
    h = harness(persona_of(reaction_delay_s=1.0))
    seller = h.fake.register_human(ALICE, 10_000)
    auction_id = await listed(h, seller)

    first = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "activated")))
    await run_for(h, 1.5)

    assert len(fleet_bids(h)) == 1

    second = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "bid")))
    await run_for(h, 1.5)

    assert len(fleet_bids(h)) == 1
    await asyncio.gather(first, second)


async def test_decision_uses_the_view_after_the_reaction_delay() -> None:
    h = harness(persona_of(reaction_delay_s=10.0))
    seller = h.fake.register_human(ALICE, 10_000)
    mate = h.fake.register_bot(MATE, 10_000)
    auction_id = await listed(h, seller)

    task = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "activated")))
    await run_for(h, 0.5)
    await h.fake.place_bid(mate, auction_id, 1100)
    await run_for(h, 11.0)
    await task

    own = [bid for bid in h.fake.bids if bid.user_id == BOT]
    assert own
    assert own[-1].amount > 1100


async def test_agent_survives_every_api_error() -> None:
    errors = [
        BadRequest(400, "bad request"),
        Forbidden(403, "forbidden"),
        NotFound(404, "not found"),
        Conflict(409, "conflict"),
        RateLimited(429, "slow down"),
        ApiUnavailable(503, "down"),
    ]
    for error in errors:
        h = harness(persona_of(reaction_delay_s=1.0))
        seller = h.fake.register_human(ALICE, 10_000)
        auction_id = await listed(h, seller)

        async def failing(token: str, auction_id: UUID, amount: int, _error=error) -> None:
            raise _error

        h.fake.place_bid = failing
        task = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "activated")))
        await run_for(h, 5.0)

        assert task.done()
        assert task.exception() is None
        assert h.agent.open_bids == {}
        assert h.gate.try_claim(auction_id, h.scheduler.now())


async def test_open_bid_expires_after_seventy_seconds() -> None:
    h = harness(persona_of(reaction_delay_s=1.0))
    seller = h.fake.register_human(ALICE, 10_000)
    auction_id = await listed(h, seller)

    async def swallowing(token: str, auction_id: UUID, amount: int) -> None:
        h.fake.bids.append(BidRecord(auction_id, BOT, amount, h.scheduler.now()))

    h.fake.place_bid = swallowing
    task = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "activated")))
    await run_for(h, 5.0)
    await task

    assert auction_id in h.agent.open_bids

    await run_for(h, 75.0)
    await h.agent.tick()

    assert h.agent.open_bids == {}
    assert h.gate.try_claim(auction_id, h.scheduler.now())


async def test_agent_waits_for_its_lock_release_before_rebidding() -> None:
    h = harness(persona_of(reaction_delay_s=10.0))
    seller = h.fake.register_human(ALICE, 10_000)
    mate = h.fake.register_bot(MATE, 10_000)
    auction_id = await listed(h, seller)

    first = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "activated")))
    await run_for(h, 20.0)
    confirm = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "bid")))
    await run_for(h, 11.0)
    await asyncio.gather(first, confirm)

    assert len([bid for bid in h.fake.bids if bid.user_id == BOT]) == 1
    assert h.agent.open_bids[auction_id].confirmed
    assert len(h.agent.saga_latencies) == 1

    await h.fake.place_bid(mate, auction_id, 1100)
    await run_for(h, 10.0)
    rebid = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "bid")))
    await run_for(h, 11.0)
    await rebid

    own = [bid for bid in h.fake.bids if bid.user_id == BOT]
    assert len(own) == 2
    assert own[-1].amount > 1100


async def test_wallet_top_up_below_thirty_percent_at_most_every_five_minutes() -> None:
    h = harness(persona_of(), funds=2_000)
    topups: list[int] = []
    original = h.fake.add_funds

    async def counting(token: str, amount: int) -> None:
        topups.append(amount)
        await original(token, amount)

    h.fake.add_funds = counting

    await h.agent.tick()

    assert topups == [8_000]

    h.fake.set_available(BOT, Decimal(2_000))
    await run_for(h, 60.0)
    await h.agent.tick()

    assert topups == [8_000]

    await run_for(h, 250.0)
    await h.agent.tick()

    assert topups == [8_000, 8_000]


async def test_one_fleet_request_in_flight_per_auction() -> None:
    h = harness(persona_of(reaction_delay_s=5.0))
    seller = h.fake.register_human(ALICE, 10_000)
    mate_token = h.fake.register_bot(MATE, 10_000)
    mate_agent = BotAgent(
        persona_of(reaction_delay_s=5.0),
        session_of(MATE, mate_token, h.scheduler),
        h.fake,
        h.state,
        h.registry,
        lambda: KNOBS,
        h.bucket,
        h.gate,
        random.Random(12),
        h.scheduler.now,
        h.scheduler.sleep,
        SETTINGS,
        h.agent._relogin,
    )
    auction_id = await listed(h, seller)

    change = MarketChange(auction_id, "activated")
    tasks = [
        asyncio.ensure_future(h.agent.react(change)),
        asyncio.ensure_future(mate_agent.react(change)),
    ]
    await run_for(h, 7.0)
    await asyncio.gather(*tasks)

    assert len(fleet_bids(h)) == 1


async def test_reauthenticates_once_after_401() -> None:
    h = harness(persona_of(reaction_delay_s=1.0))
    seller = h.fake.register_human(ALICE, 10_000)
    auction_id = await listed(h, seller)
    relogin_calls: list[int] = []

    async def relogin() -> BotSession:
        relogin_calls.append(1)
        return h.session

    h.agent._relogin = relogin
    h.agent._session = session_of(BOT, "stale-token", h.scheduler)

    task = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "activated")))
    await run_for(h, 5.0)
    await task

    assert relogin_calls == [1]
    assert len(fleet_bids(h)) == 1


async def test_agent_does_not_bid_without_an_official_price() -> None:
    h = harness(persona_of(reaction_delay_s=1.0))
    auction_id = uuid4()
    h.state.apply(
        BidPlaced(
            event_id=uuid4(),
            public_auction_id=auction_id,
            new_winning_user_id=ALICE,
            new_price=Decimal(500),
        )
    )

    task = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "bid")))
    await run_for(h, 3.0)

    assert task.done()
    assert task.exception() is None
    assert fleet_bids(h) == []


async def test_tick_lists_only_available_items() -> None:
    h = harness(persona_of())
    fresh = await h.fake.mint_item(h.token, "Chipped Pager", Rarity.Epic)
    busy = await h.fake.mint_item(h.token, "Scratched Tape Player", Rarity.Epic)
    ends = h.scheduler.now() + timedelta(seconds=600)
    await h.fake.create_auction(h.token, busy, 300, ends)

    await h.agent.tick()

    mine = await h.fake.my_auctions(h.token)
    assert len(mine) == 2
    inventory = {item.public_item_id: item.status for item in await h.fake.get_inventory(h.token)}
    assert inventory[fresh] == "LockedForAuction"
    assert inventory[busy] == "LockedForAuction"


async def two_listings(h: SimpleNamespace, seller: str) -> tuple[UUID, UUID]:
    ends = h.scheduler.now() + timedelta(seconds=600)
    first_item = await h.fake.mint_item(seller, "Pocket TV", Rarity.Epic)
    second_item = await h.fake.mint_item(seller, "Chipped Pager", Rarity.Epic)
    first = await h.fake.create_auction(seller, first_item, 100, ends)
    second = await h.fake.create_auction(seller, second_item, 100, ends)
    return first, second


async def test_reactions_to_different_auctions_overlap() -> None:
    h = harness(persona_of(reaction_delay_s=10.0))
    seller = h.fake.register_human(ALICE, 10_000)
    stop = asyncio.Event()
    task = asyncio.ensure_future(h.agent.run(stop))
    await two_listings(h, seller)

    await run_for(h, 21.0)

    assert len(fleet_bids(h)) == 2
    stop.set()
    await task


async def test_concurrent_reactions_respect_max_open_bids() -> None:
    persona = replace(persona_of(reaction_delay_s=10.0), max_open_bids=1)
    h = harness(persona)
    seller = h.fake.register_human(ALICE, 10_000)
    original = h.fake.place_bid

    async def slow(token: str, auction_id: UUID, amount: int) -> None:
        await h.scheduler.sleep(5.0)
        await original(token, auction_id, amount)

    h.fake.place_bid = slow
    stop = asyncio.Event()
    task = asyncio.ensure_future(h.agent.run(stop))
    await two_listings(h, seller)

    await run_for(h, 30.0)

    assert len(fleet_bids(h)) == 1
    stop.set()
    await task


async def test_saga_latency_counts_from_the_confirmation_event() -> None:
    h = harness(persona_of(reaction_delay_s=20.0))
    seller = h.fake.register_human(ALICE, 10_000)
    auction_id = await listed(h, seller)
    reported: list[float] = []
    h.agent._on_saga_latency = reported.append

    first = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "activated")))
    await run_for(h, 30.0)
    confirm = asyncio.ensure_future(h.agent.react(MarketChange(auction_id, "bid")))
    await run_for(h, 21.0)
    await asyncio.gather(first, confirm)

    assert h.agent.saga_latencies == reported
    assert len(reported) == 1
    assert 3.0 <= reported[0] <= 9.0
