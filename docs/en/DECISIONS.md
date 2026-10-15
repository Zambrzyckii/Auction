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
| 2026-10-14 | Funds reservation saga implemented: pessimistic pending bid on `Auction`, `Wallet` as DDD aggregate root owning a per-bid `FundsLock` ledger (EF owned collection) | owner | an uncovered bid is rejected before it leads; release and settlement take amounts from the ledger, not from events |
| 2026-10-14 | Backend grows with seven gameplay features before the Angular frontend: starter pack, player transfers, mystery warehouses, bank loans, pawnshop bots, casino, user profiles, in that order | owner | the frontend will have more to show; the money-moving features (bank, pawnshop, casino) sit next to each other so the game economy is designed as one piece |
| 2026-10-15 | Warehouses as a fifth module; the entry fee is defined by the tier, locked by a saga at join and doubles as the maximum bid budget | owner | the funds saga takes 3-9 s and would not fit a 5-10 s raise window; the lock moves to the calm lobby phase and raises stay local writes bounded by the budget |
| 2026-10-15 | Dedicated `WarehouseEntryLock*` request and reply events; all warehouse refunds reuse `FundsUnlockRequestedEvent` | agent (proposal, accepted) | a `FundsLockedEvent` reply would also reach the Auctions handler in process and dead-letter after five attempts; the unlock consumer tolerates a missing lock, so redundant refunds are safe |
| 2026-10-15 | Warehouse stock is quoted, not pre-minted: Inventory prices the manifest without saving items, Warehouses stores it hidden, the winner's items are minted at settlement with the quoted prices | agent (proposal, accepted) | `ItemConfiguration` allows one item per auction lock and no house user exists; the manifest travels in `WarehouseWonEvent`, so minting stays idempotent through the inbox |
| 2026-10-15 | Public warehouse parameters (entry fee, increments, starting price) derive only from the tier; only the estimate range derives from the hidden value | owner | increments derived from the value would let players read the hidden value from the allowed raises |
| 2026-10-15 | The winner's final price leaves the economy and losers get full refunds | owner | a warehouse war has no seller to credit; the sink offsets the mint-and-sell faucet recorded as a known limitation |
| 2026-10-15 | `CLAUDE.md` files are tracked by git | owner | agent instructions evolve with the code and should be reviewable in history |
| 2026-10-15 | Integration events grouped by subject (`Auctions/`, `Funds/`, `Items/`, `Users/`, `Warehouses/`), one namespace segment each | owner | by-subject keeps request/reply pairs together where by-module would split them; the registry and the outbox `Type` column use simple type names, so stored rows never notice |
| 2026-10-15 | GitHub Actions pipeline mirroring the GitLab one, triggered by pushes and pull requests to `main` | owner | the repository is hosted on GitHub, which does not run `.gitlab-ci.yml`; both files stay so a GitLab mirror keeps working |
| 2026-10-15 | Bank loans: fixed offers from configuration, one repayment at maturity collected by a keeper, partial collection with a one-time penalty and automatic retries, no new loan until the debt is repaid, minute-scale terms | owner | the owner picked each of these over the alternatives (free amounts, instalments, immediate default) in the planning session of 2026-10-15 |
| 2026-10-15 | Loans gated by lifetime turnover thresholds per offer, not by the current balance | owner | "to take a 10k loan the player must have 20k of historical turnover, the account can hold 0"; creditworthiness measures market activity, which a fresh or drained account cannot fake |
| 2026-10-15 | `LifetimeTurnover` counts economy credits only: shop sales, auction settlements, bot top-ups and loan disbursements; player transfers and starting funds are excluded | owner | an A to B to A transfer loop would pump both counters for free, and the owner's fresh-player example starts at turnover 0; the disbursement-counts ladder was accepted explicitly |
| 2026-10-15 | Flat per-term interest rounded `AwayFromZero`, `TotalDue` frozen at `Create`, no early-repayment discount | agent (proposal, accepted) | an annual rate rounds to 0.00 at minute terms; banker's rounding sends half-cents to even digits, which is surprising in a game economy; the snapshot keeps old debts stable under config changes |
| 2026-10-15 | A partial collection requested before `DueOn` returns the loan to `Active` without penalty | owner | early manual repayment is the player's initiative and must never be worse than waiting for the keeper |
| 2026-10-15 | `ApprovalTimeout` and `CollectionPendingTimeout` validated at or above 10 minutes | agent (proposal, accepted) | the outbox dead-letters after about 5 minutes per saga leg, so 10 minutes is the horizon after which no reply can still arrive; shorter timeouts would reopen the double-collection and free-principal races |
| 2026-10-15 | Bank risks accepted at portfolio scale: loan laundering through free registrations and auction wash-trading, no suspended-wallet checks in the bank sagas, and possible replays from hand-revived dead letters | owner | the economy is played by bots and reviewers; an account-age requirement, a transfer block while indebted and counterparty-weighted turnover are deferred until real players arrive |

## Related documents

- [adr/](adr) - the four architecture decision records.
- [CHANGELOG.md](CHANGELOG.md) - the milestones these decisions belong to.
- [CONVENTIONS.md](CONVENTIONS.md) - the rules that follow from them.
