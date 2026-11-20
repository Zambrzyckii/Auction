import random
from collections import Counter

from auction_bots.api.models import Rarity
from auction_bots.fleet.archetypes import ITEM_NAMES
from auction_bots.fleet.policies.stock import (
    ITEM_LOCKS,
    LOCK_SHARE,
    locked_names,
    open_names,
    pick_name,
)


def test_locks_name_listed_items_with_the_agreed_counts() -> None:
    assert set(ITEM_LOCKS) <= set(ITEM_NAMES)
    assert Counter(ITEM_LOCKS.values()) == {Rarity.Legendary: 8, Rarity.Epic: 6, Rarity.Common: 6}


def test_pools_split_the_list() -> None:
    assert len(ITEM_NAMES) == 160
    assert len(open_names()) == 140
    assert not set(open_names()) & set(ITEM_LOCKS)
    assert locked_names(Rarity.Rare) == ()
    for rarity in (Rarity.Common, Rarity.Epic, Rarity.Legendary):
        expected = {name for name, lock in ITEM_LOCKS.items() if lock is rarity}
        assert set(locked_names(rarity)) == expected


def test_picks_respect_locks_and_share() -> None:
    for rarity in Rarity:
        rng = random.Random(7)
        picks = [pick_name(rarity, rng) for _ in range(4000)]
        assert all(ITEM_LOCKS.get(name, rarity) is rarity for name in picks)
        locked = sum(name in ITEM_LOCKS for name in picks) / 4000
        assert abs(locked - LOCK_SHARE[rarity]) < 0.05
    rng = random.Random(7)
    seen = {pick_name(Rarity.Legendary, rng) for _ in range(4000)}
    assert set(locked_names(Rarity.Legendary)) <= seen


def test_pick_is_deterministic() -> None:
    first, second = random.Random(3), random.Random(3)
    assert [pick_name(Rarity.Epic, first) for _ in range(20)] == [
        pick_name(Rarity.Epic, second) for _ in range(20)
    ]
