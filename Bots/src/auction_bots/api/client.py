import asyncio
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

import httpx
from pydantic import TypeAdapter

from auction_bots.api.budget import LoginGate, TokenBucket
from auction_bots.api.models import (
    AuctionDto,
    CreatedAuction,
    CreatedItem,
    CreatedUser,
    LoginResponse,
    MyAuctionDto,
    Rarity,
    UserItemDto,
    WalletDto,
    WarehouseDetailsDto,
    WarehouseSummaryDto,
)


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(f"{status}: {message}")
        self.status = status
        self.message = message


class BadRequest(ApiError):
    pass


class Unauthorized(ApiError):
    pass


class Forbidden(ApiError):
    pass


class NotFound(ApiError):
    pass


class Conflict(ApiError):
    pass


class RateLimited(ApiError):
    pass


class ApiUnavailable(ApiError):
    pass


class BidInProgress(Conflict):
    pass


class EmailTaken(Conflict):
    pass


class UsernameTaken(Conflict):
    pass


def conflict_for(message: str) -> Conflict:
    lowered = message.lower()
    if "bid is already being processed" in lowered:
        return BidInProgress(409, message)
    if "email" in lowered:
        return EmailTaken(409, message)
    if "username" in lowered:
        return UsernameTaken(409, message)
    return Conflict(409, message)


def error_for(status: int, message: str) -> ApiError:
    if status == 400:
        return BadRequest(status, message)
    if status == 401:
        return Unauthorized(status, message)
    if status == 403:
        return Forbidden(status, message)
    if status == 404:
        return NotFound(status, message)
    if status == 409:
        return conflict_for(message)
    if status == 429:
        return RateLimited(status, message)
    return ApiError(status, message)


@dataclass
class ClientStats:
    requests: int = 0
    rate_limited: int = 0
    conflicts: int = 0
    unavailable: int = 0


class MarketApi(Protocol):
    async def provision_bot(self, api_key: str, body: Mapping[str, str]) -> UUID: ...

    async def login(self, email: str, password: str) -> LoginResponse: ...

    async def add_funds(self, token: str, amount: int) -> None: ...

    async def get_wallet(self, token: str, user_id: UUID) -> WalletDto: ...

    async def mint_item(self, token: str, name: str, rarity: Rarity) -> UUID: ...

    async def get_inventory(self, token: str) -> list[UserItemDto]: ...

    async def sell_to_shop(self, token: str, item_id: UUID) -> None: ...

    async def create_auction(
        self, token: str, item_id: UUID, starting_price: int, ends_on: datetime
    ) -> UUID: ...

    async def list_auctions(self, limit: int) -> list[AuctionDto]: ...

    async def get_auction(self, auction_id: UUID) -> AuctionDto: ...

    async def my_auctions(self, token: str) -> list[MyAuctionDto]: ...

    async def place_bid(self, token: str, auction_id: UUID, amount: int) -> None: ...

    async def list_warehouses(self, token: str, limit: int) -> list[WarehouseSummaryDto]: ...

    async def get_warehouse(self, token: str, warehouse_id: UUID) -> WarehouseDetailsDto: ...

    async def join_warehouse(self, token: str, warehouse_id: UUID) -> None: ...

    async def leave_warehouse(self, token: str, warehouse_id: UUID) -> None: ...

    async def raise_warehouse(self, token: str, warehouse_id: UUID, increment: int) -> None: ...


AUCTION_LIST = TypeAdapter(list[AuctionDto])
MY_AUCTION_LIST = TypeAdapter(list[MyAuctionDto])
ITEM_LIST = TypeAdapter(list[UserItemDto])
WAREHOUSE_LIST = TypeAdapter(list[WarehouseSummaryDto])


