from auction_bots.feed.dedupe import RecentIds


def test_duplicate_message_id_is_dropped() -> None:
    recent = RecentIds()

    assert recent.seen("message-1") is False
    assert recent.seen("message-1") is True


def test_oldest_id_is_evicted_at_capacity() -> None:
    recent = RecentIds(capacity=3)

    assert recent.seen("a") is False
    assert recent.seen("b") is False
    assert recent.seen("c") is False
    assert recent.seen("d") is False

    assert recent.seen("a") is False
