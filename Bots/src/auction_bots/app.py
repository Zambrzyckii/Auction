import asyncio
import logging
import os
import random
import signal
import statistics
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from auction_bots.api.budget import LoginGate, TokenBucket
from auction_bots.api.client import (
    ApiError,
    ApiUnavailable,
    ClientStats,
    GatewayClient,
    MarketApi,
)
from auction_bots.config import Settings, load_settings
from auction_bots.director.controller import Director
from auction_bots.director.knobs import Knobs
from auction_bots.feed.consumer import FeedConsumer
from auction_bots.feed.dedupe import RecentIds
from auction_bots.fleet.agent import AuctionGate, BotAgent
from auction_bots.fleet.identity import (
    BotSession,
    derive_identity,
    fingerprint,
    provision_or_login,
)
from auction_bots.fleet.persona import sample_persona
from auction_bots.fleet.registry import FleetRegistry
from auction_bots.logging import configure_logging
from auction_bots.market.ledger import OutcomeLedger
from auction_bots.market.state import MarketState
from auction_bots.secrets import read_secret
from auction_bots.warehouses.watcher import WarehouseWatcher

SUMMARY_INTERVAL_S = 60.0

log = logging.getLogger("auction_bots.app")


@dataclass(frozen=True)
class FleetSummary:
    logged_in: int
    topups: int
    pending_listings: int
    bids_per_min: float
    saga_p50_s: float | None


def summary_line(
    stats: ClientStats,
    ledger: OutcomeLedger,
    state: MarketState,
    knobs: Knobs,
    fleet: FleetSummary,
) -> dict[str, object]:
    outcomes = ledger.recent(500)
    paid = sum((o.final_price for o in outcomes if o.side == "human_sold"), Decimal(0))
    received = sum((o.final_price for o in outcomes if o.side != "human_sold"), Decimal(0))
    return {
        "logged_in": fleet.logged_in,
        "topups": fleet.topups,
        "paid_to_humans": int(paid),
        "received_from_humans": int(received),
        "active_listings": len(state.active()),
        "pending_listings": fleet.pending_listings,
        "bids_per_min": fleet.bids_per_min,
        "rate_limited": stats.rate_limited,
        "conflicts": stats.conflicts,
        "saga_p50_s": fleet.saga_p50_s,
        "knobs": asdict(knobs),
    }


