# AuctionServer — current state

> English version. Polish 1:1 counterpart: [../pl/STATE.md](../pl/STATE.md)
>
> Last updated: 2026-10-15

## Phase

**Backend complete for the main flow, no other module started.** On 2026-10-14 the pending-auction timeout and the funds-reservation saga for bids landed, followed the same day by the first gameplay batch: the starter item pack and player-to-player transfers. On 2026-10-15 the fifth module, Warehouses, landed with the warehouse wars from the third roadmap item, and the sixth, Banking, with the turnover-gated loans from the fourth. Before that the last code commit was `e684e33` from 2026-08-30. Register, login, create auction, bid, close and settle work end to end inside one process, with the known gaps listed below; the whole chain, both sagas included, was verified manually against the Compose stack on 2026-10-14, the warehouse war chain (stocking, entry locks, guarded raises, settlement with reveal and refunds) the same way on 2026-10-15, and the loan chain (turnover rejection, grant after a top-up, early repayment, keeper collection, overdue penalty with retry) the same day, with all six outboxes clean afterwards.

## What exists

- `Backend/`: the host `AuctionServer.Api`, the modules Identity, Wallets, Auctions, Inventory, Warehouses and Banking and the contracts project `Shared.Integration`; 25 endpoints, 25 integration events, 22 tables, six `OutboxProcessor`s, `AuctionCloser`, `WarehouseKeeper` and `BankKeeper`.
- Tests: six xUnit projects, 428 test methods (234 offline, 194 integration through Testcontainers), none crossing a module boundary.
- CI: `.gitlab-ci.yml` and its GitHub Actions mirror `.github/workflows/ci.yml`, both with `build`, `unit-tests` and `integration-tests`.
- Documentation: `docs/en` and `docs/pl` with this set of pages and 15 rendered diagrams; root `README.md` and `README.pl.md`.
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

On 2026-10-14 the owner decided to grow the backend with gameplay features before the Angular frontend. The first batch (starter item pack, player-to-player transfers) shipped the same day, the warehouse wars and the bank followed on 2026-10-15. Next in the [VISION.md](VISION.md) roadmap is the pawnshop, which depends on the economy decisions the bank has now made.

## Related documents

- [VISION.md](VISION.md) - what is planned.
- [CHANGELOG.md](CHANGELOG.md) - how the project got here.
- [ARCHITECTURE.md](ARCHITECTURE.md) - how it is built and what is missing.
