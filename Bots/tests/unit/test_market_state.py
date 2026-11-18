from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from auction_bots.api.models import AuctionDto, Rarity
from auction_bots.feed.events import (
    AuctionActivated,
    AuctionCancelled,
    AuctionFinished,
    BidPlaced,
)
from auction_bots.market.ledger import OutcomeLedger
from auction_bots.market.state import MarketState

NOW = datetime(2026, 11, 18, 12, 0, 0, tzinfo=UTC)

BOT_A = UUID("00000000-0000-0000-0000-00000000b001")
BOT_B = UUID("00000000-0000-0000-0000-00000000b002")
HUMAN_X = UUID("00000000-0000-0000-0000-0000000000a1")
HUMAN_Y = UUID("00000000-0000-0000-0000-0000000000a2")

FLEET = {BOT_A, BOT_B}


def is_human(user_id: UUID | None) -> bool:
    return user_id is not None and user_id not in FLEET


def make_state(
    ledger: OutcomeLedger | None = None, clock=lambda: NOW
) -> tuple[MarketState, OutcomeLedger]:
    ledger = ledger or OutcomeLedger()
    return MarketState(is_human, ledger, clock), ledger


def activated(
    auction_id: UUID, seller: UUID, official: int = 100, current: int = 10
) -> AuctionActivated:
    return AuctionActivated(
        event_id=uuid4(),
        public_auction_id=auction_id,
        seller_user_id=seller,
        public_item_id=uuid4(),
        item_name="Pager",
        item_rarity=Rarity.Common,
        item_official_price=Decimal(official),
        current_price=Decimal(current),
        ends_on=NOW + timedelta(minutes=5),
    )


def bid(auction_id: UUID, winner: UUID, price: int, previous: UUID | None = None) -> BidPlaced:
    return BidPlaced(
        event_id=uuid4(),
        public_auction_id=auction_id,
        new_winning_user_id=winner,
        previous_winning_user_id=previous,
        new_price=Decimal(price),
        previous_price=None,
    )


def finished(
    auction_id: UUID, seller: UUID, winner: UUID | None, final: int | None
) -> AuctionFinished:
    return AuctionFinished(
        event_id=uuid4(),
        public_auction_id=auction_id,
        seller_user_id=seller,
        winner_user_id=winner,
        final_price=None if final is None else Decimal(final),
    )


def test_bid_on_unknown_auction_creates_a_placeholder() -> None:
    state, _ = make_state()
    auction_id = uuid4()

    state.apply(bid(auction_id, HUMAN_X, 120))

    view = state.get(auction_id)
    assert view is not None
    assert view.official_price is None
    assert view.current_price == Decimal(120)
    assert view.leader_id == HUMAN_X


def test_two_human_bids_are_counted() -> None:
    state, _ = make_state()
    auction_id = uuid4()
    state.apply(activated(auction_id, BOT_A))

    state.apply(bid(auction_id, HUMAN_X, 110))
    state.apply(bid(auction_id, HUMAN_Y, 120, previous=HUMAN_X))

    view = state.get(auction_id)
    assert view is not None
    assert view.human_bids == 2


def test_stale_bid_does_not_rewind_the_price() -> None:
    state, _ = make_state()
    auction_id = uuid4()
    state.apply(activated(auction_id, BOT_A))
    state.apply(bid(auction_id, HUMAN_X, 120))

    state.apply(bid(auction_id, HUMAN_X, 120))

    view = state.get(auction_id)
    assert view is not None
    assert view.current_price == Decimal(120)
    assert view.human_bids == 1


class FakeListApi:
    def __init__(self, auctions: list[AuctionDto]) -> None:
        self.auctions = auctions

    async def list_auctions(self, limit: int) -> list[AuctionDto]:
        return self.auctions


def listed_auction(auction_id: UUID, seller: UUID, official: int, current: int) -> AuctionDto:
    return AuctionDto(
        public_auction_id=auction_id,
        seller_user_id=seller,
        current_winning_user_id=None,
        status="Active",
        current_price=Decimal(current),
        ends_on=NOW + timedelta(minutes=5),
        item_name="Pager",
        item_rarity=Rarity.Common,
        item_official_price=Decimal(official),
        cancellation_reason=None,
    )


async def test_resync_fills_placeholders_and_prunes_after_two_minutes() -> None:
    state, _ = make_state()
    placeholder_id = uuid4()
    stale_id = uuid4()
    state.apply(bid(placeholder_id, HUMAN_X, 120))
    old = activated(stale_id, BOT_A)
    old = old.model_copy(update={"ends_on": NOW - timedelta(minutes=3)})
    state.apply(old)

    await state.resync(FakeListApi([listed_auction(placeholder_id, BOT_A, 450, 120)]))

    filled = state.get(placeholder_id)
    assert filled is not None
    assert filled.official_price == Decimal(450)
    assert state.get(stale_id) is None


def test_outcomes_wait_until_recording_is_enabled() -> None:
    state, ledger = make_state()
    first, second = uuid4(), uuid4()
    state.apply(activated(first, BOT_A))
    state.apply(activated(second, BOT_A))

    state.apply(finished(first, BOT_A, HUMAN_X, 80))
    assert ledger.recent(10) == []

    state.enable_outcomes()
    state.apply(finished(second, BOT_A, HUMAN_X, 80))
    assert len(ledger.recent(10)) == 1


async def test_subscribers_get_every_change_kind() -> None:
    state, _ = make_state()
    queue = state.subscribe()
    first, second = uuid4(), uuid4()

    state.apply(activated(first, BOT_A))
    state.apply(bid(first, HUMAN_X, 120))
    state.apply(finished(first, BOT_A, HUMAN_X, 120))
    state.apply(activated(second, BOT_A))
    state.apply(
        AuctionCancelled(
            event_id=uuid4(),
            public_auction_id=second,
            public_item_id=uuid4(),
            reason="ItemLockRejected",
        )
    )
    await state.resync(FakeListApi([listed_auction(uuid4(), BOT_A, 100, 10)]))

    kinds = set()
    while not queue.empty():
        kinds.add(queue.get_nowait().kind)
    assert kinds == {"activated", "bid", "finished", "cancelled", "resynced"}
