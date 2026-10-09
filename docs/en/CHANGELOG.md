# AuctionServer — changelog

> English version. Polish 1:1 counterpart: [../pl/CHANGELOG.md](../pl/CHANGELOG.md)
>
> Milestone-level entries, newest first; each entry is dated by the day the work was done.

- **2026-10-07** — **Documentation set**: bilingual `docs/en` and `docs/pl` (architecture, backend chapters, standing documents, ADRs, planned modules), 13 Mermaid diagrams rendered to SVG, root README rewritten as a front door with a Polish twin; the previous `docs/` folder moved out of the repository.
- **2026-08-30** — **Settlement chain completed**: Wallets outbox and `AuctionSettledEvent`, Inventory handlers for `AuctionFinishedEvent` (unlock) and `AuctionSettledEvent` (transfer), `GET /api/auctions/{id}`, Auctions integration tests; the funds reservation saga for bids designed but not implemented.
- **2026-08-29** — **Item-lock saga and bots**: auctions created as `Pending`, `ItemLockRequestedEvent`, `ItemLockedEvent` and `ItemLockRejectedEvent`, `AuctionStatus` with the item snapshot, inboxes in Auctions and Inventory, `Bot` role with 24-hour tokens, API-key scheme and `POST /api/users/bots`, bot-only `POST /api/wallets/funds` and `POST /api/inventory/items`, configurable starting funds, Inventory endpoints, enums serialized as strings, idempotent `BidPlacedEvent` consumer.
- **2026-08-26** — **Inventory application layer**: crafting, shop sale, item queries, Inventory outbox and migration; `IIntegrationEventPublisher` seam and `EventId` on every event.
- **2026-08-16 / 2026-08-17** — **Validation, dead letters, Inventory module**: FluentValidation pipeline with the 400 contract, outbox dead-lettering with exponential backoff, `Item` entity and repository, Inventory module wired into the host, settlement made idempotent through the Wallets inbox.
- **2026-08-15** — **Identity, closer, CI**: registration and login with BCrypt and JWT, wallet created from `UserRegisteredEvent` through the Identity outbox, auction creation with migrations, `AuctionCloser`, Wallets inbox, GitLab CI pipeline, `src/` and `tests/` layout.
- **2026-08-03 / 2026-08-04** — **Wallet integration tests and design note**: Auctions migration, Testcontainers-based Wallet tests, `AGENTS.md` with the target architecture (deleted on 2026-08-15), base login and register logic.
- **2026-07-06 to 2026-07-08** — **Foundations**: project structure, Auctions entity and CQRS infrastructure, endpoints, `AppException`, Auctions outbox and migrations, Wallets with add funds, endpoints, migration and concurrency handling, first README.

## Related documents

- [STATE.md](STATE.md) - the current state.
- [DECISIONS.md](DECISIONS.md) - the decisions behind the milestones.
