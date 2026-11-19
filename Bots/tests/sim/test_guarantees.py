import asyncio
import inspect
import random
import statistics
from collections.abc import Callable
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

from auction_bots.api.budget import TokenBucket
from auction_bots.api.models import Rarity
from auction_bots.config import load_settings
from auction_bots.director.controller import control_step
from auction_bots.director.knobs import Knobs
from auction_bots.feed.dedupe import RecentIds
from auction_bots.feed.events import BidPlaced
from auction_bots.fleet.agent import AuctionGate, BotAgent
from auction_bots.fleet.identity import BotSession
from auction_bots.fleet.persona import sample_persona
from auction_bots.fleet.registry import FleetRegistry
from auction_bots.market.ledger import Outcome, OutcomeLedger
from auction_bots.market.state import MarketState
from sim.fake_market import PRICE_BY_RARITY, FakeMarket
from sim.humans import CappedBuyer, Seller, SimHuman
from sim.scheduler import START, Scheduler

CONFIG = Path(__file__).resolve().parents[2] / "bots.toml"
KNOBS = Knobs.from_generosity(0.3, listing_rate=6.0)
BUY_CAP = 0.815
ROUNDING_SLACK = 1
RARITIES = (Rarity.Common, Rarity.Rare, Rarity.Epic, Rarity.Legendary)
RARITY_WEIGHTS = (60, 30, 9, 1)


def world_of(agents: int, seed: int, *, ledger_capacity: int = 500) -> SimpleNamespace:
    scheduler = Scheduler()
    settings = load_settings(CONFIG, {"BOTS_FLEET_SIZE": str(agents)})
    registry = FleetRegistry(expected=agents)
    ledger = OutcomeLedger(capacity=ledger_capacity)
    state = MarketState(registry.is_human, ledger, scheduler.now)
    fake = FakeMarket(scheduler, state, RecentIds(), random.Random(f"{seed}:market"))
    return SimpleNamespace(
        scheduler=scheduler,
        settings=settings,
        registry=registry,
        ledger=ledger,
        state=state,
        fake=fake,
        seed=seed,
    )


def build_agents(w: SimpleNamespace, api, *, saga_bucket: TokenBucket | None = None) -> None:
    def elapsed() -> float:
        return (w.scheduler.now() - START).total_seconds()

    w.gate = AuctionGate()
    bucket = saga_bucket or TokenBucket(1000.0, 1000, clock=elapsed, sleep=w.scheduler.sleep)
    w.agents = []
    w.tokens = {}
    for index in range(w.settings.fleet.size):
        persona = sample_persona(index, random.Random(w.settings.fleet.seed + index), w.settings)
        user_id = UUID(int=index + 1)
        token = w.fake.register_bot(user_id, persona.bankroll)
        w.registry.add(index, user_id)
        w.tokens[user_id] = token
        session = BotSession(
            index=index,
            user_id=user_id,
            expires_at=w.scheduler.now() + timedelta(hours=8),
            relogin_at=w.scheduler.now() + timedelta(hours=7),
            token=token,
        )

        async def relogin(s: BotSession = session) -> BotSession:
            return s

        w.agents.append(
            BotAgent(
                persona,
                session,
                api,
                w.state,
                w.registry,
                lambda: KNOBS,
                bucket,
                w.gate,
                random.Random(f"{w.seed}:{index}"),
                w.scheduler.now,
                w.scheduler.sleep,
                w.settings,
                relogin,
            )
        )


def start_fleet(w: SimpleNamespace) -> None:
    w.stop = asyncio.Event()
    w.fleet_tasks = [asyncio.ensure_future(agent.run(w.stop)) for agent in w.agents]


async def stop_fleet(w: SimpleNamespace) -> None:
    w.stop.set()
    await asyncio.gather(*w.fleet_tasks)


async def official_of(w: SimpleNamespace, auction_id: UUID) -> float:
    return float((await w.fake.get_auction(auction_id)).item_official_price)


def schedule_fleet_listings(
    w: SimpleNamespace,
    total: int,
    *,
    batch: int,
    every_s: float,
    duration_s: tuple[float, float],
    rng: random.Random,
) -> dict[UUID, Decimal]:
    officials: dict[UUID, Decimal] = {}
    created = 0

    async def wave() -> None:
        nonlocal created
        for _ in range(batch):
            if created >= total:
                return
            seller = w.agents[created % len(w.agents)]
            token = w.tokens[seller.session.user_id]
            rarity = rng.choices(RARITIES, weights=RARITY_WEIGHTS, k=1)[0]
            official = PRICE_BY_RARITY[rarity]
            item_id = await w.fake.mint_item(token, "Fleet Lot", rarity)
            start = max(1, round(float(official) * rng.uniform(0.3, 0.8)))
            ends = w.scheduler.now() + timedelta(seconds=rng.uniform(*duration_s))
            auction_id = await w.fake.create_auction(token, item_id, start, ends)
            officials[auction_id] = official
            created += 1
        if created < total:
            w.scheduler.call_at(w.scheduler.now() + timedelta(seconds=every_s), wave)

    w.scheduler.call_at(w.scheduler.now() + timedelta(seconds=every_s), wave)
    return officials


