# Auctions module

> English version. Polish 1:1 counterpart: [../../pl/backend/auctions.md](../../pl/backend/auctions.md)

`AuctionServer.Modules.Auctions` owns auctions and bids: it creates an auction as `Pending`, asks Inventory to lock the item, accepts bids with an anti-sniping window, closes expired auctions from a background service and announces the result to Wallets and Inventory. Writes go through EF Core, reads through Dapper, and the module exposes four endpoints under `/api/auctions`.

## Overview

| Area | Files |
|---|---|
| Endpoints | [`Presentation/AuctionEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Auctions/Presentation/AuctionEndpoints.cs), request records `CreateAuctionRequest`, `PlaceBidRequest` |
| Commands | `Application/Commands/CreateAuction/` and `Application/Commands/PlaceBid/` (command, handler, validator each) |
| Queries | `Application/Queries/GetActiveAuctions/` and `Application/Queries/GetAuctionById/` (query, Dapper handler, DTO each) |
| Event handlers | `Application/Handlers/ItemLockedEventHandler.cs`, `Application/Handlers/ItemLockRejectedEventHandler.cs` |
| Domain | [`Domain/Entities/Auction.cs`](../../../Backend/src/AuctionServer.Modules.Auctions/Domain/Entities/Auction.cs), `Domain/Enums/AuctionStatus.cs`, [`Domain/Exceptions/AuctionExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Auctions/Domain/Exceptions/AuctionExceptions.cs) |
| Infrastructure | `Persistence/` (`AuctionDbContext`, `AuctionRepository`, `SqlConnectionFactory`), `Configurations/`, `Outbox/`, `Inbox/`, `Background/` (`AuctionCloser`, `OutboxProcessor`), `Infrastructure/Migrations/` plus the top-level `Migrations/` |

[`AuctionModuleExtensions.AddAuctionModule`](../../../Backend/src/AuctionServer.Modules.Auctions/AuctionModuleExtensions.cs) registers `AuctionDbContext` with Npgsql, `ISqlConnectionFactory` as a singleton, `IAuctionRepository` as scoped and the two hosted services `OutboxProcessor` and `AuctionCloser`; `MapAuctionEndpoints` maps the route group.

## Running

```bash
# from Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Auctions --startup-project src/AuctionServer.Api --context AuctionDbContext --output-dir Infrastructure/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Auctions --startup-project src/AuctionServer.Api --context AuctionDbContext
dotnet test tests/AuctionServer.Modules.Auctions.Tests                                                    # offline + integration (Docker)
dotnet test tests/AuctionServer.Modules.Auctions.Tests --filter "FullyQualifiedName!~IntegrationTests"   # offline only, as in the CI unit-tests job
```

The migrations are split between two folders: [`Migrations/`](../../../Backend/src/AuctionServer.Modules.Auctions/Migrations) holds `20260707073128_InitialAuctions` and the model snapshot `AppDbContextModelSnapshot.cs`, while [`Infrastructure/Migrations/`](../../../Backend/src/AuctionServer.Modules.Auctions/Infrastructure/Migrations) holds the seven later ones: `Sync_Auctions_Fix`, `Align_Auctions_With_Configuration`, `Add_EndsOn_And_ItemId_Index`, `Add_Auction_Version`, `Add_Outbox_DeadLetter_And_Backoff`, `Add_Auction_Status_And_Item_Snapshot` (hand-edited, contains a `migrationBuilder.Sql` call) and `Add_Auctions_Inbox`. New migrations must be created with `--output-dir Infrastructure/Migrations` to land next to the others.

## Configuration

The module has no configuration keys of its own; it receives the connection string from `AddAuctionModule`. The rules that shape its behaviour are constants in code:

| Rule | Value | Where |
|---|---|---|
| anti-sniping window | 30 s (`AntiSnipingWindow`) | `Auction.ApplyNewBid` |
| closer interval and batch | every 3 s, up to 20 auctions | `AuctionCloser` |
| outbox poll interval and batch | every 3 s, up to 20 rows | `OutboxProcessor` |
| `EndsOn` accepted by the validator | later than now and earlier than now + 30 days | `CreateAuctionCommandValidator` |
| `EndsOn` accepted by the entity | at least now + 1 minute | `Auction.Create` |
| `StartingPrice` and bid `Amount` | greater than zero | validators and `Auction` |
| `limit` of `GET /api/auctions` | 1 to 100 | `AuctionEndpoints` |

