from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import pytest

from auction_bots.api.budget import TokenBucket
from auction_bots.api.models import AuctionDto
from auction_bots.config import load_settings
from auction_bots.director.controller import Director, control_step, liveness_step, saga_rate_step
from auction_bots.fleet.registry import FleetRegistry
from auction_bots.market.ledger import Outcome, OutcomeLedger
from auction_bots.market.state import MarketState

SETTINGS = load_settings(Path(__file__).resolve().parents[2] / "bots.toml", {})
AT = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
BOT = UUID(int=1)


def outcome(margin: float) -> Outcome:
    official = Decimal(1000)
    final = Decimal(round(1000 * (1 - margin)))
    return Outcome(uuid4(), "human_bought", official, final, AT)


def test_fewer_than_five_outcomes_keep_generosity() -> None:
    outcomes = [outcome(0.5) for _ in range(4)]

    assert control_step(0.3, outcomes, SETTINGS.director) == 0.3


def test_dead_zone_holds_generosity() -> None:
    outcomes = [outcome(0.17) for _ in range(9)]

    assert control_step(0.3, outcomes, SETTINGS.director) == 0.3


def test_low_margin_raises_generosity() -> None:
    outcomes = [outcome(0.05) for _ in range(9)]

    assert control_step(0.3, outcomes, SETTINGS.director) == pytest.approx(0.35)


def test_high_margin_lowers_generosity() -> None:
    outcomes = [outcome(0.40) for _ in range(9)]

    result = control_step(0.3, outcomes, SETTINGS.director)

    assert result == pytest.approx(0.175)
    assert result < 0.3


def test_generosity_is_clipped_to_the_unit_interval() -> None:
    starving = [outcome(-1.0) for _ in range(9)]
    feasting = [outcome(1.0) for _ in range(9)]

    assert control_step(0.95, starving, SETTINGS.director) == 1.0
    assert control_step(0.02, feasting, SETTINGS.director) == 0.0


def test_only_the_last_fifty_outcomes_count() -> None:
    outcomes = [outcome(1.0) for _ in range(50)] + [outcome(0.15) for _ in range(50)]

    assert control_step(0.3, outcomes, SETTINGS.director) == 0.3


def test_listing_rate_moves_a_quarter_within_bounds() -> None:
    listing = SETTINGS.listing

    assert liveness_step(6.0, 10, listing) == 7.5
    assert liveness_step(6.0, 40, listing) == 4.5
    assert liveness_step(6.0, 25, listing) == 6.0
    assert liveness_step(9.0, 10, listing) == 10.0
    assert liveness_step(1.2, 40, listing) == 1.0


async def test_pending_listings_count_as_live() -> None:
    registry = FleetRegistry(expected=1)
    registry.add(0, BOT)
    ledger = OutcomeLedger(capacity=50)
    state = MarketState(registry.is_human, ledger, lambda: AT)

    def dto(status: str) -> AuctionDto:
        return AuctionDto(
            public_auction_id=uuid4(),
            seller_user_id=BOT,
            status=status,
            current_price=Decimal(100),
            ends_on=AT + timedelta(minutes=5),
        )

    class StubApi:
        async def list_auctions(self, limit: int) -> list[AuctionDto]:
            return [dto("Active"), dto("Pending")]

    await state.resync(StubApi())
    director = Director(ledger, state, TokenBucket(0.5, 5), SETTINGS, lambda: AT)

    assert director.live_listings() == 2


def test_slow_sagas_halve_the_saga_rate() -> None:
    assert saga_rate_step(0.5, 13.0, SETTINGS.budget) == 0.25


def test_fast_sagas_restore_the_saga_rate() -> None:
    assert saga_rate_step(0.25, 8.0, SETTINGS.budget) == 0.5
    assert saga_rate_step(0.25, 10.0, SETTINGS.budget) == 0.25
    assert saga_rate_step(0.25, None, SETTINGS.budget) == 0.25