def iso_z(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


class GatewayClient(MarketApi):
    def __init__(
        self,
        base_url: str,
        bucket: TokenBucket,
        login_gate: LoginGate,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        max_429_retries: int = 3,
        backoff_s: Sequence[float] = (1.0, 2.0, 4.0),
    ) -> None:
        self._bucket = bucket
        self._login_gate = login_gate
        self._sleep = sleep
        self._max_429_retries = max_429_retries
        self._backoff_s = tuple(backoff_s)
        self._http = httpx.AsyncClient(
            base_url=base_url, transport=transport, timeout=httpx.Timeout(10.0)
        )
        self.stats = ClientStats()

    async def aclose(self) -> None:
        await self._http.aclose()

    @staticmethod
    def _message_of(response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            return response.text
        if isinstance(payload, dict) and "error" in payload:
            return str(payload["error"])
        return response.text

    @staticmethod
    def _retry_after(response: httpx.Response) -> float:
        header = response.headers.get("Retry-After")
        if header is None:
            return 1.0
        try:
            return float(header)
        except ValueError:
            return 1.0

    async def _send(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        json_body: Mapping[str, object] | None = None,
        extra_headers: Mapping[str, str] | None = None,
        through_login_gate: bool = False,
    ) -> httpx.Response:
        retries_429 = 0
        server_failures = 0
        while True:
            if through_login_gate:
                await self._login_gate.wait()
            await self._bucket.acquire()
            self.stats.requests += 1
            headers = dict(extra_headers or {})
            if token is not None:
                headers["Authorization"] = f"Bearer {token}"
            try:
                response = await self._http.request(method, path, json=json_body, headers=headers)
            except httpx.TransportError as error:
                self.stats.unavailable += 1
                if server_failures >= len(self._backoff_s):
                    raise ApiUnavailable(0, str(error)) from error
                await self._sleep(self._backoff_s[server_failures])
                server_failures += 1
                continue
            if response.status_code >= 500:
                self.stats.unavailable += 1
                if server_failures >= len(self._backoff_s):
                    raise ApiUnavailable(response.status_code, self._message_of(response))
                await self._sleep(self._backoff_s[server_failures])
                server_failures += 1
                continue
            if response.status_code == 429:
                self.stats.rate_limited += 1
                if retries_429 >= self._max_429_retries:
                    raise RateLimited(429, self._message_of(response))
                await self._sleep(self._retry_after(response))
                retries_429 += 1
                continue
            if response.status_code == 409:
                self.stats.conflicts += 1
            if response.status_code >= 400:
                raise error_for(response.status_code, self._message_of(response))
            return response

    async def provision_bot(self, api_key: str, body: Mapping[str, str]) -> UUID:
        response = await self._send(
            "POST",
            "/api/users/bots",
            json_body=dict(body),
            extra_headers={"X-Api-Key": api_key},
            through_login_gate=True,
        )
        return CreatedUser.model_validate_json(response.content).public_user_id

    async def login(self, email: str, password: str) -> LoginResponse:
        response = await self._send(
            "POST",
            "/api/users/login",
            json_body={"email": email, "password": password},
            through_login_gate=True,
        )
        return LoginResponse.model_validate_json(response.content)

    async def add_funds(self, token: str, amount: int) -> None:
        await self._send("POST", "/api/wallets/funds", token=token, json_body={"amount": amount})

    async def get_wallet(self, token: str, user_id: UUID) -> WalletDto:
        response = await self._send("GET", f"/api/wallets/{user_id}", token=token)
        return WalletDto.model_validate_json(response.content)

    async def mint_item(self, token: str, name: str, rarity: Rarity) -> UUID:
        response = await self._send(
            "POST",
            "/api/inventory/items",
            token=token,
            json_body={"name": name, "rarity": rarity.value},
        )
        return CreatedItem.model_validate_json(response.content).public_item_id

    async def get_inventory(self, token: str) -> list[UserItemDto]:
        response = await self._send("GET", "/api/inventory", token=token)
        return ITEM_LIST.validate_json(response.content)

    async def sell_to_shop(self, token: str, item_id: UUID) -> None:
        await self._send("POST", f"/api/inventory/{item_id}/sell", token=token)

    async def create_auction(
        self, token: str, item_id: UUID, starting_price: int, ends_on: datetime
    ) -> UUID:
        response = await self._send(
            "POST",
            "/api/auctions",
            token=token,
            json_body={
                "itemId": str(item_id),
                "startingPrice": starting_price,
                "endsOn": iso_z(ends_on),
            },
        )
        return CreatedAuction.model_validate_json(response.content).public_auction_id

    async def list_auctions(self, limit: int) -> list[AuctionDto]:
        response = await self._send("GET", f"/api/auctions?limit={limit}")
        return AUCTION_LIST.validate_json(response.content)

    async def get_auction(self, auction_id: UUID) -> AuctionDto:
        response = await self._send("GET", f"/api/auctions/{auction_id}")
        return AuctionDto.model_validate_json(response.content)

    async def my_auctions(self, token: str) -> list[MyAuctionDto]:
        response = await self._send("GET", "/api/auctions/mine", token=token)
        return MY_AUCTION_LIST.validate_json(response.content)

    async def place_bid(self, token: str, auction_id: UUID, amount: int) -> None:
        await self._send(
            "POST", f"/api/auctions/{auction_id}/bid", token=token, json_body={"amount": amount}
        )

    async def list_warehouses(self, token: str, limit: int) -> list[WarehouseSummaryDto]:
        response = await self._send("GET", f"/api/warehouses?limit={limit}", token=token)
        return WAREHOUSE_LIST.validate_json(response.content)

    async def get_warehouse(self, token: str, warehouse_id: UUID) -> WarehouseDetailsDto:
        response = await self._send("GET", f"/api/warehouses/{warehouse_id}", token=token)
        return WarehouseDetailsDto.model_validate_json(response.content)

    async def join_warehouse(self, token: str, warehouse_id: UUID) -> None:
        await self._send("POST", f"/api/warehouses/{warehouse_id}/join", token=token)

    async def leave_warehouse(self, token: str, warehouse_id: UUID) -> None:
        await self._send("POST", f"/api/warehouses/{warehouse_id}/leave", token=token)

    async def raise_warehouse(self, token: str, warehouse_id: UUID, increment: int) -> None:
        await self._send(
            "POST",
            f"/api/warehouses/{warehouse_id}/bids",
            token=token,
            json_body={"increment": increment},
        )
