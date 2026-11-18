import math
import random
from decimal import Decimal

from auction_bots.api.models import Rarity
from auction_bots.director.knobs import Knobs
from auction_bots.fleet.persona import Persona


def value_of(
    item_official_price: Decimal,
    rarity: Rarity,
    name: str,
    persona: Persona,
    knobs: Knobs,
    rng: random.Random,
) -> Decimal:
    mid = (persona.multiplier_range[0] + persona.multiplier_range[1]) / 2
    multiplier = rng.lognormvariate(math.log(mid), 0.15)
    if rarity is not Rarity.Legendary:
        if rarity in persona.favourite_rarities:
            multiplier *= 1.15
        if any(word.lower() in name.lower() for word in persona.name_taste):
            multiplier *= 1.1
    return Decimal(round(float(item_official_price) * multiplier))
