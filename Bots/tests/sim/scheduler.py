import asyncio
import heapq
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

START = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)

Callback = Callable[[], Awaitable[None] | None]


class Scheduler:
    """Virtual UTC clock with a heap of (due, seq, callback) entries."""

    def __init__(self) -> None:
        self._now = START
        self._seq = 0
        self._heap: list[tuple[datetime, int]] = []
        self._callbacks: dict[int, Callback] = {}

    def now(self) -> datetime:
        return self._now

    def call_at(self, when: datetime, callback: Callback) -> None:
        self._seq += 1
        heapq.heappush(self._heap, (when, self._seq))
        self._callbacks[self._seq] = callback

    async def sleep(self, seconds: float) -> None:
        future: asyncio.Future[None] = asyncio.get_running_loop().create_future()

        def wake() -> None:
            if not future.done():
                future.set_result(None)

        self.call_at(self._now + timedelta(seconds=max(seconds, 0.0)), wake)
        await future

    async def run_until(self, when: datetime) -> None:
        await self._drain()
        while self._heap and self._heap[0][0] <= when:
            due, seq = heapq.heappop(self._heap)
            self._now = max(self._now, due)
            result = self._callbacks.pop(seq)()
            if result is not None:
                await result
            await self._drain()
        self._now = max(self._now, when)
        await self._drain()

    async def _drain(self) -> None:
        for _ in range(10):
            await asyncio.sleep(0)
