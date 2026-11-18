import pytest

from auction_bots.api.budget import LoginGate, TokenBucket


class FakeTime:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def clock(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


async def test_bucket_spreads_a_burst_below_the_gateway_rate() -> None:
    fake = FakeTime()
    bucket = TokenBucket(rate=45, burst=60, clock=fake.clock, sleep=fake.sleep)

    times: list[float] = []
    for _ in range(300):
        await bucket.acquire()
        times.append(fake.now)

    for count, at in enumerate(times, start=1):
        assert count <= 60 + 45 * at + 1e-9

    excess = 0.0
    previous = times[0]
    for at in times:
        excess = max(0.0, excess - 60 * (at - previous)) + 1
        previous = at
        assert excess <= 120 + 1


async def test_login_gate_spaces_calls_by_1_2_s() -> None:
    fake = FakeTime()
    gate = LoginGate(interval_s=1.2, clock=fake.clock, sleep=fake.sleep)

    times: list[float] = []
    for _ in range(3):
        await gate.wait()
        times.append(fake.now)

    assert times[0] == pytest.approx(0.0)
    assert times[1] - times[0] == pytest.approx(1.2)
    assert times[2] - times[1] == pytest.approx(1.2)


async def test_set_rate_slows_the_bucket() -> None:
    fake = FakeTime()
    bucket = TokenBucket(rate=1, burst=1, clock=fake.clock, sleep=fake.sleep)

    await bucket.acquire()
    await bucket.acquire()
    full_rate_gap = fake.now

    bucket.set_rate(0.5)
    before = fake.now
    await bucket.acquire()

    assert full_rate_gap == pytest.approx(1.0)
    assert fake.now - before == pytest.approx(2.0)
