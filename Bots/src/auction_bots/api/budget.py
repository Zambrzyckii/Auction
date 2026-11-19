import asyncio
import time
from collections.abc import Awaitable, Callable

MAX_SLEEP_SLICE_S = 5.0


class TokenBucket:
    def __init__(
        self,
        rate: float,
        burst: int,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._rate = rate
        self._burst = burst
        self._clock = clock
        self._sleep = sleep
        self._tokens = float(burst)
        self._updated = clock()

    def set_rate(self, rate: float) -> None:
        self._refill()
        self._rate = rate

    @property
    def rate(self) -> float:
        return self._rate

    def _refill(self) -> None:
        now = self._clock()
        self._tokens = min(float(self._burst), self._tokens + (now - self._updated) * self._rate)
        self._updated = now

    async def acquire(self) -> None:
        while True:
            self._refill()
            if self._tokens >= 1:
                self._tokens -= 1
                return
            await self._sleep(min(max((1 - self._tokens) / self._rate, 1e-6), MAX_SLEEP_SLICE_S))


class LoginGate:
    def __init__(
        self,
        interval_s: float,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._interval = interval_s
        self._clock = clock
        self._sleep = sleep
        self._next_at = clock()

    async def wait(self) -> None:
        while True:
            now = self._clock()
            if now >= self._next_at:
                self._next_at = now + self._interval
                return
            await self._sleep(self._next_at - now)
