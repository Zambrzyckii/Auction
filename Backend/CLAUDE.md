# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

This file covers the .NET backend in `Backend/`. `Frontend/`, `Bots/` and `Infrastructure/` are planned work
with no code — they may not even exist in the tree yet.

The original design note (`AGENTS.md`) was deleted on 2026-08-15; the target architecture now lives in
`docs/en/VISION.md` and `docs/en/ARCHITECTURE.md`. Parts of it are not implemented yet;
see "Aspirational vs. implemented" below before trusting roadmap claims.

## Commands

All commands run from `Backend/`. Solution file is `AuctionServer.slnx` (XML solution format, .NET 10 SDK 10.0.301).
Projects live under `src/` (application code) and `tests/` (test projects).

```bash
dotnet build AuctionServer.slnx
dotnet run --project src/AuctionServer.Api        # http://localhost:5244 (https profile: 7009)
dotnet test AuctionServer.slnx                    # NOTE: starts Docker containers, see below
docker compose up -d                              # from the repo ROOT: API on :8080 + postgres (host port 5436), migrates at startup
```

### Tests

Five test projects, one per module (`tests/AuctionServer.Modules.<Module>.Tests`):

- All five mix offline unit tests (domain, validators, outbox entity) with Testcontainers integration tests under
  `IntegrationTests/` (repositories, event handlers, command and query handlers), each driven by a
  `<Module>PostgresFixture` collection fixture. **Require a running Docker daemon** and pull
  `postgres:latest`; each fixture applies the module's migrations with `MigrateAsync()` — for Auctions that is the
  first place the two-folder migration chain is applied from scratch. A bare `dotnet test`
  on the solution silently spins these containers up. `.gitlab-ci.yml` keeps a Docker-free `unit-tests` job by
  running `Auctions.Tests` with `--filter "FullyQualifiedName!~IntegrationTests"`; the `~IntegrationTests` half
  runs in `integration-tests` next to the other four projects. `Wallets.Tests` and `Identity.Tests` additionally boot the whole
  host through a `WebApplicationFactory<Program>` fixture (`CustomApi`) that sets `ConnectionStrings__DefaultConnection`,
  `Jwt__Key` (Identity also `Bots__ApiKey`) as process env vars and migrates only its own module — the other modules'
  outbox processors log errors against missing tables; that noise is expected.

Run one project / one test:

```bash
dotnet test tests/AuctionServer.Modules.Auctions.Tests
dotnet test tests/AuctionServer.Modules.Auctions.Tests \
  --filter "FullyQualifiedName~AuctionTests.ApplyNewBid_WhenAmountIsHigher_ShouldUpdateCurrentPrice"
```

### EF Core migrations

Each module owns its own `DbContext` and its own migrations, so `--project` / `--startup-project` / `--context`
are always required. `dotnet ef` 10.0.9 is installed globally.

```bash
dotnet ef migrations list --project src/AuctionServer.Modules.Wallets \
  --startup-project src/AuctionServer.Api --context WalletDbContext --no-connect

dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Auctions \
  --startup-project src/AuctionServer.Api --context AuctionDbContext \
  --output-dir Infrastructure/Migrations
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Inventory \
  --startup-project src/AuctionServer.Api --context InventoryDbContext \
  --output-dir Infrastructure/Persistence/Migrations
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Wallets \
  --startup-project src/AuctionServer.Api --context WalletDbContext \
  --output-dir Infrastructure/Persistence/Migrations
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Warehouses \
  --startup-project src/AuctionServer.Api --context WarehouseDbContext \
  --output-dir Infrastructure/Persistence/Migrations
```

`--output-dir` matters for Auctions: the module has **two** migration folders. `Migrations/` holds the initial
migration plus `AppDbContextModelSnapshot.cs` (legacy name — it is annotated `[DbContext(typeof(AuctionDbContext))]`),
while `Infrastructure/Migrations/` holds every later migration (`Sync_Auctions_Fix` … `Add_Auction_Status_And_Item_Snapshot`,
`Add_Auctions_Inbox`, `Add_Auction_CreatedOn`, `Add_Auction_Pending_Bid`) and has no snapshot. EF finds both because it
scans the whole assembly, but the default output dir is `Migrations/`, so new migrations land in the old folder
unless you pass `--output-dir`. Wallets is consistent: everything under `Infrastructure/Persistence/Migrations/`
(`Initial_Wallets`, `Add_Wallets_Inbox`, `Add_Wallets_Outbox`, `Add_Wallets_Funds_Locks`).

