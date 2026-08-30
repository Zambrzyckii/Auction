# AuctionServer — Gamified Auction System

A backend for a gamified auction house, built as a **modular monolith** in **.NET 10** on **PostgreSQL**.
Users register, receive a virtual wallet, collect items and trade them through real-time-ish auctions with
anti-sniping, automatic closing and exactly-once financial settlement.

This is a portfolio / learning project. Its goal is not feature count but **doing the architecture properly**:
strict module boundaries, event-driven communication between modules, and correctness guarantees
(idempotency, optimistic concurrency, atomic writes) that are usually skipped in demo projects.

## Tech stack

| Area | Choice |
|---|---|
| Runtime | .NET 10, ASP.NET Core minimal APIs |
| Database | PostgreSQL (single database, module-isolated tables) |
| Data access | EF Core 10 (writes) + Dapper (read path in Auctions) |
| Messaging (in-process) | MediatR — commands, queries and integration events |
| Validation | FluentValidation via a MediatR pipeline behavior |
| Auth | JWT bearer (+ API-key scheme for bot provisioning), BCrypt password hashing, claims-based identity |
| Testing | xUnit; Testcontainers for integration tests against real PostgreSQL |
| CI | GitLab CI — build, unit tests, integration tests (docker-in-docker) |

## Architecture

```
Backend/src
├── AuctionServer.Api                  host: DI wiring, JWT + API-key auth, global error handling
├── AuctionServer.Modules.Identity     register / login / bot provisioning, JWT issuing, user outbox
├── AuctionServer.Modules.Wallets      virtual funds: available/locked balance, settlement inbox + outbox
├── AuctionServer.Modules.Auctions     auctions & bidding, item-lock saga, background closer, inbox + outbox
├── AuctionServer.Modules.Inventory    items, crafting, shop, item lock / transfer for auctions, inbox + outbox
└── AuctionServer.Shared.Integration   the only shared project: integration events + base exception
```

Non-negotiable module rules:

- **No cross-module project references and no cross-module database joins.** Modules talk only through
  integration events (plain records in `Shared.Integration`).
- Every module owns its own `DbContext` and its own EF migrations. All modules share one physical database,
  so isolation is enforced by discipline and globally unique table names, not by schemas.
- `Domain` and `Application` layers stay free of ASP.NET Core types.

### The main flow (implemented; every hop covered by integration tests)

1. **Register** → Identity stores the user and writes `UserRegisteredEvent` to its **outbox** in the same
   transaction; a background processor publishes it; Wallets reacts and creates the user's wallet
   credited with the configured starting balance (`Wallets:StartingFunds`).
2. **Login** → JWT with the user's public id and role (15 min for players, 24 h for bots); endpoints resolve the caller from claims, never from the body.
3. **Create auction** → validated request (FluentValidation pipeline), factory-method invariants; the auction
   is stored as `Pending` and `ItemLockRequestedEvent` goes to the outbox in the same transaction. Inventory
   checks ownership and availability, locks the item and replies with `ItemLockedEvent` (or
   `ItemLockRejectedEvent`); Auctions then activates the auction with an item snapshot (name, rarity, official
   price) or cancels it with the reason. One open auction per item is enforced by a filtered unique index.
4. **Bid** → only on `Active` auctions; optimistic concurrency (`Version` token) resolves closer-vs-bidder
   races; bidding near the end extends the auction (**anti-sniping window**); `BidPlacedEvent` locks the
   bidder's funds and releases the previous leader's.
5. **Auction closes** → a background `AuctionCloser` picks up expired auctions, closes them and emits
   `AuctionFinishedEvent` atomically with the state change. Without a winner, Inventory unlocks the item.
6. **Settlement** → Wallets consumes the event through an **inbox** (`ProcessedMessages` keyed by event id):
   winner's locked funds are spent, seller is paid — **exactly once**, even though delivery is at-least-once —
   and `AuctionSettledEvent` is written to the Wallets outbox in the same transaction. Inventory consumes it
   and transfers the item to the winner: the item moves only after the money did.

### Reliability mechanics

- **Transactional outbox** in every publishing module — an event row and the state change commit together;
  a poller publishes pending rows.
