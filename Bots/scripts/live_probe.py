"""Live probe of the bot fleet on the compose stack.

Run from Bots/ with the stack and the bots profile up:
    .venv/bin/python scripts/live_probe.py --fleet-size 10 [--resilience]
"""

import argparse
import asyncio
import json
import os
import random
import subprocess
import sys
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import httpx
from pydantic import TypeAdapter

from auction_bots.api.budget import LoginGate, TokenBucket
from auction_bots.api.client import ApiError, BidInProgress, GatewayClient, NotFound
from auction_bots.api.models import (
    AuctionDto,
    CamelModel,
    Rarity,
    UtcDatetime,
    WarehouseDetailsDto,
)
from auction_bots.config import load_settings
from auction_bots.fleet.identity import derive_identity, provision_or_login, read_jwt_claims
from auction_bots.fleet.persona import sample_persona
from auction_bots.fleet.policies.warehouse import decode_true_value
from auction_bots.secrets import read_secret
from auction_bots.warehouses.watcher import ESTIMATE_VARIANTS

BOTS_DIR = Path(__file__).resolve().parents[1]
ROOT = BOTS_DIR.parent
GATEWAY_URL = "http://localhost:8080"
PLAYER_PASSWORD = "Zaq1@wsxCde3"
BUY_CAP = 0.815
HELPER_BOT_INDEX = 999
HELPER_TOPUP = 10_000
PLAYER_GRANT = 3_000
AMBIGUOUS_ESTIMATE_DIVISOR = Decimal("1.3")
SUMMARY_WAIT_S = 180.0
FIRST_BID_WAIT_S = 60.0
CANDIDATE_WAIT_S = 180.0
WAR_WAIT_S = 600.0
LOBBY_WAIT_S = 15.0
FEE_CONFIRM_WAIT_S = 60.0
STEERING_WAIT_S = 150.0
SETTLE_WAIT_S = 120.0
SNIPE_GUARD = timedelta(seconds=30)
SELL_DURATION = timedelta(minutes=3)
BUY_WINDOW = (timedelta(minutes=2), timedelta(minutes=10))
CHEAP_FRACTION = 0.6
ACTIVE_LISTINGS_RANGE = {10: (5, 30), 100: (20, 30)}


class BidDto(CamelModel):
    bidder_user_id: UUID
    amount: Decimal
    placed_on: UtcDatetime


BID_LIST = TypeAdapter(list[BidDto])


class ProbeClient(GatewayClient):
    async def register_human(self, body: dict[str, str]) -> None:
        await self._send("POST", "/api/users/register", json_body=body, through_login_gate=True)

    async def auction_bids(self, auction_id: UUID) -> list[BidDto]:
        response = await self._send("GET", f"/api/auctions/{auction_id}/bids")
        return BID_LIST.validate_json(response.content)

    async def transfer(self, token: str, recipient: UUID, amount: int) -> None:
        await self._send(
            "POST",
            "/api/wallets/transfers",
            token=token,
            json_body={"recipientUserId": str(recipient), "amount": amount},
        )


class Probe:
    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0

    def check(self, name: str, condition: bool, detail: str = "") -> bool:
        if condition:
            self.passed += 1
        else:
            self.failed += 1
        suffix = f" ({detail})" if detail else ""
        print(f"{'PASS' if condition else 'FAIL'} {name}{suffix}", flush=True)
        return condition

    def summary(self) -> int:
        print(f"probe {self.passed} PASS {self.failed} FAIL", flush=True)
        return 1 if self.failed else 0


def compose(*args: str) -> str:
    result = subprocess.run(
        ["docker", "compose", *args], cwd=ROOT, capture_output=True, text=True, check=False
    )
    return result.stdout


def bots_logs() -> str:
    return compose("logs", "bots", "--no-log-prefix")


def summaries(logs: str) -> list[dict]:
    found = []
    for line in logs.splitlines():
        if '"fleet summary"' not in line:
            continue
        try:
            found.append(json.loads(line[line.index("{") :])["extra"])
        except (ValueError, KeyError):
            continue
    return found


def count_429(logs: str) -> int:
    return logs.count('"status": 429')


def bots_state() -> str:
    return compose("ps", "bots", "--format", "{{.State}}").strip()


def bots_restart_count() -> int:
    container = compose("ps", "-q", "bots").strip()
    if not container:
        return -1
    result = subprocess.run(
        ["docker", "inspect", "-f", "{{.RestartCount}}", container],
        capture_output=True,
        text=True,
        check=False,
    )
    return int(result.stdout.strip() or -1)


