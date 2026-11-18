import random
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID

from sim.fake_market import FakeMarket
from sim.scheduler import Scheduler

from auction_bots.api.budget import TokenBucket
from auction_bots.api.client import ApiError
from auction_bots.api.models import Rarity
from auction_bots.config import load_settings
from auction_bots.director.controller import Director
from auction_bots.feed.dedupe import RecentIds
from auction_bots.fleet.archetypes import ArchetypeName
from auction_bots.fleet.identity import BotSession
from auction_bots.fleet.persona import Persona
from auction_bots.fleet.registry import FleetRegistry
from auction_bots.market.ledger import OutcomeLedger
from auction_bots.market.state import MarketState
from auction_bots.warehouses.watcher import WarehouseWatcher, WarState

SETTINGS = load_settings(Path(__file__).resolve().parents[2] / "bots.toml", {})
HUMAN = UUID(int=99)


def persona_of(index: int) -> Persona:
    return Persona(
        index=index,
        archetype=ArchetypeName.Flipper,
        multiplier_range=(0.55, 0.95),
        bankroll=10_000,
        step_range=(0.03, 0.08),
        reaction_delay_s=5.0,
        tick_s=30.0,
        activity=1.0,
        rarity_taste={rarity: 1.0 for rarity in Rarity},
        favourite_rarities=frozenset(),
        name_taste=(),
        yield_bias=0.0,
        max_open_bids=2,
        max_listings=3,
        single_bid=False,
        bot_war_cap=0.6,
        list_batch=(1, 1),
        first_name="Kevin",
        surname="Mercer",
    )


def env(bot_count: int = 3) -> SimpleNamespace:
    scheduler = Scheduler()
    bot_ids = [UUID(int=i + 1) for i in range(bot_count)]
    registry = FleetRegistry(expected=bot_count)
    for index, bot_id in enumerate(bot_ids):
        registry.add(index, bot_id)
    ledger = OutcomeLedger(capacity=50)
    state = MarketState(registry.is_human, ledger, scheduler.now)
    fake = FakeMarket(scheduler, state, RecentIds(), random.Random(3), duplicate_p=0.0)
    tokens = {bot_id: fake.register_bot(bot_id, 10_000) for bot_id in bot_ids}
    human = fake.register_human(HUMAN, 10_000)
    agents = {}
    for index, bot_id in enumerate(bot_ids):
        session = BotSession(
            index=index,
            user_id=bot_id,
            expires_at=scheduler.now() + timedelta(hours=8),
            relogin_at=scheduler.now() + timedelta(hours=7),
            token=tokens[bot_id],
        )
        agents[bot_id] = SimpleNamespace(
            persona=persona_of(index),
            session=session,
            wallet_hint=lambda: Decimal(10_000),
        )
    director = Director(ledger, state, TokenBucket(0.5, 5), SETTINGS, scheduler.now)
    watcher = WarehouseWatcher(
        fake,
        agents,
        lambda: agents[bot_ids[0]].session,
        director,
        ledger,
        registry,
        SETTINGS,
        random.Random(9),
        scheduler.now,
    )
    return SimpleNamespace(
        scheduler=scheduler,
        fake=fake,
        ledger=ledger,
        watcher=watcher,
        bot_ids=bot_ids,
        tokens=tokens,
        human=human,
    )


async def run_for(e: SimpleNamespace, seconds: float) -> None:
    await e.scheduler.run_until(e.scheduler.now() + timedelta(seconds=seconds))


async def bidding_war(e: SimpleNamespace, prices: list[int]) -> UUID:
    warehouse_id = e.fake.open_warehouse(prices=prices)
    await e.fake.join_warehouse(e.human, warehouse_id)
    for bot_id in e.bot_ids[:2]:
        await e.fake.join_warehouse(e.tokens[bot_id], warehouse_id)
    await run_for(e, 32.0)
    e.watcher.wars[warehouse_id] = WarState(members=set(e.bot_ids[:2]))
    return warehouse_id


