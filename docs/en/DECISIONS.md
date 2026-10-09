# AuctionServer — decision log

> English version. Polish 1:1 counterpart: [../pl/DECISIONS.md](../pl/DECISIONS.md)

Append-only log of decisions, oldest first, dated by the day the decision was taken (for code, the date of the commit that introduced it). Where no rationale was written down at the time, the row says so instead of inventing one; decisions with lasting consequences also have an ADR under [adr/](adr).

| Date | Decision | Author | Rationale |
|---|---|---|---|
| 2026-07-06 | Modular monolith in .NET on one PostgreSQL database with a single shared contracts project (`Shared.Integration`) | owner | recorded in the design note of 2026-08-03 and the README: strict module boundaries and event-driven integration over feature count; see ADR-001 |
| 2026-07-06 | Auctions uses CQRS: EF Core for writes, Dapper for reads | owner | design note: "full CQRS (EF Core for writes, Dapper for complex reads)" for Auctions; see ADR-004 |
| 2026-07-07 | Domain exceptions derive from `AppException(message, statusCode)` and are mapped by one global handler | owner | README: one exception handler so endpoints contain no try/catch |
| 2026-07-07 | Transactional outbox in Auctions | owner | design note: events saved in the same transaction as the business state; see ADR-002 |
| 2026-07-08 | `Guid Version` concurrency tokens; `DbUpdateConcurrencyException` mapped to 409 | owner | design note: optimistic concurrency on financial writes to prevent double spend |
| 2026-07-08 | Wallets uses CQS (EF Core for reads and writes) | owner | design note: CQS for Wallets, CQRS only where reads are complex |
| 2026-08-03 | Integration tests run against real PostgreSQL through Testcontainers, no database mocking | owner | design note, testing strategy |
| 2026-08-04 | Identity with BCrypt password hashing and HS256 JWTs | owner | rationale not recorded |
| 2026-08-15 | Wallet created automatically from `UserRegisteredEvent` through the Identity outbox | owner | README: wallet-per-user auto-creation |
| 2026-08-15 | GitLab CI with `build`, `unit-tests` and `integration-tests` (docker-in-docker) | owner | rationale not recorded |
| 2026-08-15 | Background `AuctionCloser` closes expired auctions and emits `AuctionFinishedEvent` | owner | README: automatic closing atomically with the state change |
| 2026-08-15 | Inbox (`ProcessedMessages`) in Wallets for idempotent consumption | owner | README: exactly-once settlement over at-least-once delivery; see ADR-002 |
| 2026-08-15 | `src/` and `tests/` layout under `Backend/` | owner | rationale not recorded |
| 2026-08-16 | FluentValidation through a MediatR pipeline behavior with a 400 contract | owner | README: consistent validation error contract |
| 2026-08-16 | Outbox dead-lettering with exponential backoff, five attempts | owner | README: failing messages keep their error history and stop retrying forever |
| 2026-08-16 | Inventory module: rarity tiers, crafting three to one, official shop | owner | README feature list; the rules themselves have no recorded rationale |
| 2026-08-17 | Settlement in Wallets made idempotent via the inbox | owner | README: exactly once |
| 2026-08-26 | `IIntegrationEventPublisher` seam and `EventId` on every event | owner | README: RabbitMQ as a drop-in replacement for the in-process publisher; see ADR-003 |
| 2026-08-29 | Enums serialized as strings in JSON | owner | rationale not recorded |
| 2026-08-29 | Bot role with 24-hour tokens, API-key scheme and bot-only endpoints | owner | README: bots provisioned and funded through dedicated endpoints; the lifetimes have no recorded rationale |
| 2026-08-29 | Configurable starting funds (`Wallets:StartingFunds`) | owner | rationale not recorded |
| 2026-08-29 | Auctions created as `Pending` until Inventory confirms the item lock; filtered unique index for one open auction per item; inboxes in Auctions and Inventory | owner | README: an auction never refers to an item the seller cannot lock |
| 2026-08-30 | Wallets outbox and `AuctionSettledEvent`; the item is transferred only after settlement | owner | README: the item moves only after the money did |
| 2026-08-30 | Funds reservation per bid designed (pessimistic bid, per-bid lock ledger) but not implemented | owner | design note of 2026-08-30: an uncovered bid breaks an auction, two wallets and an item |
| 2026-10-07 | Documentation set: bilingual EN/PL 1:1 under `docs/`, standing documents plus module chapters, Mermaid diagrams rendered to SVG, previous `docs/` moved out of the repository, README rewritten as a front door | owner (with agent) | the previous documentation did not match the code and was not tracked by git |
| 2026-10-07 | Module chapters live centrally in `docs/{en,pl}/backend/`; each planned module gets one page | owner (with agent) | three of the four modules do not exist yet; one index is easier to keep |
| 2026-10-07 | Diagram labels in English only, shared by both languages | agent (proposal, accepted) | one source per diagram; Polish letters are a problem in Mermaid labels |

## Related documents

- [adr/](adr) - the four architecture decision records.
- [CHANGELOG.md](CHANGELOG.md) - the milestones these decisions belong to.
- [CONVENTIONS.md](CONVENTIONS.md) - the rules that follow from them.