async def run(
    settings: Settings,
    api_key: str,
    amqp_password: str,
    *,
    api: MarketApi | None = None,
    consumer: FeedConsumer | None = None,
    stop: asyncio.Event | None = None,
) -> None:
    stop = stop or asyncio.Event()

    def clock() -> datetime:
        return datetime.now(UTC)

    registry = FleetRegistry(expected=settings.fleet.size)
    ledger = OutcomeLedger(capacity=max(settings.director.window * 2, 100))
    state = MarketState(
        registry.is_human, ledger, clock, prune_after_s=settings.market.prune_after_s
    )
    recent = RecentIds()
    if api is None:
        bucket = TokenBucket(settings.budget.rate_per_s, settings.budget.burst)
        login_gate = LoginGate(settings.budget.login_interval_s)
        api = GatewayClient(settings.gateway.url, bucket, login_gate)
    if consumer is None:
        amqp = settings.amqp
        url = f"amqp://{amqp.user}:{amqp_password}@{amqp.host}:{amqp.port}/{amqp.vhost.lstrip('/')}"
        queue_name = f"{amqp.queue_prefix}{fingerprint(api_key)}"
        consumer = FeedConsumer(url, queue_name, state, amqp, recent)

    sessions: dict[int, BotSession] = {}
    personas = {}
    for index in range(settings.fleet.size):
        if stop.is_set():
            return
        persona_rng = random.Random(settings.fleet.seed + index)
        persona = sample_persona(index, persona_rng, settings)
        identity = derive_identity(index, api_key, persona, birthday=settings.persona.birthday)
        try:
            session = await provision_or_login(api, api_key, identity, persona_rng, clock())
        except ApiError as error:
            log.warning("bot %03d provisioning failed", index, extra={"status": error.status})
            registry.skip(index)
            continue
        if session is None:
            registry.skip(index)
            continue
        registry.add(index, session.user_id)
        sessions[index] = session
        personas[index] = persona
        if (index + 1) % 10 == 0:
            log.info("provisioned %d of %d bots", index + 1, settings.fleet.size)
    if not registry.complete:
        log.warning("fleet registry is incomplete after provisioning")
    if not sessions:
        log.error("no bot could log in, idling until stop")
        await stop.wait()
        return

    try:
        await state.resync(api)
    except ApiError as error:
        log.warning("first resync failed", extra={"status": error.status})
    state.enable_outcomes()

    saga_bucket = TokenBucket(settings.budget.saga_rate_per_s, settings.budget.saga_burst)
    director = Director(ledger, state, saga_bucket, settings, clock)
    auction_gate = AuctionGate()

    def relogin_for(index: int):
        async def relogin() -> BotSession:
            identity = derive_identity(
                index, api_key, personas[index], birthday=settings.persona.birthday
            )
            rng = random.Random(settings.fleet.seed + index)
            session = await provision_or_login(api, api_key, identity, rng, clock())
            if session is None:
                raise ApiUnavailable(503, "relogin failed")
            sessions[index] = session
            return session

        return relogin

    agents: dict[UUID, BotAgent] = {}
    for index, session in sorted(sessions.items()):
        agent = BotAgent(
            personas[index],
            session,
            api,
            state,
            registry,
            lambda: director.knobs,
            saga_bucket,
            auction_gate,
            random.Random(f"{settings.fleet.seed}:{index}"),
            clock,
            asyncio.sleep,
            settings,
            relogin_for(index),
        )
        agents[session.user_id] = agent

    def coordinator() -> BotSession:
        return sessions[min(sessions)]

    watcher = WarehouseWatcher(
        api,
        agents,
        coordinator,
        director,
        ledger,
        registry,
        settings,
        random.Random(f"{settings.fleet.seed}:watcher"),
        clock,
    )
    stats = getattr(api, "stats", ClientStats())

    async def summary_loop() -> None:
        previous_bids = 0
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=SUMMARY_INTERVAL_S)
            except TimeoutError:
                total_bids = sum(agent.bids_placed for agent in agents.values())
                latencies = [
                    latency for agent in agents.values() for latency in agent.saga_latencies[-20:]
                ]
                fleet = FleetSummary(
                    logged_in=len(sessions),
                    topups=sum(agent.topups_total for agent in agents.values()),
                    pending_listings=sum(agent.tracked_listings for agent in agents.values()),
                    bids_per_min=float(total_bids - previous_bids),
                    saga_p50_s=statistics.median(latencies) if latencies else None,
                )
                previous_bids = total_bids
                log.info(
                    "fleet summary",
                    extra=summary_line(stats, ledger, state, director.knobs, fleet),
                )

    async def resync_loop() -> None:
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=settings.market.resync_interval_s)
            except TimeoutError:
                try:
                    await state.resync(api)
                except ApiError as error:
                    log.warning("resync failed", extra={"status": error.status})

    async def start_agent(agent: BotAgent, delay: float) -> None:
        if delay > 0:
            try:
                await asyncio.wait_for(stop.wait(), timeout=delay)
                return
            except TimeoutError:
                pass
        await agent.run(stop)

    tasks = [
        asyncio.ensure_future(consumer.run(stop)),
        asyncio.ensure_future(director.run(stop)),
        asyncio.ensure_future(watcher.run(stop)),
        asyncio.ensure_future(summary_loop()),
        asyncio.ensure_future(resync_loop()),
    ]
    count = max(len(agents), 1)
    for position, agent in enumerate(agents.values()):
        delay = settings.fleet.startup_ramp_s * position / count
        tasks.append(asyncio.ensure_future(start_agent(agent, delay)))
    log.info("fleet started", extra={"agents": len(agents)})

    await stop.wait()
    _, pending = await asyncio.wait(tasks, timeout=5.0)
    for task in pending:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


def _config_path() -> Path:
    override = os.environ.get("BOTS_CONFIG")
    if override:
        return Path(override)
    local = Path("bots.toml")
    if local.exists():
        return local
    return Path(__file__).resolve().parents[2] / "bots.toml"


def main() -> None:
    settings = load_settings(_config_path(), os.environ)
    api_key = read_secret(settings.secrets.api_key_file)
    amqp_password = read_secret(settings.secrets.amqp_password_file)
    configure_logging("INFO", [api_key, amqp_password])

    async def runner() -> None:
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for signum in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(signum, stop.set)
        await run(settings, api_key, amqp_password, stop=stop)

    asyncio.run(runner())
