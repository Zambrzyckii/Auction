import random
from collections.abc import Mapping
from dataclasses import dataclass

from auction_bots.api.models import Rarity
from auction_bots.config import Settings
from auction_bots.fleet.archetypes import FIRST_NAMES, SURNAMES, TASTE_WORDS, ArchetypeName


@dataclass(frozen=True)
class Persona:
    index: int
    archetype: ArchetypeName
    multiplier_range: tuple[float, float]
    bankroll: int
    step_range: tuple[float, float]
    reaction_delay_s: float
    tick_s: float
    activity: float
    rarity_taste: Mapping[Rarity, float]
    favourite_rarities: frozenset[Rarity]
    name_taste: tuple[str, ...]
    yield_bias: float
    max_open_bids: int
    max_listings: int
    single_bid: bool
    bot_war_cap: float
    list_batch: tuple[int, int]
    first_name: str
    surname: str


def sample_persona(index: int, rng: random.Random, settings: Settings) -> Persona:
    names = list(settings.archetypes.keys())
    shares = [settings.archetypes[name].share for name in names]
    chosen = rng.choices(names, weights=shares, k=1)[0]
    archetype = settings.archetypes[chosen]
    p = settings.persona

    rarity_taste = {rarity: rng.uniform(0.5, 1.5) for rarity in Rarity}
    if chosen == ArchetypeName.Collector:
        favourite_rarities = frozenset(rng.sample(list(Rarity), rng.randint(1, 2)))
        name_taste = tuple(rng.sample(TASTE_WORDS, rng.randint(0, 2)))
    else:
        favourite_rarities = frozenset()
        name_taste = ()

    if archetype.activity is not None:
        activity = archetype.activity
    else:
        activity = rng.uniform(p.activity_min, p.activity_max)

    return Persona(
        index=index,
        archetype=ArchetypeName(chosen),
        multiplier_range=(archetype.multiplier_min, archetype.multiplier_max),
        bankroll=rng.randint(archetype.bankroll_min, archetype.bankroll_max),
        step_range=(archetype.step_min, archetype.step_max),
        reaction_delay_s=rng.uniform(p.reaction_delay_min_s, p.reaction_delay_max_s),
        tick_s=rng.uniform(p.tick_min_s, p.tick_max_s),
        activity=activity,
        rarity_taste=rarity_taste,
        favourite_rarities=favourite_rarities,
        name_taste=name_taste,
        yield_bias=rng.uniform(p.yield_bias_min, p.yield_bias_max),
        max_open_bids=rng.randint(p.max_open_bids_min, p.max_open_bids_max),
        max_listings=rng.randint(p.max_listings_min, p.max_listings_max),
        single_bid=archetype.single_bid,
        bot_war_cap=rng.uniform(
            settings.warehouses.bot_war_target_min, settings.warehouses.bot_war_target_max
        ),
        list_batch=(archetype.list_batch_min, archetype.list_batch_max),
        first_name=rng.choice(FIRST_NAMES),
        surname=rng.choice(SURNAMES),
    )
