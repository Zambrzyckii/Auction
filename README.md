# AuctionServer

> English version. Polish counterpart: [README.pl.md](README.pl.md)

**AuctionServer** is a gamified auction house built as a **modular monolith in .NET 10 on PostgreSQL**: users register, receive a virtual wallet, collect and craft items, trade them through timed auctions with anti-sniping, automatic closing and exactly-once settlement, bid in fast warehouse wars over hidden stock, take bank loans gated by their lifetime market turnover, earn passive income from a pawnshop staffed by bots, gamble their money away at a casino with roulette and blackjack and show it all off on a profile with turnover-driven levels, an avatar and friends. It is a portfolio and learning project whose point is the architecture: strict module boundaries, event-driven integration through a transactional outbox and inbox, and correctness guarantees (idempotency, optimistic concurrency, atomic writes) that demo projects usually skip.

## Status

The backend is complete for the main flow: nine modules (Identity, Wallets, Auctions, Inventory, Warehouses, Banking, Pawnshop, Casino, Profiles), 51 endpoints, 37 integration events, 819 test methods, CI pipelines for GitLab and GitHub Actions, an OpenTelemetry observability stack measured with k6, an nginx gateway in front of the API and PgBouncer in front of PostgreSQL. The Angular frontend, the AI bots and RabbitMQ are planned and not started. Live status: [docs/en/STATE.md](docs/en/STATE.md).

## Quick start

```bash
docker compose up -d        # the nginx gateway on http://localhost:8080 in front of the API, PostgreSQL behind PgBouncer, SeaweedFS and telemetry, migrations applied at startup
```

Then `POST /api/users/register`, `POST /api/users/login` and call the rest with the returned token; the endpoints are listed in [docs/en/backend/README.md](docs/en/backend/README.md). The manual, IDE-friendly path (local PostgreSQL, user secrets, migrations per module, `dotnet run`) is described in [docs/en/backend/README.md#running](docs/en/backend/README.md#running).

<details>
<summary>Tests</summary>

```bash
dotnet test AuctionServer.slnx      # the module projects start PostgreSQL and the host project nginx through Testcontainers, so Docker must be running
```

</details>

## Requirements

- .NET SDK 10.0 and the `dotnet-ef` tool (`dotnet tool install --global dotnet-ef`)
- Docker, for PostgreSQL and for the Testcontainers-based tests
- Node.js 18+ and Python 3 only to re-render the documentation diagrams

## Documentation

Bilingual EN/PL, 1:1 structure: [docs/en](docs/en) / [docs/pl](docs/pl). Start with the index.

- [Index](docs/en/README.md) - reading order and a map of every page
- [Architecture](docs/en/ARCHITECTURE.md) - system context, modules, auction flows, data model, CI and known limitations, with diagrams
- [Backend](docs/en/backend/README.md) - projects, running, configuration, request pipeline, tests, and one chapter per module
- [Vision](docs/en/VISION.md) - glossary, target system, what is planned next
- [Conventions](docs/en/CONVENTIONS.md) - how the code, tests and documentation are kept
- [Decisions](docs/en/DECISIONS.md) and [ADRs](docs/en/adr) - why it is built this way
- [State](docs/en/STATE.md) and [Changelog](docs/en/CHANGELOG.md) - where the project stands and how it got here
- [Frontend](docs/en/frontend.md), [Bots](docs/en/bots.md), [Infrastructure](docs/en/infrastructure.md) - the planned modules