def fleet_queue_consumers() -> int | None:
    output = compose("exec", "-T", "rabbitmq", "rabbitmqctl", "list_queues", "name", "consumers")
    for line in output.splitlines():
        if line.startswith("auctionserver.bots"):
            return int(line.split()[-1])
    return None


async def wait_for[T](
    probe_fn: Callable[[], Awaitable[T | None]], timeout_s: float, every_s: float
) -> T | None:
    deadline = time.monotonic() + timeout_s
    while True:
        value = await probe_fn()
        if value is not None:
            return value
        if time.monotonic() >= deadline:
            return None
        await asyncio.sleep(every_s)


async def wait_for_summary(fleet_size: int, timeout_s: float) -> dict | None:
    async def latest() -> dict | None:
        lines = summaries(bots_logs())
        if lines and lines[-1]["logged_in"] == fleet_size:
            return lines[-1]
        return None

    return await wait_for(latest, timeout_s, 10.0)


def now() -> datetime:
    return datetime.now(UTC)


async def health_status() -> int | None:
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            return (await http.get(f"{GATEWAY_URL}/health/ready")).status_code
    except httpx.HTTPError:
        return None


class Player:
    def __init__(self, api: ProbeClient, email: str, token: str, user_id: UUID) -> None:
        self.api = api
        self.email = email
        self.token = token
        self.user_id = user_id

    async def relogin(self) -> None:
        self.token = (await self.api.login(self.email, PLAYER_PASSWORD)).token

    async def available(self) -> Decimal | None:
        try:
            return (await self.api.get_wallet(self.token, self.user_id)).available_funds
        except NotFound:
            return None


async def phase_health(probe: Probe, fleet_size: int) -> None:
    ready = await health_status()
    probe.check("P1 /health/ready is 200", ready == 200, str(ready))
    probe.check("P1 bots container is running", bots_state() == "running", bots_state())
    summary = await wait_for_summary(fleet_size, SUMMARY_WAIT_S)
    probe.check(
        f"P1 summary shows logged_in {fleet_size}",
        summary is not None,
        json.dumps(summary) if summary else "no summary line in 3 minutes",
    )
    probe.check("P1 no 429 in the fleet log", count_429(bots_logs()) == 0)


async def phase_player(probe: Probe, api: ProbeClient) -> Player | None:
    stamp = int(time.time())
    email = f"probe-{stamp}@probe.local"
    try:
        await api.register_human(
            {
                "email": email,
                "password": PLAYER_PASSWORD,
                "username": f"probe{stamp}",
                "name": "Probe",
                "surname": "Player",
                "birthday": "1990-01-01",
            }
        )
        token = (await api.login(email, PLAYER_PASSWORD)).token
    except ApiError as error:
        probe.check("P2 player registered and logged in", False, f"{error.status} {error}")
        return None
    user_id, _ = read_jwt_claims(token)
    player = Player(api, email, token, user_id)
    probe.check("P2 player registered and logged in", True, str(user_id))

    wallet = await wait_for(player.available, 60.0, 2.0)
    probe.check("P2 wallet created", wallet is not None, str(wallet))

    async def three_items() -> int | None:
        count = len(await api.get_inventory(player.token))
        return count if count >= 3 else None

    items = await wait_for(three_items, 60.0, 2.0)
    probe.check("P2 three starter items", items is not None, str(items))
    return player


async def wait_until_closed(api: ProbeClient, auction_id: UUID, ends_on: datetime) -> AuctionDto:
    async def closed() -> AuctionDto | None:
        dto = await api.get_auction(auction_id)
        return dto if dto.status not in ("Pending", "Active") else None

    remaining = max(0.0, (ends_on - now()).total_seconds())
    dto = await wait_for(closed, remaining + SETTLE_WAIT_S, 5.0)
    return dto or await api.get_auction(auction_id)


