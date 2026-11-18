from datetime import UTC, datetime
from decimal import Decimal

from auction_bots.api.models import Rarity
from auction_bots.feed.events import AuctionActivated, AuctionFinished, parse_event

ACTIVATED_BODY = b"""{
    "EventId": "0b9fdfcb-4b2e-4a3e-9a07-6d2b8a1b1a01",
    "PublicAuctionId": "3f1c7a6e-91d4-4a3f-8b1a-2e5d9c0f4b02",
    "SellerUserId": "9a2b4c6d-8e0f-4a1b-9c3d-5e7f90123b03",
    "PublicItemId": "1c3e5a7b-9d0f-4b2a-8c4e-6f8012345b04",
    "ItemName": "Scratched Walkman",
    "ItemRarity": "Common",
    "ItemOfficialPrice": 57.10,
    "CurrentPrice": 25,
    "EndsOn": "2026-11-18T12:00:00.1234567Z"
}"""


def test_activated_event_parses_the_pascal_case_body() -> None:
    event = parse_event("AuctionActivatedEvent", ACTIVATED_BODY)

    assert isinstance(event, AuctionActivated)
    assert event.item_rarity is Rarity.Common
    assert event.item_official_price == Decimal("57.1")
    assert event.ends_on.tzinfo is not None
    assert event.ends_on.astimezone(UTC).replace(microsecond=0) == datetime(
        2026, 11, 18, 12, 0, 0, tzinfo=UTC
    )


def test_finished_event_without_winner_parses_nulls() -> None:
    body = b"""{
        "EventId": "0b9fdfcb-4b2e-4a3e-9a07-6d2b8a1b1a05",
        "PublicAuctionId": "3f1c7a6e-91d4-4a3f-8b1a-2e5d9c0f4b02",
        "SellerUserId": "9a2b4c6d-8e0f-4a1b-9c3d-5e7f90123b03",
        "WinnerUserId": null,
        "FinalPrice": null
    }"""

    event = parse_event("AuctionFinishedEvent", body)

    assert isinstance(event, AuctionFinished)
    assert event.winner_user_id is None
    assert event.final_price is None


def test_unknown_type_returns_none() -> None:
    body = b'{"EventId": "0b9fdfcb-4b2e-4a3e-9a07-6d2b8a1b1a06"}'

    assert parse_event("UserRegisteredEvent", body) is None


def test_naive_ends_on_is_read_as_utc() -> None:
    body = ACTIVATED_BODY.replace(b"2026-11-18T12:00:00.1234567Z", b"2026-11-18T12:00:00")

    event = parse_event("AuctionActivatedEvent", body)

    assert isinstance(event, AuctionActivated)
    assert event.ends_on == datetime(2026, 11, 18, 12, 0, 0, tzinfo=UTC)
