import inspect
import random
import statistics
from decimal import Decimal

from auction_bots.api.models import Rarity
from auction_bots.director.knobs import Knobs
from auction_bots.fleet.archetypes import ArchetypeName
from auction_bots.fleet.persona import Persona
from auction_bots.fleet.policies.valuation import value_of

KNOBS = Knobs.from_generosity(0.3, listing_rate=6.0)


def persona_of(
    archetype: ArchetypeName,
    multiplier_range: tuple[float, float],
    favourite_rarities: frozenset[Rarity] = frozenset(),
    name_taste: tuple[str, ...] = (),
) -> Persona:
    return Persona(
        index=0,
        archetype=archetype,
        multiplier_range=multiplier_range,
        bankroll=10_000,
        step_range=(0.03, 0.08),
        reaction_delay_s=5.0,
        tick_s=30.0,
        activity=0.6,
        rarity_taste={rarity: 1.0 for rarity in Rarity},
        favourite_rarities=favourite_rarities,
        name_taste=name_taste,
        yield_bias=0.0,
        max_open_bids=2,
        max_listings=3,
        single_bid=False,
        bot_war_cap=0.6,
        list_batch=(1, 1),
        first_name="Kevin",
        surname="Mercer",
    )


def median_value(persona: Persona, official: int, rarity: Rarity, name: str, seed: int) -> float:
    rng = random.Random(seed)
    values = [
        float(value_of(Decimal(official), rarity, name, persona, KNOBS, rng)) for _ in range(1000)
    ]
    return statistics.median(values)


def test_valuation_is_whole_units() -> None:
    persona = persona_of(ArchetypeName.Flipper, (0.55, 0.95))
    rng = random.Random(7)

    for _ in range(100):
        value = value_of(Decimal(1000), Rarity.Common, "Pocket TV", persona, KNOBS, rng)
        assert value == value.to_integral_value()


def test_flipper_median_stays_inside_its_range() -> None:
    persona = persona_of(ArchetypeName.Flipper, (0.55, 0.95))

    median = median_value(persona, 1000, Rarity.Common, "Pocket TV", seed=11)

    assert 550 <= median <= 950


def test_collector_pays_more_for_a_favourite_rarity() -> None:
    persona = persona_of(
        ArchetypeName.Collector, (0.9, 1.4), favourite_rarities=frozenset({Rarity.Epic})
    )

    favourite = median_value(persona, 1000, Rarity.Epic, "Pocket TV", seed=23)
    plain = median_value(persona, 1000, Rarity.Common, "Pocket TV", seed=23)

    assert favourite >= 1.1 * plain


def test_legendary_gets_no_collector_bonus() -> None:
    persona = persona_of(
        ArchetypeName.Collector, (0.9, 1.4), favourite_rarities=frozenset({Rarity.Legendary})
    )

    legendary = median_value(persona, 10_000, Rarity.Legendary, "Pocket TV", seed=31)
    plain = median_value(persona, 10_000, Rarity.Common, "Pocket TV", seed=31)

    assert legendary <= 1.05 * plain


def test_valuation_ignores_the_seller() -> None:
    parameters = inspect.signature(value_of).parameters

    assert "seller" not in parameters
    assert "seller_id" not in parameters
    assert set(parameters) == {"item_official_price", "rarity", "name", "persona", "knobs", "rng"}
