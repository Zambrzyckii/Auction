# Messaging: Shared.Integration, outbox and inbox

> English version. Polish 1:1 counterpart: [../../pl/backend/messaging.md](../../pl/backend/messaging.md)

`AuctionServer.Shared.Integration` is the only project every module references, and the outbox and inbox tables are the only way modules influence each other. This chapter describes the shared project, the outbox row and its processor, the retry and dead-letter policy, the inbox pattern on the consuming side, the publisher seam that a message broker would replace, and the catalog of the thirty-seven integration events.

## Overview

[`AuctionServer.Shared.Integration`](../../../Backend/src/AuctionServer.Shared.Integration/AuctionServer.Shared.Integration.csproj) targets `net10.0`, depends only on `MediatR` and `FluentValidation`, and contains four folders:

| Folder | Contents |
|---|---|
| `Events/` | thirty-seven `record` types implementing MediatR `INotification`, plus the `WarehouseStockItem` and `PawnshopStockItem` payload records, grouped by subject into `Auctions/`, `Banking/`, `Casino/`, `Funds/`, `Items/`, `Pawnshop/`, `Players/`, `Users/` and `Warehouses/`; every event record starts with `Guid EventId` |
| `Exceptions/` | `AppException(message, statusCode)`, the abstract base of every domain exception, and `RequestValidationException` (400) |
| `Messaging/` | `IIntegrationEventPublisher` (the publisher seam) and `IntegrationEventTypes` (the name-to-type registry used to deserialize outbox rows) |
| `Validators/` | `ValidationBehaviour<,>`, the MediatR pipeline behavior that runs FluentValidation validators before a handler |

Modules depend on this project for the event contracts and the exception base; the host additionally implements `IIntegrationEventPublisher` in [`InProcessEventPublisher`](../../../Backend/src/AuctionServer.Api/Infrastructure/Messaging/InProcessEventPublisher.cs).

## Outbox

The diagram shows one event travelling from the producing module's transaction to the consuming module's transaction.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../diagrams/backend-messaging-01-outbox-to-inbox.dark.svg">
  <img alt="Outbox to inbox diagram" src="../../diagrams/backend-messaging-01-outbox-to-inbox.svg">
</picture>

Every module owns a copy of [`OutboxMessage`](../../../Backend/src/AuctionServer.Modules.Auctions/Infrastructure/Outbox/OutboxMessage.cs) and of [`OutboxProcessor`](../../../Backend/src/AuctionServer.Modules.Auctions/Infrastructure/Background/OutboxProcessor.cs); the eight copies differ only in the `DbContext` they use and, in Identity, in two public setters (`Errors`, `IsDead`) and a non-sealed processor class. The tables are `OutboxMessages` (Auctions, no `ToTable` call), `WalletsOutboxMessages`, `InventoryOutboxMessages`, `IdentityOutboxMessages`, `WarehousesOutboxMessages`, `BankingOutboxMessages`, `PawnshopOutboxMessages` and `CasinoOutboxMessages`. Profiles publishes nothing and is the only module without the outbox copy and without an `OutboxProcessor`; a future publisher in that module would add the standard copy back.

| Column | Type | Meaning |
|---|---|---|
| `Id` | `uuid` | primary key; producers set it to the event's `EventId` (one exception, see the catalog) |
| `Type` | `text` | the event class name (`nameof(...)`), the key into `IntegrationEventTypes` |
| `Content` | `text` | the event serialized with `System.Text.Json` |
| `CreatedOn` | `timestamptz` | set to `DateTime.UtcNow` when the row is created; the poll order |
| `ProcessedOn` | `timestamptz`, nullable | set by `MarkAsProcessed` after a successful publish |
| `AttemptCount` | `integer` | starts at 1; incremented by `FailedAttempt` |
| `Errors` | `text[]` | one exception message per failed attempt, never trimmed |
| `IsDead` | `boolean` | set by `MarkMessageAsDead`; dead rows are excluded from the poll |
| `NextAttemptOn` | `timestamptz`, nullable | the earliest time of the next attempt, computed by `FailedAttempt` |

A producer never publishes directly: it adds the row to the module `DbContext` and saves it together with the entity change (`CreateAuctionAsync`, `SaveChangesWithOutboxAsync`, `AddUserWithOutboxAsync` and the inbox-and-outbox variants listed below), so either both commit or neither does.