Identity keeps its migrations under `Infrastructure/Persistence/Migrations/` (same layout as Wallets). Its outbox
entity maps to its own `IdentityOutboxMessages` table — table names must be globally unique because all modules
share one schema. Inventory follows the same layout (snapshot `InventoryDbContextModelSnapshot.cs`):
`Initial_Inventory` creates `InventoryItems` and `InventoryOutboxMessages`, `Add_Item_LockedForAuctionId` and
`Add_Inventory_Inbox` (`InventoryProcessedMessages`) follow. Warehouses uses the Wallets layout as well:
`Initial_Warehouses` (wars, stock items, outbox, inbox) and `Add_Warehouses_Lobby` (participants table plus
`CancellationReason`) under `Infrastructure/Persistence/Migrations/`. `Add_Auction_Status_And_Item_Snapshot` is the one
hand-edited migration: it adds `Status`, backfills it from `IsClosed` with raw SQL and only then drops the column,
so pre-existing open auctions stay `Active` instead of falling back to the `Pending` default — keep that order if you
ever regenerate it.

All contexts share **one physical database**: `Program.cs` passes the same connection string to every module,
and `SqlConnectionFactory` uses it too. Module isolation is a discipline, not a schema boundary — and since no
context overrides `MigrationsHistoryTable`, they also share a single `__EFMigrationsHistory` table.

### Configuration

`appsettings.json` has **no** `ConnectionStrings` section, yet `AuctionServer.Api/Program.cs:33` reads
`DefaultConnection` and passes it with `!`. The connection string comes from User Secrets
(`UserSecretsId` `577a6cdc-…` in `AuctionServer.Api.csproj`) or from the
`ConnectionStrings__DefaultConnection` environment variable. With neither set, both modules are registered with a
null connection string and every database call fails.

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<npgsql-connection-string>" \
  --project src/AuctionServer.Api
