from uuid import uuid4

from auction_bots.fleet.registry import FleetRegistry


def test_unknown_ids_are_human() -> None:
    registry = FleetRegistry(expected=2)
    bot_id = uuid4()
    registry.add(0, bot_id)

    assert registry.is_human(uuid4()) is True
    assert registry.is_human(bot_id) is False


def test_none_is_not_human() -> None:
    registry = FleetRegistry(expected=1)

    assert registry.is_human(None) is False


def test_registry_is_complete_only_with_every_bot_added_or_skipped() -> None:
    registry = FleetRegistry(expected=3)

    registry.add(0, uuid4())
    registry.add(1, uuid4())
    assert registry.complete is False

    registry.skip(2)
    assert registry.complete is True
    assert len(registry.user_ids) == 2
