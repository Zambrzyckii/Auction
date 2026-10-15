# AuctionServer — current state

> English version. Polish 1:1 counterpart: [../pl/STATE.md](../pl/STATE.md)
>
> Last updated: 2026-10-15

## Phase

**Backend complete for the main flow, no other module started.** On 2026-10-14 the pending-auction timeout and the funds-reservation saga for bids landed, followed the same day by the first gameplay batch: the starter item pack and player-to-player transfers. On 2026-10-15 the fifth module, Warehouses, landed with the warehouse wars from the third roadmap item. Before that the last code commit was `e684e33` from 2026-08-30. Register, login, create auction, bid, close and settle work end to end inside one process, with the known gaps listed below; the whole chain, both sagas included, was verified manually against the Compose stack on 2026-10-14, and the warehouse war chain (stocking, entry locks, guarded raises, settlement with reveal and refunds) the same way on 2026-10-15, with all five outboxes clean afterwards.

## What exists

- `Backend/`: the host `AuctionServer.Api`, the modules Identity, Wallets, Auctions, Inventory and Warehouses and the contracts project `Shared.Integration`; 21 endpoints, 20 integration events, 19 tables, five `OutboxProcessor`s, `AuctionCloser` and `WarehouseKeeper`.
- Tests: five xUnit projects, 344 test methods (177 offline, 167 integration through Testcontainers), none crossing a module boundary.
- CI: `.gitlab-ci.yml` with `build`, `unit-tests` and `integration-tests`.
- Documentation: `docs/en` and `docs/pl` with this set of pages and 14 rendered diagrams; root `README.md` and `README.pl.md`.
- `Backend/Dockerfile` and a root `compose.yaml` (API + PostgreSQL, migrations applied at startup behind `Database:MigrateOnStartup`).
- CORS for the configured frontend origins (`Cors:AllowedOrigins`), the OpenAPI document at `/openapi/v1.json` and `/health` with a database check.
- Not in the repository: frontend, bots, gateway, message broker.

## Development environment

- .NET SDK 10.0.301 and `dotnet-ef` 10.0.9; every project targets `net10.0`.
- Docker for the local PostgreSQL and for Testcontainers (`postgres:latest` in tests, `postgres:16-alpine` in `compose.yaml`); `docker compose up -d` starts the whole system on `http://localhost:8080`.
- Node.js 26 and Python 3 only for re-rendering diagrams (`docs/diagrams/render.py`).
- IDE: Rider (`Backend/.idea/` is ignored, `AuctionServer.sln.DotSettings.user` is tracked).

## Known gaps

- Nothing blocks a browser client any more; the remaining smaller limitations are listed in [ARCHITECTURE.md](ARCHITECTURE.md#known-limitations).

## Next step

On 2026-10-14 the owner decided to grow the backend with gameplay features before the Angular frontend. The first batch (starter item pack, player-to-player transfers) shipped the same day and the warehouse wars followed on 2026-10-15. Next in the [VISION.md](VISION.md) roadmap is the bank granting loans.

## Related documents

- [VISION.md](VISION.md) - what is planned.
- [CHANGELOG.md](CHANGELOG.md) - how the project got here.
- [ARCHITECTURE.md](ARCHITECTURE.md) - how it is built and what is missing.
