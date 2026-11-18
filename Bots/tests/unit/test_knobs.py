import pytest

from auction_bots.director.knobs import Knobs


def test_default_generosity_maps_to_the_designed_knobs() -> None:
    knobs = Knobs.from_generosity(0.3, listing_rate=6.0)

    assert knobs.generosity == pytest.approx(0.3)
    assert knobs.buy_cap == pytest.approx(0.815)
    assert knobs.sell_bonus == pytest.approx(1.18)
    assert knobs.yield_base == pytest.approx(0.45)
    assert knobs.listing_rate == pytest.approx(6.0)


def test_generosity_is_clamped() -> None:
    low = Knobs.from_generosity(-0.5, listing_rate=6.0)
    high = Knobs.from_generosity(1.5, listing_rate=6.0)

    assert low.generosity == 0.0
    assert low.buy_cap == pytest.approx(0.95)
    assert high.generosity == 1.0
    assert high.buy_cap == pytest.approx(0.5)
    assert high.sell_bonus == pytest.approx(1.6)
    assert high.yield_base == pytest.approx(0.8)
