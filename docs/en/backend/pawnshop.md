# Pawnshop module

> English version. Polish 1:1 counterpart: [../../pl/backend/pawnshop.md](../../pl/backend/pawnshop.md)

`AuctionServer.Modules.Pawnshop` gives an established player a source of passive income. Once the lifetime wallet turnover reaches the configured threshold the player can buy premises, and the premises hold one bot. On a fixed interval the bot "buys" goods (in reality the server spawns them, priced by Inventory), keeps each item in stock for a fixed window and then sells it automatically. A sold item disappears from the economy and the owner receives a fixed share of its price. Within the window the owner can withdraw an item instead, and it becomes an ordinary Inventory item worth its full price. Bot goods never touch the auction market. The only sinks are one-time purchases (premises, bots and the bot replaced by an upgrade), so the pawnshop is a faucet whose rate is set entirely by configuration. Five endpoints live under `/api/pawnshop`, all behind JWT.

## Overview

| Area | Files |
|---|---|
| Endpoints | [`Presentation/PawnshopEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Presentation/PawnshopEndpoints.cs), request record `BuyBotRequest` |
| Commands and queries | `Application/Command/OpenPawnshop/`, `Application/Command/BuyBot/` and `Application/Command/WithdrawStockItem/` (command, handler, validator each), `Application/Queries/GetOffers/` (query, handler, `PawnshopOffersDto`, `BotTierDto`), `Application/Queries/GetPawnshop/` (query, handler, `PawnshopDto`, `StockItemDto`) |
| Options | `Application/Options/PawnshopOptions.cs` (`PawnshopOptions`, `BotTierDefinition`) |
| Event handlers | `Application/Handlers/PawnshopPaymentCompletedEventHandler.cs`, `PawnshopPaymentRejectedEventHandler.cs`, `PawnshopStockedEventHandler.cs` |
| Domain | [`Domain/Entities/Shop.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Domain/Entities/Shop.cs), [`Domain/Entities/StockItem.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Domain/Entities/StockItem.cs) (with the `PayoutBatch` record), `Domain/Enums/` (`ShopStatus`, `StockItemStatus`, `PawnshopRarity`), [`Domain/Exceptions/PawnshopExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Domain/Exceptions/PawnshopExceptions.cs) |
| Infrastructure | `Persistence/` (`PawnshopDbContext`, `PawnshopRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs`, [`Background/PawnshopKeeper.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Infrastructure/Background/PawnshopKeeper.cs) |

[`PawnshopModuleExtensions.AddPawnshopModule`](../../../Backend/src/AuctionServer.Modules.Pawnshop/PawnshopModuleExtensions.cs) takes the connection string and a `PawnshopOptions` instance and validates it up front. The checks require `PremisesPrice > 0`, `PremisesRequiredTurnover >= 0`, `StockSellDelay` within `[30 s, 7 d]`, both `StockRequestTimeout` and `PaymentTimeout` at least 10 minutes (the dead-letter horizon, see Decisions) and at least one bot tier. Tier names must be unique ignoring case and at most 64 characters long, rarities must be defined and unique across tiers, and every tier needs `Price > 0`, `SpawnInterval >= 10 s`, `PayoutRate` within `[0.01, 1)` and `StockSellDelay <= SpawnInterval * 100`. The method registers `PawnshopDbContext`, the `OutboxProcessor` and `PawnshopKeeper` hosted services, the options singleton and `IPawnshopRepository` as scoped. Like Banking the module reads and writes through EF Core. Queries use `AsNoTracking`, writes load tracked entities guarded by their `Version` concurrency tokens.

The other halves of the sagas live in the modules that own the data. Wallets runs `PawnshopPaymentRequestedEventHandler` (turnover gate plus debit through `Wallet.PayForPawnshop`) and `PawnshopPayoutEventHandler` (credit through `AddFunds`), see [wallets.md](wallets.md). Inventory runs `PawnshopStockRequestedEventHandler` (prices the goods without saving any item) and `PawnshopItemWithdrawnEventHandler` (mints the withdrawn item through `Item.CreateWithPrice`), see [inventory.md](inventory.md).

## Running

```bash
# from Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Pawnshop --startup-project src/AuctionServer.Api --context PawnshopDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Pawnshop --startup-project src/AuctionServer.Api --context PawnshopDbContext
dotnet test tests/AuctionServer.Modules.Pawnshop.Tests
```

Migrations live in [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Infrastructure/Persistence/Migrations). `20261015145524_Initial_Pawnshop` creates the shops table with the filtered unique index plus the outbox and inbox tables, `20261015152831_Add_Pawnshop_Bot` adds the bot and pending-bot snapshot columns with `NextSpawnOn` and its index, `20261015153604_Add_Pawnshop_Stock` adds the pending stock-request columns and the `PawnshopStockItems` table, and `20261015161815_Set_Pawnshop_Stock_Rate_Precision` narrows `PendingStockPayoutRate` to `numeric(5,4)` like the other rates.

## Configuration

The whole `Pawnshop` section of `appsettings.json` binds to `PawnshopOptions`, and a missing section stops the host.

| Key | Default | Effect |
|---|---|---|
| `Pawnshop:PremisesPrice` | `100000` | one-time price of the premises, debited by Wallets |
| `Pawnshop:PremisesRequiredTurnover` | `1000000` | lifetime turnover the player needs before the premises can be bought |
| `Pawnshop:StockSellDelay` | `00:05:00` | how long every spawned item stays in stock before the automatic sale, which is also the withdrawal window |
| `Pawnshop:StockRequestTimeout` | `00:15:00` | after this an unanswered spawn request is dropped (one spawn lost, schedule kept), validated `>= 10 min` |
| `Pawnshop:PaymentTimeout` | `00:15:00` | after this an unanswered premises or bot payment is rejected with "Payment timed out", validated `>= 10 min` |
| `Pawnshop:BotTiers` | the four tiers below | the bot ladder. A purchase copies the tier as a snapshot, so changing the config never reprices a bot already bought or being paid for. Do not override the array from env vars in compose (merge by index) |

The default ladder pays out 0.5 of the price on every tier. Hourly income is `3600 / SpawnInterval` times the mean of the rarity band times the payout rate, and the bands come from `Item.RollPriceFor` in Inventory (`Random.Shared.Next` with an exclusive upper bound, so 10 to 99, 100 to 999, 1 000 to 9 999 and 10 000 to 99 999). Every tier pays back its price in 15 to 18 hours.

| Tier | Rarity | Price | Spawns every | Band mean | Payout per hour | Payback |
|---|---|---|---|---|---|---|
| `Pawn Clerk` | `Common` | 50 000 | 30 s | 54.5 | about 3 270 | about 15 h |
| `Appraiser` | `Rare` | 300 000 | 60 s | 549.5 | about 16 485 | about 18 h |
| `Dealer` | `Epic` | 1 500 000 | 120 s | 5 499.5 | about 82 490 | about 18 h |
| `Magnate` | `Legendary` | 5 000 000 | 300 s | 54 999.5 | about 330 000 | about 15 h |

## Data model

`PawnshopShops`:

| Column | Type | Notes |
|---|---|---|
| `Id` | `integer` | primary key, identity |
| `PublicPawnshopId` | `uuid` | unique public identifier, carried by every event |
| `UserId` | `uuid` | unique while `Status IN (0, 1)`, so a player owns at most one live pawnshop. Raw integers in the filter, never renumber `ShopStatus` |
| `Status` | `integer` | `PendingPayment = 0`, `Active = 1`, `Rejected = 2` |
| `RequestedOn` | `timestamptz` | when the premises were requested, orders GET to the newest pawnshop |
| `ActivatedOn` | `timestamptz?` | set when the premises payment completes |
| `RejectionReason` | `text(256)?` | from Wallets or the keeper. Reused for a rejected bot purchase and cleared by the next purchase or a completed payment |
| `PendingPaymentId`, `PendingPaymentRequestedOn` | `uuid?`, `timestamptz?` | the one payment in flight. A reply must carry this id, and both rejection and expiry clear it |
| `BotTierName`, `BotRarity`, `BotSpawnInterval`, `BotPayoutRate`, `BotPurchasedOn` | `text(64)?`, `integer?`, `interval?`, `numeric(5,4)?`, `timestamptz?` | snapshot of the installed bot |
| `PendingBotTierName`, `PendingBotRarity`, `PendingBotSpawnInterval`, `PendingBotPayoutRate` | `text(64)?`, `integer?`, `interval?`, `numeric(5,4)?` | snapshot of the bot being paid for, frozen at request time |
| `NextSpawnOn` | `timestamptz?` | when the keeper requests the next spawn. With `Status` in a composite index for the spawn sweep |
| `PendingStockRequestId`, `PendingStockRequestedOn` | `uuid?`, `timestamptz?` | the one spawn request in flight |
| `PendingStockPayoutRate` | `numeric(5,4)?` | the bot's payout rate frozen for the goods of that request |
| `Version` | `uuid` | concurrency token, regenerated by every mutating method |

`PawnshopStockItems`:

| Column | Type | Notes |
|---|---|---|
| `Id` | `integer` | primary key, identity |
| `PublicStockItemId` | `uuid` | unique public identifier, used in the withdraw route and the withdrawn event |
| `PublicPawnshopId` | `uuid` | the owning pawnshop, no foreign key |
| `UserId` | `uuid` | the owner, copied from the pawnshop so the ownership check needs no join. With `Status` in a composite index |
| `Name` | `text(100)` | `Pawned {Rarity} Good` |
| `Rarity` | `integer` | `PawnshopRarity`, a local copy of Inventory's `ItemRarity` |
| `Price` | `numeric(18,2)` | full price quoted by Inventory, also the price of a withdrawn item |
| `PayoutRate` | `numeric(5,4)` | frozen per item from the request that spawned it |
| `Status` | `integer` | `InStock = 0`, `Withdrawn = 1`, `Sold = 2`. With `SellAfter` in a composite index for the sale sweep |
| `SpawnedOn`, `SellAfter` | `timestamptz` | `SellAfter = SpawnedOn + StockSellDelay` |
| `ResolvedOn` | `timestamptz?` | when the item was withdrawn or sold |
| `PayoutAmount` | `numeric(18,2)?` | set only by the sale, `Round(Price * PayoutRate, 2, AwayFromZero)` |
| `Version` | `uuid` | concurrency token, settles a withdrawal racing the sale |

`PawnshopOutboxMessages` and `PawnshopProcessedMessages` are the module's copies of the outbox and inbox tables.

## API

All five routes require a JWT.

| Method and route | Request | Response | Handler |
|---|---|---|---|
| `GET /api/pawnshop/offers` | none | 200 with `PawnshopOffersDto` straight from configuration (no database): premises price and turnover threshold, `StockSellDelay` and the tier list | `GetOffersQueryHandler` |
| `GET /api/pawnshop` | none | 200 with the caller's newest pawnshop, `Rejected` included with its reason. It carries the installed bot, the name of a bot being paid for, `NextSpawnOn` and the stock (every `InStock` item ordered by `SellAfter` plus the 20 most recently resolved with their `PayoutAmount`). 404 when the player never asked for premises | `GetPawnshopQueryHandler` |
| `POST /api/pawnshop` | empty body | 201 with `PublicPawnshopId` at once. The payment is asynchronous, so a rejection (turnover or funds) shows up in GET after two outbox polls. A second live pawnshop answers 409 through the filtered unique index | `OpenPawnshopCommandHandler` |
| `POST /api/pawnshop/bot` | `{ tierName }` | 202, the payment is asynchronous. An unknown tier answers 404 before the pawnshop lookup, so a typo cannot reveal account state. 404 without a live pawnshop. 409 when the premises are still being paid for, another payment is in flight or the tier is not strictly higher than the installed bot | `BuyBotCommandHandler` |
| `POST /api/pawnshop/stock/{id}/withdraw` | empty body | 202, the item reaches Inventory asynchronously. A foreign item answers 404 exactly like a missing one, before any state guard, so stock ids cannot be probed. 409 when the item is no longer in stock or its window has closed | `WithdrawStockItemCommandHandler` |

## Events

| Direction | Event | Handler and effect |
|---|---|---|
| published | `PawnshopPaymentRequestedEvent` | written by `OpenPawnshopCommandHandler` (premises price and turnover threshold) or `BuyBotCommandHandler` (tier price, threshold 0) in the same save as the pawnshop change. Consumed by Wallets, where `Wallet.PayForPawnshop(amount, requiredTurnover)` checks the gate and debits atomically without touching turnover |
| consumed | `PawnshopPaymentCompletedEvent` | `PawnshopPaymentCompletedEventHandler` runs `CompletePayment`. Premises become `Active`, a bot payment installs the pending snapshot and schedules `NextSpawnOn = now + SpawnInterval` |
| consumed | `PawnshopPaymentRejectedEvent` | `PawnshopPaymentRejectedEventHandler` runs `RejectPayment`. Premises become `Rejected`, which frees the unique-index slot at once. A rejected bot payment keeps the pawnshop `Active` with the old bot and stores the reason |
| published | `PawnshopStockRequestedEvent` | written by `PawnshopKeeper` with the outbox row id, the event id and `PendingStockRequestId` all equal. Consumed by Inventory, which rolls one price per requested rarity without saving any item |
| consumed | `PawnshopStockedEvent` | `PawnshopStockedEventHandler` runs `ReceiveStock`, which accepts the reply only when its `RequestId` matches the pending request and inserts the goods with `SellAfter = now + StockSellDelay` |
| published | `PawnshopPayoutEvent` | written by `PawnshopKeeper`, one per pawnshop per sweep with the summed payouts of the items it sold. Consumed by Wallets, which credits through `AddFunds`, so payouts count toward `LifetimeTurnover` |
| published | `PawnshopItemWithdrawnEvent` | written by `WithdrawStockItemCommandHandler` in the same save as the item change. Consumed by Inventory, which mints an `Available` item for the owner at the stock price through `Item.CreateWithPrice` |

Late replies are not tolerated. A payment reply whose `PaymentId` differs from `PendingPaymentId`, or a stock reply whose `RequestId` differs from `PendingStockRequestId`, throws `InvalidShopStateTransitionException`. The handlers do not catch it, so the message retries and dead-letters visibly instead of being skipped silently.

## The keeper

[`PawnshopKeeper`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Infrastructure/Background/PawnshopKeeper.cs) is a `BackgroundService` on a 5000 ms loop. Each cycle runs four sweeps in safety-nets-first order, and each sweep saves its entity changes together with its outbox rows in one `SaveChangesAsync`.

1. Expire payments. Pawnshops whose payment has been pending longer than `PaymentTimeout` (at most 50 per cycle) go through `ExpirePayment`, which rejects it with "Payment timed out" and clears `PendingPaymentId`.
2. Expire stock requests. Pawnshops whose spawn request is older than `StockRequestTimeout` (at most 50) drop it through `ExpireStockRequest`. `NextSpawnOn` stays as it is, so a lost reply costs one spawn and nothing else.
3. Sell due stock. Up to 200 `InStock` items with `SellAfter` in the past, oldest first, go through `StockItem.SellDue`, which sells every item and groups the payouts per pawnshop into `PayoutBatch` records. One `PawnshopPayoutEvent` per batch is written in the same save, so an item is `Sold` exactly when its payout row exists.
4. Request due spawns. Active pawnshops with a bot, no request in flight and `NextSpawnOn` in the past (at most 50) go through `RequestSpawn`, which sets `NextSpawnOn = now + SpawnInterval`. The schedule is anchored at the request, so there is no catch-up after downtime.

Selling runs before spawning because it moves money, and spawning runs last as the only sweep that creates new work. The keeper has no tests by repository convention. Every decision lives in `Shop` and `StockItem` and is tested there.

## Decisions

- One-time purchases are the only sinks. The premises, the bots and the bot thrown away by an upgrade cost money, while there is no rent and no withdrawal fee. The running income is the product of spawn rate, rarity band and payout rate, all in configuration.
- Payouts count toward `LifetimeTurnover`, because they arrive through Wallets' `AddFunds` like every other economy credit. The loop where passive turnover unlocks bank loans is accepted on purpose. Purchases debit through `Wallet.PayForPawnshop`, which never lowers turnover, so spending does not distort the gate.
- One premises, one bot slot and an upgrade-only ladder. A new bot replaces the installed one without a refund, and a tier that is not strictly higher answers 409, because swapping sideways without a refund would only punish a double click. Rarities are validated unique across tiers, so the ladder has at most four steps.
- `PayoutRate < 1` is validated on purpose. Withdrawing within the window keeps the full price (sell it to the shop or list it on the market), so the automatic sale is always worth less than paying attention. That gap is the activity premium. The lower bound `0.01` keeps a cheap item from paying out 0.00, because `AddFunds(0)` throws and the payout would dead-letter.
- The withdrawal window closes at `SellAfter`, not when the keeper happens to run. `Withdraw` requires `now < SellAfter` and `Sell` requires `now >= SellAfter`, so the outcome does not depend on keeper timing. When a withdrawal and the sale save at the same moment, the `Version` token on the item lets exactly one of them through.
- The payout rate is frozen per item. The rate of the bot that requested the spawn goes into `PendingStockPayoutRate` and from there into every item of the reply, so replacing the bot while a request is in flight or while goods sit in stock never reprices them.
- Payout math is `Round(Price * PayoutRate, 2, MidpointRounding.AwayFromZero)` per item, summed per pawnshop. The explicit `AwayFromZero` matches the bank interest and avoids banker's rounding, which would send `15 * 0.015 = 0.225` down to 0.22.
- Spawning follows the warehouse quoting pattern with its own events. Inventory prices transient items it never saves, and the reply echoes the request id because a pawnshop asks many times while a warehouse is stocked once. The warehouse events are not reused, since both modules would then consume each other's replies and dead-letter on foreign ids.
- `PawnshopRarity` is a local copy of Inventory's `ItemRarity`, because modules cannot reference each other, and rarities cross the boundary as strings. Only the end-to-end probe catches drift between the two enums.
- `StockRequestTimeout` and `PaymentTimeout` are validated `>= 10 min`, the same dead-letter horizon as in Banking (two legs of about five minutes of outbox backoff each). A shorter timeout would let the keeper expire a payment whose completion is still on its way.

Accepted risks, recorded by the owner on 2026-10-15:

- Crafting amplifies withdrawals. `Item.Craft` turns three items of one rarity into one item of the next rarity with a fresh price roll, and every band mean is about ten times the previous one, so each step multiplies value by about 3.3. A Pawn Clerk emptied by hand yields about 120 commons an hour, worth about 6 540 at full price or about 21 980 once crafted into 40 rares, against about 3 270 from the automatic payout. The same faucet already exists for items won in warehouse wars.
- A late `PawnshopPaymentCompletedEvent` costs the player. When the keeper has already expired the payment, Wallets has debited but the pawnshop rejects the reply (mismatched `PaymentId`) and it dead-letters. This mirrors the bank, where a late approval would have handed out free principal. With both timeouts at or above the dead-letter horizon only a dead row revived by hand can get there. The deferred mitigation is a compensating refund event, following the "Compensate late funds lock confirmation" fix in Auctions.
- Resolved stock is never deleted. `Sold` and `Withdrawn` items stay in `PawnshopStockItems` (a Pawn Clerk adds about 2 880 rows a day), GET caps the resolved history at 20 and a retention sweep is out of scope.
- Outbox throughput caps the bot population. Each outbox processor delivers at most 20 rows per 3 s poll, about 24 000 rows an hour. A Pawn Clerk writes about 240 Pawnshop outbox rows an hour (one spawn request and one payout per spawn), so about 100 of them saturate the module. That is fine at portfolio scale, and the scaling knob would be more items per spawn rather than more spawns.
- The pawnshop ignores `IsSuspendedWallet` on debit and credit, consistent with Banking and every other path in Wallets.

## Related documents

- [README.md](README.md) - backend overview, running, configuration, tests.
- [messaging.md](messaging.md) - outbox, inbox, retry policy, the event registry.
- [wallets.md](wallets.md) - `PayForPawnshop` and both Wallets-side pawnshop handlers.
- [inventory.md](inventory.md) - the quote and mint handlers on the Inventory side.
- [banking.md](banking.md) - the turnover gate and the request/reply saga shape the pawnshop reuses.
