import asyncio
import logging
import random
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from auction_bots.api.client import ApiError, MarketApi
from auction_bots.api.models import WarehouseSummaryDto
from auction_bots.config import Settings
from auction_bots.director.controller import Director
from auction_bots.fleet.agent import BotAgent
from auction_bots.fleet.identity import BotSession
from auction_bots.fleet.policies.warehouse import (
    THIRD_BOT_P,
    EstimateVariant,
    decide_join,
    decide_raise,
    human_cap,
)
from auction_bots.fleet.registry import FleetRegistry
from auction_bots.market.ledger import Outcome, OutcomeLedger

MIN_PLAYERS = 3
ESTIMATE_VARIANTS = (
    EstimateVariant(weight=1, min_multiplier=0.3, max_multiplier=0.7),
    EstimateVariant(weight=1, min_multiplier=0.8, max_multiplier=1.2),
    EstimateVariant(weight=1, min_multiplier=1.3, max_multiplier=2.5),
)

log = logging.getLogger("auction_bots.watcher")


@dataclass
class WarState:
    members: set[UUID] = field(default_factory=set)
    rejected: set[UUID] = field(default_factory=set)
    humans_seen: bool = False
    human_raises: int = 0
    human_leads: bool = False
    last_price: Decimal = Decimal(0)
    last_own_raiser: UUID | None = None
    bot_war_target: Decimal | None = None
    third_bot: bool | None = None
    settled: bool = False


class WarehouseWatcher:
    def __init__(
        self,
        api: MarketApi,
        agents: Mapping[UUID, BotAgent],
        coordinator: Callable[[], BotSession],
        director: Director,
        ledger: OutcomeLedger,
        registry: FleetRegistry,
        settings: Settings,
        rng: random.Random,
        clock: Callable[[], datetime],
    ) -> None:
        self._api = api
        self._agents = agents
        self._coordinator = coordinator
        self._director = director
        self._ledger = ledger
        self._registry = registry
        self._settings = settings
        self._rng = rng
        self._clock = clock
        self._last_list: datetime | None = None
        self.wars: dict[UUID, WarState] = {}

    async def poll_once(self) -> None:
        now = self._clock()
        interval = self._settings.warehouses.list_poll_s
        if self._last_list is None or (now - self._last_list).total_seconds() >= interval:
            try:
                await self._poll_list()
            except ApiError as error:
                log.warning("warehouse list failed", extra={"status": error.status})
            except Exception:
                log.exception("warehouse list crashed")
            self._last_list = now
        await self._poll_details()

    async def run(self, stop: asyncio.Event) -> None:
        interval = self._settings.warehouses.detail_poll_s
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=interval)
            except TimeoutError:
                await self.poll_once()

    async def _poll_list(self) -> None:
        summaries = await self._api.list_warehouses(self._coordinator().token, 100)
        for summary in summaries:
            war = self.wars.setdefault(summary.public_warehouse_id, WarState())
            if summary.players > len(war.members):
                war.humans_seen = True
            if summary.status == "Open":
                await self._fill(summary, war)

    async def _fill(self, summary: WarehouseSummaryDto, war: WarState) -> None:
        players = summary.players
        warehouse_id = summary.public_warehouse_id
        if war.third_bot is None:
            war.third_bot = self._rng.random() < THIRD_BOT_P
        bot_only_elsewhere = sum(
            1
            for other_id, other in self.wars.items()
            if other_id != warehouse_id
            and other.members
            and not other.humans_seen
            and not other.settled
        )
        for user_id in sorted(self._agents, key=str):
            if user_id in war.members or user_id in war.rejected:
                continue
            if not war.humans_seen and players >= MIN_PLAYERS:
                break
            agent = self._agents[user_id]
            view = summary.model_copy(update={"players": players})
            joins = decide_join(
                view,
                len(war.members),
                agent.persona,
                agent.wallet_hint(),
                self._director.knobs,
                bot_only_wars=bot_only_elsewhere,
                third_bot=war.third_bot,
            )
            if not joins:
                continue
            try:
                await self._api.join_warehouse(agent.session.token, warehouse_id)
            except ApiError as error:
                log.warning("join failed", extra={"status": error.status})
                if error.status == 409:
                    war.rejected.add(user_id)
                continue
            war.members.add(user_id)
            players += 1

    async def _poll_details(self) -> None:
        for warehouse_id, war in list(self.wars.items()):
            if not war.members or war.settled:
                continue
            try:
                await self._visit(warehouse_id, war)
            except ApiError as error:
                log.warning("warehouse detail failed", extra={"status": error.status})
            except Exception:
                log.exception("warehouse detail crashed")

    async def _visit(self, warehouse_id: UUID, war: WarState) -> None:
        reader = self._agents[min(war.members, key=str)]
        detail = await self._api.get_warehouse(reader.session.token, warehouse_id)
        if detail.current_price != war.last_price:
            war.human_raises += 1
            war.human_leads = True
            war.last_price = detail.current_price
        if detail.status == "Bidding":
            await self._consider_raise(warehouse_id, war, detail)
        elif detail.status in ("Settled", "Cancelled"):
            await self._record_outcome(warehouse_id, war, detail)
            war.settled = True

    async def _consider_raise(self, warehouse_id: UUID, war: WarState, detail) -> None:
        if war.bot_war_target is None:
            span = self._rng.uniform(
                self._settings.warehouses.bot_war_target_min,
                self._settings.warehouses.bot_war_target_max,
            )
            mid = (detail.estimate_min + detail.estimate_max) / 2
            war.bot_war_target = Decimal(str(round(span, 3))) * mid
        candidates = sorted(
            (member for member in war.members if member != war.last_own_raiser), key=str
        )
        if not candidates:
            return
        raiser = self._agents[self._rng.choice(candidates)]
        cap = human_cap(detail, self._director.knobs, ESTIMATE_VARIANTS)
        step = decide_raise(
            detail,
            war.human_leads,
            war.human_raises,
            raiser.persona,
            self._director.knobs,
            self._rng,
            cap=cap,
            bot_war_target=war.bot_war_target,
            humans_in_war=war.humans_seen,
        )
        if step is None:
            return
        try:
            await self._api.raise_warehouse(raiser.session.token, warehouse_id, step)
        except ApiError as error:
            log.warning("raise failed", extra={"status": error.status})
            return
        war.last_price = detail.current_price + step
        war.last_own_raiser = raiser.session.user_id
        war.human_leads = False

    async def _record_outcome(self, warehouse_id: UUID, war: WarState, detail) -> None:
        if detail.status != "Settled" or not war.human_leads:
            return
        for member in sorted(war.members, key=str):
            try:
                mine = await self._api.get_warehouse(
                    self._agents[member].session.token, warehouse_id
                )
            except ApiError:
                continue
            if mine.is_leader:
                return
        official = sum((item.price for item in detail.manifest or []), Decimal(0))
        if official <= 0:
            return
        self._ledger.record(
            Outcome(warehouse_id, "human_won_war", official, detail.current_price, self._clock())
        )
