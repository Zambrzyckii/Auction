from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from auction_bots.feed.events import AuctionFinished

if TYPE_CHECKING:
    from auction_bots.market.state import AuctionView

OutcomeSide = Literal["human_bought", "human_sold", "human_won_war"]


@dataclass(frozen=True)
class Outcome:
    auction_id: UUID
    side: OutcomeSide
    official_price: Decimal
    final_price: Decimal
    at: datetime

    @property
    def margin(self) -> float:
        if self.side == "human_sold":
            gain = self.final_price - self.official_price
        else:
            gain = self.official_price - self.final_price
        return float(gain / self.official_price)


def outcome_of(
    view: "AuctionView | None",
    event: AuctionFinished,
    is_human: Callable[[UUID | None], bool],
    at: datetime,
) -> Outcome | None:
    if view is None or view.official_price is None:
        return None
    if event.winner_user_id is None or event.final_price is None:
        return None
    seller = view.seller_id if view.seller_id is not None else event.seller_user_id
    winner_is_human = is_human(event.winner_user_id)
    if winner_is_human == is_human(seller):
        return None
    side: OutcomeSide = "human_bought" if winner_is_human else "human_sold"
    return Outcome(event.public_auction_id, side, view.official_price, event.final_price, at)


class OutcomeLedger:
    def __init__(self, capacity: int = 500) -> None:
        self._outcomes: deque[Outcome] = deque(maxlen=capacity)

    def record(self, outcome: Outcome) -> None:
        self._outcomes.append(outcome)

    def recent(self, n: int) -> list[Outcome]:
        return list(self._outcomes)[-n:]
