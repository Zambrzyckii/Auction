# AuctionServer — current state

> English version. Polish 1:1 counterpart: [../pl/STATE.md](../pl/STATE.md)
>
> Last updated: 2026-10-24

## Phase

**Backend complete for the main flow, no other module started.** On 2026-10-14 the pending-auction timeout and the funds-reservation saga for bids landed, followed the same day by the first gameplay batch: the starter item pack and player-to-player transfers. On 2026-10-15 the fifth module, Warehouses, landed with the warehouse wars from the third roadmap item, the sixth, Banking, with the turnover-gated loans from the fourth, and the seventh, Pawnshop, with the passive-income bots from the fifth. Before that the last code commit was `e684e33` from 2026-08-30. Register, login, create auction, bid, close and settle work end to end inside one process, with the known gaps listed below; the whole chain, both sagas included, was verified manually against the Compose stack on 2026-10-14, the warehouse war chain (stocking, entry locks, guarded raises, settlement with reveal and refunds) the same way on 2026-10-15, and the loan chain (turnover rejection, grant after a top-up, early repayment, keeper collection, overdue penalty with retry) the same day, with all six outboxes clean afterwards. The pawnshop chain was probed live against the Compose stack the same day with 33 checks, all passed. The probe covered the offers, the premises purchase with the turnover gate, the bot purchases and their conflicts, the spawns, the withdrawal, the automatic sale with its payout and the zero dead and zero stale pending rows across all seven outboxes. On 2026-10-17 the eighth module, Casino, landed with the chips, roulette and blackjack from the sixth roadmap item; its chain (free entry, the purchase saga with a rejection, a hedged roulette spin, the hidden hole card, the keeper's auto-stand of an abandoned hand, a cash-out that builds no turnover) was probed live against the Compose stack the same day with 34 checks, all passed, with zero dead and zero stale pending rows across all eight outboxes. On 2026-10-22 the ninth module, Profiles, landed with the user profiles from the seventh roadmap item (turnover-driven levels computed in Wallets, avatars in SeaweedFS, social links, friends, warehouse invites); its chain (profile creation from registration, level catch-up and rewards, social-link validation, the avatar round trip with the oversize and format rejections, the friend lifecycle with the auto-accepted cross request, the invites with their conflicts) was probed live against the fresh Compose stack the same day with 53 checks, all passed, with zero dead and zero stale pending rows across all eight outboxes and the level events visible in the Profiles inbox. On 2026-10-23 the platform work opened: phase one of the server-infrastructure plan landed (OpenTelemetry in the host, the Compose telemetry stack, the k6 scenarios with a baseline and thresholds), verified against the live stack and recorded in [performance.md](performance.md). Phase two followed the same day. nginx became the only entry point on port 8080, with IP rate limits, body caps, JSON errors and a JSON access log, the host trusts forwarded headers only from the pinned `edge` network, and health split into live and ready. The gateway was probed live against the restarted stack and measured in [performance.md](performance.md). On 2026-10-24 phase three put PgBouncer between the api and postgres, so the api, startup migrations included, reaches the database only through transaction pooling, probed live and measured before and after in [performance.md](performance.md).

## What exists

- `Backend/`: the host `AuctionServer.Api`, the modules Identity, Wallets, Auctions, Inventory, Warehouses, Banking, Pawnshop, Casino and Profiles (consume-only, no outbox) and the contracts project `Shared.Integration`; 51 endpoints, 37 integration events, 38 tables, eight `OutboxProcessor`s, `AuctionCloser`, `WarehouseKeeper`, `BankKeeper`, `PawnshopKeeper` and `CasinoKeeper`.
- Tests: ten xUnit projects (one per module plus the host project `AuctionServer.Api.Tests`), 819 test methods, none crossing a module boundary.
- CI: `.gitlab-ci.yml` and its GitHub Actions mirror `.github/workflows/ci.yml`, both with `build`, `unit-tests`, `integration-tests` and `gateway-config` (`nginx -t` on the gateway configuration).
- Documentation: `docs/en` and `docs/pl` with this set of pages and 19 rendered diagrams; root `README.md` and `README.pl.md`.
- `Backend/Dockerfile` and a root `compose.yaml` (the nginx gateway in front of the API + PostgreSQL behind PgBouncer + SeaweedFS for avatars plus the telemetry stack of OTel Collector, Prometheus, Tempo and Grafana, split into `edge` and `data` networks with frozen resource limits, migrations applied at startup behind `Database:MigrateOnStartup`); k6 load scenarios behind the `loadtest` profile, configuration under `Infrastructure/`. `compose.debug.yaml` additionally publishes the API on `127.0.0.1:8081`.
- CORS for the configured frontend origins (`Cors:AllowedOrigins`), the OpenAPI document at `/openapi/v1.json` (private networks only through the gateway) and `/health`, `/health/live` and `/health/ready`.
- Not in the repository: frontend, bots, message broker.

## Development environment

- .NET SDK 10.0.301 and `dotnet-ef` 10.0.9; every project targets `net10.0`.
- Docker for the local PostgreSQL and for Testcontainers (`postgres:latest` in tests, `postgres:16-alpine` in `compose.yaml`); `docker compose up -d` starts the whole system behind the gateway on `http://localhost:8080`, with Grafana on `http://127.0.0.1:3000`.
- Node.js 26 and Python 3 only for re-rendering diagrams (`docs/diagrams/render.py`).
- IDE: Rider (`Backend/.idea/` is ignored, `AuctionServer.sln.DotSettings.user` is tracked).

## Known gaps

- Nothing blocks a browser client any more; the remaining smaller limitations are listed in [ARCHITECTURE.md](ARCHITECTURE.md#known-limitations).
- The gateway has no TLS yet, so the stack must not face the internet, see [infrastructure.md](infrastructure.md#what-is-missing).

## Next step

On 2026-10-14 the owner decided to grow the backend with gameplay features before the Angular frontend. The first batch (starter item pack, player-to-player transfers) shipped the same day, the warehouse wars, the bank and the pawnshop followed on 2026-10-15, the casino on 2026-10-17 and the user profiles, the last gameplay item, on 2026-10-22, with the private-profile option following the same day. The platform work started on 2026-10-23 with the observability phase and the nginx gateway, and PgBouncer followed on 2026-10-24. The next step of the server-infrastructure plan is the Redis read cache, followed by RabbitMQ, OpenBao and hardening, with the Angular frontend and the AI bots after that ([VISION.md](VISION.md)).

## Related documents

- [VISION.md](VISION.md) - what is planned.
- [CHANGELOG.md](CHANGELOG.md) - how the project got here.
- [ARCHITECTURE.md](ARCHITECTURE.md) - how it is built and what is missing.