async def test_human_lobby_is_filled_within_ten_seconds() -> None:
    e = env()
    warehouse_id = e.fake.open_warehouse(prices=[400])
    await e.fake.join_warehouse(e.human, warehouse_id)
    await run_for(e, 4.0)

    await e.watcher.poll_once()

    assert 3 <= e.fake.war_players(warehouse_id) <= 4


async def test_full_lobby_gets_no_more_bots() -> None:
    e = env()
    warehouse_id = e.fake.open_warehouse(prices=[400])
    crowd = [e.fake.register_human(UUID(int=200 + i), 10_000) for i in range(5)]
    for token in crowd:
        await e.fake.join_warehouse(token, warehouse_id)
    await run_for(e, 4.0)

    await e.watcher.poll_once()

    assert e.fake.war_players(warehouse_id) == 5
    assert e.watcher.wars[warehouse_id].members == set()


async def test_unattributed_price_change_means_a_human_leads() -> None:
    e = env()
    warehouse_id = await bidding_war(e, prices=[20])

    await e.fake.raise_warehouse(e.human, warehouse_id, 10)
    await e.watcher.poll_once()

    war = e.watcher.wars[warehouse_id]
    assert war.human_leads is True
    assert war.human_raises == 1


async def test_own_pending_joins_count_as_fleet_seats() -> None:
    e = env(bot_count=4)
    warehouse_id = e.fake.open_warehouse(prices=[400])
    await e.fake.join_warehouse(e.human, warehouse_id)
    await run_for(e, 4.0)

    await e.watcher.poll_once()

    members = e.watcher.wars[warehouse_id].members
    states = e.fake.participant_states(warehouse_id)
    assert 2 <= len(members) <= 3
    assert all(states[member] == "Pending" for member in members)
    assert e.fake.war_players(warehouse_id) == 1 + len(members)


async def test_detail_is_reread_before_each_raise() -> None:
    e = env()
    warehouse_id = e.fake.open_warehouse(prices=[400])
    for bot_id in e.bot_ids:
        await e.fake.join_warehouse(e.tokens[bot_id], warehouse_id)
    await run_for(e, 32.0)
    war = WarState(members=set(e.bot_ids))
    war.bot_war_target = Decimal(150)
    e.watcher.wars[warehouse_id] = war
    details: list[str] = []
    original = e.fake.get_warehouse

    async def counting(token: str, wid: UUID):
        details.append(token)
        return await original(token, wid)

    e.fake.get_warehouse = counting

    for _ in range(4):
        await e.watcher.poll_once()
        await run_for(e, 1.0)

    assert len(e.fake.raises) >= 2
    assert len(details) >= len(e.fake.raises)


async def test_raise_against_a_human_stays_under_the_decoded_cap() -> None:
    e = env()
    warehouse_id = await bidding_war(e, prices=[400])
    await e.fake.raise_warehouse(e.human, warehouse_id, 100)

    for _ in range(8):
        await e.watcher.poll_once()
        await run_for(e, 1.0)
        try:
            await e.fake.raise_warehouse(e.human, warehouse_id, 10)
        except ApiError:
            pass
        await run_for(e, 1.0)

    bot_raises = [record for record in e.fake.raises if record.user_id != HUMAN]
    assert bot_raises
    assert all(record.price_after <= Decimal("326.0") for record in bot_raises)


async def test_settled_war_won_by_a_human_records_an_outcome() -> None:
    e = env()
    warehouse_id = await bidding_war(e, prices=[20])
    await e.fake.raise_warehouse(e.human, warehouse_id, 10)

    for _ in range(4):
        await e.watcher.poll_once()
        await run_for(e, 1.0)
    await run_for(e, 12.0)
    await e.watcher.poll_once()

    outcomes = e.ledger.recent(5)
    assert len(outcomes) == 1
    assert outcomes[0].side == "human_won_war"
    assert outcomes[0].official_price == Decimal(20)
    assert outcomes[0].final_price == Decimal(10)


async def test_only_one_bot_only_war_runs_at_a_time() -> None:
    e = env(bot_count=4)
    first = e.fake.open_warehouse(prices=[400])
    second = e.fake.open_warehouse(prices=[400])

    await e.watcher.poll_once()

    assert len(e.fake.participant_states(first)) == 3
    assert e.fake.participant_states(second) == {}