async def test_human_buyer_never_pays_above_buy_cap() -> None:
    w = world_of(100, 1118)
    build_agents(w, w.fake)
    human_id = UUID(int=10_001)
    buyer_token = w.fake.register_human(human_id, 10_000_000)
    buyer = SimHuman(
        human_id,
        buyer_token,
        CappedBuyer(BUY_CAP),
        random.Random("1118:buyer"),
        fake=w.fake,
        state=w.state,
        scheduler=w.scheduler,
    )
    officials = schedule_fleet_listings(
        w, 1000, batch=4, every_s=10.0, duration_s=(150.0, 300.0), rng=random.Random("1118:lots")
    )
    start_fleet(w)
    buyer_task = buyer.start()

    await w.scheduler.run_until(START + timedelta(seconds=3100))
    buyer_task.cancel()
    await stop_fleet(w)
    await w.scheduler.run_until(START + timedelta(seconds=4100))

    assert len(officials) == 1000
    fleet_ids = {agent.session.user_id for agent in w.agents}
    for bid in w.fake.bids:
        if bid.user_id in fleet_ids and bid.leader_before == human_id:
            cap = await official_of(w, bid.auction_id) * BUY_CAP
            assert bid.amount <= cap + ROUNDING_SLACK

    contested = sorted(buyer.auctions_bid, key=str)
    assert contested
    wins = 0
    for auction_id in contested:
        dto = await w.fake.get_auction(auction_id)
        assert dto.status == "Finished"
        if dto.current_winning_user_id == human_id:
            wins += 1
            assert float(dto.current_price) <= float(dto.item_official_price) * BUY_CAP
    assert wins * 3 >= len(contested)


async def test_human_seller_gets_at_least_official() -> None:
    w = world_of(30, 2026, ledger_capacity=2000)
    build_agents(w, w.fake)
    w.state.enable_outcomes()
    sellers = []
    for i in range(10):
        human_id = UUID(int=20_000 + i)
        token = w.fake.register_human(human_id, 100_000)
        sellers.append(
            SimHuman(
                human_id,
                token,
                Seller((0.3, 1.2), duration_min=(5.0, 10.0)),
                random.Random(f"2026:seller:{i}"),
                fake=w.fake,
                state=w.state,
                scheduler=w.scheduler,
            )
        )
    overpriced_id = UUID(int=20_900)
    overpriced = SimHuman(
        overpriced_id,
        w.fake.register_human(overpriced_id, 100_000),
        Seller((8.0, 10.0), duration_min=(5.0, 10.0)),
        random.Random("2026:overpriced"),
        fake=w.fake,
        state=w.state,
        scheduler=w.scheduler,
    )
    start_fleet(w)
    seller_tasks = [seller.start() for seller in sellers] + [overpriced.start()]

    await w.scheduler.run_until(START + timedelta(seconds=3010))
    for task in seller_tasks:
        task.cancel()
    await w.scheduler.run_until(START + timedelta(seconds=3800))
    await stop_fleet(w)

    listed = [auction_id for seller in sellers for auction_id in seller.listed]
    assert len(listed) == 500
    fleet_ids = {agent.session.user_id for agent in w.agents}
    official = PRICE_BY_RARITY[Rarity.Common]
    engaged = 0
    for auction_id in listed:
        bids = [b for b in w.fake.bids if b.auction_id == auction_id and b.user_id in fleet_ids]
        dto = await w.fake.get_auction(auction_id)
        assert dto.status == "Finished"
        if not bids:
            continue
        engaged += 1
        assert dto.current_winning_user_id in fleet_ids
        assert dto.current_price >= official
    assert engaged

    assert overpriced.listed
    outcomes = {outcome.auction_id for outcome in w.ledger.recent(2000)}
    for auction_id in overpriced.listed:
        assert not [b for b in w.fake.bids if b.auction_id == auction_id]
        assert auction_id not in outcomes


def outcome_with_margin(margin: float) -> Outcome:
    final = Decimal(str(round(1000 * (1 - margin), 3)))
    return Outcome(uuid4(), "human_bought", Decimal(1000), final, START)


def test_director_converges_within_twenty_steps() -> None:
    settings = load_settings(CONFIG, {}).director
    for start in (0.0, 1.0):
        rng = random.Random(f"7:{start}")
        generosity = start
        medians: list[float] = []
        deltas: list[float] = []
        for _ in range(25):
            outcomes = [
                outcome_with_margin(0.02 + 0.30 * generosity + rng.gauss(0, 0.02))
                for _ in range(50)
            ]
            medians.append(statistics.median(outcome.margin for outcome in outcomes))
            stepped = control_step(generosity, outcomes, settings)
            assert 0.0 <= stepped <= 1.0
            deltas.append(stepped - generosity)
            generosity = stepped
        for median in medians[20:]:
            assert abs(median - settings.target_margin) <= 0.04
        signs = [delta > 0 for delta in deltas if delta != 0.0]
        flips = sum(1 for before, after in zip(signs, signs[1:], strict=False) if before != after)
        assert flips <= 2