## Data model

The diagram shows the four statuses of an auction and the methods that move between them.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../diagrams/backend-auctions-01-auction-status-lifecycle.dark.svg">
  <img alt="Auction status lifecycle diagram" src="../../diagrams/backend-auctions-01-auction-status-lifecycle.svg">
</picture>

Every transition method calls `EnsureStatus` first, so an unexpected status throws `InvalidAuctionStateTransitionException` (409) instead of silently overwriting data; `ApplyNewBid` has its own checks and leaves the status at `Active`. The enum values are stored as integers and are part of the filtered unique index `"Status" IN (0, 1)` (`Pending` and `Active`), so renumbering `AuctionStatus` would change which auctions count as open.

| Column | Type | Notes |
|---|---|---|
| `AuctionId` | `integer` | primary key, identity column, never leaves the module |
| `PublicAuctionId` | `uuid` | unique; generated by `Guid.NewGuid()` in the entity; the id used in routes and events |
| `SellerUserId` | `uuid` | the Identity `PublicUserId` taken from the token |
| `ItemId` | `uuid` | the Inventory `PublicItemId`; unique while `Status IN (0, 1)` |
| `CurrentWinningUserId` | `uuid`, nullable | null until the first bid |
| `CurrentPrice` | `numeric(18,2)` | starts as `StartingPrice`, then the highest bid |
| `Status` | `integer` | `Pending = 0`, `Active = 1`, `Closed = 2`, `Cancelled = 3` |
| `ItemName`, `ItemRarity`, `ItemOfficialPrice` | `text`, `text`, `numeric(18,2)`, all nullable | the item snapshot copied by `Activate` from `ItemLockedEvent` |
| `CancellationReason` | `text`, nullable | the `Reason` of `ItemLockRejectedEvent` |
| `EndsOn` | `timestamptz` | extended by 30 s by late bids |
| `Version` | `uuid` | concurrency token, regenerated by every mutating method |

The module also owns `OutboxMessages` (its outbox, the only table without a module prefix) and `AuctionsProcessedMessages` (its inbox); both are described in [messaging.md](messaging.md).

## API

| Method and route | Auth | Request | Response | Handler |
|---|---|---|---|---|
| `GET /api/auctions?limit=N` | anonymous | `limit` query parameter, required, 1 to 100 | 200 with a list of `ActiveAuctionQueryDto`, `Active` auctions only, ordered by `EndsOn` | `GetActiveAuctionsQueryHandler` |
| `GET /api/auctions/{id}` | anonymous | — | 200 with `AuctionByIdQueryDto` for any status, 404 when unknown | `GetAuctionByIdQueryHandler` |
| `POST /api/auctions` | JWT | `{ itemId, startingPrice, endsOn }` (`EndsOn` is a `DateTimeOffset`) | 201 `{ publicAuctionId }` with `Location: /api/auctions/{id}` | `CreateAuctionCommandHandler` |
| `POST /api/auctions/{id}/bid` | JWT | `{ amount }` | 200 with an empty body | `PlaceBidCommandHandler` |

Both DTOs carry the same ten fields, `PublicAuctionId`, `SellerUserId`, `CurrentWinningUserId`, `Status`, `CurrentPrice`, `EndsOn`, `ItemName`, `ItemRarity`, `ItemOfficialPrice` and `CancellationReason`, as two separate records; `Status` is returned by name because enums are serialized as strings, and every field name is camelCase in the JSON (`publicAuctionId`, `currentPrice`). The seller and the bidder are never taken from the body, only from the `NameIdentifier` claim.

| Exception | Status | Message |
|---|---|---|
| `InvalidBidException` | 400 | `Price must be higher than current price` |
| `InvalidStartingPriceException` | 400 | `Starting price must be higher than 0` |
| `AuctionClosedException` | 400 | `This auction is closed` |
| `CannotBidOwnItemException` | 400 | `Cannot bid own item` |
| `AlreadyHighestBidderException` | 400 | `Bidder is already the highest bidder` |
| `InvalidAuctionEndDateException` | 400 | `End date must be at least one minute in the future` |
| `AuctionNotActiveException` | 400 | `Auction is not active, current status: {status}` |
| `AuctionNotFoundException` | 404 | `Auction {id} not found` |
| `AuctionAlreadyExistException` | 409 | `Auction already exist` (unique violation on insert, in practice the open-auction-per-item index) |
| `InvalidAuctionStateTransitionException` | 409 | `Cannot {action} an auction in status {status}` |
| `EventAlreadyProcessedException` | 409 | `Event was already processed`; raised by the repository and caught by the event handlers |