`OutboxProcessor` is a `BackgroundService` registered by every publishing module's `Add<Module>Module` call (all modules except Profiles). Its loop runs `ProcessPendingMessagesAsync`, logs `Outbox processing cycle failed` on any exception and waits 3 s (`Task.Delay(3000)`) before the next cycle. One cycle opens a DI scope, resolves the module `DbContext`, selects up to 20 rows where `ProcessedOn` is null, `IsDead` is false and `NextAttemptOn` is null or in the past, ordered by `CreatedOn`, and handles them one by one: `PublishAsync(Id, Type, Content)` through an `IIntegrationEventPublisher` resolved from a fresh scope created for that one message, then `MarkAsProcessed()`, or on exception `FailedAttempt(e.Message)`, `MarkMessageAsDead()` when `AttemptCount` exceeds 5 and the log entry `Failed to process outbox message {MessageId}`. `SaveChangesAsync` runs after every message, so one poisoned row does not block the rows behind it. The per-message scope gives every consumer handler a fresh `DbContext`, so entities left tracked by one failed handler cannot fail the saves of the messages behind it.

## Retry and dead letters

The diagram shows the states of one outbox row.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../diagrams/backend-messaging-02-outbox-message-lifecycle.dark.svg">
  <img alt="Outbox message lifecycle diagram" src="../../diagrams/backend-messaging-02-outbox-message-lifecycle.svg">
</picture>

`FailedAttempt` first increments `AttemptCount` and then sets `NextAttemptOn = now + 2^AttemptCount × 5 s`, so the delays grow from 20 s; the processor marks the row dead when `AttemptCount` is greater than 5, which happens on the fifth failed publish.

| Failed publish | `AttemptCount` after the failure | Wait before the next attempt |
|---|---|---|
| 1st | 2 | 20 s |
| 2nd | 3 | 40 s |
| 3rd | 4 | 80 s |
| 4th | 5 | 160 s |
| 5th | 6 | none, the row is marked dead |

A dead row keeps its full `Errors` history, and nothing in the code base replays it; reviving one means resetting `IsDead` by hand. The eight tables can be inspected with a plain query, for example:

```sql
SELECT "Id", "Type", "AttemptCount", "Errors" FROM "OutboxMessages" WHERE "IsDead";
```

## Inbox

A consuming module keeps a `ProcessedMessages` table with a single meaningful column, `EventId` (the primary key), plus `ProcessedOn`; the entity is [`ProcessedMessage`](../../../Backend/src/AuctionServer.Modules.Auctions/Infrastructure/Inbox/ProcessedMessage.cs) and the tables are `AuctionsProcessedMessages`, `WalletsProcessedMessages`, `InventoryProcessedMessages`, `WarehousesProcessedMessages`, `BankingProcessedMessages`, `PawnshopProcessedMessages`, `CasinoProcessedMessages` and `ProfilesProcessedMessages`. Identity consumes no events and has no inbox. Every consuming handler follows the same steps:

1. Call `WasEventProcessedAsync(EventId)` and return when the id is already recorded.
2. Load the aggregate and apply the domain change.
3. Add a `ProcessedMessage` with the event id and, when the module replies, an `OutboxMessage` for the reply.
4. Save everything with one repository call that uses `CancellationToken.None`, so a cancelled request cannot interrupt a money or state change half-way.
5. Catch the module's `EventAlreadyProcessedException` (409) and return: the repository throws it when the `ProcessedMessages` primary key is violated, which is how a concurrent duplicate is detected.

