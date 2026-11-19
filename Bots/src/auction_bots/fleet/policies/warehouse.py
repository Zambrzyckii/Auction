import random
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from auction_bots.api.models import WarehouseDetailsDto, WarehouseSummaryDto
from auction_bots.director.knobs import Knobs
from auction_bots.fleet.persona import Persona
from auction_bots.fleet.policies.bidding import p_yield

HUMAN_LOBBY_BOTS = 2
THIRD_BOT_P = 0.5


@dataclass(frozen=True)
class EstimateVariant:
    weight: int
    min_multiplier: float
    max_multiplier: float


def decode_true_value(
    estimate_min: Decimal, estimate_max: Decimal, variants: Sequence[EstimateVariant]
) -> Decimal | None:
    matches = []
    for variant in variants:
        candidate = estimate_min / Decimal(str(variant.min_multiplier))
        expected_max = candidate * Decimal(str(variant.max_multiplier))
        tolerance = 5 + 5 * variant.max_multiplier / variant.min_multiplier
        if abs(expected_max - estimate_max) <= Decimal(str(tolerance)):
            matches.append(candidate)
    return matches[0] if len(matches) == 1 else None


def human_cap(
    war: WarehouseSummaryDto, knobs: Knobs, variants: Sequence[EstimateVariant]
) -> Decimal:
    buy_cap = Decimal(str(knobs.buy_cap))
    true_value = decode_true_value(war.estimate_min, war.estimate_max, variants)
    if true_value is None:
        return buy_cap * war.estimate_min / Decimal("1.3")
    return buy_cap * true_value


def decide_join(
    war: WarehouseSummaryDto,
    fleet_members_in_war: int,
    persona: Persona,
    wallet_available: Decimal,
    knobs: Knobs,
    rng: random.Random,
    *,
    bot_only_wars: int,
) -> bool:
    if wallet_available < war.entry_fee or war.players >= war.max_players:
        return False
    if war.players > fleet_members_in_war:
        if fleet_members_in_war < HUMAN_LOBBY_BOTS:
            return True
        return fleet_members_in_war == HUMAN_LOBBY_BOTS and rng.random() < THIRD_BOT_P
    return bot_only_wars == 0


def decide_raise(
    war: WarehouseDetailsDto,
    human_leads: bool,
    human_raises: int,
    persona: Persona,
    knobs: Knobs,
    rng: random.Random,
    *,
    cap: Decimal,
    bot_war_target: Decimal,
    humans_in_war: bool,
) -> int | None:
    if human_leads and rng.random() < p_yield(knobs, human_raises, persona.yield_bias):
        return None
    if humans_in_war and not human_leads:
        return None
    if not human_leads and war.current_price >= bot_war_target:
        return None
    limit = cap if human_leads else war.entry_fee
    fitting = [int(step) for step in war.increments if war.current_price + step <= limit]
    if not fitting:
        return None
    return rng.choice(fitting)
