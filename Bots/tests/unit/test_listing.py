import random
from datetime import timedelta
from decimal import Decimal
from uuid import UUID

from auction_bots.api.models import Rarity
from auction_bots.director.knobs import Knobs
from auction_bots.fleet.archetypes import ArchetypeName
from auction_bots.fleet.persona import Persona
from auction_bots.fleet.policies.listing import ListingDecision, OwnedItem, decide_listing

KNOBS = Knobs.from_generosity(0.3, listing_rate=6.0)


def persona_of(archetype: ArchetypeName = ArchetypeName.Hawker) -> Persona:
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
        yield_bias=0.0,
        max_open_bids=2,
        max_listings=30,
        single_bid=False,
        bot_war_cap=0.6,
        list_batch=(2, 6),
        first_name="Kevin",
        surname="Mercer",
    )


def owned(
    index: int,
    *,
    official: int = 1000,
    available: bool = True,
    failed: int = 0,
    last_price: int | None = None,
    rarity: Rarity = Rarity.Common,
) -> OwnedItem:
    return OwnedItem(
        item_id=UUID(int=index),
        name="Pocket TV",
        rarity=rarity,
        official_price=Decimal(official),
        available=available,
        failed_listings=failed,
        last_start_price=last_price,
    )


def decide(
    inventory: list[OwnedItem],
    seed: int,
    *,
    open_listings: int = 0,
    allowance: int = 10,
) -> ListingDecision:
    return decide_listing(
        persona_of(), inventory, open_listings, KNOBS, random.Random(seed), allowance=allowance
    )


def test_start_price_is_thirty_to_eighty_percent_of_official() -> None:
    inventory = [owned(1), owned(2), owned(3)]
    seen = 0

    for seed in range(100):
        for listing in decide(inventory, seed).listings:
            seen += 1
            assert 300 <= listing.starting_price <= 800

    assert seen


def test_duration_is_two_to_fifteen_minutes() -> None:
    inventory = [owned(1), owned(2), owned(3)]
    seen = 0

    for seed in range(100):
        for listing in decide(inventory, seed).listings:
            seen += 1
            assert timedelta(minutes=2) <= listing.duration <= timedelta(minutes=15)

    assert seen


def test_mint_mix_follows_the_rarity_weights() -> None:
    minted: list[Rarity] = []
    seed = 0

    while len(minted) < 10_000:
        minted.extend(decide([], seed).mint)
        seed += 1

    shares = {rarity: 100 * minted.count(rarity) / len(minted) for rarity in Rarity}
    assert abs(shares[Rarity.Common] - 60) <= 2
    assert abs(shares[Rarity.Rare] - 30) <= 2
    assert abs(shares[Rarity.Epic] - 9) <= 2
    assert abs(shares[Rarity.Legendary] - 1) <= 2


def test_holdings_never_exceed_twenty_items() -> None:
    inventory = [owned(i) for i in range(1, 26)]

    for seed in range(50):
        decision = decide(inventory, seed)

        assert len(inventory) - len(decision.sell_to_shop) <= 20
        assert decision.mint == ()


def test_unsold_item_is_relisted_once_at_eighty_percent() -> None:
    inventory = [owned(1, failed=1, last_price=500)]

    for seed in range(50):
        decision = decide(inventory, seed)
        relisted = [entry for entry in decision.listings if entry.item_id == UUID(int=1)]

        assert relisted
        assert relisted[0].starting_price == 400


def test_second_failure_goes_to_the_shop() -> None:
    inventory = [owned(1, failed=2, last_price=400)]

    for seed in range(50):
        decision = decide(inventory, seed)

        assert UUID(int=1) in decision.sell_to_shop
        assert all(entry.item_id != UUID(int=1) for entry in decision.listings)


def test_only_available_items_are_listed_or_sold() -> None:
    inventory = [owned(1, available=False), owned(2), owned(3, available=False, failed=2)]

    for seed in range(50):
        decision = decide(inventory, seed)
        touched = {entry.item_id for entry in decision.listings} | set(decision.sell_to_shop)

        assert UUID(int=1) not in touched
        assert UUID(int=3) not in touched


def test_allowance_caps_new_listings() -> None:
    inventory = [owned(i) for i in range(1, 11)]

    for seed in range(50):
        assert len(decide(inventory, seed, allowance=2).listings) <= 2