| Handler | Module | Save method | Reply |
|---|---|---|---|
| `UserRegisteredEventHandler` | Wallets | `AddWalletAsync` | none; no inbox, a duplicate throws `WalletAlreadyExistException`, which the handler swallows |
| `BidPlacedEventHandler` | Wallets | `SaveUserFundsWithInboxAsync` | none |
| `FundsLockRequestedEventHandler` | Wallets | `SaveUserFundsWithInboxAndOutboxAsync` | `FundsLockedEvent` or `FundsLockRejectedEvent` |
| `FundsUnlockRequestedEventHandler` | Wallets | `SaveUserFundsWithInboxAsync` | none; a missing lock is a valid outcome |
| `AuctionFinishedEventHandler` | Wallets | `SaveUserFundsWithInboxAndOutboxAsync` | `AuctionSettledEvent` |
| `ItemSoldToShopEventHandler` | Wallets | `SaveUserFundsWithInboxAsync` | none |
| `WarehouseEntryLockRequestedEventHandler` | Wallets | `SaveUserFundsWithInboxAndOutboxAsync` | `WarehouseEntryLockedEvent` or `WarehouseEntryLockRejectedEvent` |
| `WarehouseWonEventHandler` | Wallets | `SaveUserFundsWithInboxAsync` | none |
| `ItemLockedEventHandler` | Auctions | `SaveChangesWithInboxAndOutboxAsync` | `AuctionActivatedEvent` |
| `ItemLockRejectedEventHandler` | Auctions | `SaveChangesWithInboxAsync` | none |
| `FundsLockedEventHandler` | Auctions | `SaveChangesWithInboxAndOutboxAsync` | `BidPlacedEvent`, or `FundsUnlockRequestedEvent` when the auction is no longer `Active` |
| `FundsLockRejectedEventHandler` | Auctions | `SaveChangesWithInboxAsync` | none |
| `UserRegisteredEventHandler` | Inventory | `AddItemsWithInboxAsync` | none; the starter pack |
| `ItemLockRequestedEventHandler` | Inventory | `SaveChangesWithInboxAndOutboxAsync` | `ItemLockedEvent` or `ItemLockRejectedEvent` |
| `AuctionFinishedEventHandler` | Inventory | `SaveChangesWithInboxAsync` | none |
| `AuctionSettledEventHandler` | Inventory | `SaveChangesWithInboxAsync` | none |
| `AuctionCancelledEventHandler` | Inventory | `SaveChangesWithInboxAsync` | none; a missing lock is a valid outcome |
| `WarehouseStockRequestedEventHandler` | Inventory | `SaveChangesWithInboxAndOutboxAsync` | `WarehouseStockedEvent` |
| `WarehouseWonEventHandler` | Inventory | `AddItemsWithInboxAsync` | none; mints the manifest |
| `WarehouseStockedEventHandler` | Warehouses | `SaveStockWithInboxAsync` | none |
| `WarehouseEntryLockedEventHandler` | Warehouses | `SaveWarWithInboxAsync`, or `SaveWarWithInboxAndOutboxAsync` on the refund path | `FundsUnlockRequestedEvent` for an orphaned lock |
| `WarehouseEntryLockRejectedEventHandler` | Warehouses | `SaveWarWithInboxAsync` | none; a missing participant is a valid outcome |
| `LoanRequestedEventHandler` | Wallets | `SaveUserFundsWithInboxAndOutboxAsync` | `LoanApprovedEvent` or `LoanRejectedEvent` |
| `LoanRepaymentRequestedEventHandler` | Wallets | `SaveUserFundsWithInboxAndOutboxAsync` | `LoanRepaymentCollectedEvent`, always, even for a zero collection |
| `LoanApprovedEventHandler` | Banking | `SaveLoanWithInboxAsync` | none |
| `LoanRejectedEventHandler` | Banking | `SaveLoanWithInboxAsync` | none |
| `LoanRepaymentCollectedEventHandler` | Banking | `SaveLoanWithInboxAsync` | none |
| `PawnshopPaymentRequestedEventHandler` | Wallets | `SaveUserFundsWithInboxAndOutboxAsync` | `PawnshopPaymentCompletedEvent` or `PawnshopPaymentRejectedEvent` |
| `PawnshopPayoutEventHandler` | Wallets | `SaveUserFundsWithInboxAsync` | none |
| `PawnshopStockRequestedEventHandler` | Inventory | `SaveChangesWithInboxAndOutboxAsync` | `PawnshopStockedEvent` |
| `PawnshopItemWithdrawnEventHandler` | Inventory | `AddItemsWithInboxAsync` | none, it mints the withdrawn item |
| `PawnshopPaymentCompletedEventHandler` | Pawnshop | `SaveShopWithInboxAsync` | none |
| `PawnshopPaymentRejectedEventHandler` | Pawnshop | `SaveShopWithInboxAsync` | none |
| `PawnshopStockedEventHandler` | Pawnshop | `SaveStockWithInboxAsync` | none |
| `CasinoChipPurchaseRequestedEventHandler` | Wallets | `SaveUserFundsWithInboxAndOutboxAsync` | `CasinoChipPurchaseCompletedEvent` or `CasinoChipPurchaseRejectedEvent` |
| `CasinoCashOutEventHandler` | Wallets | `SaveUserFundsWithInboxAsync` | none |
| `CasinoChipPurchaseCompletedEventHandler` | Casino | `SaveChangesWithInboxAsync` | none |
| `CasinoChipPurchaseRejectedEventHandler` | Casino | `SaveChangesWithInboxAsync` | none; on an `Expired` purchase the reject is a silent no-op |
| `UserRegisteredEventHandler` | Profiles | `AddProfileWithInboxAsync` | none; the profile with the username snapshot |
| `PlayerLevelledUpEventHandler` | Profiles | `SaveChangesWithInboxAsync` | none; applies the absolute level monotonically |

