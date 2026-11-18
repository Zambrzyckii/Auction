import asyncio
import random
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from sim.fake_market import FakeMarket
from sim.scheduler import Scheduler

from auction_bots.api.client import ClientStats
from auction_bots.app import FleetSummary, run, summary_line
from auction_bots.config import Settings, load_settings
from auction_bots.director.knobs import Knobs
from auction_bots.feed.dedupe import RecentIds
from auction_bots.fleet.identity import derive_identity
from auction_bots.fleet.persona import sample_persona
from auction_bots.market.ledger import Outcome, OutcomeLedger
from auction_bots.market.state import MarketState

CONFIG = Path(__file__).resolve().parents[2] / "bots.toml"
AT = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
SUMMARY_KEYS = {
    "logged_in",
    "topups",
    "paid_to_humans",
    "received_from_humans",
    "active_listings",
    "pending_listings",
    "bids_per_min",
    "rate_limited",
    "conflicts",
    "saga_p50_s",
    "knobs",
}


def settings_of() -> Settings:
    base = load_settings(CONFIG, {"BOTS_FLEET_SIZE": "10"})
    fleet = base.fleet.model_copy(update={"startup_ramp_s": 0.2})
    return base.model_copy(update={"fleet": fleet})


def fake_market() -> FakeMarket:
    scheduler = Scheduler()
    state = MarketState(lambda user_id: True, OutcomeLedger(), scheduler.now)
    return FakeMarket(scheduler, state, RecentIds(), random.Random(1), duplicate_p=0.0)


class FakeConsumer:
    def __init__(self) -> None:
        self.started = False

    async def run(self, stop: asyncio.Event) -> None:
        self.started = True
        await stop.wait()


async def test_fleet_of_ten_starts_against_the_fake_market() -> None:
    fake = fake_market()
    consumer = FakeConsumer()
    stop = asyncio.Event()

    task = asyncio.ensure_future(
        run(settings_of(), "test-api-key", "amqp-pw", api=fake, consumer=consumer, stop=stop)
    )
    await asyncio.sleep(0.3)
    stop.set()
    await asyncio.wait_for(task, timeout=5.0)

    assert fake.user_count() == 10
    assert consumer.started


def test_summary_line_has_every_counter() -> None:
    state = MarketState(lambda user_id: True, OutcomeLedger(), lambda: AT)
    ledger = OutcomeLedger()
    ledger.record(Outcome(uuid4(), "human_sold", Decimal(100), Decimal(120), AT))
    ledger.record(Outcome(uuid4(), "human_bought", Decimal(100), Decimal(80), AT))
    fleet = FleetSummary(
        logged_in=10, topups=500, pending_listings=2, bids_per_min=3.0, saga_p50_s=5.5
    )

    line = summary_line(
        ClientStats(), ledger, state, Knobs.from_generosity(0.3, listing_rate=6.0), fleet
    )

    assert set(line) == SUMMARY_KEYS
    assert line["paid_to_humans"] == 120
    assert line["received_from_humans"] == 80


async def test_stop_event_ends_every_loop() -> None:
    fake = fake_market()
    stop = asyncio.Event()

    task = asyncio.ensure_future(
        run(settings_of(), "test-api-key", "amqp-pw", api=fake, consumer=FakeConsumer(), stop=stop)
    )
    await asyncio.sleep(0.5)
    stop.set()

    await asyncio.wait_for(task, timeout=5.0)


async def test_skipped_bot_does_not_block_the_start() -> None:
    settings = settings_of()
    fake = fake_market()
    persona = sample_persona(3, random.Random(settings.fleet.seed + 3), settings)
    identity = derive_identity(3, "test-api-key", persona, birthday=settings.persona.birthday)
    await fake.provision_bot(
        "other-key",
        {
            "email": "someone@else.local",
            "password": "Xx1!xxxxxxxxxxxxxxxx",
            "username": identity.username,
            "name": "Someone",
            "surname": "Else",
            "birthday": "1990-01-01",
        },
    )
    stop = asyncio.Event()

    task = asyncio.ensure_future(
        run(settings, "test-api-key", "amqp-pw", api=fake, consumer=FakeConsumer(), stop=stop)
    )
    await asyncio.sleep(0.3)
    stop.set()
    await asyncio.wait_for(task, timeout=5.0)

    assert fake.user_count() == 10
