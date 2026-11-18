import asyncio
import uuid

import aio_pika
import pytest
from testcontainers.community.rabbitmq import RabbitMqContainer

from auction_bots.config import AmqpSettings
from auction_bots.feed.consumer import FeedConsumer, queue_arguments
from auction_bots.feed.dedupe import RecentIds
from auction_bots.feed.events import BidPlaced, MarketEvent

pytestmark = pytest.mark.broker

BID_BODY = b"""{
    "EventId": "0b9fdfcb-4b2e-4a3e-9a07-6d2b8a1b1a01",
    "PublicAuctionId": "3f1c7a6e-91d4-4a3f-8b1a-2e5d9c0f4b02",
    "NewWinningUserId": "9a2b4c6d-8e0f-4a1b-9c3d-5e7f90123b03",
    "PreviousWinningUserId": null,
    "NewPrice": 100,
    "PreviousPrice": null
}"""

QUEUE_NAME = "auctionserver.bots.abc123"


def amqp_settings() -> AmqpSettings:
    return AmqpSettings(
        host="localhost",
        port=5672,
        user="guest",
        vhost="/",
        exchange="auctionserver.market",
        queue_prefix="auctionserver.bots",
        message_ttl_ms=120000,
        queue_expires_ms=900000,
        prefetch=50,
    )


class WaitingSink:
    def __init__(self) -> None:
        self.events: list[MarketEvent] = []
        self.first_event = asyncio.Event()

    def apply(self, event: MarketEvent) -> None:
        self.events.append(event)
        self.first_event.set()


def market_message(body: bytes, message_id: str, type_name: str) -> aio_pika.Message:
    return aio_pika.Message(
        body,
        message_id=message_id,
        type=type_name,
        content_type="application/json",
        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
    )


async def test_market_event_reaches_the_sink_once() -> None:
    with RabbitMqContainer("rabbitmq:4.1-alpine") as rabbit:
        url = (
            f"amqp://{rabbit.username}:{rabbit.password}"
            f"@{rabbit.get_container_host_ip()}:{rabbit.get_exposed_port(rabbit.port)}/"
        )
        settings = amqp_settings()

        publisher = await aio_pika.connect(url)
        async with publisher:
            channel = await publisher.channel()
            exchange = await channel.declare_exchange(
                settings.exchange, aio_pika.ExchangeType.TOPIC, durable=True
            )
            queue = await channel.declare_queue(
                QUEUE_NAME, durable=True, arguments=queue_arguments(settings)
            )
            await queue.bind(exchange, routing_key="#")

            message_id = str(uuid.uuid4())
            await exchange.publish(
                market_message(BID_BODY, message_id, "BidPlacedEvent"),
                routing_key="BidPlacedEvent",
            )
            await exchange.publish(
                market_message(BID_BODY, message_id, "BidPlacedEvent"),
                routing_key="BidPlacedEvent",
            )
            await exchange.publish(
                market_message(
                    b'{"EventId": "0b9fdfcb-4b2e-4a3e-9a07-6d2b8a1b1a09"}',
                    str(uuid.uuid4()),
                    "UserRegisteredEvent",
                ),
                routing_key="UserRegisteredEvent",
            )

        sink = WaitingSink()
        consumer = FeedConsumer(url, QUEUE_NAME, sink, settings, RecentIds())
        stop = asyncio.Event()
        task = asyncio.create_task(consumer.run(stop))
        try:
            await asyncio.wait_for(sink.first_event.wait(), timeout=30)
            await asyncio.sleep(1.0)

            assert len(sink.events) == 1
            assert isinstance(sink.events[0], BidPlaced)

            check = await aio_pika.connect(url)
            async with check:
                check_channel = await check.channel()
                redeclared = await check_channel.declare_queue(QUEUE_NAME, passive=True)
                assert redeclared.declaration_result.message_count == 0
        finally:
            stop.set()
            await asyncio.wait_for(task, timeout=10)