Only `EventAlreadyProcessedException` is caught. A missing aggregate (`AuctionNotFoundException`, `UserWithThisIdDontHaveWallet`, `UserOrItemDoesntExistException`), a domain rule (`InsufficientFundsException`, `LockNotFoundException`, `ItemNotLockedException`, `InvalidAuctionStateTransitionException`, `InvalidLoanStateTransitionException`, `InvalidShopStateTransitionException`, `InvalidPurchaseStateTransitionException`) and a `DbUpdateConcurrencyException` all propagate to the producer's `OutboxProcessor`, where they count as a failed attempt. The intent is visible failure: a message that cannot be applied ends up dead with its reason recorded instead of being skipped.

## Publisher seam

[`IIntegrationEventPublisher`](../../../Backend/src/AuctionServer.Shared.Integration/Messaging/IIntegrationEventPublisher.cs) has one method, `PublishAsync(Guid messageId, string type, string content, CancellationToken token)`. The host registers `InProcessEventPublisher` for it as a scoped service in [`Program.cs`](../../../Backend/src/AuctionServer.Api/Program.cs); the implementation ignores `messageId`, calls [`IntegrationEventTypes.Deserialize(type, content)`](../../../Backend/src/AuctionServer.Shared.Integration/Messaging/IntegrationEventTypes.cs) and hands the result to MediatR `IPublisher.Publish`, which runs the handlers one after another in DI registration order (Auctions, Wallets, Identity, Inventory, Warehouses, Banking, Pawnshop, Casino assemblies). `Deserialize` throws `NotSupportedException` for a type that is not in the registry and `JsonException` for an empty payload; both land in `Errors` of the outbox row.

Replacing the in-process bus with a broker means one new `IIntegrationEventPublisher` implementation that sends `Type` and `Content` to the broker, plus a host-side consumer that deserializes incoming messages the same way and publishes them to MediatR; the modules, their outboxes and their inboxes stay as they are. Adding an event means adding a record to the right subject folder under `Events/` and one line to the registry; the producer stores `nameof(TheEvent)` in `Type`, so the folder and namespace never reach the database.

## Event catalog