class MeteredMarket:
    SAGA_METHODS = frozenset({"place_bid", "create_auction", "sell_to_shop"})

    def __init__(self, fake: FakeMarket, bucket: TokenBucket, elapsed: Callable[[], float]) -> None:
        self._fake = fake
        self._bucket = bucket
        self._elapsed = elapsed
        self.requests: list[float] = []
        self.saga_requests: list[float] = []

    def __getattr__(self, name: str):
        target = getattr(self._fake, name)
        if not inspect.iscoroutinefunction(target):
            return target

        async def call(*args, **kwargs):
            await self._bucket.acquire()
            now = self._elapsed()
            self.requests.append(now)
            if name in self.SAGA_METHODS:
                self.saga_requests.append(now)
            return await target(*args, **kwargs)

        return call


def assert_window_bound(times: list[float], window_s: float, budget: int) -> None:
    upper = 0
    for lower, start in enumerate(times):
        upper = max(upper, lower)
        while upper < len(times) and times[upper] <= start + window_s:
            upper += 1
        assert upper - lower <= budget


async def test_peak_requests_stay_inside_the_gateway_limits() -> None:
    for seed in (1, 2, 3):
        await _run_peak_seed(seed)


async def _run_peak_seed(seed: int) -> None:
    w = world_of(30, seed)

    def elapsed() -> float:
        return (w.scheduler.now() - START).total_seconds()

    budget = w.settings.budget
    bucket = TokenBucket(budget.rate_per_s, budget.burst, clock=elapsed, sleep=w.scheduler.sleep)
    metered = MeteredMarket(w.fake, bucket, elapsed)
    saga_bucket = TokenBucket(
        budget.saga_rate_per_s, budget.saga_burst, clock=elapsed, sleep=w.scheduler.sleep
    )
    build_agents(w, metered, saga_bucket=saga_bucket)
    for index in range(10):
        token = w.tokens[w.agents[index].session.user_id]
        item_id = await w.fake.mint_item(token, "Epic Drop", Rarity.Epic)
        ends = w.scheduler.now() + timedelta(seconds=150)
        await w.fake.create_auction(token, item_id, 1, ends)
    coordinator_token = w.tokens[w.agents[0].session.user_id]

    def schedule_resync() -> None:
        async def resync() -> None:
            await w.state.resync(metered)
            schedule_resync()

        w.scheduler.call_at(w.scheduler.now() + timedelta(seconds=60.0), resync)

    def schedule_poll() -> None:
        async def poll() -> None:
            await metered.list_warehouses(coordinator_token, 20)
            schedule_poll()

        w.scheduler.call_at(w.scheduler.now() + timedelta(seconds=3.0), poll)

    schedule_resync()
    schedule_poll()
    start_fleet(w)

    await w.scheduler.run_until(START + timedelta(seconds=180))
    await stop_fleet(w)

    rate = budget.rate_per_s
    assert metered.requests
    assert_window_bound(metered.requests, 1.0, budget.burst + round(rate) + 1)
    assert_window_bound(metered.requests, 10.0, budget.burst + round(rate * 10) + 1)
    assert_window_bound(metered.requests, 60.0, budget.burst + round(rate * 60) + 1)
    assert_window_bound(metered.saga_requests, 60.0, 35)


async def test_fleet_never_bids_on_its_own_auctions() -> None:
    w = world_of(20, 99)
    build_agents(w, w.fake)
    attempts: list[UUID] = []
    original = w.fake.place_bid

    async def recording(token: str, auction_id: UUID, amount: int) -> None:
        attempts.append(auction_id)
        await original(token, auction_id, amount)

    w.fake.place_bid = recording
    ghost = uuid4()
    w.state.apply(
        BidPlaced(
            event_id=uuid4(),
            public_auction_id=ghost,
            new_winning_user_id=uuid4(),
            new_price=Decimal(50),
        )
    )
    stop = asyncio.Event()
    tasks = [asyncio.ensure_future(agent.run(stop)) for agent in w.agents]

    await w.scheduler.run_until(START + timedelta(seconds=900))
    stop.set()
    await asyncio.gather(*tasks)

    assert w.fake.bids
    for bid in w.fake.bids:
        dto = await w.fake.get_auction(bid.auction_id)
        assert dto.seller_user_id != bid.user_id
    messages = [error.message for error in w.fake.errors]
    assert not [m for m in messages if "own auction" in m or "highest bidder" in m]
    assert ghost not in attempts
