from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from auction_bots.feed.events import AuctionFinished
from auction_bots.market.ledger import Outcome, OutcomeLedger, outcome_of
from auction_bots.market.state import AuctionView

NOW = datetime(2026, 11, 18, 12, 0, 0, tzinfo=UTC)

BOT = UUID("00000000-0000-0000-0000-00000000b001")
HUMAN = UUID("00000000-0000-0000-0000-0000000000a1")
OTHER_HUMAN = UUID("00000000-0000-0000-0000-0000000000a2")

FLEET = {BOT}


def is_human(user_id: UUID | None) -> bool:
    return user_id is not None and user_id not in FLEET


def view_of(auction_id: UUID, seller: UUID, official: int | None) -> AuctionView:
    return AuctionView(
        auction_id=auction_id,
        seller_id=seller,
        leader_id=None,
        current_price=Decimal(10),
        official_price=None if official is None else Decimal(official),
        rarity=None,
        item_name=None,
        ends_on=None,
    )


def finished(
    auction_id: UUID, seller: UUID, winner: UUID | None, final: int | None
) -> AuctionFinished:
    return AuctionFinished(
        event_id=uuid4(),
        public_auction_id=auction_id,
        seller_user_id=seller,
        winner_user_id=winner,
        final_price=None if final is None else Decimal(final),
    )


def test_human_buyer_margin() -> None:
    auction_id = uuid4()

    outcome = outcome_of(
        view_of(auction_id, BOT, 100), finished(auction_id, BOT, HUMAN, 80), is_human, NOW
    )

    assert outcome is not None
    assert outcome.side == "human_bought"
    assert outcome.margin == pytest.approx(0.2)


def test_human_seller_margin() -> None:
    auction_id = uuid4()

    outcome = outcome_of(
        view_of(auction_id, HUMAN, 100), finished(auction_id, HUMAN, BOT, 118), is_human, NOW
    )

    assert outcome is not None
    assert outcome.side == "human_sold"
    assert outcome.margin == pytest.approx(0.18)


def test_human_versus_human_outcome_is_ignored() -> None:
    auction_id = uuid4()

    outcome = outcome_of(
        view_of(auction_id, HUMAN, 100),
        finished(auction_id, HUMAN, OTHER_HUMAN, 150),
        is_human,
        NOW,
    )

    assert outcome is None


def test_unsold_human_listing_is_not_an_outcome() -> None:
    auction_id = uuid4()

    outcome = outcome_of(
        view_of(auction_id, HUMAN, 100), finished(auction_id, HUMAN, None, None), is_human, NOW
    )

    assert outcome is None


def test_unknown_official_price_gives_no_outcome() -> None:
    auction_id = uuid4()

    outcome = outcome_of(
        view_of(auction_id, BOT, None), finished(auction_id, BOT, HUMAN, 80), is_human, NOW
    )

    assert outcome is None


def test_recent_returns_newest_last_within_capacity() -> None:
    ledger = OutcomeLedger(capacity=3)
    for price in (10, 20, 30, 40):
        ledger.record(
            Outcome(
                auction_id=uuid4(),
                side="human_bought",
                official_price=Decimal(100),
                final_price=Decimal(price),
                at=NOW,
            )
        )

    outcomes = ledger.recent(10)

    assert len(outcomes) == 3
    assert [o.final_price for o in outcomes] == [Decimal(20), Decimal(30), Decimal(40)]