| Event | Payload (besides `EventId`) | Producer | Consumers | Outbox `Id` equals `EventId` |
|---|---|---|---|---|
| `UserRegisteredEvent` | `PublicUserId`, `Email`, `Username?` (a defaulted parameter, so payloads from before the field deserialize to null) | Identity `RegisterCommandHandler`, `RegisterBotCommandHandler` | Wallets, Inventory and Profiles `UserRegisteredEventHandler` | yes |
| `ItemLockRequestedEvent` | `PublicAuctionId`, `PublicItemId`, `SellerUserId` | Auctions `CreateAuctionCommandHandler` | Inventory `ItemLockRequestedEventHandler` | yes |
| `ItemLockedEvent` | `PublicAuctionId`, `PublicItemId`, `ItemName`, `ItemRarity`, `OfficialPrice` | Inventory `ItemLockRequestedEventHandler` | Auctions `ItemLockedEventHandler` | yes |
| `ItemLockRejectedEvent` | `PublicAuctionId`, `PublicItemId`, `Reason` | Inventory `ItemLockRequestedEventHandler` | Auctions `ItemLockRejectedEventHandler` | yes |
| `AuctionActivatedEvent` | `PublicAuctionId`, `SellerUserId`, `PublicItemId`, `ItemName`, `ItemRarity`, `ItemOfficialPrice`, `CurrentPrice`, `EndsOn` | Auctions `ItemLockedEventHandler` | none | yes |
| `BidPlacedEvent` | `PublicAuctionId`, `NewWinningUserId`, `PreviousWinningUserId?`, `NewPrice`, `PreviousPrice?` | Auctions `FundsLockedEventHandler` (the bid confirmation) | Wallets `BidPlacedEventHandler` | yes |
| `AuctionFinishedEvent` | `PublicAuctionId`, `SellerUserId`, `WinnerUserId?`, `FinalPrice?` | Auctions `AuctionCloser` | Wallets and Inventory `AuctionFinishedEventHandler` | yes |
| `AuctionCancelledEvent` | `PublicAuctionId`, `PublicItemId`, `Reason` | Auctions `AuctionCloser` | Inventory `AuctionCancelledEventHandler` | yes |
| `AuctionSettledEvent` | `PublicAuctionId`, `SellerUserId`, `WinnerUserId`, `FinalPrice` | Wallets `AuctionFinishedEventHandler` | Inventory `AuctionSettledEventHandler` | yes |
| `ItemSoldToShopEvent` | `PublicItemId`, `OwnerUserId`, `Price` | Inventory `SellItemToShopCommandHandler` | Wallets `ItemSoldToShopEventHandler` | no, two separate `Guid.NewGuid()` calls |
| `FundsLockRequestedEvent` | `PublicAuctionId`, `BidderUserId`, `Amount` | Auctions `PlaceBidCommandHandler` | Wallets `FundsLockRequestedEventHandler` | yes |
| `FundsLockedEvent` | `PublicAuctionId`, `BidderUserId`, `Amount` | Wallets `FundsLockRequestedEventHandler` | Auctions `FundsLockedEventHandler` | yes |
| `FundsLockRejectedEvent` | `PublicAuctionId`, `BidderUserId`, `Reason` | Wallets `FundsLockRequestedEventHandler` | Auctions `FundsLockRejectedEventHandler` | yes |
| `FundsUnlockRequestedEvent` | `PublicAuctionId`, `BidderUserId`; for warehouse refunds `PublicAuctionId` carries the warehouse id | Auctions `FundsLockedEventHandler`; Warehouses `LeaveWarehouseWarCommandHandler`, `WarehouseEntryLockedEventHandler` and `WarehouseKeeper` | Wallets `FundsUnlockRequestedEventHandler` | yes |
| `WarehouseStockRequestedEvent` | `PublicWarehouseId`, `Rarities` | Warehouses `WarehouseKeeper` | Inventory `WarehouseStockRequestedEventHandler` | yes |
| `WarehouseStockedEvent` | `PublicWarehouseId`, `Stock` (list of `WarehouseStockItem`) | Inventory `WarehouseStockRequestedEventHandler` | Warehouses `WarehouseStockedEventHandler` | yes |
| `WarehouseEntryLockRequestedEvent` | `PublicWarehouseId`, `UserId`, `Amount` | Warehouses `JoinWarehouseWarCommandHandler` | Wallets `WarehouseEntryLockRequestedEventHandler` | yes |
| `WarehouseEntryLockedEvent` | `PublicWarehouseId`, `UserId` | Wallets `WarehouseEntryLockRequestedEventHandler` | Warehouses `WarehouseEntryLockedEventHandler` | yes |
| `WarehouseEntryLockRejectedEvent` | `PublicWarehouseId`, `UserId`, `Reason` | Wallets `WarehouseEntryLockRequestedEventHandler` | Warehouses `WarehouseEntryLockRejectedEventHandler` | yes |
| `WarehouseWonEvent` | `PublicWarehouseId`, `WinnerUserId`, `FinalPrice`, `Stock` | Warehouses `WarehouseKeeper` | Wallets and Inventory `WarehouseWonEventHandler` | yes |
| `LoanRequestedEvent` | `PublicLoanId`, `UserId`, `Principal`, `RequiredTurnover` | Banking `CreateLoanCommandHandler` | Wallets `LoanRequestedEventHandler` | yes |
| `LoanApprovedEvent` | `PublicLoanId`, `UserId` | Wallets `LoanRequestedEventHandler` | Banking `LoanApprovedEventHandler` | yes |
| `LoanRejectedEvent` | `PublicLoanId`, `UserId`, `Reason` | Wallets `LoanRequestedEventHandler` | Banking `LoanRejectedEventHandler` | yes |
| `LoanRepaymentRequestedEvent` | `PublicLoanId`, `UserId`, `Amount` | Banking `BankKeeper`, `RepayLoanCommandHandler` | Wallets `LoanRepaymentRequestedEventHandler` | yes |
| `LoanRepaymentCollectedEvent` | `PublicLoanId`, `UserId`, `AmountCollected` | Wallets `LoanRepaymentRequestedEventHandler` | Banking `LoanRepaymentCollectedEventHandler` | yes |
| `PawnshopPaymentRequestedEvent` | `PublicPawnshopId`, `PaymentId`, `UserId`, `Amount`, `RequiredTurnover` | Pawnshop `OpenPawnshopCommandHandler`, `BuyBotCommandHandler` | Wallets `PawnshopPaymentRequestedEventHandler` | yes |
| `PawnshopPaymentCompletedEvent` | `PublicPawnshopId`, `PaymentId`, `UserId` | Wallets `PawnshopPaymentRequestedEventHandler` | Pawnshop `PawnshopPaymentCompletedEventHandler` | yes |
| `PawnshopPaymentRejectedEvent` | `PublicPawnshopId`, `PaymentId`, `UserId`, `Reason` | Wallets `PawnshopPaymentRequestedEventHandler` | Pawnshop `PawnshopPaymentRejectedEventHandler` | yes |
| `PawnshopStockRequestedEvent` | `PublicPawnshopId`, `Rarities` | Pawnshop `PawnshopKeeper` | Inventory `PawnshopStockRequestedEventHandler` | yes |
| `PawnshopStockedEvent` | `PublicPawnshopId`, `RequestId`, `Stock` (list of `PawnshopStockItem`) | Inventory `PawnshopStockRequestedEventHandler` | Pawnshop `PawnshopStockedEventHandler` | yes |
| `PawnshopPayoutEvent` | `PublicPawnshopId`, `UserId`, `Amount` | Pawnshop `PawnshopKeeper` | Wallets `PawnshopPayoutEventHandler` | yes |
| `PawnshopItemWithdrawnEvent` | `PublicPawnshopId`, `PublicStockItemId`, `UserId`, `Name`, `Rarity`, `Price` | Pawnshop `WithdrawStockItemCommandHandler` | Inventory `PawnshopItemWithdrawnEventHandler` | yes |
| `CasinoChipPurchaseRequestedEvent` | `PublicPurchaseId`, `UserId`, `Amount` | Casino `PurchaseChipsCommandHandler` | Wallets `CasinoChipPurchaseRequestedEventHandler` | yes |
| `CasinoChipPurchaseCompletedEvent` | `PublicPurchaseId`, `UserId` | Wallets `CasinoChipPurchaseRequestedEventHandler` | Casino `CasinoChipPurchaseCompletedEventHandler` | yes |
| `CasinoChipPurchaseRejectedEvent` | `PublicPurchaseId`, `UserId`, `Reason` | Wallets `CasinoChipPurchaseRequestedEventHandler` | Casino `CasinoChipPurchaseRejectedEventHandler` | yes |
| `CasinoCashOutEvent` | `UserId`, `Amount` | Casino `CashOutChipsCommandHandler` | Wallets `CasinoCashOutEventHandler` | yes |
| `PlayerLevelledUpEvent` | `UserId`, `PreviousLevel`, `NewLevel`, `RewardAmount` | Wallets `WalletDbContext.SaveChangesAsync`, which drains the wallet's pending level-ups into outbox rows before the base save | Profiles `PlayerLevelledUpEventHandler` | yes |

