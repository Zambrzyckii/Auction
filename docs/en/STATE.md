# AuctionServer — current state

> English version. Polish 1:1 counterpart: [../pl/STATE.md](../pl/STATE.md)
>
> Last updated: 2026-10-17

## Phase

**Backend complete for the main flow, no other module started.** On 2026-10-14 the pending-auction timeout and the funds-reservation saga for bids landed, followed the same day by the first gameplay batch: the starter item pack and player-to-player transfers. On 2026-10-15 the fifth module, Warehouses, landed with the warehouse wars from the third roadmap item, the sixth, Banking, with the turnover-gated loans from the fourth, and the seventh, Pawnshop, with the passive-income bots from the fifth. Before that the last code commit was `e684e33` from 2026-08-30. Register, login, create auction, bid, close and settle work end to end inside one process, with the known gaps listed below; the whole chain, both sagas included, was verified manually against the Compose stack on 2026-10-14, the warehouse war chain (stocking, entry locks, guarded raises, settlement with reveal and refunds) the same way on 2026-10-15, and the loan chain (turnover rejection, grant after a top-up, early repayment, keeper collection, overdue penalty with retry) the same day, with all six outboxes clean afterwards. The pawnshop chain was probed live against the Compose stack the same day with 33 checks, all passed. The probe covered the offers, the premises purchase with the turnover gate, the bot purchases and their conflicts, the spawns, the withdrawal, the automatic sale with its payout and the zero dead and zero stale pending rows across all seven outboxes. On 2026-10-17 the eighth module, Casino, landed with the chips, roulette and blackjack from the sixth roadmap item; its chain (free entry, the purchase saga with a rejection, a hedged roulette spin, the hidden hole card, the keeper's auto-stand of an abandoned hand, a cash-out that builds no turnover) was probed live against the Compose stack the same day with 34 checks, all passed, with zero dead and zero stale pending rows across all eight outboxes.

## What exists

- `Backend/`: the host `AuctionServer.Api`, the modules Identity, Wallets, Auctions, Inventory, Warehouses, Banking, Pawnshop and Casino and the contracts project `Shared.Integration`; 38 endpoints, 36 integration events, 33 tables, eight `OutboxProcessor`s, `AuctionCloser`, `WarehouseKeeper`, `BankKeeper`, `PawnshopKeeper` and `CasinoKeeper`.
- Tests: eight xUnit projects, 646 test methods (380 offline, 266 integration through Testcontainers), none crossing a module boundary.
- CI: `.gitlab-ci.yml` and its GitHub Actions mirror `.github/workflows/ci.yml`, both with `build`, `unit-tests` and `integration-tests`.
- Documentation: `docs/en` and `docs/pl` with this set of pages and 17 rendered diagrams; root `README.md` and `README.pl.md`.
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

On 2026-10-14 the owner decided to grow the backend with gameplay features before the Angular frontend. The first batch (starter item pack, player-to-player transfers) shipped the same day, the warehouse wars, the bank and the pawnshop followed on 2026-10-15 and the casino on 2026-10-17. Next in the [VISION.md](VISION.md) roadmap are the user profiles (friends, avatar, linked accounts, a private-profile option), the last gameplay item before the Angular frontend.

## Related documents

- [VISION.md](VISION.md) - what is planned.
- [CHANGELOG.md](CHANGELOG.md) - how the project got here.
- [ARCHITECTURE.md](ARCHITECTURE.md) - how it is built and what is missing.
