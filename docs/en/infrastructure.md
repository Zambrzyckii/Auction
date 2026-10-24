# Infrastructure

> English version. Polish 1:1 counterpart: [../pl/infrastructure.md](../pl/infrastructure.md)

The `Infrastructure/` folder exists since 2026-10-23 and holds the configuration of the services around the backend, namely the telemetry pipeline under `Infrastructure/observability/`, the k6 load tests under `Infrastructure/k6/`, the nginx gateway under `Infrastructure/gateway/` and the PgBouncer configuration under `Infrastructure/pgbouncer/`. The cache, the broker and the secrets service remain planned. The owner adopted the seven-phase server-infrastructure plan on 2026-10-22. Phase one (observability and the k6 baseline) landed first, phase two (the nginx gateway) followed the same day, 2026-10-23, and phase three (PgBouncer) landed on 2026-10-24. The full target picture is the diagram in [VISION.md](VISION.md#4-target-system).

## Status

Started on 2026-10-14 with the Compose file. On 2026-10-23 the Compose stack grew from three services to seven plus an optional load generator, split into an `edge` and a `data` network, with CPU and memory limits on `api` (2 CPUs, 1 GB) and `postgres` (1 CPU, 512 MB) so that k6 results stay comparable between runs. Later that day the nginx gateway joined as the eighth service and the only entry point, limited to 1 CPU and 128 MB, and the `edge` network got the fixed range `172.16.80.0/24`. On 2026-10-24 PgBouncer joined as the ninth service, limited to 1 CPU and 64 MB, between the api and postgres on the `data` network. The broker joins in a later phase.

## What exists today

| Service | Image (pinned) | Published | Role |
|---|---|---|---|
| gateway | nginx:1.28.3-alpine | 8080 | the only entry point, described in [Gateway](#gateway) |
| api | build `Backend/` | none (127.0.0.1:8081 with `compose.debug.yaml`) | the host, telemetry enabled through the `Observability` section, forwarded headers trusted from the `edge` network |
| postgres | postgres:16-alpine | 5436 | the one database |
| pgbouncer | edoburu/pgbouncer:v1.26.1-p0 | none | transaction pooling between the api and postgres, described in [Connection pooling](#connection-pooling) |
| seaweedfs | chrislusf/seaweedfs:4.48 | none | avatar object storage |
| otel-collector | otel/opentelemetry-collector-contrib:0.163.2 | none | receives OTLP from the api, fans out to the backends |
| prometheus | prom/prometheus:v3.15.1 | none | scrapes the collector every 10 s, stores metrics for 7 days |
| tempo | grafana/tempo:3.1.1 | none | stores traces on a volume |
| grafana | grafana/grafana:13.2.4 | 127.0.0.1:3000 | reads Prometheus and Tempo, provisioned from files |
| k6 | grafana/k6:2.3.0 | none | load generator behind the `loadtest` profile, run on demand |

The telemetry pipeline is described in [`Infrastructure/README.md`](../../Infrastructure/README.md); the host side (options, the orphan-span sampler, the publisher decorator, the outbox metrics) in [ADR-005](adr/005-observability-and-k6.md). The k6 scenarios (`browse.js`, `bid-storm.js`, `mixed.js`) seed their own data through the public API, classify the domain's expected 409s as expected and fail on the thresholds recorded in [performance.md](performance.md) together with the baseline. `gateway-limits.js` drives the gateway itself and checks every rate-limit zone under load.

## Gateway

`Infrastructure/gateway/nginx.conf` is the whole gateway. Compose mounts it read-only into the `gateway` service, publishes port 8080 and starts nginx only after the api reports healthy. The decision record is [ADR-006](adr/006-nginx-gateway.md).

| Path | What happens |
|---|---|
| `/api/` | proxied to the api |
| `/health`, `/health/live`, `/health/ready` | proxied to the api |
| `/openapi/` | proxied for `127.0.0.1`, `172.16.0.0/12` and `192.168.0.0/16`, everyone else gets 403 |
| `/gateway-health` | answered by nginx itself, used by its container healthcheck |
| anything else | 404 from nginx |

- Rate limits per client address. Requests without an `Authorization` header share the `anonymous` zone (20 requests per second, burst 40), requests with one use the `authenticated` zone (60 per second, burst 120). `/api/users/login` and `/api/users/register` use the `login` zone instead (1 per second, burst 5). A rejected request gets 429 with `Retry-After: 1` and `{"error":"Too many requests"}`. nginx cannot verify a JWT, so any `Authorization` header buys the bigger bucket. Limits per user stay with the backend (phase 7).
- Body size. 64 KB by default and 4 MB for `PUT /api/profiles/me/avatar`. The api caps an avatar request at `Profiles:Avatar:MaxBytes` (2 MiB) plus 8 KiB of multipart overhead, so the gateway never rejects a body the api would accept. Raising `MaxBytes` towards its 5 MiB maximum needs the 4 MB limit raised too. A rejected body gets 413 with `{"error":"Request body too large"}`.
- Headers to the api. `Host`, `X-Forwarded-Proto`, `X-Forwarded-For` with the connecting address only and `X-Request-Id` with a fresh 32-character id. Values the client sent for the last two are discarded.
- Compression. gzip for `application/json` and `text/plain` responses of 1 KB or more, with `Vary: Accept-Encoding`. The OpenAPI document shrinks from 31 KB to under 3 KB.
- Access log. One JSON object per request on stdout (`docker compose logs gateway`) with `time`, `remote_addr`, `method`, `uri`, `status`, `request_time`, `upstream_response_time` and `request_id`. The `Authorization` header is never logged, and `request_id` equals the `X-Request-Id` the api receives.
- Finding the api. nginx asks Docker's DNS (`127.0.0.11`) for the api address every 5 seconds, so a recreated api with a new address is found without restarting nginx. The switch costs at most one 5-second window of 502 responses.
- Trust on the host side. The `Gateway` section (`Gateway__Enabled`, `Gateway__TrustedNetworks__0`) makes the host accept `X-Forwarded-For` and `X-Forwarded-Proto` only from the `edge` network. The section is fail-fast. An enabled gateway needs at least one network, and every entry must be a canonical CIDR such as `172.16.80.0/24`, never `172.16.80.1/24`. `UseForwardedHeaders` is the first middleware.
- Health. `/health/live` runs no checks, `/health/ready` runs the checks tagged `ready` (the database today) and `/health` runs all of them. The api container probes `/health/ready` with bash `/dev/tcp`, because the runtime image has no HTTP client. Compose never restarts an unhealthy container, the status only gates the gateway start and shows in `docker compose ps`.
- Debugging without nginx. `docker compose -f compose.yaml -f compose.debug.yaml up -d` publishes the api on `127.0.0.1:8081`, reachable from this machine only.

## Connection pooling

`Infrastructure/pgbouncer/pgbouncer.ini` is the whole pooler configuration. Compose mounts it read-only into the `pgbouncer` service, the image's entrypoint generates `userlist.txt` from `DB_USER` and `DB_PASSWORD`, and the api, startup migrations included, reaches postgres only through `pgbouncer:6432`. The decision record is [ADR-007](adr/007-pgbouncer-transaction-pooling.md).

- Transaction pooling. A server connection is borrowed for the duration of one transaction, so up to `max_client_conn` (500) client connections share `default_pool_size` (25) server connections plus `reserve_pool_size` (10) drawn after a 5 s wait, with `max_db_connections` (40) as the ceiling across pools. One api instance costs postgres at most 35 of its 100 slots.
- The api keeps Npgsql pooling on and adds `No Reset On Close=true`, so a returned connection does not send a `DISCARD ALL` that would wipe a server connection other clients share.
- An unknown parameter in `pgbouncer.ini` is fatal, so a typo stops the container at startup instead of being silently ignored.
- Session state (advisory locks, temporary tables, LISTEN/NOTIFY, prepared statements) must not be introduced without moving that caller off the pooler. The code has none today.
- `SHOW POOLS` shows client and server connections live, through `docker compose exec -e PGPASSWORD=auction pgbouncer psql -h 127.0.0.1 -p 6432 -U auction -d pgbouncer -c "SHOW POOLS"`. The integration tests assert on its numbers.

## Target design

- **nginx API gateway** (phase 2): landed on 2026-10-23, see [Gateway](#gateway). TLS is still missing.
- **PgBouncer** (phase 3): landed on 2026-10-24, see [Connection pooling](#connection-pooling). Migrations go through the pooler too.
- **Redis** (phase 4): the distributed level of the hot-auction-read cache behind a module-owned seam, TTL-only.
- **RabbitMQ** (phase 5): the transport for integration events behind `IIntegrationEventPublisher`, with retry tiers, a dead queue and a sequential host-side consumer; see [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).
- **OpenBao** (phase 6): the secrets service read at startup through a custom configuration provider.
- **Hardening** (phase 7): image build in CI, backups, a .NET per-user rate limiter and the k8s/OIDC migration notes.

## What the backend provides

| Need | Available today |
|---|---|
| a transport seam | `IIntegrationEventPublisher.PublishAsync(messageId, type, content)` is the single place where events leave a module; `IntegrationEventTypes` turns `type` and `content` back into a typed event; since 2026-10-23 the host wraps it in `InstrumentedEventPublisher`, so any future transport is measured for free |
| telemetry | the `Observability` configuration section (disabled by default, fail-fast validation when enabled) exports traces, metrics and logs over OTLP; `AuctionServer.*` sources and meters are subscribed, so new module meters appear without host changes |
| a trusted proxy hop | the `Gateway` configuration section (disabled by default, fail-fast validation when enabled) lets `UseForwardedHeaders`, the first middleware, trust `X-Forwarded-For` and `X-Forwarded-Proto` only from the listed CIDR networks |
| health for orchestration | `/health/live` (no checks) and `/health/ready` (checks tagged `ready`, the database today) next to the full `/health` |
| configuration from the environment | every setting is read through `IConfiguration`, so `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey` and the `Observability__*` keys can be injected as environment variables |
| a reproducible database | the schema is fully described by the nine migration sets, applied with `dotnet ef database update` per context or at startup when `Database:MigrateOnStartup` is `true` (Compose sets it) |
| object storage for avatars | the `seaweedfs` service in `compose.yaml`: pinned image, no published ports, reached behind the `IAvatarStorage` seam ([backend/profiles.md](backend/profiles.md)) |
| a CI baseline | `.gitlab-ci.yml` and its GitHub Actions mirror `.github/workflows/ci.yml` build and test on every push, including the host test project `AuctionServer.Api.Tests`, whose gateway tests start nginx and traefik/whoami through Testcontainers, and check `nginx.conf` with `nginx -t` in a `gateway-config` job |

## What is missing

- **There is no TLS yet, so the stack must not face the internet until it lands.** The owner's target is HTTPS only with an own certificate, renewed automatically or served by a redundant pair so the certificate does not become a single point of failure.
- nginx answers 502 (api unreachable, for example inside the 5-second re-resolve window) with its default HTML page, unlike the JSON bodies of 413 and 429.
- nginx forwards `Host` without the port, so the OpenAPI `servers` entry reads `http://localhost/`. The api builds only relative URLs, so nothing else is affected.
- No AMQP publisher and no host-side consumer; [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md) describes what the swap involves.
- The CI pipeline has no deploy stage, no artifacts and no image build.
- Secrets in `compose.yaml` are plaintext environment variables until phase 6.

## API

The infrastructure layer has one endpoint of its own, `/gateway-health`, which nginx answers without the api. Everything else on port 8080 is the backend API, and the broker will carry the thirty-seven integration events listed in [backend/messaging.md](backend/messaging.md#event-catalog).

## Decisions

- The telemetry stack is OTel Collector + Prometheus + Grafana + Tempo, the owner's pick over the lighter Aspire Dashboard; see [ADR-005](adr/005-observability-and-k6.md).
- The gateway is nginx with IP rate limits, body caps, JSON errors and a CIDR trust model for forwarded headers, see [ADR-006](adr/006-nginx-gateway.md).
- The pooler is PgBouncer in transaction mode and the migrations go through it, because the Npgsql EF 10 migration lock is a table lock inside the migration transaction, with Npgsql pooling kept on plus `No Reset On Close=true`, see [ADR-007](adr/007-pgbouncer-transaction-pooling.md).
- Load tests target `http://api:8080` directly from inside the Compose network, so the baseline stays comparable now that the gateway sits in front. Only `gateway-limits.js` goes through the gateway, run with `BASE_URL=http://gateway`.
- The transport is introduced behind the existing seam rather than by changing the modules, see [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).

## Related documents

- [performance.md](performance.md) - the k6 baseline and every before/after measurement.
- [ARCHITECTURE.md](ARCHITECTURE.md) - the system context with the planned parts and the CI pipeline.
- [backend/messaging.md](backend/messaging.md) - the outbox, the publisher seam and the event catalog.
- [frontend.md](frontend.md), [bots.md](bots.md) - the clients that depend on this layer.
