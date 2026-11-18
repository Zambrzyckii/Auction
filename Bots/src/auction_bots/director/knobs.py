from dataclasses import dataclass


@dataclass(frozen=True)
class Knobs:
    generosity: float
    buy_cap: float
    sell_bonus: float
    yield_base: float
    listing_rate: float

    @classmethod
    def from_generosity(cls, g: float, listing_rate: float) -> "Knobs":
        clamped = max(0.0, min(1.0, g))
        return cls(
            generosity=clamped,
            buy_cap=0.95 - 0.45 * clamped,
            sell_bonus=1.0 + 0.6 * clamped,
            yield_base=0.3 + 0.5 * clamped,
            listing_rate=listing_rate,
        )
