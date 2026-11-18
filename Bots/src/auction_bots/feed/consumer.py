import asyncio
import logging
from typing import Protocol

import aio_pika
from aio_pika.abc import AbstractIncomingMessage

from auction_bots.config import AmqpSettings
from auction_bots.feed.dedupe import RecentIds
from auction_bots.feed.events import MarketEvent, parse_event

log = logging.getLogger("feed")


class EventSink(Protocol):
    def apply(self, event: MarketEvent) -> None: ...


def queue_arguments(settings: AmqpSettings) -> dict[str, int]:
    return {"x-message-ttl": settings.message_ttl_ms, "x-expires": settings.queue_expires_ms}


class FeedConsumer:
    def __init__(
        self,
        url: str,
        queue_name: str,
        sink: EventSink,
        settings: AmqpSettings,
        recent: RecentIds,
    ) -> None:
        self._url = url
        self._queue_name = queue_name
        self._sink = sink
        self._settings = settings
        self._recent = recent

    async def handle(self, message: AbstractIncomingMessage) -> None:
        type_name = message.type or message.routing_key or ""
        event = parse_event(type_name, message.body)
        if event is None:
            await message.ack()
            return
        message_id = message.message_id or str(event.event_id)
        if self._recent.seen(message_id):
            await message.ack()
            return
        self._sink.apply(event)
        await message.ack()

    async def run(self, stop: asyncio.Event) -> None:
        backoff = 1.0
        while not stop.is_set():
            try:
                connection = await aio_pika.connect_robust(self._url)
                async with connection:
                    channel = await connection.channel()
                    await channel.set_qos(prefetch_count=self._settings.prefetch)
                    exchange = await channel.declare_exchange(
                        self._settings.exchange, aio_pika.ExchangeType.TOPIC, durable=True
                    )
                    queue = await channel.declare_queue(
                        self._queue_name,
                        durable=True,
                        arguments=queue_arguments(self._settings),
                    )
                    await queue.bind(exchange, routing_key="#")
                    backoff = 1.0
                    log.info("consuming %s", self._queue_name)
                    await queue.consume(self.handle)
                    await stop.wait()
            except (aio_pika.exceptions.AMQPError, OSError) as error:
                log.warning(
                    "feed connection lost (%s), reconnecting in %.0f s",
                    type(error).__name__,
                    backoff,
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)
