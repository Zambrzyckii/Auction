import random
from collections.abc import Mapping
from functools import cache

from auction_bots.api.models import Rarity
from auction_bots.fleet.archetypes import ITEM_NAMES

ITEM_LOCKS: Mapping[str, Rarity] = {
    "Chipped Diner Mug": Rarity.Common,
    "Neon Diner Sign": Rarity.Legendary,
    "Deflated Basketball": Rarity.Common,
    "Signed Game Ball": Rarity.Epic,
    "Faded Wrestling Belt": Rarity.Legendary,
    "Overdue Library Book": Rarity.Common,
    "Grandfather Clock Missing Pendulum": Rarity.Epic,
    "Velvet Crooner Painting": Rarity.Legendary,
    "Taxidermy Bass": Rarity.Epic,
    "Jar of Loose Screws": Rarity.Common,
    "Gold-Plated Hammer": Rarity.Legendary,
    "Director's Megaphone": Rarity.Epic,
    "Chewed Leash": Rarity.Common,
    "Solid Gold Pocket Watch": Rarity.Legendary,
    "Knockoff Diamond Watch": Rarity.Epic,
    "Belt Buckle the Size of a Plate": Rarity.Legendary,
    "Snake in a Can": Rarity.Common,
    "Jackalope Mount": Rarity.Epic,
    "Singing Fish Plaque": Rarity.Legendary,
    "Genuine Fake Moon Rock": Rarity.Legendary,
}

LOCK_SHARE: Mapping[Rarity, float] = {
    Rarity.Common: 0.1,
    Rarity.Rare: 0.0,
    Rarity.Epic: 0.5,
    Rarity.Legendary: 0.5,
}


@cache
def locked_names(rarity: Rarity) -> tuple[str, ...]:
    return tuple(name for name in ITEM_NAMES if ITEM_LOCKS.get(name) is rarity)


@cache
def open_names() -> tuple[str, ...]:
    return tuple(name for name in ITEM_NAMES if name not in ITEM_LOCKS)


def pick_name(rarity: Rarity, rng: random.Random) -> str:
    locked = locked_names(rarity)
    if locked and rng.random() < LOCK_SHARE[rarity]:
        return rng.choice(locked)
    return rng.choice(open_names())
