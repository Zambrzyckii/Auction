import random
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from auction_bots.director.knobs import Knobs
from auction_bots.fleet.persona import Persona
from auction_bots.market.state import AuctionView


class BidAction(StrEnum):
    BID = "bid"
    WAIT = "wait"
    YIELD = "yield"


@dataclass(frozen=True)
class BidDecision:
    action: BidAction
    amount: int | None = None


def p_yield(knobs: Knobs, human_bids: int, yield_bias: float) -> float:
    raw = knobs.yield_base + 0.3 * (human_bids - 1) + yield_bias
    return max(0.0, min(1.0, raw))


def in_final_window(ends_on: datetime, now: datetime, guard_s: float) -> bool:
    return (ends_on - now).total_seconds() <= guard_s


def next_step(current: Decimal, persona: Persona, rng: random.Random) -> int:
    low, high = persona.step_range
    return max(1, round(float(current) * rng.uniform(low, high)))


def decide_bid(
    auction: AuctionView,
    persona: Persona,
    wallet_available: Decimal,
    knobs: Knobs,
    is_human: Callable[[UUID | None], bool],
    now: datetime,
    rng: random.Random,
    *,
    self_id: UUID,
    valuation: Decimal,
    guard_s: float = 40.0,
) -> BidDecision:
    if auction.official_price is None:
        return BidDecision(BidAction.WAIT)
    if auction.seller_id == self_id or auction.leader_id == self_id:
        return BidDecision(BidAction.WAIT)
    value = valuation
    if is_human(auction.seller_id):
        value = Decimal(round(float(valuation) * knobs.sell_bonus))

    final = auction.ends_on is None or in_final_window(auction.ends_on, now, guard_s)
    human_leader = is_human(auction.leader_id)

    if human_leader and final:
        return BidDecision(BidAction.YIELD)
    if human_leader and rng.random() < p_yield(knobs, auction.human_bids, persona.yield_bias):
        return BidDecision(BidAction.YIELD)
    if persona.single_bid and not final:
        return BidDecision(BidAction.WAIT)

    step = next_step(auction.current_price, persona, rng)
    bid = value if persona.single_bid else auction.current_price + step

    if auction.leader_id is None and is_human(auction.seller_id):
        bid = max(bid, auction.official_price)

    cap = value

    if human_leader or not is_human(auction.seller_id):
        cap = min(cap, Decimal(round(float(auction.official_price) * knobs.buy_cap)))

    amount = int(min(bid, cap, wallet_available))

    if amount < auction.current_price + 1:
        return BidDecision(BidAction.WAIT)

    return BidDecision(BidAction.BID, amount)