## Read path

Reads bypass EF Core. [`SqlConnectionFactory`](../../../Backend/src/AuctionServer.Modules.Auctions/Infrastructure/Persistence/SqlConnectionFactory.cs) creates an `NpgsqlConnection` from the module's connection string, and the two query handlers run raw SQL with Dapper: [`GetActiveAuctionsQueryHandler`](../../../Backend/src/AuctionServer.Modules.Auctions/Application/Queries/GetActiveAuctions/GetActiveAuctionsQueryHandler.cs) selects the ten DTO columns `FROM "Auctions" WHERE "Status" = @Active ORDER BY "EndsOn" LIMIT @Limit`, and [`GetAuctionByIdQueryHandler`](../../../Backend/src/AuctionServer.Modules.Auctions/Application/Queries/GetAuctionById/GetAuctionByIdQueryHandler.cs) selects the same columns `WHERE "PublicAuctionId" = @PublicAuctionId` with `QuerySingleOrDefaultAsync`, throwing `AuctionNotFoundException` on null. Identifiers are quoted because EF Core created them in PascalCase; Dapper maps the columns onto the DTO constructor by name, and the integer `Status` becomes the `AuctionStatus` enum.

## Background services

[`AuctionCloser`](../../../Backend/src/AuctionServer.Modules.Auctions/Infrastructure/Background/AuctionCloser.cs) is a `BackgroundService` that every 3 s loads up to 20 auctions with `Status = Active` and `EndsOn` in the past, calls `CloseAuction()` on each and adds an `AuctionFinishedEvent` outbox row whose `WinnerUserId` and `FinalPrice` are null when nobody bid; the whole batch is one `SaveChangesAsync`. A `DbUpdateConcurrencyException` (a bid saved between the load and the save) fails the cycle, which is logged as `Auction closing cycle failed` and repeated 3 s later with a fresh load. The module's `OutboxProcessor` is the shared implementation described in [messaging.md](messaging.md).

## Events

| Direction | Event | Where |
|---|---|---|
| published | `ItemLockRequestedEvent` | `CreateAuctionCommandHandler`, in the same `SaveChangesAsync` as the new auction |
| published | `BidPlacedEvent` | `PlaceBidCommandHandler`, with the previous winner and price for the unlock |
| published | `AuctionActivatedEvent` | `ItemLockedEventHandler`; registered but consumed by nobody |
| published | `AuctionFinishedEvent` | `AuctionCloser` |
| consumed | `ItemLockedEvent` | `ItemLockedEventHandler`, inbox `AuctionsProcessedMessages`, calls `Activate` |
| consumed | `ItemLockRejectedEvent` | `ItemLockRejectedEventHandler`, inbox `AuctionsProcessedMessages`, calls `Cancel` |

## Decisions

- An auction is created as `Pending` and becomes `Active` only after Inventory confirms the lock, so a listing never refers to an item the seller does not own or has already listed; the filtered unique index on `ItemId` backs the rule at the database level.
- The item name, rarity and official price are copied onto the auction at activation, so the read path never needs Inventory data and the listing survives later changes to the item.
- Reads use Dapper and raw SQL while writes stay on EF Core; the trade-off is recorded in [ADR-004](../adr/004-dapper-read-path-in-auctions.md).
- `Version` is regenerated by every mutating method, so the closer and a late bidder cannot both win: one of them gets `DbUpdateConcurrencyException`, surfaced as 409 or as a repeated closer cycle.
- A bid is accepted before Wallets confirms the funds; the consequences and the planned pessimistic bid are described in [../ARCHITECTURE.md](../ARCHITECTURE.md#known-limitations).

## Related documents

- [README.md](README.md) - backend overview, running, configuration, tests.
- [messaging.md](messaging.md) - outbox, inbox, retry policy.
- [inventory.md](inventory.md) - the other side of the item-lock saga.
- [wallets.md](wallets.md) - funds locking and settlement.
- [../ARCHITECTURE.md](../ARCHITECTURE.md) - the three auction flows as sequence diagrams.