dotnet user-secrets set "Jwt:Key" "<random-string-min-32-chars>" --project src/AuctionServer.Api
dotnet user-secrets set "Bots:ApiKey" "<random-string>" --project src/AuctionServer.Api
```

`Jwt:Key` is equally mandatory and equally absent from `appsettings.json` (only `Jwt:Issuer`/`Jwt:Audience` live
there). Without it the app **starts fine but every request 500s**: `JwtBearerOptions` initialize lazily on the
first request and `Encoding.UTF8.GetBytes(null)` throws (`Program.cs:42`). Supply it via user secrets or the
`Jwt__Key` environment variable. `Wallets:StartingFunds` (not a secret — lives in `appsettings.json`) has a startup fail-fast:
`Program.cs:34` throws `InvalidOperationException` when it is missing and `AddWalletsModule(connectionString, startingFunds)`
throws `ArgumentOutOfRangeException` when it is `<= 0`. The whole `Warehouses` section (tiers, estimates, pool and
timing knobs, bound to `WarehousesOptions`) has the same fail-fast at `Program.cs:36`.
`Jwt:Key` still has no startup check, and neither has `Bots:ApiKey` (secret — user-secrets or `Bots__ApiKey`):
it is read into the `ApiKey` scheme at `Program.cs:46-47`; when missing the app starts and `POST /api/users/bots` answers 401.

`.env` / `.env.example` (`DB_USER`, `DB_PASSWORD`) have no consumer in the repository — the root `compose.yaml`
deliberately does not read them (dev-only values are inline there) and no code reads them either. Treat them as
leftovers, not as the app's configuration path.

The root `compose.yaml` runs the host with `Database__MigrateOnStartup=true`: `Program.cs` then applies all five
contexts' migrations between `Build()` and `Run()`, before the outbox processors start. The flag defaults to
`false` in `appsettings.json`, so `dotnet run` and the test fixtures keep migrating explicitly.

No `.editorconfig`, `Directory.Build.props` or `global.json` exists, and no formatter/linter is configured.
`AuctionServer.sln.DotSettings.user` is per-user Rider state, not a shared standard.

## Architecture

Modular monolith on .NET 10 + PostgreSQL. One module = one `.csproj`, internally split into
`Presentation` / `Application` / `Domain` / `Infrastructure`.

```
AuctionServer.Api                  host: DI wiring, endpoint mapping, GlobalExceptionHandler, JWT + ApiKey schemes
AuctionServer.Modules.Auctions     auctions & bidding, item-lock and funds-lock sagas; CQRS — EF Core writes, Dapper reads
AuctionServer.Modules.Wallets      virtual funds with a per-bid lock ledger and player transfers with an append-only history, settlement inbox + outbox; CQS — EF Core for both
AuctionServer.Modules.Identity     register/login/bot provisioning (BCrypt, JWT with name/id/role claims, 24 h bot tokens)
AuctionServer.Modules.Inventory    items/crafting/shop + bot-only mint and a config-driven starter pack on registration; locks items for auctions, transfers them to the winner
AuctionServer.Modules.Warehouses   warehouse wars: server-stocked pool, hidden manifest, entry-fee lock saga, 5-10 s raise windows, settlement burns the final price; CQS — EF Core for both
AuctionServer.Shared.Integration   the only shared project: integration events + AppException
```

### Module wiring pattern

Each module exposes two static extension classes; the host calls both and nothing else:

- `<Module>ModuleExtensions.Add<Module>Module(services, connectionString)` — registers the `DbContext` and
  repositories (`AuctionModuleExtensions.cs:12`, `WalletModuleExtensions.cs:10`). Wallets additionally takes the
  starting funds, Inventory the starter-item list and Warehouses its whole options section; each lands in a
  singleton options record (`WalletsOptions`, `InventoryOptions`, `WarehousesOptions`).
- `<Module>Endpoints.Map<Module>Endpoints(app)` — minimal-API `MapGroup("/api/<module>")` with handlers that only
  build a MediatR message and `sender.Send(...)`, no logic in the endpoint
  (`Presentation/WalletEndpoints.cs:13`, `Presentation/AuctionEndpoints.cs:13`).

MediatR and FluentValidation are registered per module assembly in `Program.cs:59-92` — each module gets its own
`AddValidatorsFromAssembly(...)` plus an `AddMediatR(...)` block that also re-adds the shared
`ValidationBehaviour<,>` open behavior (MediatR 14 deduplicates repeated `AddOpenBehavior` registrations, so this
is safe). Adding a module means adding both lines — assembly scanning is not automatic.

### Cross-module communication

Modules never join across each other's tables. A publishing module writes the event into its own outbox table in
the same `SaveChangesAsync` as the state change (e.g. `PlaceBidCommandHandler` → `OutboxMessages`,
Identity's `RegisterCommandHandler` → `IdentityOutboxMessages`). Each publishing module runs its own
`OutboxProcessor` (`BackgroundService`, 3 s poll) that hands pending rows — raw `Type` + JSON `Content` — to
`IIntegrationEventPublisher` (`Shared.Integration/Messaging/`). The processors know nothing about the transport.
The host registers the only implementation, `InProcessEventPublisher` (`AuctionServer.Api/Infrastructure/Messaging/`),
which resolves the CLR type through the `IntegrationEventTypes` registry and publishes via MediatR `IPublisher`;
consumers are `INotificationHandler<>` implementations in other modules' Application layers.

**Adding an integration event means registering it in `IntegrationEventTypes`** — an unregistered type throws
`NotSupportedException` at publish time, so the outbox row retries and dead-letters instead of being delivered.
The outbox row `Id` and the event's `EventId` are the same Guid by convention (`AuctionCloser.cs`,
`PlaceBidCommandHandler.cs`, `CreateAuctionCommandHandler.cs`, `RegisterCommandHandler.cs`); the reply handlers reuse
it for the reply they emit (`ItemLockRequestedEventHandler.cs`, `ItemLockedEventHandler.cs`, Wallets'
`AuctionFinishedEventHandler.cs`).

Active event flows:

- `UserRegisteredEvent` → Wallets creates the wallet credited with `WalletsOptions.StartingFunds` (`UserRegisteredEventHandler.cs:14`).
- **Funds-reservation saga** (choreography, mirror of the item-lock saga): `PlaceBidCommandHandler` stores the bid
  via `Auction.RequestBid` as `PendingBidderId`/`PendingBidAmount` (one pending bid per auction, 409
  `BidInProgressException`; `EndsOn` extended by the anti-sniping window at request time) and writes
  `FundsLockRequestedEvent` → Wallets' `FundsLockRequestedEventHandler` calls `Wallet.LockFunds(auctionId, amount)`,
  adding an `Active` row to the per-bid `FundsLock` ledger (owned collection, table `WalletsFundsLocks`), and
  replies `FundsLockedEvent` or, on insufficient funds / duplicate lock, `FundsLockRejectedEvent` → Auctions'
  `FundsLockedEventHandler` runs `ConfirmPendingBid` and emits `BidPlacedEvent` (now meaning "bid confirmed",
  carrying the previous leader), or, when the auction stopped being `Active`, runs `RejectPendingBid` and emits
  `FundsUnlockRequestedEvent`; `FundsLockRejectedEventHandler` just clears the pending bid. `BidPlacedEvent` →
  Wallets releases the previous leader's lock (`ReleaseLock`, amount from the ledger); `FundsUnlockRequestedEvent`
  → Wallets releases the late lock, treating a missing lock as a valid outcome. A bid becomes visible after
  ~3-9 s (two outbox polls).
- **Auction creation saga** (choreography, no orchestrator): `CreateAuctionCommandHandler` stores the auction as
  `Pending` and `ItemLockRequestedEvent` in one transaction → Inventory's `ItemLockRequestedEventHandler` loads the
  item through `GetUserItemAsync` (ownership + existence), calls `Item.LockForAuction(publicAuctionId)` and replies
  from its outbox with `ItemLockedEvent` (name, rarity as string, official price) — or, when the item is missing,
  foreign or not `Available`, with `ItemLockRejectedEvent` whose `Reason` is the domain exception message. Exactly
  one reply per request: the inbox row and the reply row are saved together. `ItemLockedEvent` → Auctions
  `Auction.Activate(...)` copies the snapshot onto the row, flips `Pending → Active` and emits
  `AuctionActivatedEvent` (no consumer today — the outbox row is marked processed after MediatR publishes into the
  void); `ItemLockRejectedEvent` → `Auction.Cancel(reason)` stores `CancellationReason`. `AuctionCloser` also cancels
  auctions stuck in `Pending` longer than 10 minutes (`PendingActivationTimeout` from `CreatedOn`) and emits
  `AuctionCancelledEvent`. Inventory's `AuctionCancelledEventHandler` unlocks the item when one is still locked
  for that auction and treats a missing lock as a valid outcome, writing the inbox row either way. `Activate`
  after `EndsOn` still activates. `AuctionCloser` then closes such an auction without a winner and Inventory
  unlocks the item. Creation-to-activation
  takes ~6–9 s (two outbox polls); bids on a `Pending` auction get 400 `AuctionNotActiveException`.
- `AuctionFinishedEvent` (emitted by the `AuctionCloser` background service, which closes expired auctions in the
  same transaction) has **two consumers**: Wallets consumes the winner's `FundsLock` for the auction (`ConsumeLock`) and credits the seller with that amount, and in the same `SaveChangesAsync`,
  writes `AuctionSettledEvent` to `WalletsOutboxMessages`; Inventory's `AuctionFinishedEventHandler` unlocks the
  item (`Item.UnlockItem`) only when there is no winner. MediatR runs them in registration order (Wallets before
  Inventory, `Program.cs:67,81`); an exception in Inventory retries the whole publish and Wallets' inbox makes its
  part a no-op. `WarehouseWonEvent` leans on the same order: money is spent before items are minted.
- `AuctionSettledEvent` → Inventory's `AuctionSettledEventHandler` finds the item by `LockedForAuctionId`
  (`GetItemLockedForAuctionAsync`, 404 when nothing is locked for that auction) and `Item.TransferTo(winner)`.
  The item moves only after the money did.
- `ItemSoldToShopEvent` (Inventory's `SellItemToShopCommandHandler`, outbox `InventoryOutboxMessages`) → Wallets
  credits the seller with the item's `OfficialPrice` (`ItemSoldToShopEventHandler`, inbox-protected).
- **Warehouse sagas** (three, all driven by the Warehouses module): stock quoting — `WarehouseStockRequestedEvent`
  → Inventory prices a manifest without saving any item (`WarehouseStockRequestedEventHandler`) → `WarehouseStockedEvent`;
  entry lock — `WarehouseEntryLockRequestedEvent` → Wallets `LockFunds` → `WarehouseEntryLockedEvent` /
  `WarehouseEntryLockRejectedEvent` (dedicated events on purpose: a `FundsLockedEvent` reply would also hit the
  Auctions handler in process and dead-letter); settlement — `WarehouseWonEvent` → Wallets `Wallet.SpendLock` burns
  the final price (no seller to credit) and Inventory mints the manifest through `Item.CreateWithPrice`. All
  warehouse refunds reuse `FundsUnlockRequestedEvent`; its missing-lock tolerance makes redundant refunds safe.
  Timers (lobby countdown, raise windows, pool refill) live in `WarehouseKeeper` (1 s loop). Details with the full
  event table: `docs/en/backend/warehouses.md`.

Delivery is at-least-once, so every cross-module consumer is idempotent via an **inbox** — one table per consuming
module (`WalletsProcessedMessages`, `AuctionsProcessedMessages`, `InventoryProcessedMessages`,
`WarehousesProcessedMessages`), event id as PK,
`ProcessedMessage` entity under `Infrastructure/Inbox/`. The handler checks the inbox first (`WasEventProcessedAsync`)
and silently returns on a replay; entity changes and the inbox row are still saved in one `SaveChangesAsync`
(`SaveChangesWithInboxAsync`, or `SaveChangesWithInboxAndOutboxAsync` when the handler also replies), so the PK
unique violation — surfaced as the module's `EventAlreadyProcessedException` and swallowed by the handler — remains
the backstop for the race where two deliveries pass the check concurrently. All consumers follow this shape (Wallets: `BidPlacedEventHandler`,
`AuctionFinishedEventHandler`, `ItemSoldToShopEventHandler`, `FundsLockRequestedEventHandler`,
`FundsUnlockRequestedEventHandler`, `WarehouseEntryLockRequestedEventHandler`, `WarehouseWonEventHandler`;
Auctions: `ItemLockedEventHandler`, `ItemLockRejectedEventHandler`,
`FundsLockedEventHandler`, `FundsLockRejectedEventHandler`; Inventory: `ItemLockRequestedEventHandler`,
`AuctionFinishedEventHandler`, `AuctionSettledEventHandler`, `AuctionCancelledEventHandler`,
`WarehouseStockRequestedEventHandler`, `WarehouseWonEventHandler`; Warehouses: `WarehouseStockedEventHandler`,
`WarehouseEntryLockedEventHandler`, `WarehouseEntryLockRejectedEventHandler`); `UserRegisteredEventHandler` relies on the wallet
unique index instead. Handlers deliberately do **not** catch illegal state transitions —
`InvalidAuctionStateTransitionException` (409), `ItemNotLockedException`, the 404 from `GetItemLockedForAuctionAsync`
— so no inbox row is written, the outbox row retries and finally dead-letters with the reason in `Errors`. A visible
failure beats a silent skip.

Outbox messages that keep failing are **dead-lettered**: `AttemptCount`/`Errors`/`NextAttemptOn`/`IsDead` columns,
exponential backoff (`2^attempt * 5 s`), parked after 5 failed attempts and skipped by the poll query. The
outbox entity and processor exist as five separate copies (Auctions, Identity, Inventory, Wallets, Warehouses) — a
change to one must be mirrored in the others.

Events live in `AuctionServer.Shared.Integration/Events/` and are plain records carrying an `EventId`.

### Read path (Auctions)

Queries bypass EF Core: `ISqlConnectionFactory` (a singleton wrapping the connection string,
`Infrastructure/Persistence/SqlConnectionFactory.cs:7`) hands out an `NpgsqlConnection`, and the handlers run raw
SQL through Dapper into flat DTOs. Two queries: `GetActiveAuctions` (`WHERE "Status" = @Active ORDER BY "EndsOn"
LIMIT @Limit`, `GetActiveAuctionsQueryHandler.cs:11`) and `GetAuctionById` (`QuerySingleOrDefaultAsync`, `null` →
`AuctionNotFoundException` 404, any status — the seller sees `Pending` / `Cancelled` + `CancellationReason`,
`GetAuctionByIdQueryHandler.cs:11`). Each query owns its DTO in its own folder (`ActiveAuctionQueryDto`,
`AuctionByIdQueryDto`) — identical ten fields today, kept separate on purpose so they can diverge. Dapper matches the
record constructor **by column name**, so a DTO parameter must be spelled exactly like the column; `Status` is an
`integer` column that Dapper maps to `AuctionStatus` and the host serializes as a string (`Program.cs:81-82`).
Writes go through `IAuctionRepository` + EF Core. Wallets does not do this — it reads through EF with `AsNoTracking()`
(`Infrastructure/Persistence/WalletRepository.cs:24`).

Caveat when touching that SQL: EF creates PascalCase, quoted identifiers (`"Auctions"`, `"Status"`), and the
query quotes them accordingly. Keep every identifier double-quoted in raw SQL — an unquoted name is folded to
lowercase by PostgreSQL and will not match the schema. Both queries are covered by
`GetActiveAuctionsQueryHandlerTests` / `GetAuctionByIdQueryHandlerTests`, which build a real
`SqlConnectionFactory(fixture.ConnectionString)` against the Testcontainers database.

### Financial-write conventions (Wallets)

- **Optimistic concurrency**: `Wallet.Version` is a `Guid` regenerated by every mutating domain method and mapped
  as a concurrency token (`Infrastructure/Persistence/WalletDbContext.cs:16`). Concurrent updates throw
  `DbUpdateConcurrencyException`. `Auction.Version` and Inventory's `Item.Version` follow the same pattern —
  regenerate the token in every mutating method you add.
- **CancellationToken**: passed through to reads, but deliberately dropped on critical financial saves —
  `SaveUserFundsWithInboxAsync(processedMessage, CancellationToken.None)` in `BidPlacedEventHandler.cs`, so a dropped client connection
  cannot abort a half-applied money transfer. Keep this asymmetry when adding financial writes.
- Invariants live in the entity, not the handler: `Wallet.LockFunds` / `ReleaseLock` / `ConsumeLock` / `SpendLock` / `AddFunds`
  validate and throw (`Domain/Entities/Wallet.cs`), and `FundsLock` rows are mutated only through the `Wallet`
  aggregate root (the child mutators are `internal`). Handlers orchestrate, they do not check balances.

### Error handling

Domain exceptions derive from `AppException(message, statusCode)` (`Shared.Integration/Exceptions/AppException.cs:3`)
and are grouped as nested classes in a per-module static container (`WalletExceptions`, `AuctionExceptions`,
`IdentityException`). `GlobalExceptionHandler` (`AuctionServer.Api/Infrastructure/GlobalExceptionHandler.cs:9`)
maps `AppException` → its own status code, `DbUpdateConcurrencyException` → 409, everything else → 500, and always
writes `{ "Error": "..." }`. Endpoints therefore contain no try/catch. The handler only runs because
`app.UseExceptionHandler()` is called in `Program.cs` — `AddExceptionHandler` alone registers it in DI but does
not put the middleware in the pipeline (this was once missing and every `AppException` surfaced as 500).

New domain error ⇒ add a nested exception type with the right status code; no handler change needed.

### Request validation

Commands are validated by FluentValidation validators living next to each command
(`<Command>Validator : AbstractValidator<Command>`), executed by the shared
`ValidationBehaviour<,>` (`Shared.Integration/Validators/ValidationBehaviour.cs`) before any handler runs.
Failures are joined into one message and thrown as `RequestValidationException : AppException(400)`
(`Shared.Integration/Exceptions/AppException.cs`), so the global handler needs no special case. Validator
messages are forced to English via `ValidatorOptions.Global.LanguageManager.Culture` in `Program.cs`.
Time-dependent rules must use the lambda overloads (`GreaterThan(_ => DateTimeOffset.UtcNow)`) — validators are
scoped, but a constant captured in the constructor freezes at validator construction.

### Partial-unique-index idiom

Wallets enforces "one active row per business key" with a filtered unique index rather than a plain unique
constraint: `HasIndex(...).IsUnique().HasFilter(...)` on `IsSuspendedWallet` (`WalletDbContext.cs:14-15`).
Suspended rows are kept, not deleted. Auctions uses the same idiom for "one open auction per item":
`HasIndex(x => x.ItemId).IsUnique().HasFilter("\"Status\" IN (0, 1)")` (`AuctionConfiguration.cs:15`) — a
cancelled or closed auction frees the item. The filter is raw SQL over the enum's integer values, and the
`Add_Auction_Status_And_Item_Snapshot` data migration uses the same numbers, so `AuctionStatus`
(`Pending=0, Active=1, Closed=2, Cancelled=3`) must never be renumbered. Inventory's unique index on
`Item.LockedForAuctionId` (`ItemConfiguration.cs:13`) needs no filter: PostgreSQL treats NULLs as distinct, so it
only constrains locked items and doubles as the lookup key for `GetItemLockedForAuctionAsync`. Wallets' `FundsLock` ledger uses the same idiom:
a unique index on (`WalletUserId`, `PublicAuctionId`) filtered on `"Status" = 0` enforces one active lock per
auction per wallet, so `FundsLockStatus.Active` must stay `0`.

### Entity configuration

All five contexts call `ApplyConfigurationsFromAssembly` (`AuctionDbContext.cs:17`, `WalletDbContext.cs:20`,
`IdentityDbContext.cs:15`, `InventoryDbContext.cs:18`, `WarehouseDbContext.cs:18`), so every `IEntityTypeConfiguration<T>` in a module assembly is live
(Auctions keeps them in `Infrastructure/Configurations/`, the other modules in `Infrastructure/Configuration/`).

Auctions keys: the primary key is the `int AuctionId` identity column (`AuctionConfiguration.cs:11`), and
`PublicAuctionId` is a unique-indexed public identifier (`AuctionConfiguration.cs:12`) — the same
surrogate-key-plus-public-Guid shape as `User.Id` / `User.PublicUserId` in Identity. External API surface uses
the Guid; the int stays internal.

Soft-delete: `User` is filtered globally by `HasQueryFilter(x => !x.IsDeleted)` (`IdentityConfiguration.cs:16`
— in the configuration class, not the context). Any Identity query silently excludes deleted users;
`IgnoreQueryFilters()` is required to see them.

## Aspirational vs. implemented

Where the documentation, the README roadmap and the code disagree, the code wins. Current state:

**Implemented** (register → wallet via outbox → login/JWT → funds → create auction as `Pending` → item locked
in Inventory → auction activated with item snapshot → pessimistic bid confirmed by a funds lock (anti-sniping) → background auto-close →
exactly-once settlement via inbox → `AuctionSettledEvent` → item transferred to the winner, or unlocked when
nobody bid): all five modules are fully wired — authentication, five outbox processors, `AuctionCloser`,
`WarehouseKeeper`, validation pipeline and the global exception handler are all live in `Program.cs`. The whole chain — both sagas
included — was verified manually end-to-end on 2026-10-14 against the compose stack: insufficient-funds rejection,
409 on a second in-flight bid, confirm, release of the previous leader's lock, close, settlement by consuming the
winner's lock and the item transfer, with zero dead or pending outbox rows afterwards.

Also on 2026-10-14 the first gameplay batch landed: a starter item pack granted by Inventory's own
`UserRegisteredEventHandler` (inbox-idempotent because items have no natural unique key; configured through
`Inventory:StarterItems`, default three `Common` items, empty list disables it) and player-to-player transfers
(`Wallet.Withdraw` spends only `AvailableFunds`; append-only `WalletsTransfers` row saved in the same transaction
as both balance changes; `POST /api/wallets/transfers` + owner-only `GET /api/wallets/{id}/transfers`). Both were
probed live against the rebuilt compose stack the same day (11 checks: pack granted on register, balances moved,
history row, 400 self-transfer and insufficient funds, 403 foreign history), all four outboxes clean afterwards.

On 2026-10-15 the fifth module, Warehouses, landed: warehouse wars with a server-stocked pool (`WarehouseKeeper`,
1 s loop), a hidden manifest quoted by Inventory, misleading public estimates, an entry fee locked through a
dedicated Wallets saga that doubles as the bid budget, 5-10 s raise windows with tier-fixed increments, and a
settlement that burns the final price (`Wallet.SpendLock`) and mints the manifest (`Item.CreateWithPrice`).
Five endpoints under `/api/warehouses`, six events, five tables. Chapter: `docs/en/backend/warehouses.md`.
Probed live against the compose stack on 2026-10-15 (20 checks: three players funded and joined, entry locks
confirmed, guarded raises — 409 for the leading raiser, 400 for an increment outside the tier — settlement after
the window, manifest revealed only once `Settled`, exact winner and loser balances, items minted at the quoted
prices, zero pending and zero dead rows across all five outboxes).

Roles are wired end-to-end: `Role { Admin, User, Bot }` (`Identity/Domain/Entities/Role.cs`, stored as an `integer`
column, so adding members needs no migration), a `ClaimTypes.Role` claim issued in `LoginCommandHandler.cs:34`, the
`"Bot"` policy registered in `Program.cs:36-44`, and two bot-only endpoints — `POST /api/wallets/funds`
(`WalletEndpoints.cs:29`) and `POST /api/inventory/items` (`InventoryEndpoints.cs:41-46`, `GrantItemCommand` →
`Item.Create`). The policy name is a plain string repeated in the host and both modules — keep it `"Bot"`.
`WalletApiSmokeTests` proves the claim → JWT → `RequireRole` chain (200 for `Bot`, 403 for `User`) and the
owner-only rule on `GET /api/wallets/{id}` (401 anonymous, 403 for someone else's wallet). `HostSmokeTests` covers
`/health` (a `SELECT 1` through `DatabaseHealthCheck` in the host), the OpenAPI document at `/openapi/v1.json`
(`AddOpenApi`/`MapOpenApi`) and the CORS preflight for `Cors:AllowedOrigins` (default `http://localhost:4200`).
Both classes share one `CustomApi` through the `HostIntegration` xUnit collection — the fixture sets process-wide
environment variables, so a second parallel instance corrupts the first; never attach it via `IClassFixture`.

