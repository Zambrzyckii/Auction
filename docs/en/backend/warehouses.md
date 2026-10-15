# Warehouses module

> English version. Polish 1:1 counterpart: [../../pl/backend/warehouses.md](../../pl/backend/warehouses.md)

`AuctionServer.Modules.Warehouses` runs the warehouse wars: a server-stocked pool of warehouses with hidden content, limited-entry lobbies (3-5 players), an entry fee that doubles as the bid budget, fast raise windows measured in seconds and a reveal of the manifest only after settlement. Players never see the real value, only deliberately misleading estimates. The winner pays the final price into nothing (a money sink), the losers get their entry fee back, and the items are minted in Inventory at the prices rolled during quoting. Five endpoints live under `/api/warehouses`, all behind JWT.

## Overview

| Area | Files |
|---|---|
| Endpoints | [`Presentation/WarehouseEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Presentation/WarehouseEndpoints.cs), request record `PlaceWarehouseBidRequest` |
| Commands and queries | `Application/Command/JoinWarehouseWar/`, `Application/Command/LeaveWarehouseWar/` and `Application/Command/PlaceWarehouseBid/` (command, handler, validator each), `Application/Queries/GetWarehouses/` (query, handler, `WarehouseSummaryDto`), `Application/Queries/GetWarehouseById/` (query, handler, `WarehouseDetailsDto`, `ManifestItemDto`) |
| Options and estimates | `Application/Options/` (`WarehousesOptions`, `WarehouseTierDefinition`, `RarityWeight`, `EstimateVariant`), [`Application/Estimates/EstimateGenerator.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Application/Estimates/EstimateGenerator.cs) |
| Event handlers | `Application/Handlers/WarehouseStockedEventHandler.cs`, `WarehouseEntryLockedEventHandler.cs`, `WarehouseEntryLockRejectedEventHandler.cs` |
| Domain | [`Domain/Entities/WarehouseWar.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Domain/Entities/WarehouseWar.cs), `Domain/Entities/WarehouseParticipant.cs`, `Domain/Entities/StockItem.cs`, `Domain/Enums/` (`WarehouseWarStatus`, `ParticipantState`), [`Domain/Exceptions/WarehouseExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Domain/Exceptions/WarehouseExceptions.cs) |
| Infrastructure | `Persistence/` (`WarehouseDbContext`, `WarehouseRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs`, [`Background/WarehouseKeeper.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Infrastructure/Background/WarehouseKeeper.cs) |

[`WarehouseModuleExtensions.AddWarehousesModule`](../../../Backend/src/AuctionServer.Modules.Warehouses/WarehouseModuleExtensions.cs) takes the connection string and a `WarehousesOptions` instance and validates it up front: `PoolSize > 0`, `MinPlayers >= 2`, `MaxPlayers >= MinPlayers`, at least one tier and one estimate variant, positive fees, increments and weights, and only known rarities (`Common`, `Rare`, `Epic`, `Legendary`). It registers `WarehouseDbContext`, the `OutboxProcessor` and `WarehouseKeeper` hosted services, the options singleton and `IWarehouseRepository` as scoped. Like Wallets the module reads and writes through EF Core (no Dapper): queries use `AsNoTracking` repository methods, writes load a tracked war.

## Running

```bash
# from Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Warehouses --startup-project src/AuctionServer.Api --context WarehouseDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Warehouses --startup-project src/AuctionServer.Api --context WarehouseDbContext
dotnet test tests/AuctionServer.Modules.Warehouses.Tests
```

Migrations live in [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Warehouses/Infrastructure/Persistence/Migrations): `20261014171153_Initial_Warehouses` and `20261014191955_Add_Warehouses_Lobby`.

## Configuration

The whole `Warehouses` section of `appsettings.json` binds to `WarehousesOptions`; a missing section stops the host.

| Key | Default | Effect |
|---|---|---|
| `Warehouses:PoolSize` | `3` | how many wars in `Stocking` or `Open` the keeper keeps alive at once |
| `Warehouses:MinPlayers` | `3` | confirmed players needed to start the join countdown |
| `Warehouses:MaxPlayers` | `5` | lobby capacity; a full lobby starts bidding immediately |
| `Warehouses:JoinCountdown` | `00:00:30` | time from reaching the minimum to the start of bidding |
| `Warehouses:RaiseWindow` | `00:00:10` | time the current raise stays open; every raise resets it |
| `Warehouses:LobbyTimeout` | `00:10:00` | after this a lobby that never scheduled a countdown (and a war stuck in `Stocking`) is cancelled with refunds |
| `Warehouses:Tiers` | `Small` (3-5 items, fee 500, increments 10/50/100), `Medium` (4-7, 2500, 50/100/250/500), `Large` (5-10, 15000, 100/250/500/1000) | public parameters of a war: item count range, rarity weights, entry fee and the allowed increments |
| `Warehouses:EstimateVariants` | weight 30: 0.3-0.7x, weight 40: 0.8-1.2x, weight 30: 1.3-2.5x | the deception table: one variant is rolled per war and scales the real value into the public estimate range |

## Data model

`WarehousesWars`:

| Column | Type | Notes |
|---|---|---|
| `Id` | `integer` | primary key, identity |
| `PublicWarehouseId` | `uuid` | unique public identifier, used in routes and events |
| `Tier` | `text(32)` | name of the tier the war was rolled from |
| `Status` | `integer` | `Stocking = 0`, `Open = 1`, `Bidding = 2`, `Settled = 3`, `Cancelled = 4` |
| `TotalValue` | `numeric(18,2)` | the real manifest value; never leaves the server, no DTO exposes it |
| `EstimateMin`, `EstimateMax` | `numeric(18,2)` | the public, deliberately misleading estimate |
| `EntryFee` | `numeric(18,2)` | copied from the tier; also the per-player bid budget |
| `CurrentPrice` | `numeric(18,2)` | starts at 0, grows by increments |
| `CurrentLeaderId` | `uuid?` | the player who raised last; the winner after settlement |
| `BiddingStartsOn` | `timestamp?` | set = the countdown is scheduled; in the past = the lineup is frozen |
| `BiddingEndsOn` | `timestamp?` | the raise window; reset by every raise |
| `CancellationReason` | `text?` | set by `Cancel`, e.g. `No bids placed`, `Lobby timed out` |
| `CreatedOn` | `timestamp` | used by the lobby timeout |
| `Version` | `uuid` | concurrency token regenerated by every mutating method; a lost raise race ends as 409 |

The module also owns `WarehousesParticipants`, an EF owned collection of the `WarehouseWar` aggregate (`Id`, `WarehouseWarId` FK with cascade delete, `UserId`, `State` with `PendingLock = 0`, `Active = 1`; unique index on `WarehouseWarId, UserId`) - unlike `AuctionsBids` the participants take part in the invariants (capacity, who may raise), so they live inside the aggregate and mutate only through its methods. `WarehousesStockItems` (`Id`, indexed `PublicWarehouseId`, `Name(100)`, `Rarity(16)`, `Price`) sits outside the aggregate like `Bid` does: nothing validates against it, it is the hidden manifest written once after quoting. `WarehousesOutboxMessages` and `WarehousesProcessedMessages` are described in [messaging.md](messaging.md).

| Method | Rule | Effect |
|---|---|---|
| `Create(tier, entryFee)` | `entryFee > 0` | new war in `Stocking` |
| `OpenLobby(totalValue, min, max)` | status `Stocking`; `totalValue > 0`, `0 < min <= max` | stores the value and estimates, opens the lobby |
| `Join(userId, maxPlayers)` | status `Open`, countdown not finished, not a participant yet, below capacity | adds a `PendingLock` participant; the seat is reserved before the fee is confirmed |
| `Leave(userId)` | status `Open`, countdown not finished, is a participant | removes the participant |
| `ConfirmParticipant(userId, min, max, countdown)` | status `Open`, is a participant | activates the participant; at `minPlayers` active schedules `BiddingStartsOn = now + countdown` once, at `maxPlayers` overrides it to `now` |
| `RemoveParticipant(userId)` | is a participant | frees the seat after a rejected fee lock |
| `StartBidding(minPlayers, raiseWindow)` | status `Open`, countdown scheduled, enough active players | `Bidding` plus the first raise window |
| `Raise(userId, increment, allowedIncrements, raiseWindow)` | status `Bidding`, window open, caller active, not the leader, increment in the tier set, `CurrentPrice + increment <= EntryFee` | new leader, higher price, fresh window |
| `Settle()` | status `Bidding`, a leader exists | `Settled` |
| `Cancel(reason)` | not `Settled` or `Cancelled` | `Cancelled` plus the reason |

| Exception | Status |
|---|---|
| `WarehouseNotFoundException` | 404 |
| `ParticipantNotFoundException` | 404 |
| `InvalidEntryFeeException`, `InvalidEstimateException`, `InvalidIncrementException`, `BudgetExceededException` | 400 |
| `WarNotStockingException`, `WarNotOpenException`, `WarNotBiddingException`, `JoinCountdownFinishedException`, `RaiseWindowClosedException`, `ParticipantNotActiveException`, `AlreadyLeadingException`, `CountdownNotStartedException`, `NotEnoughPlayersException`, `InvalidWarStateTransitionException`, `EventAlreadyProcessedException` | 409 |

## API

All five routes require a JWT.

| Method and route | Request | Response | Handler |
|---|---|---|---|
| `GET /api/warehouses?limit=` | `limit` 1-100, required | 200 with `WarehouseSummaryDto` list: `Open` and `Bidding` wars, oldest first - tier, estimates, entry fee, current price, item count, players/max, timers; never `TotalValue` | `GetWarehousesQueryHandler` |
| `GET /api/warehouses/{id}` | `id` is `PublicWarehouseId` | 200 with `WarehouseDetailsDto`: the summary fields plus the caller's state (`IsParticipant`, `ParticipantState`, `IsLeader`), `CancellationReason`, and after `Settled` the full `Manifest` (name, rarity, price per item); 404 for an unknown id | `GetWarehouseByIdQueryHandler` |
| `POST /api/warehouses/{id}/join` | empty body; the caller joins | 200 immediately; the fee lock is asynchronous - the client polls GET until `ParticipantState` turns `Active` or the participant disappears; 409 when full, already joined or the countdown finished | `JoinWarehouseWarCommandHandler` |
| `POST /api/warehouses/{id}/leave` | empty body | 200; removes the participant and requests the fee refund; 404 when not a participant, 409 after the countdown | `LeaveWarehouseWarCommandHandler` |
| `POST /api/warehouses/{id}/bids` | `{ increment }` from the tier's set | 200; the raise is applied synchronously (no saga - the budget is the already-locked entry fee); domain guards answer 400/409, a lost write race answers 409 via the `Version` token | `PlaceWarehouseBidCommandHandler` |

## Events

| Direction | Event | Handler and effect |
|---|---|---|
| published | `WarehouseStockRequestedEvent` | written by `WarehouseKeeper` when it refills the pool: a new `Stocking` war plus the rolled rarity list in one save; consumed by Inventory, which quotes prices without creating items |
| consumed | `WarehouseStockedEvent` | `WarehouseStockedEventHandler` sums the quoted prices, rolls the public estimate through `EstimateGenerator`, opens the lobby and stores the manifest rows plus the inbox row in one save |
| published | `WarehouseEntryLockRequestedEvent` | written by `JoinWarehouseWarCommandHandler` in the same transaction as the new participant; consumed by Wallets, which locks the entry fee |
| consumed | `WarehouseEntryLockedEvent` | `WarehouseEntryLockedEventHandler` confirms the participant (and the countdown logic runs); when the war is no longer `Open` or the player already left, it emits `FundsUnlockRequestedEvent` instead, so an orphaned lock always flows back |
| consumed | `WarehouseEntryLockRejectedEvent` | `WarehouseEntryLockRejectedEventHandler` frees the reserved seat; a missing participant is a valid outcome |
| published | `FundsUnlockRequestedEvent` | the refund path, reused from the auctions saga (its Wallets consumer tolerates a missing lock): on leave, on orphaned locks, for every active participant of a cancelled war and for the losers of a settled one |
| published | `WarehouseWonEvent` | written by the keeper when a war settles, carrying the winner, the final price and the full manifest; consumed by Wallets (`SpendLock`: the final price leaves the economy, the rest of the fee returns) and by Inventory (mints the manifest via `Item.CreateWithPrice` at quoted prices); MediatR runs Wallets first, so money always moves before items |

## The keeper

[`WarehouseKeeper`](../../../Backend/src/AuctionServer.Modules.Warehouses/Infrastructure/Background/WarehouseKeeper.cs) is a `BackgroundService` on a 1000 ms loop (the raise windows are 5-10 s, so the `AuctionCloser`'s 10 s cadence would be too coarse). Each cycle runs four sweeps, each saving its changes and outbox rows in one `SaveChangesAsync`: starts bidding where the countdown elapsed (or cancels a lobby that fell below the minimum), settles or cancels wars whose raise window expired, cancels lobbies and stocking wars older than `LobbyTimeout`, and refills the pool to `PoolSize` with freshly rolled tiers and rarities.

## Decisions

- The entry fee is the bid budget. A funds-lock saga takes 3-9 s (two outbox polls), which cannot fit a 5-10 s raise window, so the money is locked once, during the calm lobby phase, and every raise is a purely local aggregate operation bounded by `EntryFee`. Raise races are resolved by the `Version` token (the loser gets 409 and retries).
- Dedicated entry-lock events instead of reusing `FundsLockRequestedEvent`: the `FundsLockedEvent` reply has an in-process consumer in Auctions that would throw `AuctionNotFoundException` for a warehouse id and dead-letter the reply after five attempts. `FundsUnlockRequestedEvent` IS reused for refunds, because its only consumer tolerates a missing lock - which also makes redundant refunds safe, and the module prefers a redundant refund over a stranded fee.
- Anti-leak rule: everything public (entry fee, increments, the starting price of 0) derives only from the tier; only the estimates derive from the real value, and they pass through `EstimateGenerator`, which rolls a weighted deception variant, scales, rounds to tens and floors at 10.
- No pre-minting: Inventory cannot hold "nobody's" items (the unique index on `LockedForAuctionId` allows one item per auction id, there is no house user, `TransferTo` requires a locked item). Instead Inventory quotes prices on transient `Item.Create` results that are never saved, the manifest lives in `WarehousesStockItems`, and the real items are minted only at settlement from the event-carried manifest, idempotently through the inbox.
- The final price is a money sink: no seller exists, so `Wallet.SpendLock` consumes the winner's lock, returns the change and the price itself vanishes. Known limitation: the minted items can be sold to the shop at `OfficialPrice` (a money faucet), so if typical final prices stay below typical manifest values the wars print money; the deception variants and tier tuning are the levers to watch.
- Participants in `PendingLock` reserve a seat before paying, otherwise five concurrent joins could all pass the capacity check. A rejected lock frees the seat; a lock confirmed after the war moved on is refunded by the orphaned-lock branch.

## Related documents

- [README.md](README.md) - backend overview, running, configuration, tests.
- [messaging.md](messaging.md) - outbox, inbox, retry policy.
- [wallets.md](wallets.md) - the entry-fee lock, `SpendLock` and the refunds.
- [inventory.md](inventory.md) - the price quoting and the settlement mint.