## Decisions

- The outbox and inbox are copied into every module instead of living in `Shared.Integration`, so the shared project stays a contracts-only assembly with no EF Core dependency; the price is eight identical classes to keep in sync (see [ADR-002](../adr/002-transactional-outbox-and-inbox.md)). Profiles consumes without publishing and carries only the inbox copy.
- The bus is in-process and the publisher is a seam, so the modules were written for at-least-once delivery from the start and a broker can be introduced without touching them (see [ADR-003](../adr/003-in-process-event-bus-before-rabbitmq.md)).
- Handlers let unexpected exceptions escape on purpose, so a message that cannot be applied becomes a dead row with its error history rather than a silent skip.

## Related documents

- [README.md](README.md) - backend overview, running, configuration, tests.
- [../ARCHITECTURE.md](../ARCHITECTURE.md) - the three auction flows as sequence diagrams.
- [auctions.md](auctions.md), [wallets.md](wallets.md), [inventory.md](inventory.md), [identity.md](identity.md), [warehouses.md](warehouses.md), [banking.md](banking.md), [pawnshop.md](pawnshop.md), [casino.md](casino.md) - producers and consumers per module.
- [../adr/002-transactional-outbox-and-inbox.md](../adr/002-transactional-outbox-and-inbox.md), [../adr/003-in-process-event-bus-before-rabbitmq.md](../adr/003-in-process-event-bus-before-rabbitmq.md) - the two messaging ADRs.