- **Inbox (idempotent consumer)** in every consuming module (Wallets, Auctions, Inventory) — duplicate
  deliveries are detected up front, and a concurrent duplicate hits a primary-key violation and rolls back
  cleanly.
- **Saga by choreography, no orchestrator** — auction creation and settlement are chains of events across
  modules; each hop is a local transaction with inbox + outbox, so a crash between hops loses nothing and a
  redelivery changes nothing. Illegal state transitions (e.g. activating a non-pending auction) throw a 409,
  which dead-letters the message with its reason instead of silently skipping it.
- **Dead-lettering with exponential backoff** — failing outbox messages retry with growing delays
  (10 s → 20 s → 40 s → 80 s), keep their error history in the row, and are parked as dead after 5 attempts
  instead of retrying forever.
- **Optimistic concurrency everywhere money or state races matter** (`Wallet.Version`, `Auction.Version`) —
  conflicts surface as HTTP 409 or a retry on the next background tick.
- **Global error contract** — domain exceptions carry their HTTP status; a single exception handler maps them,
  so endpoints contain no try/catch.

## What is done vs. planned

**Done (works today, covered by the flow above):**

- Identity: registration, login, JWT with a role claim (`User` / `Bot`), bot account provisioning
  (`POST /api/users/bots`, API-key protected), soft-deleted users, password hashing
- Wallets: wallet-per-user auto-creation with configured starting funds, add funds (bot-only), lock/unlock/spend,
  settlement inbox, `AuctionSettledEvent` outbox
- Auctions: create (`Pending` until Inventory locks the item), list + detail (Dapper read model with status and
  item snapshot), bid with anti-sniping, background auto-close, inbox + outbox with dead-letter + backoff
- Inventory: item rarity tiers with rarity-based price rolls, a state machine
  (`Available / LockedForAuction / SoldToShop / Consumed`), crafting (sacrifice 3 same-rarity items → 1 random
  item of the next tier), selling to an official shop (paid out through Wallets), bot-only mint endpoint
  (`POST /api/inventory/items`), item lock for auctions and transfer to the winner / unlock after close
- Request validation pipeline (FluentValidation + MediatR behavior) with a consistent 400 error contract
- CI pipeline: build + unit tests + Testcontainers integration tests for all four modules

**Planned next:**

- Funds reservation for bids (same saga pattern) — today a bid is accepted before funds are verified
- Bid history table
- Starter item pack on registration
- RabbitMQ as the event transport (drop-in replacement for the in-process publisher)
- Angular frontend, AI market bots, API gateway (empty top-level dirs are placeholders for these)

## Running locally

```bash
# 1. PostgreSQL
docker run -d --name auction_db -p 6767:5432 \
  -e POSTGRES_USER=<user> -e POSTGRES_PASSWORD=<pass> -e POSTGRES_DB=AuctionDb postgres:16-alpine

# 2. Secrets (from Backend/)
dotnet user-secrets set "ConnectionStrings:DefaultConnection" \
  "Host=localhost;Port=6767;Database=AuctionDb;Username=<user>;Password=<pass>" \
  --project src/AuctionServer.Api
dotnet user-secrets set "Jwt:Key" "<random-string-min-32-chars>" --project src/AuctionServer.Api
dotnet user-secrets set "Bots:ApiKey" "<random-string>" --project src/AuctionServer.Api

# 3. Migrations (per module context; see Backend/CLAUDE.md for the full list)
dotnet ef database update --project src/AuctionServer.Modules.Identity \
  --startup-project src/AuctionServer.Api --context IdentityDbContext
# ... repeat for WalletDbContext, AuctionDbContext and InventoryDbContext

# 4. Run
dotnet run --project src/AuctionServer.Api        # http://localhost:5244

# 5. Tests (every test project has Testcontainers integration tests — a running Docker daemon is required)
dotnet test AuctionServer.slnx
```

## Repository layout

```
Backend/          all code (solution: AuctionServer.slnx, src/ + tests/)
Frontend/         planned Angular client
Bots/             planned AI market bots
Infrastructure/   planned RabbitMQ / gateway / compose setup
```
