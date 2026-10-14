# AuctionServer

> English version. Polish counterpart: [README.pl.md](README.pl.md)

**AuctionServer** is a gamified auction house built as a **modular monolith in .NET 10 on PostgreSQL**: users register, receive a virtual wallet, collect and craft items and trade them through timed auctions with anti-sniping, automatic closing and exactly-once settlement. It is a portfolio and learning project whose point is the architecture: strict module boundaries, event-driven integration through a transactional outbox and inbox, and correctness guarantees (idempotency, optimistic concurrency, atomic writes) that demo projects usually skip.

## Status

The backend is complete for the main flow: four modules (Identity, Wallets, Auctions, Inventory), 13 endpoints, 14 integration events, 230 test methods and a GitLab CI pipeline. The Angular frontend, the AI bots, the API gateway and RabbitMQ are planned and not started. Live status: [docs/en/STATE.md](docs/en/STATE.md).

## Quick start

```bash
docker compose up -d        # PostgreSQL + the API on http://localhost:8080, migrations applied at startup
```

Then `POST /api/users/register`, `POST /api/users/login` and call the rest with the returned token; the endpoints are listed in [docs/en/backend/README.md](docs/en/backend/README.md). The manual, IDE-friendly path (local PostgreSQL, user secrets, migrations per module, `dotnet run`) is described in [docs/en/backend/README.md#running](docs/en/backend/README.md#running).

<details>
<summary>Tests</summary>

```bash
dotnet test AuctionServer.slnx      # every project starts PostgreSQL through Testcontainers, so Docker must be running
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
