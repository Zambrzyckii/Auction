# Infrastructure

> English version. Polish 1:1 counterpart: [../pl/infrastructure.md](../pl/infrastructure.md)

The `Infrastructure/` folder exists since 2026-10-23 and holds the configuration of the services around the backend: the telemetry pipeline under `Infrastructure/observability/` and the k6 load tests under `Infrastructure/k6/`. The API gateway, the connection pooler, the cache, the broker and the secrets service remain planned; the owner adopted the seven-phase server-infrastructure plan on 2026-10-22 and phase one (observability and the k6 baseline) landed first. The full target picture is the diagram in [VISION.md](VISION.md#4-target-system).

## Status

Started on 2026-10-14 with the Compose file. On 2026-10-23 the Compose stack grew from three services to seven plus an optional load generator, split into an `edge` and a `data` network, with CPU and memory limits on `api` (2 CPUs, 1 GB) and `postgres` (1 CPU, 512 MB) so that k6 results stay comparable between runs. The gateway and the broker join in later phases.

## What exists today

| Service | Image (pinned) | Published | Role |
|---|---|---|---|
| api | build `Backend/` | 8080 | the host, telemetry enabled through the `Observability` section |
| postgres | postgres:16-alpine | 5436 | the one database |
| seaweedfs | chrislusf/seaweedfs:4.48 | none | avatar object storage |
| otel-collector | otel/opentelemetry-collector-contrib:0.163.2 | none | receives OTLP from the api, fans out to the backends |
| prometheus | prom/prometheus:v3.15.1 | none | scrapes the collector every 10 s, stores metrics for 7 days |
| tempo | grafana/tempo:3.1.1 | none | stores traces on a volume |
| grafana | grafana/grafana:13.2.4 | 127.0.0.1:3000 | reads Prometheus and Tempo, provisioned from files |
| k6 | grafana/k6:2.3.0 | none | load generator behind the `loadtest` profile, run on demand |

The telemetry pipeline is described in [`Infrastructure/README.md`](../../Infrastructure/README.md); the host side (options, the orphan-span sampler, the publisher decorator, the outbox metrics) in [ADR-005](adr/005-observability-and-k6.md). The k6 scenarios (`browse.js`, `bid-storm.js`, `mixed.js`) seed their own data through the public API, classify the domain's expected 409s as expected and fail on the thresholds recorded in [performance.md](performance.md) together with the baseline.

## Target design

- **nginx API gateway** (phase 2): the only published address, TLS, IP rate limits and body caps; per-user limits and CORS stay in the backend.
- **PgBouncer** (phase 3): transaction pooling in front of PostgreSQL; migrations keep a direct connection because `MigrateAsync` takes a session advisory lock.
- **Redis** (phase 4): the distributed level of the hot-auction-read cache behind a module-owned seam, TTL-only.
- **RabbitMQ** (phase 5): the transport for integration events behind `IIntegrationEventPublisher`, with retry tiers, a dead queue and a sequential host-side consumer; see [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).
- **OpenBao** (phase 6): the secrets service read at startup through a custom configuration provider.
- **Hardening** (phase 7): image build in CI, backups, a .NET per-user rate limiter and the k8s/OIDC migration notes.

## What the backend provides

| Need | Available today |
|---|---|
| a transport seam | `IIntegrationEventPublisher.PublishAsync(messageId, type, content)` is the single place where events leave a module; `IntegrationEventTypes` turns `type` and `content` back into a typed event; since 2026-10-23 the host wraps it in `InstrumentedEventPublisher`, so any future transport is measured for free |
| telemetry | the `Observability` configuration section (disabled by default, fail-fast validation when enabled) exports traces, metrics and logs over OTLP; `AuctionServer.*` sources and meters are subscribed, so new module meters appear without host changes |
| configuration from the environment | every setting is read through `IConfiguration`, so `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey` and the `Observability__*` keys can be injected as environment variables |
| a reproducible database | the schema is fully described by the nine migration sets, applied with `dotnet ef database update` per context or at startup when `Database:MigrateOnStartup` is `true` (Compose sets it) |
| object storage for avatars | the `seaweedfs` service in `compose.yaml`: pinned image, no published ports, reached behind the `IAvatarStorage` seam ([backend/profiles.md](backend/profiles.md)) |
| a CI baseline | `.gitlab-ci.yml` and its GitHub Actions mirror `.github/workflows/ci.yml` build and test on every push, including the host test project `AuctionServer.Api.Tests` |

## What is missing

- The `api` service in `compose.yaml` has no container healthcheck yet: the runtime image ships no HTTP client to probe `/health` with; phase 2 adds a bash `/dev/tcp` probe.
- No AMQP publisher and no host-side consumer; [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md) describes what the swap involves.
- The CI pipeline has no deploy stage, no artifacts and no image build.
- Secrets in `compose.yaml` are plaintext environment variables until phase 6.

## API

The infrastructure layer has no API of its own; it would front the backend endpoints and carry the thirty-seven integration events listed in [backend/messaging.md](backend/messaging.md#event-catalog).

## Decisions

- The telemetry stack is OTel Collector + Prometheus + Grafana + Tempo, the owner's pick over the lighter Aspire Dashboard; see [ADR-005](adr/005-observability-and-k6.md).
- Load tests target `http://api:8080` directly from inside the Compose network, so the baseline stays comparable after the gateway lands in front.
- The transport is introduced behind the existing seam rather than by changing the modules, see [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).

## Related documents

- [performance.md](performance.md) - the k6 baseline and every before/after measurement.
- [ARCHITECTURE.md](ARCHITECTURE.md) - the system context with the planned parts and the CI pipeline.
- [backend/messaging.md](backend/messaging.md) - the outbox, the publisher seam and the event catalog.
- [frontend.md](frontend.md), [bots.md](bots.md) - the clients that depend on this layer.
