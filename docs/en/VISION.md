# AuctionServer — vision

> English version. Polish 1:1 counterpart: [../pl/VISION.md](../pl/VISION.md)

This document states what AuctionServer is meant to become, defines the vocabulary used across the documentation and separates what exists today from what is planned. It is the entry point for anyone deciding what to build next.

## 1. What is AuctionServer

AuctionServer is a gamified auction house: registered users receive a wallet with virtual money, collect items of four rarity tiers, craft and sell them, and trade them through timed auctions with anti-sniping, automatic closing and exactly-once settlement. It is a portfolio and learning project: the goal is not the number of features but a backend whose module boundaries, event-driven integration and correctness guarantees (idempotency, optimistic concurrency, atomic writes) hold up under inspection.

## 2. Glossary

| Term | Meaning |
|---|---|
| auction | a timed listing of one item by its owner; statuses `Pending`, `Active`, `Closed`, `Cancelled` |
| bid | an offer above the current price by a user who is neither the seller nor the current leader; today a bid is accepted before the bidder's funds are checked |
| anti-sniping window | the last 30 s of an auction; a bid inside it extends `EndsOn` by 30 s |
| available funds, locked funds | the two balances of a wallet; a leading bid moves money from available to locked, settlement spends the locked part |
| official price | the item's price rolled from its rarity at creation; paid by the shop and shown on the auction |
| rarity tier | `Common`, `Rare`, `Epic`, `Legendary`; each tier has its own price range |
| crafting | consuming three items of one tier to create one item of the next tier |
| official shop | the built-in buyer that pays the official price for any available item |
| bot | an account with `Role.Bot`: provisioned with an API key, 24-hour tokens, allowed to mint items and add funds |
| integration event | a record in `Shared.Integration/Events/` that one module publishes and others consume |
| outbox, inbox | the per-module tables that make publishing atomic with the state change and consumption idempotent |
| dead letter | an outbox row that failed five times and is no longer retried |
| saga | a chain of events across modules with no central coordinator, each step a local transaction |
| item snapshot | the name, rarity and official price copied onto an auction when it is activated |

## 3. Actors

- **Player** (`Role.User`): registers, logs in for a 15-minute token, lists items, bids, crafts and sells to the shop.
- **Bot** (`Role.Bot`): a provisioned account with a 24-hour token that can additionally call `POST /api/wallets/funds` and `POST /api/inventory/items`; intended for the planned AI market bots.
- **Bot provisioner**: whoever holds `Bots:ApiKey`; creates bot accounts through `POST /api/users/bots` and has no user record.
- `Role.Admin` exists in the enum but is never assigned or checked.

## 4. Target system

The system-context diagram in [ARCHITECTURE.md](ARCHITECTURE.md) shows the target with dashed borders; it comes from the project's original design note (`AGENTS.md`, deleted on 2026-08-15) and the previous README:

- an **Angular frontend** as the user interface;
- an **API gateway** as the single entry point for the frontend and the bots;
- the **backend API**, the modular monolith that exists today, kept as one deployable;
- **RabbitMQ** as the transport for integration events leaving the monolith, plugged into the `IIntegrationEventPublisher` seam;
- **AI bots** written in Python that listen to market events on RabbitMQ and act through the gateway.

## 5. What exists today

- Identity: registration, login, JWT with a role claim, bot provisioning with an API key, soft-deleted users, BCrypt.
- Wallets: automatic wallet with configured starting funds, bot-only top-up, lock, unlock and spend of funds, settlement with an inbox and an outbox.
- Auctions: creation as `Pending` until Inventory locks the item, listing and detail through Dapper, bidding with anti-sniping, background closing, outbox with retry and dead letters, inbox.
- Inventory: items with rarity-based prices, crafting, selling to the shop, locking and transferring items for auctions, inbox and outbox.
- Cross-cutting: FluentValidation pipeline, global error contract, optimistic concurrency, GitLab CI with Testcontainers.

## 6. Planned next

TODO(human): order the items below by priority and add one sentence per item saying why it comes next; edit only this English file, the Polish twin is translated afterwards.

- Funds reservation per bid: a bid stored as `Pending` that becomes the leader only after Wallets confirms a per-bid lock, mirroring the item-lock saga (designed on 2026-08-30, not implemented).
- Bid history: a table of bids per auction and `GET /api/auctions/{id}/bids`.
- Starter item pack granted on registration.
- RabbitMQ as the event transport behind `IIntegrationEventPublisher`.
- Angular frontend, AI market bots and the API gateway.
- Docker Compose for the host and PostgreSQL, so the project starts with one command.

## 7. Ground rules

- One module is one project with `Presentation/`, `Application/`, `Domain/` and `Infrastructure/`; `Domain/` and `Application/` stay free of ASP.NET Core types.
- No cross-module project references and no cross-module database queries; modules communicate only through integration events in `Shared.Integration`.
- Every module owns its `DbContext`, its tables and its migrations; the shared database does not mean shared tables.
- Every state change that another module must learn about goes through the outbox in the same transaction; every consumer is idempotent.
- Money and state races are resolved by optimistic concurrency, never by silent last-write-wins.

## Related documents

- [ARCHITECTURE.md](ARCHITECTURE.md) - how the existing part is built.
- [STATE.md](STATE.md) - where the project stands right now.
- [DECISIONS.md](DECISIONS.md) and [adr/](adr) - why it is built this way.
- [frontend.md](frontend.md), [bots.md](bots.md), [infrastructure.md](infrastructure.md) - the planned modules.
