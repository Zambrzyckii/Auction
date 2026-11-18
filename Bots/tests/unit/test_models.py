from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from auction_bots.api.models import AuctionDto, Rarity, WarehouseDetailsDto

AUCTION_JSON = b"""{
    "publicAuctionId": "3f1c7a6e-91d4-4a3f-8b1a-2e5d9c0f4b02",
    "sellerUserId": "9a2b4c6d-8e0f-4a1b-9c3d-5e7f90123b03",
    "currentWinningUserId": null,
    "status": "Active",
    "currentPrice": 120,
    "endsOn": "2026-11-18T12:30:00Z",
    "itemName": "Pager",
    "itemRarity": "Rare",
    "itemOfficialPrice": 450,
    "cancellationReason": null
}"""


def test_auction_dto_reads_all_ten_fields() -> None:
    dto = AuctionDto.model_validate_json(AUCTION_JSON)

    assert dto.public_auction_id == UUID("3f1c7a6e-91d4-4a3f-8b1a-2e5d9c0f4b02")
    assert dto.seller_user_id == UUID("9a2b4c6d-8e0f-4a1b-9c3d-5e7f90123b03")
    assert dto.current_winning_user_id is None
    assert dto.status == "Active"
    assert dto.current_price == Decimal(120)
    assert dto.ends_on == datetime(2026, 11, 18, 12, 30, 0, tzinfo=UTC)
    assert dto.item_name == "Pager"
    assert dto.item_rarity is Rarity.Rare
    assert dto.item_official_price == Decimal(450)
    assert dto.cancellation_reason is None


def test_warehouse_details_reads_increments_and_manifest() -> None:
    body = b"""{
        "publicWarehouseId": "5a7c9e1b-3d5f-4a2c-8e0b-2f4061728b05",
        "tier": "Small",
        "status": "Bidding",
        "estimateMin": 800,
        "estimateMax": 1200,
        "entryFee": 500,
        "currentPrice": 150,
        "itemCount": 4,
        "players": 3,
        "maxPlayers": 5,
        "biddingStartsOn": "2026-11-18T12:00:00Z",
        "biddingEndsOn": null,
        "isParticipant": true,
        "participantState": "Active",
        "isLeader": false,
        "cancellationReason": null,
        "manifest": null,
        "increments": [10, 50, 100]
    }"""

    dto = WarehouseDetailsDto.model_validate_json(body)

    assert dto.increments == [Decimal(10), Decimal(50), Decimal(100)]
    assert dto.manifest is None
    assert dto.is_participant is True
    assert dto.is_leader is False
