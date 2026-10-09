# AuctionServer

> English version. Polish counterpart: [README.pl.md](README.pl.md)

**AuctionServer** is a gamified auction house built as a **modular monolith in .NET 10 on PostgreSQL**: users register, receive a virtual wallet, collect and craft items and trade them through timed auctions with anti-sniping, automatic closing and exactly-once settlement. It is a portfolio and learning project whose point is the architecture: strict module boundaries, event-driven integration through a transactional outbox and inbox, and correctness guarantees (idempotency, optimistic concurrency, atomic writes) that demo projects usually skip.

## Status

The backend is complete for the main flow: four modules (Identity, Wallets, Auctions, Inventory), 13 endpoints, 9 integration events, 214 test methods and a GitLab CI pipeline. The Angular frontend, the AI bots, the API gateway and RabbitMQ are planned and not started; the funds reservation saga for bids is designed and not implemented. Live status: [docs/en/STATE.md](docs/en/STATE.md).

## Quick start

Starting the system takes four steps today, because there is no Compose file yet and migrations are not applied at startup. Requirements are listed below; all `dotnet` commands run from `Backend/`.

```bash
# 1. PostgreSQL
docker run -d --name auction_db -p 6767:5432 -e POSTGRES_USER=<user> -e POSTGRES_PASSWORD=<pass> -e POSTGRES_DB=AuctionDb postgres:16-alpine

# 2. Secrets
cd Backend
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=6767;Database=AuctionDb;Username=<user>;Password=<pass>" --project src/AuctionServer.Api
dotnet user-secrets set "Jwt:Key" "<random string, at least 32 characters>" --project src/AuctionServer.Api
dotnet user-secrets set "Bots:ApiKey" "<random string>" --project src/AuctionServer.Api

# 3. Schema, one command per module context
dotnet ef database update --project src/AuctionServer.Modules.Identity --startup-project src/AuctionServer.Api --context IdentityDbContext
dotnet ef database update --project src/AuctionServer.Modules.Wallets --startup-project src/AuctionServer.Api --context WalletDbContext
dotnet ef database update --project src/AuctionServer.Modules.Auctions --startup-project src/AuctionServer.Api --context AuctionDbContext
dotnet ef database update --project src/AuctionServer.Modules.Inventory --startup-project src/AuctionServer.Api --context InventoryDbContext

# 4. Run
dotnet run --project src/AuctionServer.Api        # http://localhost:5244
```

Then `POST /api/users/register`, `POST /api/users/login` and call the rest with the returned token; the endpoints are listed in [docs/en/backend/README.md](docs/en/backend/README.md).

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
