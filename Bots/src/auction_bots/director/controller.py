import asyncio
import logging
import statistics
from collections import deque
from collections.abc import Callable, Sequence
from datetime import datetime

from auction_bots.api.budget import TokenBucket
from auction_bots.config import BudgetSettings, DirectorSettings, ListingSettings, Settings
from auction_bots.director.knobs import Knobs
from auction_bots.market.ledger import Outcome, OutcomeLedger
from auction_bots.market.state import MarketState

log = logging.getLogger("auction_bots.director")


def control_step(
    generosity: float, outcomes: Sequence[Outcome], settings: DirectorSettings
) -> float:
    window = outcomes[-settings.window :]
    if len(window) < settings.min_outcomes:
        return generosity
    median = statistics.median(outcome.margin for outcome in window)
    error = settings.target_margin - median
    if abs(error) <= settings.dead_zone:
        return generosity
    return max(0.0, min(1.0, generosity + settings.gain * error))


def liveness_step(listing_rate: float, live_listings: int, settings: ListingSettings) -> float:
    if live_listings < settings.active_listings_min:
        changed = listing_rate * 1.25
    elif live_listings > settings.active_listings_max:
        changed = listing_rate * 0.75
    else:
        return listing_rate
    return max(settings.listing_rate_min, min(settings.listing_rate_max, changed))


def saga_rate_step(
    rate: float,
    latency_p50_s: float | None,
    settings: BudgetSettings,
    *,
    slow_p50_s: float = 12.0,
    fast_p50_s: float = 9.0,
) -> float:
    if latency_p50_s is None:
        return rate
    if latency_p50_s > slow_p50_s:
        return rate / 2
    if latency_p50_s < fast_p50_s:
        return settings.saga_rate_per_s
    return rate


class Director:
    def __init__(
        self,
        ledger: OutcomeLedger,
        state: MarketState,
        saga_bucket: TokenBucket,
        settings: Settings,
        clock: Callable[[], datetime],
    ) -> None:
        self._ledger = ledger
        self._state = state
        self._saga_bucket = saga_bucket
        self._settings = settings
        self._clock = clock
        self._generosity = settings.director.generosity_start
        self._listing_rate = settings.listing.listing_rate_start
        self._latencies: deque[float] = deque(maxlen=200)

    @property
    def knobs(self) -> Knobs:
        return Knobs.from_generosity(self._generosity, listing_rate=self._listing_rate)

    def record_saga_latency(self, seconds: float) -> None:
        self._latencies.append(seconds)

    def live_listings(self) -> int:
        return len(self._state.active())

    async def run(self, stop: asyncio.Event) -> None:
        interval = self._settings.director.interval_s
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval)
            except TimeoutError:
                self.step()

    def step(self) -> None:
        director = self._settings.director
        outcomes = self._ledger.recent(director.window)
        self._generosity = control_step(self._generosity, outcomes, director)
        self._listing_rate = liveness_step(
            self._listing_rate, self.live_listings(), self._settings.listing
        )
        p50 = statistics.median(self._latencies) if self._latencies else None
        saga_rate = saga_rate_step(
            self._saga_bucket.rate,
            p50,
            self._settings.budget,
            slow_p50_s=director.saga_slow_p50_s,
            fast_p50_s=director.saga_fast_p50_s,
        )
        self._saga_bucket.set_rate(saga_rate)
        log.info(
            "knobs",
            extra={
                "generosity": round(self._generosity, 3),
                "listing_rate": self._listing_rate,
                "saga_rate": saga_rate,
                "live_listings": self.live_listings(),
                "outcomes": len(outcomes),
            },
        )