async def phase_sell(probe: Probe, api: ProbeClient, player: Player) -> None:
    inventory = await api.get_inventory(player.token)
    available = [item for item in inventory if item.status == "Available"]
    chosen = next((i for i in available if i.rarity == Rarity.Common), None) or available[0]
    official = chosen.official_price
    funds_before = await player.available() or Decimal(0)
    ends = now() + SELL_DURATION
    auction_id = await api.create_auction(player.token, chosen.public_item_id, int(official), ends)

    async def active() -> AuctionDto | None:
        dto = await api.get_auction(auction_id)
        return dto if dto.status == "Active" else None

    probe.check("P3 listing activated", await wait_for(active, 60.0, 3.0) is not None)

    async def fleet_bid() -> BidDto | None:
        bids = await api.auction_bids(auction_id)
        for bid in bids:
            if bid.bidder_user_id != player.user_id and bid.amount >= official:
                return bid
        return None

    activated_at = now()
    first = await wait_for(fleet_bid, FIRST_BID_WAIT_S, 3.0)
    probe.check(
        "P3 fleet bid at or above official within 60 s",
        first is not None,
        f"{first.amount} vs {official} after {(now() - activated_at).total_seconds():.0f} s"
        if first
        else "no bid within 60 s",
    )

    final = await wait_until_closed(api, auction_id, ends)
    probe.check(
        "P3 listing sold to a bot",
        final.status == "Closed" and final.current_winning_user_id not in (None, player.user_id),
        f"{final.status} winner {final.current_winning_user_id}",
    )

    async def paid() -> Decimal | None:
        funds = await player.available()
        return funds if funds is not None and funds - funds_before >= official else None

    funds_after = await wait_for(paid, 60.0, 3.0)
    probe.check(
        "P3 seller received at least official",
        funds_after is not None,
        f"{funds_before} -> {funds_after or await player.available()}",
    )


def is_cheap_candidate(dto: AuctionDto, player: Player, at: datetime) -> bool:
    if dto.seller_user_id == player.user_id or dto.item_official_price is None:
        return False
    if dto.current_price >= Decimal(str(CHEAP_FRACTION)) * dto.item_official_price:
        return False
    return BUY_WINDOW[0] <= dto.ends_on - at <= BUY_WINDOW[1]


def affordable(dto: AuctionDto, funds: float) -> bool:
    return float(dto.item_official_price or 0) * BUY_CAP <= funds


async def phase_buy(probe: Probe, api: ProbeClient, player: Player) -> None:
    await player.relogin()

    async def candidate() -> AuctionDto | None:
        at = now()
        funds = float(await player.available() or 0)
        cheap = [
            a
            for a in await api.list_auctions(100)
            if is_cheap_candidate(a, player, at) and affordable(a, funds)
        ]
        return min(cheap, key=lambda a: a.ends_on) if cheap else None

    target = await wait_for(candidate, CANDIDATE_WAIT_S, 10.0)
    if not probe.check("P4 cheap fleet listing found", target is not None):
        return
    assert target is not None
    official = target.item_official_price or Decimal(0)
    cap = float(official) * BUY_CAP
    auction_id = target.public_auction_id
    own_bids = 0

    while True:
        dto = await api.get_auction(auction_id)
        if dto.status not in ("Pending", "Active"):
            break
        if dto.current_winning_user_id != player.user_id:
            amount = int(dto.current_price) + 1
            if amount <= cap:
                try:
                    await api.place_bid(player.token, auction_id, amount)
                    own_bids += 1
                except BidInProgress:
                    await asyncio.sleep(3.0)
                    continue
                except ApiError as error:
                    print(f"     bid {amount} rejected: {error.status} {error}", flush=True)
        await asyncio.sleep(3.0)

    bids = await api.auction_bids(auction_id)
    mine = [b for b in bids if b.bidder_user_id == player.user_id]
    probe.check("P4 player bids confirmed", own_bids > 0 and bool(mine), f"{own_bids}/{len(mine)}")
    final = await api.get_auction(auction_id)
    probe.check(
        "P4 player won under the buy cap",
        final.current_winning_user_id == player.user_id and float(final.current_price) <= cap,
        f"{final.current_price} vs cap {cap:.0f}, winner {final.current_winning_user_id}",
    )
    late = [
        b
        for b in bids
        if b.bidder_user_id != player.user_id and b.placed_on > final.ends_on - SNIPE_GUARD
    ]
    probe.check("P4 no fleet bid in the last 30 s", not late, f"{len(late)} late bids")

    async def delivered() -> bool | None:
        names = [item.name for item in await api.get_inventory(player.token)]
        return True if final.item_name in names else None

    probe.check("P4 item delivered to the player", await wait_for(delivered, 60.0, 3.0) is True)


def war_cap(war: WarehouseDetailsDto) -> float:
    true_value = decode_true_value(war.estimate_min, war.estimate_max, ESTIMATE_VARIANTS)
    if true_value is None:
        true_value = war.estimate_min / AMBIGUOUS_ESTIMATE_DIVISOR
    return float(true_value) * BUY_CAP


async def helper_bot_token(api: ProbeClient, api_key: str) -> str | None:
    settings = load_settings(BOTS_DIR / "bots.toml", os.environ)
    rng = random.Random(settings.fleet.seed + HELPER_BOT_INDEX)
    persona = sample_persona(HELPER_BOT_INDEX, rng, settings)
    identity = derive_identity(
        HELPER_BOT_INDEX, api_key, persona, birthday=settings.persona.birthday
    )
    session = await provision_or_login(api, api_key, identity, rng, now())
    return session.token if session else None


