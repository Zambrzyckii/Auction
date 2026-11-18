import random
from collections import Counter
from pathlib import Path

import pytest

from auction_bots.config import Settings, load_settings
from auction_bots.fleet.persona import sample_persona


@pytest.fixture
def settings(settings_path: Path) -> Settings:
    return load_settings(settings_path, env={})


def test_same_seed_gives_the_same_fleet(settings: Settings) -> None:
    for index in range(10):
        first = sample_persona(index, random.Random(settings.fleet.seed + index), settings)
        second = sample_persona(index, random.Random(settings.fleet.seed + index), settings)
        assert first == second


def test_archetype_shares_hold_over_ten_thousand_draws(settings: Settings) -> None:
    counts: Counter[str] = Counter()
    for index in range(10_000):
        persona = sample_persona(index, random.Random(settings.fleet.seed + index), settings)
        counts[str(persona.archetype)] += 1

    for name, archetype in settings.archetypes.items():
        assert counts[name] / 10_000 == pytest.approx(archetype.share, abs=0.02)


def test_persona_parameters_stay_in_range(settings: Settings) -> None:
    persona_settings = settings.persona
    for index in range(200):
        persona = sample_persona(index, random.Random(settings.fleet.seed + index), settings)
        archetype = settings.archetypes[str(persona.archetype)]

        assert persona.multiplier_range == (archetype.multiplier_min, archetype.multiplier_max)
        assert archetype.bankroll_min <= persona.bankroll <= archetype.bankroll_max
        assert persona.step_range == (archetype.step_min, archetype.step_max)
        low, high = persona_settings.reaction_delay_min_s, persona_settings.reaction_delay_max_s
        assert low <= persona.reaction_delay_s <= high
        assert persona_settings.tick_min_s <= persona.tick_s <= persona_settings.tick_max_s
        if archetype.activity is not None:
            assert persona.activity == archetype.activity
        else:
            assert (
                persona_settings.activity_min <= persona.activity <= persona_settings.activity_max
            )
        low, high = persona_settings.yield_bias_min, persona_settings.yield_bias_max
        assert low <= persona.yield_bias <= high
        min_bids, max_bids = persona_settings.max_open_bids_min, persona_settings.max_open_bids_max
        assert min_bids <= persona.max_open_bids <= max_bids
        min_l, max_l = persona_settings.max_listings_min, persona_settings.max_listings_max
        assert min_l <= persona.max_listings <= max_l
        assert persona.single_bid == archetype.single_bid
        assert persona.list_batch == (archetype.list_batch_min, archetype.list_batch_max)
        assert persona.first_name
        assert persona.surname
