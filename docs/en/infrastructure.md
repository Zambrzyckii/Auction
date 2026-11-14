# Infrastructure

> English version. Polish 1:1 counterpart: [../pl/infrastructure.md](../pl/infrastructure.md)

The `Infrastructure/` folder exists since 2026-10-23 and holds the configuration of the services around the backend, namely the telemetry pipeline under `Infrastructure/observability/`, the k6 load tests under `Infrastructure/k6/`, the nginx gateway under `Infrastructure/gateway/`, the PgBouncer configuration under `Infrastructure/pgbouncer/`, the OpenBao bootstrap and persistent config under `Infrastructure/vault/` and the gitignored secret files with their generator under `Infrastructure/secrets/`. The broker runs in the Compose stack since 2026-11-04 (its configuration is the service definition plus `RabbitTopology` in the host), and the secrets service runs there since the same day. The owner adopted the seven-phase server-infrastructure plan on 2026-10-22. Phase one (observability and the k6 baseline) landed first, phase two (the nginx gateway) followed the same day, 2026-10-23, phase three (PgBouncer) landed on 2026-10-24, phase four (the Redis read cache) on 2026-11-01, and phase five (RabbitMQ) and phase six (OpenBao) both on 2026-11-04. Phase seven (hardening) closed the plan on 2026-11-07: the non-root read-only api image, the `pgbackup` service, the image build in CI, the per-user rate limiter, the broker-outage fix with its alerts, the avatar conditional GET, the optional Loki overlay and Dependabot. The full target picture is the diagram in [VISION.md](VISION.md#4-target-system).

## Status

Started on 2026-10-14 with the Compose file. On 2026-10-23 the Compose stack grew from three services to seven plus an optional load generator, split into an `edge` and a `data` network, with CPU and memory limits on `api` (2 CPUs, 1 GB) and `postgres` (1 CPU, 512 MB) so that k6 results stay comparable between runs. Later that day the nginx gateway joined as the eighth service and the only entry point, limited to 1 CPU and 128 MB, and the `edge` network got the fixed range `172.16.80.0/24`. On 2026-10-24 PgBouncer joined as the ninth service, limited to 1 CPU and 64 MB, between the api and postgres on the `data` network. On 2026-11-01 Redis joined as the tenth service (`redis:7.2-alpine`, 1 CPU and 128 MB, `--maxmemory 64mb` with `allkeys-lru`, no persistence and no volume) on the `data` network; the api deliberately does not `depends_on` it, because a missing Redis only degrades read latency. On 2026-11-04 RabbitMQ joined as the eleventh service (`rabbitmq:4.1-management-alpine`, 1 CPU and 384 MB, management UI on `127.0.0.1:15672`, user `auction` with the password from `Infrastructure/secrets/`) on the `data` network, and the api switched to the Rabbit transport. Later the same day phase six added OpenBao as the twelfth service (`openbao/openbao:2.7.2`, 1 CPU and 256 MB, dev mode) with the one-shot `vault-init` seeding it on every stack start, and every plaintext secret left the compose file for the gitignored `Infrastructure/secrets/` directory. On 2026-11-07 phase seven hardened the runtime: the api image runs as the non-root `app` user on a read-only filesystem with a tmpfs `/tmp` and a 30 s stop grace period, `pgbackup` joined as the thirteenth service (1 CPU, 128 MB) dumping the database daily into the `pgbackups` volume, and the optional `compose.loki.yaml` overlay adds Loki (1 CPU, 256 MB) with the collector re-pointed at it.

## What exists today

| Service | Image (pinned) | Published | Role |
|---|---|---|---|
| gateway | nginx:1.28.3-alpine | 8080 | the only entry point, described in [Gateway](#gateway) |
| api | build `Backend/` | none (127.0.0.1:8081 with `compose.debug.yaml`) | the host, telemetry enabled through the `Observability` section, forwarded headers trusted from the `edge` network, non-root on a read-only filesystem |
| postgres | postgres:16-alpine | 5436 | the one database |
| pgbouncer | edoburu/pgbouncer:v1.26.1-p0 | none | transaction pooling between the api and postgres, described in [Connection pooling](#connection-pooling) |
| pgbackup | prodrigestivill/postgres-backup-local:16-alpine | none | daily `pg_dump` straight to postgres with three-bucket rotation, see [Backups](#backups) |
| seaweedfs | chrislusf/seaweedfs:4.48 | none | avatar object storage |
| otel-collector | otel/opentelemetry-collector-contrib:0.163.2 | none | receives OTLP from the api, fans out to the backends |
| prometheus | prom/prometheus:v3.15.1 | none | scrapes the collector every 10 s, stores metrics for 7 days |
| tempo | grafana/tempo:3.1.1 | none | stores traces on a volume |
| grafana | grafana/grafana:13.2.4 | 127.0.0.1:3000 | reads Prometheus and Tempo, provisioned from files |
| vault | openbao/openbao:2.7.2 | none (127.0.0.1:8200 with `compose.debug.yaml`) | the secrets service, dev mode by default, raft through `compose.vault-persistent.yaml` |
| vault-init | openbao/openbao:2.7.2 | none | one-shot seeder, exits after writing the policy, the AppRole, the secrets and the api credentials |
| k6 | grafana/k6:2.3.0 | none | load generator behind the `loadtest` profile, run on demand |
| loki | grafana/loki:3.5.7 | none | log store, only with the `compose.loki.yaml` overlay, which also re-points the collector and provisions the Grafana datasource |

The telemetry pipeline is described in [`Infrastructure/README.md`](../../Infrastructure/README.md); the host side (options, the orphan-span sampler, the publisher decorator, the outbox metrics) in [ADR-005](adr/005-observability-and-k6.md). The k6 scenarios (`browse.js`, `bid-storm.js`, `mixed.js`) seed their own data through the public API, classify the domain's expected 409s as expected and fail on the thresholds recorded in [performance.md](performance.md) together with the baseline. `gateway-limits.js` drives the gateway itself and checks every rate-limit zone under load. Prometheus additionally evaluates `Infrastructure/observability/prometheus-rules.yml`: `OutboxDeadMessages` fires on a dead-lettered outbox row and `OutboxPublishFailing` on sustained publish failures; there is no Alertmanager, so the alert state lives in Grafana Explore and the Prometheus API.

## Gateway

`Infrastructure/gateway/nginx.conf` is the whole gateway. Compose mounts it read-only into the `gateway` service, publishes port 8080 and starts nginx only after the api reports healthy. The decision record is [ADR-006](adr/006-nginx-gateway.md).

| Path | What happens |
|---|---|
| `/api/` | proxied to the api |
| `/health`, `/health/live`, `/health/ready` | proxied to the api |
| `/openapi/` | proxied for `127.0.0.1`, `172.16.0.0/12` and `192.168.0.0/16`, everyone else gets 403 |
| `/gateway-health` | answered by nginx itself, used by its container healthcheck |
| anything else | 404 from nginx |

- Rate limits per client address. Requests without an `Authorization` header share the `anonymous` zone (20 requests per second, burst 40), requests with one use the `authenticated` zone (60 per second, burst 120). `/api/users/login` and `/api/users/register` use the `login` zone instead (1 per second, burst 5). A rejected request gets 429 with `Retry-After: 1` and `{"error":"Too many requests"}`. nginx cannot verify a JWT, so any `Authorization` header buys the bigger bucket. Limits per user live in the host since phase seven, see [Per-user rate limits](#per-user-rate-limits).
- Body size. 64 KB by default and 4 MB for `PUT /api/profiles/me/avatar`. The api caps an avatar request at `Profiles:Avatar:MaxBytes` (2 MiB) plus 8 KiB of multipart overhead, so the gateway never rejects a body the api would accept. Raising `MaxBytes` towards its 5 MiB maximum needs the 4 MB limit raised too. A rejected body gets 413 with `{"error":"Request body too large"}`.
- Headers to the api. `Host`, `X-Forwarded-Proto`, `X-Forwarded-For` with the connecting address only and `X-Request-Id` with a fresh 32-character id. Values the client sent for the last two are discarded.
- Compression. gzip for `application/json` and `text/plain` responses of 1 KB or more, with `Vary: Accept-Encoding`. The OpenAPI document shrinks from 31 KB to under 3 KB.
- Access log. One JSON object per request on stdout (`docker compose logs gateway`) with `time`, `remote_addr`, `method`, `uri`, `status`, `request_time`, `upstream_response_time` and `request_id`. The `Authorization` header is never logged, and `request_id` equals the `X-Request-Id` the api receives.
- Finding the api. nginx asks Docker's DNS (`127.0.0.11`) for the api address every 5 seconds, so a recreated api with a new address is found without restarting nginx. The switch costs at most one 5-second window of 502 responses. Such a 502 carries `{"error":"Api unavailable"}` like the other gateway errors.
- Trust on the host side. The `Gateway` section (`Gateway__Enabled`, `Gateway__TrustedNetworks__0`) makes the host accept `X-Forwarded-For` and `X-Forwarded-Proto` only from the `edge` network. The section is fail-fast. An enabled gateway needs at least one network, and every entry must be a canonical CIDR such as `172.16.80.0/24`, never `172.16.80.1/24`. `UseForwardedHeaders` is the first middleware.
- Health. `/health/live` runs no checks, `/health/ready` runs the checks tagged `ready` (the database today) and `/health` runs all of them. The api container probes `/health/ready` with bash `/dev/tcp`, because the runtime image has no HTTP client. Compose never restarts an unhealthy container, the status only gates the gateway start and shows in `docker compose ps`.
- Debugging without nginx. `docker compose -f compose.yaml -f compose.debug.yaml up -d` publishes the api on `127.0.0.1:8081`, reachable from this machine only.

## Per-user rate limits

Since phase seven the host runs the framework rate limiter (`Microsoft.AspNetCore.RateLimiting`, no package) behind the fail-fast `RateLimiting` section, disabled by default and enabled in Compose. It sits after authentication and partitions by the user id claim, so it counts per account where nginx counts per address. Three token buckets cover the authenticated writes: `Writes` is the umbrella over every POST, PUT and DELETE behind a JWT (20 tokens per second, burst 40), `HotWrites` tightens the hot paths, the auction bid, the warehouse bids with join and leave, the whole casino and the wallet transfers (5 per second, burst 10), and `Uploads` covers the avatar PUT (1 per 10 seconds, burst 3). The route map lives in the host (`RateLimitingExtensions.Classify`), mirroring the `IntegrationEventRecipients` idiom, so the modules stay untouched and a new write endpoint lands under the umbrella automatically. A rejected request gets 429 with `Retry-After` and the global `{"error":...}` body. Anonymous endpoints stay with nginx's `login` zone, because before authentication there is nothing per-user to key on. This completes the ADR-006 split: address limits at the edge, account limits in the host.

## Connection pooling

`Infrastructure/pgbouncer/pgbouncer.ini` is the whole pooler configuration. Compose mounts it read-only into the `pgbouncer` service together with the generated `Infrastructure/secrets/pgbouncer-userlist.txt` as the `auth_file` (until phase six the image's entrypoint generated the userlist from `DB_USER` and `DB_PASSWORD` environment variables), and the api, startup migrations included, reaches postgres only through `pgbouncer:6432`. The decision record is [ADR-007](adr/007-pgbouncer-transaction-pooling.md).

- Transaction pooling. A server connection is borrowed for the duration of one transaction, so up to `max_client_conn` (500) client connections share `default_pool_size` (25) server connections plus `reserve_pool_size` (10) drawn after a 5 s wait, with `max_db_connections` (40) as the ceiling across pools. One api instance costs postgres at most 35 of its 100 slots.
- The api keeps Npgsql pooling on and adds `No Reset On Close=true`, so a returned connection does not send a `DISCARD ALL` that would wipe a server connection other clients share.
- An unknown parameter in `pgbouncer.ini` is fatal, so a typo stops the container at startup instead of being silently ignored.
- Session state (advisory locks, temporary tables, LISTEN/NOTIFY, prepared statements) must not be introduced without moving that caller off the pooler. The code has none today.
- `SHOW POOLS` shows client and server connections live, through `docker compose exec -e PGPASSWORD="$(cat Infrastructure/secrets/postgres-password.secret)" pgbouncer psql -h 127.0.0.1 -p 6432 -U auction -d pgbouncer -c "SHOW POOLS"`. The integration tests assert on its numbers.

## Message broker

RabbitMQ 4.1 carries two durable exchanges, declared idempotently by every connecting side through the host's `RabbitTopology`. The direct exchange `auctionserver.events` feeds the durable queue `auctionserver.deliveries`, the internal leg between the outbox processors and the delivery store: `RabbitEventPublisher` publishes persistent messages with the metadata in the AMQP `MessageId` and `Type` properties and the raw event JSON as the body, and returns only on the publisher confirm, while `RabbitDeliveryConsumer` feeds `DeliveryDispatcher.AcceptAsync` with manual acks, prefetch 20 and a 5 s cooldown before a failed message is requeued. The topic exchange `auctionserver.market` re-publishes the four public auction events with the type name as the routing key, the consume-only feed for the planned bots. Retries and dead letters stay in the database (ADR-011), so the broker holds no DLX and an idle stack shows an empty queue. The transport switch is the host's fail-fast `Messaging` section, `InProcess` by default and `Rabbit` in Compose. The decision record is [ADR-013](adr/013-rabbitmq-transport.md).

## Secrets

Since phase six no secret value lives in `compose.yaml`. `Infrastructure/secrets/gen-secrets.sh` generates random passwords into a gitignored directory (only the generator and the `*.example` templates are tracked), the infrastructure containers read them as compose file secrets or as mounted generated files, and the api reads its five secrets from OpenBao. A dev-mode `vault` service plus the one-shot `vault-init` seed the `auction-api` policy, the AppRole, the secrets under `secret/auction/api` and the `role-id`/`secret-id` files in the `vaultcreds` volume on every stack start, and the api, whose fail-fast `Vault` section defaults to disabled, logs in with AppRole at startup through a hand-written `IConfigurationProvider` (about 120 lines, no package) added as the last configuration source, so vault values win over environment variables. Rotation, the persistent raft overlay and the manual unseal drill are documented step by step in [operations.md](operations.md). The decision record is [ADR-014](adr/014-openbao-secrets.md).

## Backups

The `pgbackup` service dumps the database on the `@daily` schedule straight to postgres, bypassing PgBouncer because transaction pooling breaks the long single session a dump needs, and rotates three retention buckets in the `pgbackups` volume: 7 daily, 4 weekly and 6 monthly copies, the newest always linked as `last/auctionserver-latest.sql.gz`. The on-demand dump and the restore drill, exercised live, are step-by-step in [operations.md](operations.md#database-backups).

## Target design

- **nginx API gateway** (phase 2): landed on 2026-10-23, see [Gateway](#gateway). TLS is still missing.
- **PgBouncer** (phase 3): landed on 2026-10-24, see [Connection pooling](#connection-pooling). Migrations go through the pooler too.
- **Redis** (phase 4, landed 2026-11-01): the distributed level of the hot-auction-read cache behind a module-owned seam, TTL-only; details in [backend/auctions.md](backend/auctions.md) and [ADR-009](adr/009-hybrid-read-cache-in-auctions.md).
- **RabbitMQ** (phase 5, landed 2026-11-04): the AMQP transport behind `IIntegrationEventPublisher` plus the consume-only market exchange for the bots. Retries and dead letters stayed in the database rather than in the broker (ADR-011); see [Message broker](#message-broker) and [ADR-013](adr/013-rabbitmq-transport.md).
- **OpenBao** (phase 6, landed 2026-11-04): the secrets service read at startup through a custom configuration provider, with compose file secrets for the infrastructure containers; see [Secrets](#secrets) and [ADR-014](adr/014-openbao-secrets.md).
- **Hardening** (phase 7, landed 2026-11-07): the non-root read-only api image with a layered restore, the `pgbackup` service with a verified restore drill, the image build to GHCR in CI, the per-user rate limiter, the broker-outage fix in the outbox (amended [ADR-013](adr/013-rabbitmq-transport.md)) with Prometheus alerts, the avatar conditional GET, the optional Loki overlay, Dependabot, and the k8s and OIDC notes below. The plan is complete.

## What the backend provides

| Need | Available today |
|---|---|
| a transport seam | `IIntegrationEventPublisher.PublishAsync(messageId, type, content)` is the single place where events leave a module; `IntegrationEventTypes` turns `type` and `content` back into a typed event; since 2026-10-23 the host wraps it in `InstrumentedEventPublisher`, so any future transport is measured for free |
| telemetry | the `Observability` configuration section (disabled by default, fail-fast validation when enabled) exports traces, metrics and logs over OTLP; `AuctionServer.*` sources and meters are subscribed, so new module meters appear without host changes |
| a trusted proxy hop | the `Gateway` configuration section (disabled by default, fail-fast validation when enabled) lets `UseForwardedHeaders`, the first middleware, trust `X-Forwarded-For` and `X-Forwarded-Proto` only from the listed CIDR networks |
| health for orchestration | `/health/live` (no checks) and `/health/ready` (checks tagged `ready`, the database today) next to the full `/health` |
| configuration from the environment | every setting is read through `IConfiguration`, so `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey` and the `Observability__*` keys can be injected as environment variables; since phase six the fail-fast `Vault` section can add OpenBao as the last configuration source, whose values win over the environment |
| a reproducible database | the schema is fully described by the nine migration sets, applied with `dotnet ef database update` per context or at startup when `Database:MigrateOnStartup` is `true` (Compose sets it) |
| object storage for avatars | the `seaweedfs` service in `compose.yaml`: pinned image, no published ports, reached behind the `IAvatarStorage` seam ([backend/profiles.md](backend/profiles.md)) |
| a CI baseline | the GitHub Actions workflow `.github/workflows/ci.yml` builds and tests on every push, including the host test project `AuctionServer.Api.Tests`, whose gateway tests start nginx and traefik/whoami through Testcontainers, checks `nginx.conf` with `nginx -t` in a `gateway-config` job, validates `compose.yaml` in `compose-config` and builds the application image to GHCR in `image` |

## What is missing

- **There is no TLS yet, so the stack must not face the internet until it lands.** The owner's target is HTTPS only with an own certificate, renewed automatically or served by a redundant pair so the certificate does not become a single point of failure.- nginx forwards `Host` without the port, so the OpenAPI `servers` entry reads `http://localhost/`. The api builds only relative URLs, so nothing else is affected.
- The CI pipeline has no deploy stage: the `image` job pushes to GHCR from `main`, but nothing consumes that image automatically.
- Secret zero remains: the generated secret files and the AppRole credentials volume live on the host filesystem, so the trust chain still ends there (named honestly in [ADR-014](adr/014-openbao-secrets.md)).

## API

The infrastructure layer has one endpoint of its own, `/gateway-health`, which nginx answers without the api. Everything else on port 8080 is the backend API. The internal queue carries all thirty-eight integration events listed in [backend/messaging.md](backend/messaging.md#event-catalog), and the market exchange re-publishes four of them for the bots ([bots.md](bots.md)).

## Decisions

- The telemetry stack is OTel Collector + Prometheus + Grafana + Tempo, the owner's pick over the lighter Aspire Dashboard; see [ADR-005](adr/005-observability-and-k6.md).
- The gateway is nginx with IP rate limits, body caps, JSON errors and a CIDR trust model for forwarded headers, see [ADR-006](adr/006-nginx-gateway.md).
- The pooler is PgBouncer in transaction mode and the migrations go through it, because the Npgsql EF 10 migration lock is a table lock inside the migration transaction, with Npgsql pooling kept on plus `No Reset On Close=true`, see [ADR-007](adr/007-pgbouncer-transaction-pooling.md).
- Load tests target `http://api:8080` directly from inside the Compose network, so the baseline stays comparable now that the gateway sits in front. Only `gateway-limits.js` goes through the gateway, run with `BASE_URL=http://gateway`.
- The transport is introduced behind the existing seam rather than by changing the modules, see [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md); the 2026-11-04 swap confirmed it and touched only the host.
- The broker speaks through the raw `RabbitMQ.Client`, not a messaging framework, with publisher confirms before an outbox row counts as processed and all retry state in the database, see [ADR-013](adr/013-rabbitmq-transport.md).
- The secrets backend is OpenBao read once at startup through a hand-written configuration provider (no package), while the infrastructure containers get generated compose file secrets, see [ADR-014](adr/014-openbao-secrets.md).
- PgBouncer keeps the stock image with a mounted generated userlist, the owner's pick over a wrapper image with `_FILE` support, and Redis runs with `--requirepass` from a secret file, also the owner's pick, see [ADR-014](adr/014-openbao-secrets.md).
- Backups ride the prebuilt `prodrigestivill/postgres-backup-local` image, the owner's pick over a hand-rolled cron sidecar (2026-11-07).
- The per-user limiter is the framework one, token buckets partitioned by the user id claim with the route map in the host; it realizes the host half of [ADR-006](adr/006-nginx-gateway.md), so no new ADR was written.
- Loki is an optional overlay, not a base service, the owner's pick to keep the default stack lighter (2026-11-07).
- The image goes to GHCR only from `main`, tagged `latest` plus the commit sha, and pull requests build without pushing; GitLab CI was removed outright (both 2026-11-07).
- Postgres stays published on host port 5436 on all interfaces, the owner's explicit call (2026-11-07). This is an accepted risk of the dev stack, not a production pattern: the generated password is the only guard, and a loopback bind would cost nothing locally.

## A future Kubernetes deployment

Nothing in the repository targets Kubernetes today; this section maps the compose stack onto it for the day it is needed.

- The api becomes a Deployment with an HPA, `/health/live` and `/health/ready` wired as the liveness and readiness probes, and the image pulled from GHCR.
- The gateway's job moves to an Ingress controller; the nginx zones translate to controller annotations, while the per-account limits already live in the host.
- postgres moves under the CloudNativePG operator, whose Pooler replaces the pgbouncer container.
- RabbitMQ runs under its operator with quorum queues in place of the single-node durable queue.
- The vault comes from the official Helm chart with the agent injector replacing the AppRole file hand-off in the `vaultcreds` volume.
- Startup migrations move from `Database:MigrateOnStartup` to a Job that completes before the rollout.

Before more than one api replica is allowed, the single-instance assumptions must fall: the outbox and delivery pollers already claim with `FOR UPDATE SKIP LOCKED` leases, so they are replica-safe, but `AuctionCloser` and the four keepers would run in every pod and need leader election or a singleton pod, the HybridCache L1 has no backplane so cached reads may diverge per pod for the TTL, the rate limiter keeps its buckets per pod so effective limits multiply by the replica count, and the JWT signing key is already shared through the vault.

## A future OIDC provider

Identity issues the JWTs today. When social login, MFA or more client types arrive, a dedicated OIDC provider (Keycloak) takes over token issuing.

- The host switches `AddJwtBearer` to the provider's `Authority` and validates through its JWKS instead of the shared `Jwt:Key`.
- The Angular client logs in with Authorization Code + PKCE, which also adds the refresh flow the current 15-minute tokens lack.
- The bots move from `X-Api-Key` provisioning to the client-credentials flow.
- Identity stays as the user store, mapping `PublicUserId` onto the provider's `sub`, and the BCrypt hashes migrate lazily on first login.
- The price is one heavyweight service more, roughly 500 MB of RAM in this stack, which is why it waits for a real trigger.

## Related documents

- [performance.md](performance.md) - the k6 baseline and every before/after measurement.
- [ARCHITECTURE.md](ARCHITECTURE.md) - the system context with the planned parts and the CI pipeline.
- [backend/messaging.md](backend/messaging.md) - the outbox, the publisher seam and the event catalog.
- [frontend.md](frontend.md), [bots.md](bots.md) - the clients that depend on this layer.
