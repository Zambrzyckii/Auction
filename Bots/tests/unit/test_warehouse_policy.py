import random
from decimal import Decimal
from uuid import UUID

from auction_bots.api.models import Rarity, WarehouseDetailsDto, WarehouseSummaryDto
from auction_bots.director.knobs import Knobs
from auction_bots.fleet.archetypes import ArchetypeName
from auction_bots.fleet.persona import Persona
from auction_bots.fleet.policies.warehouse import (
    EstimateVariant,
    decide_join,
    decide_raise,
    decode_true_value,
    human_cap,
)

KNOBS = Knobs.from_generosity(0.3, listing_rate=6.0)
VARIANTS = (
    EstimateVariant(weight=5, min_multiplier=0.3, max_multiplier=0.7),
    EstimateVariant(weight=4, min_multiplier=0.8, max_multiplier=1.2),
    EstimateVariant(weight=1, min_multiplier=1.3, max_multiplier=2.5),
)


def persona_of() -> Persona:
    return Persona(
        index=0,
        archetype=ArchetypeName.Flipper,
        multiplier_range=(0.55, 0.95),
        bankroll=10_000,
        step_range=(0.03, 0.08),
        reaction_delay_s=5.0,
        tick_s=30.0,
        activity=0.6,
        rarity_taste={rarity: 1.0 for rarity in Rarity},
        favourite_rarities=frozenset(),
        name_taste=(),
        yield_bias=0.0,
        max_open_bids=2,
        max_listings=3,
        single_bid=False,
        bot_war_cap=0.6,
        list_batch=(1, 1),
        first_name="Kevin",
        surname="Mercer",
    )


def war(
    *,
    estimate_min: int = 300,
    estimate_max: int = 700,
    entry_fee: int = 100,
    current_price: int = 0,
    players: int = 1,
    max_players: int = 6,
) -> WarehouseSummaryDto:
    return WarehouseSummaryDto(
        public_warehouse_id=UUID(int=7),
        tier="Standard",
        status="Open",
        estimate_min=Decimal(estimate_min),
        estimate_max=Decimal(estimate_max),
        entry_fee=Decimal(entry_fee),
        current_price=Decimal(current_price),
        item_count=3,
        players=players,
        max_players=max_players,
    )


def details(
    *,
    current_price: int,
    entry_fee: int = 100,
    increments: tuple[int, ...] = (10, 25, 50),
) -> WarehouseDetailsDto:
    return WarehouseDetailsDto(
        public_warehouse_id=UUID(int=7),
        tier="Standard",
        status="Bidding",
        estimate_min=Decimal(300),
        estimate_max=Decimal(700),
        entry_fee=Decimal(entry_fee),
        current_price=Decimal(current_price),
        item_count=3,
        players=3,
        max_players=6,
        is_participant=True,
        is_leader=False,
        increments=[Decimal(value) for value in increments],
    )


def join(
    lobby: WarehouseSummaryDto,
    members: int,
    seed: int,
    *,
    wallet: int = 1000,
    bot_only_wars: int = 0,
    third_bot: bool = False,
) -> bool:
    return decide_join(
        lobby,
        members,
        persona_of(),
        Decimal(wallet),
        KNOBS,
        bot_only_wars=bot_only_wars,
        third_bot=third_bot,
    )


def raise_step(
    lobby: WarehouseDetailsDto,
    seed: int,
    *,
    human_leads: bool,
    human_raises: int = 1,
    cap: int = 1_000_000,
    target: int = 1_000_000,
    humans_in_war: bool = False,
) -> int | None:
    return decide_raise(
        lobby,
        human_leads,
        human_raises,
        persona_of(),
        KNOBS,
        random.Random(seed),
        cap=Decimal(cap),
        bot_war_target=Decimal(target),
        humans_in_war=humans_in_war,
    )


def test_true_value_is_decoded_from_the_estimate_ratio() -> None:
    for low, high in ((300, 700), (800, 1200), (1300, 2500)):
        assert decode_true_value(Decimal(low), Decimal(high), VARIANTS) == Decimal(1000)


def test_ambiguous_ratio_falls_back_below_true_value() -> None:
    assert decode_true_value(Decimal(10), Decimal(20), VARIANTS) is None

    cap = human_cap(war(estimate_min=10, estimate_max=20), KNOBS, VARIANTS)

    assert cap == Decimal(str(KNOBS.buy_cap)) * Decimal(10) / Decimal("1.3")


def test_human_lobby_gets_two_bots_and_only_the_rolled_third() -> None:
    for members, expected in ((0, True), (1, True), (3, False)):
        for seed in range(200):
            assert join(war(players=1 + members), members, seed) is expected

    assert join(war(players=3), 2, 0, third_bot=True) is True
    assert join(war(players=3), 2, 0, third_bot=False) is False


def test_only_one_bot_only_war_at_a_time() -> None:
    empty = war(players=0)

    assert not any(join(empty, 0, seed, bot_only_wars=1) for seed in range(100))
    assert any(join(empty, 0, seed, bot_only_wars=0) for seed in range(100))


def test_no_join_without_the_entry_fee() -> None:
    for seed in range(100):
        assert join(war(players=1), 0, seed, wallet=50) is False


def test_no_join_into_a_full_lobby() -> None:
    full = war(players=6, max_players=6)

    for seed in range(100):
        assert join(full, 1, seed) is False


def test_raise_against_a_human_never_passes_the_cap() -> None:
    lobby = details(current_price=560)
    raised = [
        step
        for seed in range(500)
        if (step := raise_step(lobby, seed, human_leads=True, cap=600)) is not None
    ]

    assert raised
    assert all(step in (10, 25) for step in raised)
    for seed in range(200):
        assert raise_step(details(current_price=595), seed, human_leads=True, cap=600) is None


def test_bot_war_never_exceeds_the_entry_fee() -> None:
    lobby = details(current_price=80, entry_fee=100)
    results = [raise_step(lobby, seed, human_leads=False, human_raises=0) for seed in range(200)]

    assert any(step is not None for step in results)
    assert all(step is None or 80 + step <= 100 for step in results)


def test_raise_uses_only_listed_increments() -> None:
    lobby = details(current_price=0)

    for seed in range(200):
        human_step = raise_step(lobby, seed, human_leads=True)
        bot_step = raise_step(lobby, seed, human_leads=False, human_raises=0)

        assert human_step is None or human_step in (10, 25, 50)
        assert bot_step is None or bot_step in (10, 25, 50)


def test_no_raise_over_a_fleet_leader_while_humans_are_in_the_war() -> None:
    lobby = details(current_price=40, entry_fee=1000)

    for seed in range(200):
        assert raise_step(lobby, seed, human_leads=False, humans_in_war=True) is None

    raised = [
        raise_step(lobby, seed, human_leads=False, humans_in_war=False) for seed in range(200)
    ]
    assert any(step is not None for step in raised)
