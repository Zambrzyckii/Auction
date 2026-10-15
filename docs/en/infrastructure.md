# Infrastructure (planned)

> English version. Polish 1:1 counterpart: [../pl/infrastructure.md](../pl/infrastructure.md)

Most of this layer does not exist yet: the repository contains no `Infrastructure/` folder and no broker or gateway configuration. What does exist is the GitLab CI pipeline, described in [ARCHITECTURE.md](ARCHITECTURE.md#build-and-ci), plus [`Backend/Dockerfile`](../../Backend/Dockerfile) and the root [`compose.yaml`](../../compose.yaml) that start the API and PostgreSQL with one command.

## Status

Started on 2026-10-14 with the Compose file; the broker and the gateway remain planned. The previous README reserved `Infrastructure/` for "RabbitMQ / gateway / compose setup" and the deleted design note (`AGENTS.md`) names an API gateway as the single entry point and RabbitMQ as the message broker; when those arrive, their services join `compose.yaml`.

## Target design

- **API gateway**: the only address the frontend and the bots know; routes to the backend host and is the natural place for rate limiting and CORS.
- **RabbitMQ**: the transport for integration events leaving the monolith, fed by a new `IIntegrationEventPublisher` implementation and consumed by the bots and by a host-side consumer.
- **Docker Compose**: the host, PostgreSQL, RabbitMQ and the gateway started with one command, with migrations applied before the host serves traffic.

## What the backend provides

| Need | Available today |
|---|---|
| a transport seam | `IIntegrationEventPublisher.PublishAsync(messageId, type, content)` is the single place where events leave a module; `IntegrationEventTypes` turns `type` and `content` back into a typed event |
| configuration from the environment | every setting is read through `IConfiguration`, so `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey` and `Wallets__StartingFunds` can be injected as environment variables |
| a reproducible database | the schema is fully described by the six migration sets, applied with `dotnet ef database update` per context or at startup when `Database:MigrateOnStartup` is `true` (Compose sets it) |
| a CI baseline | `.gitlab-ci.yml` builds and tests on every push inside the official SDK image with docker-in-docker |

## What is missing

- The `api` service in `compose.yaml` has no container healthcheck: the runtime image ships no HTTP client to probe `/health` with, so an orchestrator has to probe the endpoint from outside.
- No AMQP publisher and no host-side consumer; [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md) describes what the swap involves.
- The CI pipeline has no deploy stage, no artifacts and no image build.

## API

The infrastructure layer has no API of its own; it would front the backend endpoints and carry the nine integration events listed in [backend/messaging.md](backend/messaging.md#event-catalog).

## Decisions

- RabbitMQ was chosen as the broker and an API gateway as the entry point in the original design note; the gateway product and the Compose layout are open.
- The transport is introduced behind the existing seam rather than by changing the modules, see [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).

## Related documents

- [ARCHITECTURE.md](ARCHITECTURE.md) - the system context with the planned parts and the CI pipeline.
- [backend/messaging.md](backend/messaging.md) - the outbox, the publisher seam and the event catalog.
- [frontend.md](frontend.md), [bots.md](bots.md) - the clients that depend on this layer.
