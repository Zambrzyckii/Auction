from types import SimpleNamespace

from auction_bots.config import AmqpSettings
from auction_bots.feed.consumer import FeedConsumer, queue_arguments
from auction_bots.feed.dedupe import RecentIds
from auction_bots.feed.events import AuctionFinished, BidPlaced, MarketEvent

BID_BODY = b"""{
    "EventId": "0b9fdfcb-4b2e-4a3e-9a07-6d2b8a1b1a01",
    "PublicAuctionId": "3f1c7a6e-91d4-4a3f-8b1a-2e5d9c0f4b02",
    "NewWinningUserId": "9a2b4c6d-8e0f-4a1b-9c3d-5e7f90123b03",
    "PreviousWinningUserId": null,
    "NewPrice": 100,
    "PreviousPrice": null
}"""

FINISHED_BODY = b"""{
    "EventId": "0b9fdfcb-4b2e-4a3e-9a07-6d2b8a1b1a02",
    "PublicAuctionId": "3f1c7a6e-91d4-4a3f-8b1a-2e5d9c0f4b02",
    "SellerUserId": "9a2b4c6d-8e0f-4a1b-9c3d-5e7f90123b03",
    "WinnerUserId": null,
    "FinalPrice": null
}"""


def amqp_settings() -> AmqpSettings:
    return AmqpSettings(
        host="rabbitmq",
        port=5672,
        user="auction",
        vhost="/",
        exchange="auctionserver.market",
        queue_prefix="auctionserver.bots",
        message_ttl_ms=120000,
        queue_expires_ms=900000,
        prefetch=50,
    )


class CollectingSink:
    def __init__(self) -> None:
        self.events: list[MarketEvent] = []

    def apply(self, event: MarketEvent) -> None:
        self.events.append(event)


def make_message(body: bytes, message_id: str, type_: str | None, routing_key: str = ""):
    message = SimpleNamespace(body=body, message_id=message_id, type=type_, routing_key=routing_key)
    message.acks = 0
    message.nacks = 0

    async def ack() -> None:
        message.acks += 1

    async def nack(requeue: bool = True) -> None:
        message.nacks += 1

    message.ack = ack
    message.nack = nack
    return message


def make_consumer(sink: CollectingSink) -> FeedConsumer:
    return FeedConsumer(
        "amqp://user:pass@rabbitmq:5672/",
        "auctionserver.bots.abc123",
        sink,
        amqp_settings(),
        RecentIds(),
    )


async def test_unknown_type_is_acked_and_dropped() -> None:
    sink = CollectingSink()
    consumer = make_consumer(sink)
    message = make_message(
        b'{"EventId": "0b9fdfcb-4b2e-4a3e-9a07-6d2b8a1b1a03"}', "m1", "UserRegisteredEvent"
    )

    await consumer.handle(message)

    assert sink.events == []
    assert message.acks == 1


async def test_redelivered_message_reaches_the_sink_once() -> None:
    sink = CollectingSink()
    consumer = make_consumer(sink)
    first = make_message(BID_BODY, "m1", "BidPlacedEvent")
    second = make_message(BID_BODY, "m1", "BidPlacedEvent")

    await consumer.handle(first)
    await consumer.handle(second)

    assert len(sink.events) == 1
    assert isinstance(sink.events[0], BidPlaced)
    assert first.acks == 1
    assert second.acks == 1


async def test_type_falls_back_to_the_routing_key() -> None:
    sink = CollectingSink()
    consumer = make_consumer(sink)
    message = make_message(FINISHED_BODY, "m2", None, routing_key="AuctionFinishedEvent")

    await consumer.handle(message)

    assert len(sink.events) == 1
    assert isinstance(sink.events[0], AuctionFinished)


def test_queue_arguments_expire_idle_queues() -> None:
    assert queue_arguments(amqp_settings()) == {"x-message-ttl": 120000, "x-expires": 900000}