async def phase_war(probe: Probe, api: ProbeClient, player: Player, api_key: str) -> None:
    await player.relogin()
    helper = await helper_bot_token(api, api_key)
    if not probe.check("P5 helper bot ready", helper is not None):
        return
    assert helper is not None
    helper_id, _ = read_jwt_claims(helper)

    async def helper_wallet() -> Decimal | None:
        try:
            return (await api.get_wallet(helper, helper_id)).available_funds
        except NotFound:
            return None

    probe.check("P5 helper wallet created", await wait_for(helper_wallet, 60.0, 2.0) is not None)
    funds_before = await player.available() or Decimal(0)
    await api.add_funds(helper, HELPER_TOPUP)
    await api.transfer(helper, player.user_id, PLAYER_GRANT)

    async def granted() -> Decimal | None:
        funds = await player.available()
        return funds if funds is not None and funds - funds_before >= PLAYER_GRANT else None

    probe.check("P5 transfer reached the player", await wait_for(granted, 60.0, 2.0) is not None)

    async def joinable_war() -> WarehouseDetailsDto | None:
        funds = await player.available() or Decimal(0)
        for war in await api.list_warehouses(player.token, 100):
            if war.status != "Open" or war.players >= war.max_players or war.entry_fee > funds:
                continue
            return await api.get_warehouse(player.token, war.public_warehouse_id)
        return None

    war = await wait_for(joinable_war, WAR_WAIT_S, 5.0)
    found = f"{war.tier} {war.players}/{war.max_players}" if war else ""
    if not probe.check("P5 joinable open war found", war is not None, found):
        return
    assert war is not None
    warehouse_id = war.public_warehouse_id
    cap = war_cap(war)
    step = int(min(war.increments))
    before_join = await player.available() or Decimal(0)
    await api.join_warehouse(player.token, warehouse_id)

    async def lobby_filled() -> int | None:
        players = (await api.get_warehouse(player.token, warehouse_id)).players
        return players if players >= 3 else None

    players = await wait_for(lobby_filled, LOBBY_WAIT_S, 1.0)
    probe.check("P5 lobby reached 3 players within 15 s", players is not None, str(players))

    async def bidding() -> WarehouseDetailsDto | None:
        detail = await api.get_warehouse(player.token, warehouse_id)
        return detail if detail.status == "Bidding" else None

    detail = await wait_for(bidding, 90.0, 1.0)
    if not probe.check("P5 war entered Bidding", detail is not None):
        return

    async def fee_confirmed() -> WarehouseDetailsDto | None:
        detail = await api.get_warehouse(player.token, warehouse_id)
        return detail if detail.participant_state == "Active" else None

    confirmed = await wait_for(fee_confirmed, FEE_CONFIRM_WAIT_S, 1.0)
    probe.check("P5 player entry fee confirmed", confirmed is not None)
    try:
        await api.raise_warehouse(player.token, warehouse_id, step)
        probe.check(f"P5 player raised by {step}", True)
    except ApiError as error:
        probe.check(f"P5 player raised by {step}", False, f"{error.status} {error}")

    over_cap: list[Decimal] = []
    last_price = None
    was_leader = False
    while True:
        detail = await api.get_warehouse(player.token, warehouse_id)
        outbid = detail.current_price != last_price and was_leader and not detail.is_leader
        if outbid and float(detail.current_price) > cap:
            over_cap.append(detail.current_price)
        last_price = detail.current_price
        was_leader = detail.is_leader
        if detail.status in ("Settled", "Cancelled"):
            break
        await asyncio.sleep(1.0)

    probe.check("P5 fleet raises over the player stayed under the cap", not over_cap, str(over_cap))
    probe.check(
        "P5 war settled or cancelled for players present",
        detail.status == "Settled" or detail.cancellation_reason != "Not enough players",
        f"{detail.status} {detail.cancellation_reason or ''}",
    )
    if detail.status == "Settled" and detail.is_leader:
        probe.check("P5 winner sees the manifest", detail.manifest is not None)
        value = sum((item.price for item in detail.manifest or []), Decimal(0))
        probe.check(
            "P5 winner paid under the cap of the manifest value",
            float(detail.current_price) <= float(value) * BUY_CAP + step,
            f"{detail.current_price} vs {value}",
        )

        async def delivered() -> bool | None:
            inventory = await api.get_inventory(player.token)
            return True if len(inventory) >= len(detail.manifest or []) else None

        probe.check("P5 manifest items delivered", await wait_for(delivered, 60.0, 3.0) is True)
    else:

        async def refunded() -> Decimal | None:
            funds = await player.available()
            return funds if funds is not None and funds >= before_join else None

        probe.check("P5 entry fee returned", await wait_for(refunded, 60.0, 3.0) is not None)


