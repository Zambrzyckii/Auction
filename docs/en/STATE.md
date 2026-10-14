# AuctionServer — current state

> English version. Polish 1:1 counterpart: [../pl/STATE.md](../pl/STATE.md)
>
> Last updated: 2026-10-14

## Phase

**Backend complete for the main flow, no other module started.** On 2026-10-14 the pending-auction timeout with its Inventory compensation landed. Before that the last code commit was `e684e33` from 2026-08-30. Register, login, create auction, bid, close and settle work end to end inside one process, with the known gaps listed below.

## What exists

- `Backend/`: the host `AuctionServer.Api`, the modules Identity, Wallets, Auctions and Inventory and the contracts project `Shared.Integration`; 13 endpoints, 10 integration events, 11 tables, four `OutboxProcessor`s and `AuctionCloser`.
- Tests: four xUnit projects, 217 test methods (115 offline, 102 integration through Testcontainers), none crossing a module boundary.
- CI: `.gitlab-ci.yml` with `build`, `unit-tests` and `integration-tests`.
- Documentation: `docs/en` and `docs/pl` with this set of pages and 13 rendered diagrams; root `README.md` and `README.pl.md`.
- Not in the repository: frontend, bots, gateway, message broker, Dockerfile, Compose file.

## Development environment

- .NET SDK 10.0.301 and `dotnet-ef` 10.0.9; every project targets `net10.0`.
- Docker for the local PostgreSQL and for Testcontainers (`postgres:latest` in tests, `postgres:16-alpine` suggested for local runs).
- Node.js 26 and Python 3 only for re-rendering diagrams (`docs/diagrams/render.py`).
- IDE: Rider (`Backend/.idea/` is ignored, `AuctionServer.sln.DotSettings.user` is tracked).

## Known gaps

- A bid is accepted before the bidder's funds are verified, and `LockedFunds` has no link to a bid; the per-bid reservation saga is designed but not implemented.
- No CORS, no OpenAPI, no health checks, no migrations at startup; a browser client cannot be connected without the first two.
- `GET /api/wallets/{id}` is anonymous; the full list is in [ARCHITECTURE.md](ARCHITECTURE.md#known-limitations).

## Next step

Implement the funds reservation saga (a pessimistic `Pending` bid confirmed by Wallets, a per-bid `FundsLock`), the first item in [VISION.md](VISION.md); the order of the remaining items awaits the owner's decision in that document.

## Related documents

- [VISION.md](VISION.md) - what is planned.
- [CHANGELOG.md](CHANGELOG.md) - how the project got here.
- [ARCHITECTURE.md](ARCHITECTURE.md) - how it is built and what is missing.
