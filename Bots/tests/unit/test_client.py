import json
from uuid import UUID

import httpx
import pytest

from auction_bots.api.budget import LoginGate, TokenBucket
from auction_bots.api.client import (
    ApiUnavailable,
    BidInProgress,
    EmailTaken,
    GatewayClient,
    RateLimited,
    Unauthorized,
    UsernameTaken,
)

USER_ID = "9a2b4c6d-8e0f-4a1b-9c3d-5e7f90123b03"
AUCTION_ID = UUID("3f1c7a6e-91d4-4a3f-8b1a-2e5d9c0f4b02")

BOT_BODY = {
    "email": "bot-000-abc123@bots.auction.local",
    "password": "secret-password-Aa1!",
    "username": "Kevin000abc",
    "name": "Kevin",
    "surname": "Mercer",
    "birthday": "1975-01-01",
}


class RecordedSleep:
    def __init__(self) -> None:
        self.calls: list[float] = []

    async def __call__(self, seconds: float) -> None:
        self.calls.append(seconds)


class FakeGate(LoginGate):
    def __init__(self) -> None:
        super().__init__(interval_s=0.0)
        self.waits = 0

    async def wait(self) -> None:
        self.waits += 1


def make_client(
    handler, sleep: RecordedSleep | None = None, gate: LoginGate | None = None
) -> GatewayClient:
    return GatewayClient(
        "http://gateway",
        TokenBucket(rate=10_000, burst=10_000),
        gate or FakeGate(),
        transport=httpx.MockTransport(handler),
        sleep=sleep or RecordedSleep(),
    )


async def test_429_waits_for_retry_after_at_most_three_times() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, headers={"Retry-After": "1"})

    sleep = RecordedSleep()
    client = make_client(handler, sleep=sleep)

    with pytest.raises(RateLimited):
        await client.place_bid("token", AUCTION_ID, 100)

    assert sleep.calls == [1.0, 1.0, 1.0]
    assert client.stats.rate_limited == 4


async def test_server_errors_back_off_1_2_4_then_raise() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    sleep = RecordedSleep()
    client = make_client(handler, sleep=sleep)

    with pytest.raises(ApiUnavailable):
        await client.get_auction(AUCTION_ID)

    assert sleep.calls == [1.0, 2.0, 4.0]


async def test_bid_in_progress_maps_to_its_own_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"error": "Another bid is already being processed"})

    client = make_client(handler)

    with pytest.raises(BidInProgress):
        await client.place_bid("token", AUCTION_ID, 100)

    assert client.stats.conflicts == 1


async def test_username_taken_is_not_email_taken() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"error": "This username is taken"})

    client = make_client(handler)

    with pytest.raises(UsernameTaken) as caught:
        await client.provision_bot("api-key", BOT_BODY)

    assert not isinstance(caught.value, EmailTaken)


async def test_401_maps_to_unauthorized() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401)

    client = make_client(handler)

    with pytest.raises(Unauthorized):
        await client.get_inventory("stale-token")


async def test_money_is_sent_as_json_integers() -> None:
    captured: list[bytes] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request.content)
        return httpx.Response(200)

    client = make_client(handler)

    await client.add_funds("token", 1500)

    payload = json.loads(captured[0])
    assert payload == {"amount": 1500}
    assert isinstance(payload["amount"], int)
    assert b'"1500"' not in captured[0]


async def test_provisioning_goes_through_the_login_gate() -> None:
    seen_keys: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_keys.append(request.headers.get("X-Api-Key"))
        return httpx.Response(201, json={"publicUserId": USER_ID})

    gate = FakeGate()
    client = make_client(handler, gate=gate)

    user_id = await client.provision_bot("api-key", BOT_BODY)

    assert gate.waits == 1
    assert seen_keys == ["api-key"]
    assert user_id == UUID(USER_ID)
