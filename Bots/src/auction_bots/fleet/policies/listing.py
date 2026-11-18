import random
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from uuid import UUID

from auction_bots.api.models import Rarity
from auction_bots.director.knobs import Knobs
from auction_bots.fleet.persona import Persona

RARITY_WEIGHTS: dict[Rarity, int] = {
    Rarity.Common: 60,
    Rarity.Rare: 30,
    Rarity.Epic: 9,
    Rarity.Legendary: 1,
}
HOLDINGS_LIMIT = 20
SHOP_AFTER_FAILURES = 2
START_PRICE_RANGE = (0.3, 0.8)
DURATION_MINUTES = (2.0, 15.0)


@dataclass(frozen=True)
class OwnedItem:
    item_id: UUID
    name: str
    rarity: Rarity
    official_price: Decimal
    available: bool
    failed_listings: int
    last_start_price: int | None


@dataclass(frozen=True)
class Listing:
    item_id: UUID
    starting_price: int
    duration: timedelta


@dataclass(frozen=True)
class ListingDecision:
    mint: tuple[Rarity, ...] = ()
    listings: tuple[Listing, ...] = ()
    sell_to_shop: tuple[UUID, ...] = ()


def decide_listing(
    persona: Persona,
    inventory: Sequence[OwnedItem],
    open_listings: int,
    knobs: Knobs,
    rng: random.Random,
    *,
    allowance: int,
) -> ListingDecision:
    active_items = [item for item in inventory if item.available]
    shop = [item.item_id for item in active_items if item.failed_listings >= SHOP_AFTER_FAILURES]
    fresh = [item for item in active_items if item.failed_listings < SHOP_AFTER_FAILURES]
    surplus = max(0, len(inventory) - len(shop) - HOLDINGS_LIMIT)
    shop += [item.item_id for item in fresh[:surplus]]
    candidates = fresh[surplus:]
    count = max(0, min(allowance, persona.max_listings - open_listings, len(candidates)))
    listings = []

    for item in rng.sample(candidates, count):
        if item.failed_listings == 1 and item.last_start_price is not None:
            price = round(0.8 * item.last_start_price)
        else:
            price = round(float(item.official_price) * rng.uniform(*START_PRICE_RANGE))
        duration = timedelta(minutes=rng.uniform(*DURATION_MINUTES))
        listings.append(Listing(item.item_id, price, duration))

    mint: tuple[Rarity, ...] = ()
    if not candidates and len(inventory) < HOLDINGS_LIMIT:
        weights = list(RARITY_WEIGHTS.values())
        batch = rng.randint(*persona.list_batch)
        mint = tuple(rng.choices(list(RARITY_WEIGHTS.keys()), weights, k=batch))

    return ListingDecision(mint=mint, listings=tuple(listings), sell_to_shop=tuple(shop))