async def phase_limits(
    probe: Probe, fleet_size: int, rate_floor: float, rate_ceiling: float
) -> None:
    logs = bots_logs()
    probe.check("P6 no 429 in the fleet log", count_429(logs) == 0, str(count_429(logs)))
    lines = summaries(logs)
    latest = lines[-1] if lines else {}
    low, high = ACTIVE_LISTINGS_RANGE.get(fleet_size, (5, 30))
    probe.check("P6 fleet bids per minute above zero", latest.get("bids_per_min", 0) > 0)
    seen = "no summary"

    async def steered() -> str | None:
        nonlocal seen
        lines = summaries(bots_logs())
        if len(lines) < 2:
            return None
        active = lines[-1]["active_listings"]
        rate, before = lines[-1]["knobs"]["listing_rate"], lines[-2]["knobs"]["listing_rate"]
        seen = f"{active} listings, listing_rate {before:.2f} then {rate:.2f}"
        if low <= active <= high:
            return seen
        if active > high and (rate < before or rate <= rate_floor):
            return seen
        if active < low and (rate > before or rate >= rate_ceiling):
            return seen
        return None

    steering = await wait_for(steered, STEERING_WAIT_S, 10.0)
    probe.check(
        f"P6 director steers active listings toward {low} to {high}", steering is not None, seen
    )
    consumers = fleet_queue_consumers()
    probe.check("P6 one consumer on the fleet queue", consumers == 1, str(consumers))


async def phase_resilience(probe: Probe) -> None:
    restarts_before = bots_restart_count()
    compose("restart", "rabbitmq")

    async def reconnected() -> bool | None:
        return True if fleet_queue_consumers() == 1 else None

    probe.check("P7 feed reconnected within 30 s", await wait_for(reconnected, 30.0, 2.0) is True)
    summaries_before = len(summaries(bots_logs()))

    async def bidding_again() -> bool | None:
        lines = summaries(bots_logs())
        return True if len(lines) > summaries_before and lines[-1]["bids_per_min"] > 0 else None

    probe.check(
        "P7 fleet keeps bidding after the broker restart",
        await wait_for(bidding_again, 180.0, 10.0) is True,
    )

    compose("restart", "api")

    async def api_ready() -> bool | None:
        return True if await health_status() == 200 else None

    probe.check("P7 api back after restart", await wait_for(api_ready, 120.0, 3.0) is True)
    probe.check(
        "P7 bots container survived the api restart",
        bots_state() == "running" and bots_restart_count() == restarts_before,
        f"state {bots_state()} restarts {bots_restart_count()}",
    )
    summaries_before = len(summaries(bots_logs()))
    probe.check(
        "P7 fleet bids again within 2 minutes",
        await wait_for(bidding_again, 180.0, 10.0) is True,
    )


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fleet-size", type=int, default=10)
    parser.add_argument("--resilience", action="store_true")
    args = parser.parse_args()

    settings = load_settings(BOTS_DIR / "bots.toml", os.environ)
    key_file = os.environ.get(
        "BOTS_API_KEY_FILE", str(ROOT / "Infrastructure" / "secrets" / "bots-api-key.secret")
    )
    api_key = read_secret(Path(key_file))
    bucket = TokenBucket(settings.budget.rate_per_s, settings.budget.burst)
    api = ProbeClient(GATEWAY_URL, bucket, LoginGate(settings.budget.login_interval_s))
    probe = Probe()

    async def guarded(name: str, phase: Awaitable[None]) -> None:
        try:
            await phase
        except ApiError as error:
            probe.check(f"{name} finished without API errors", False, f"{error.status} {error}")

    try:
        await guarded("P1", phase_health(probe, args.fleet_size))
        player = await phase_player(probe, api)
        if player is not None:
            await guarded("P3", phase_sell(probe, api, player))
            await guarded("P4", phase_buy(probe, api, player))
            await guarded("P5", phase_war(probe, api, player, api_key))
        await phase_limits(
            probe,
            args.fleet_size,
            settings.listing.listing_rate_min,
            settings.listing.listing_rate_max,
        )
        if args.resilience:
            await guarded("P7", phase_resilience(probe))
    finally:
        await api.aclose()
    return probe.summary()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
