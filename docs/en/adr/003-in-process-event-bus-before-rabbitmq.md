# ADR-003: In-process event bus behind a publisher seam, RabbitMQ later

- **Status:** accepted (2026-08-26) · PL: [../../pl/adr/003-in-process-event-bus-before-rabbitmq.md](../../pl/adr/003-in-process-event-bus-before-rabbitmq.md)
- **Context:** RabbitMQ is part of the target system, but running a broker during the backend-only phase would add infrastructure without changing how modules are written.
- **Decision:** the outbox processors publish through `IIntegrationEventPublisher`; its only implementation, `InProcessEventPublisher` in the host, deserializes the row through `IntegrationEventTypes` and publishes it with MediatR, so events never leave the process today.
- **Consequences:** modules already assume at-least-once delivery and sequential handlers; swapping the transport means one AMQP publisher plus a host-side consumer, with the modules untouched; until then events are invisible outside the process, which is why the planned bots cannot subscribe to anything yet.
