from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


def assume_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


UtcDatetime = Annotated[datetime, AfterValidator(assume_utc)]


class Rarity(StrEnum):
    Common = "Common"
    Rare = "Rare"
    Epic = "Epic"
    Legendary = "Legendary"


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, frozen=True, extra="ignore"
    )


class AuctionDto(CamelModel):
    public_auction_id: UUID
    seller_user_id: UUID
    current_winning_user_id: UUID | None = None
    status: str
    current_price: Decimal
    ends_on: UtcDatetime
    item_name: str | None = None
    item_rarity: Rarity | None = None
    item_official_price: Decimal | None = None
    cancellation_reason: str | None = None


class MyAuctionDto(AuctionDto):
    created_on: UtcDatetime


class UserItemDto(CamelModel):
    public_item_id: UUID
    name: str
    rarity: Rarity
    status: str
    official_price: Decimal


class WalletDto(CamelModel):
    available_funds: Decimal
    locked_funds: Decimal
    lifetime_turnover: Decimal


class LoginResponse(CamelModel):
    token: str
    refresh_token: str | None = None


class CreatedAuction(CamelModel):
    public_auction_id: UUID


class CreatedItem(CamelModel):
    public_item_id: UUID


class CreatedUser(CamelModel):
    public_user_id: UUID


class ManifestItemDto(CamelModel):
    name: str
    rarity: Rarity
    price: Decimal


class WarehouseSummaryDto(CamelModel):
    public_warehouse_id: UUID
    tier: str
    status: str
    estimate_min: Decimal
    estimate_max: Decimal
    entry_fee: Decimal
    current_price: Decimal
    item_count: int
    players: int
    max_players: int
    bidding_starts_on: UtcDatetime | None = None
    bidding_ends_on: UtcDatetime | None = None


class WarehouseDetailsDto(WarehouseSummaryDto):
    is_participant: bool
    participant_state: str | None = None
    is_leader: bool
    cancellation_reason: str | None = None
    manifest: list[ManifestItemDto] | None = None
    increments: list[Decimal]
