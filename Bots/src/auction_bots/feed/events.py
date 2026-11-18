from collections.abc import Mapping
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, ValidationError
from pydantic.alias_generators import to_pascal

from auction_bots.api.models import Rarity, UtcDatetime


class PascalModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_pascal, populate_by_name=True, frozen=True, extra="ignore"
    )


class AuctionActivated(PascalModel):
    event_id: UUID
    public_auction_id: UUID
    seller_user_id: UUID
    public_item_id: UUID
    item_name: str
    item_rarity: Rarity
    item_official_price: Decimal
    current_price: Decimal
    ends_on: UtcDatetime


class BidPlaced(PascalModel):
    event_id: UUID
    public_auction_id: UUID
    new_winning_user_id: UUID
    previous_winning_user_id: UUID | None = None
    new_price: Decimal
    previous_price: Decimal | None = None


class AuctionFinished(PascalModel):
    event_id: UUID
    public_auction_id: UUID
    seller_user_id: UUID
    winner_user_id: UUID | None = None
    final_price: Decimal | None = None


class AuctionCancelled(PascalModel):
    event_id: UUID
    public_auction_id: UUID
    public_item_id: UUID
    reason: str


MarketEvent = AuctionActivated | BidPlaced | AuctionFinished | AuctionCancelled

EVENT_TYPES: Mapping[str, type[MarketEvent]] = {
    "AuctionActivatedEvent": AuctionActivated,
    "BidPlacedEvent": BidPlaced,
    "AuctionFinishedEvent": AuctionFinished,
    "AuctionCancelledEvent": AuctionCancelled,
}


def parse_event(type_name: str, body: bytes) -> MarketEvent | None:
    event_type = EVENT_TYPES.get(type_name)
    if event_type is None:
        return None
    try:
        return event_type.model_validate_json(body)
    except ValidationError:
        return None
