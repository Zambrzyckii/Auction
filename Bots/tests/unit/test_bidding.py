import random
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest

from auction_bots.api.models import Rarity
from auction_bots.director.knobs import Knobs
from auction_bots.fleet.archetypes import ArchetypeName
from auction_bots.fleet.persona import Persona
from auction_bots.fleet.policies.bidding import BidAction, BidDecision, decide_bid, p_yield
from auction_bots.market.state import AuctionView

KNOBS = Knobs.from_generosity(0.3, listing_rate=6.0)
BUY_CAP_LIMIT = 815  # 1000 * (0.95 - 0.45 * 0.3)
NOW = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
SELF = UUID(int=1)
OTHER_BOT = UUID(int=2)
THIRD_BOT = UUID(int=3)
HUMAN = UUID(int=4)
FLEET = {SELF, OTHER_BOT, THIRD_BOT}


def is_human(user_id: UUID | None) -> bool:
    return user_id is not None and user_id not in FLEET


def persona_of(
    archetype: ArchetypeName,
    *,
    single_bid: bool = False,
    yield_bias: float = 0.0,
) -> Persona:
    return Persona(
        index=0,
        archetype=archetype,
        multiplier_range=(0.55, 0.95),
        bankroll=10_000,
        step_range=(0.03, 0.08),
        reaction_delay_s=5.0,
        tick_s=30.0,
        activity=0.6,
        rarity_taste={rarity: 1.0 for rarity in Rarity},
        favourite_rarities=frozenset(),
        name_taste=(),
        yield_bias=yield_bias,
        max_open_bids=2,
        max_listings=3,
        single_bid=single_bid,
        bot_war_cap=0.6,
        list_batch=(1, 1),
        first_name="Kevin",
        surname="Mercer",
    )


def view(
    seller: UUID | None,
    leader: UUID | None,
    current: int,
    *,
    official: int | None = 1000,
    ends_in_s: float = 300.0,
    human_bids: int = 0,
) -> AuctionView:
    return AuctionView(
        auction_id=UUID(int=99),
        seller_id=seller,
        leader_id=leader,
        current_price=Decimal(current),
        official_price=None if official is None else Decimal(official),
        rarity=Rarity.Common,
        item_name="Pocket TV",
        ends_on=NOW + timedelta(seconds=ends_in_s),
        human_bids=human_bids,
    )


def decide(
    auction: AuctionView,
    seed: int,
    *,
    persona: Persona | None = None,
    wallet: int = 10_000,
    valuation: int = 900,
) -> BidDecision:
    return decide_bid(
        auction,
        persona or persona_of(ArchetypeName.Flipper),
        Decimal(wallet),
        KNOBS,
        is_human,
        NOW,
        random.Random(seed),
        self_id=SELF,
        valuation=Decimal(valuation),
    )


def test_agent_does_not_bid_without_an_official_price() -> None:
    auction = view(HUMAN, None, 100, official=None)

    for seed in range(100):
        assert decide(auction, seed).action is BidAction.WAIT


def test_bot_never_bids_on_its_own_auction_or_when_leading() -> None:
    own = view(SELF, HUMAN, 500)
    leading = view(OTHER_BOT, SELF, 500)

    for seed in range(100):
        assert decide(own, seed).action is not BidAction.BID
        assert decide(leading, seed).action is not BidAction.BID


def test_first_bid_on_a_human_listing_is_at_least_official() -> None:
    auction = view(HUMAN, None, 300)

    for seed in range(100):
        decision = decide(auction, seed)

        assert decision.action is BidAction.BID
        assert decision.amount is not None
        assert decision.amount >= 1000


def test_no_bot_bids_above_its_valuation_on_a_human_listing() -> None:
    premium_cap = round(900 * KNOBS.sell_bonus)

    for seed in range(1000):
        decision = decide(view(HUMAN, OTHER_BOT, 1020), seed)
        if decision.action is BidAction.BID:
            assert decision.amount is not None
            assert decision.amount <= premium_cap
    for seed in range(100):
        assert decide(view(HUMAN, None, 1200), seed).action is not BidAction.BID


def test_human_leader_is_outbid_only_up_to_the_buy_cap() -> None:
    amounts = []

    for current in (700, 790):
        auction = view(OTHER_BOT, HUMAN, current, human_bids=1)
        for seed in range(1000):
            decision = decide(auction, seed)
            if decision.action is BidAction.BID:
                assert decision.amount is not None
                amounts.append(decision.amount)

    assert amounts
    assert all(amount <= BUY_CAP_LIMIT for amount in amounts)


def test_bot_never_outbids_a_human_in_the_final_window() -> None:
    auction = view(OTHER_BOT, HUMAN, 700, ends_in_s=39.0, human_bids=1)

    for seed in range(1000):
        assert decide(auction, seed).action is not BidAction.BID


def test_two_humans_on_a_bot_auction_leave_bots_out() -> None:
    auction = view(OTHER_BOT, HUMAN, 700, human_bids=3)

    for seed in range(100):
        assert decide(auction, seed).action is BidAction.YIELD


def test_p_yield_at_default_knobs() -> None:
    assert p_yield(KNOBS, 1, 0.0) == pytest.approx(0.45)
    assert p_yield(KNOBS, 3, 0.0) == 1.0


def test_bid_stays_within_wallet_and_above_current() -> None:
    auction = view(OTHER_BOT, THIRD_BOT, 700)
    bids = 0

    for seed in range(1000):
        decision = decide(auction, seed, wallet=750)
        if decision.action is BidAction.BID:
            bids += 1
            assert decision.amount is not None
            assert 701 <= decision.amount <= 750
    assert bids
    for seed in range(100):
        assert decide(auction, seed, wallet=600).action is not BidAction.BID


def test_bot_listing_war_stops_at_the_buy_cap() -> None:
    auction = view(OTHER_BOT, THIRD_BOT, 780)

    for seed in range(1000):
        decision = decide(auction, seed)
        if decision.action is BidAction.BID:
            assert decision.amount is not None
            assert decision.amount <= BUY_CAP_LIMIT


def test_sniper_waits_until_the_final_window_against_bots() -> None:
    sniper = persona_of(ArchetypeName.Sniper, single_bid=True)
    early = view(OTHER_BOT, THIRD_BOT, 700)
    late = view(OTHER_BOT, THIRD_BOT, 700, ends_in_s=35.0)

    for seed in range(100):
        assert decide(early, seed, persona=sniper, valuation=800).action is not BidAction.BID

        decision = decide(late, seed, persona=sniper, valuation=800)

        assert decision.action is BidAction.BID
        assert decision.amount is not None
        assert 701 <= decision.amount <= 800