Bot provisioning: `POST /api/users/bots` (`IdentityEndpoints.cs:31-36`; `RegisterBotCommand` → `RegisterBotCommandHandler` =
`/register` + `User.ChangeRole(Role.Bot)`, returns `PublicUserId`) sits behind the `"BotProvisioning"` policy, bound to the
`ApiKey` scheme only (`Program.cs:33-44`; `Api/Infrastructure/Authentication/ApiKeyAuthenticationHandler.cs` — header
`X-Api-Key`, secret `Bots:ApiKey`, constant-time compare, `Scheme.Name` as the identity's authentication type). A JWT
alone never satisfies it and the API-key principal never satisfies `"Bot"`; `BotProvisioningApiTests` proves both.
Bot JWTs live 24 h, player JWTs 15 min (`LoginCommandHandler.cs:27`); there is no token revocation. Policy literals:
`"Bot"` (host, Wallets, Inventory) and `"BotProvisioning"` (host, Identity). Bots also receive `Wallets:StartingFunds`
— `UserRegisteredEvent` carries no role — which is harmless because they top themselves up through `/funds`.

Still aspirational — verify before building on them:

- **Auctions created before the saga** (any `ItemId`, no locked item) dead-letter in Inventory with a 404 when
  they close; Wallets still settles them correctly. Clean the dev database rather than special-casing them.
- **RabbitMQ, API Gateway, Angular frontend and AI bots do not exist** in this repository — no packages, no code.
  The transport seam is in place (`IIntegrationEventPublisher`), but `InProcessEventPublisher` is its only
  implementation; a broker means adding an AMQP publisher + a host-side consumer that feeds `IPublisher`, not
  touching the modules.

Known debt worth keeping in mind: `Microsoft.Extensions.Hosting` is pinned to a .NET 11 **preview** version in
Auctions, Wallets and Inventory (fix all three together); Testcontainers fixtures use an obsolete
`PostgreSqlBuilder` constructor (CS0618); `AuctionActivatedEvent` is published but nobody consumes it;
`SellItemToShopCommandHandler.cs` breaks the "outbox `Id` == `EventId`" convention with two separate Guids.
