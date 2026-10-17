# Casino module

> English version. Polish 1:1 counterpart: [../../pl/backend/casino.md](../../pl/backend/casino.md)

`AuctionServer.Modules.Casino` is the first continuous money sink of the economy: every game is statistically lost by the player, and the house edge takes a share of every chip wagered. Entry is free. The player exchanges wallet money 1:1 for casino chips through an asynchronous purchase saga with Wallets, plays european roulette and blackjack synchronously on the chip balance, and cashes chips out 1:1 back to the wallet. Cashed-out money never builds `LifetimeTurnover`, so the casino cannot farm the gates of the bank or the pawnshop. Eight endpoints live under `/api/casino`, all behind JWT. The server rolls every outcome; a future frontend only animates it.

## Overview

| Area | Files |
|---|---|
| Endpoints | [`Presentation/CasinoEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Presentation/CasinoEndpoints.cs), request records `PurchaseChipsRequest`, `CashOutChipsRequest`, `SpinRouletteRequest`, `StartBlackjackHandRequest`, `BlackjackActionRequest` |
| Commands and queries | `Application/Command/PurchaseChips/`, `CashOutChips/`, `SpinRoulette/`, `StartBlackjackHand/` and `ActOnBlackjackHand/` (command, handler, validator each; the spin and blackjack commands own their DTOs), `Application/Queries/GetCasino/`, `GetRouletteSpins/` and `GetBlackjackHands/` (query, handler, DTOs each) |
| Options | `Application/Options/CasinoOptions.cs` (`CasinoOptions`, `RouletteOptions`, `BlackjackOptions`) |
| Event handlers | `Application/Handlers/CasinoChipPurchaseCompletedEventHandler.cs`, `CasinoChipPurchaseRejectedEventHandler.cs` |
| Domain | [`Domain/Entities/ChipAccount.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/ChipAccount.cs), [`ChipPurchase.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/ChipPurchase.cs), [`RouletteBet.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/RouletteBet.cs), [`RouletteSpin.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/RouletteSpin.cs), [`BlackjackHand.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/BlackjackHand.cs), `Domain/Cards/` (`Card`, `HandValue`, `ICardSource`), `Domain/Enums/` (`ChipPurchaseStatus`, `RouletteBetType`, `BlackjackHandStatus`, `BlackjackOutcome`, `BlackjackAction`), [`Domain/Exceptions/CasinoExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Exceptions/CasinoExceptions.cs) |
| Infrastructure | `Persistence/` (`CasinoDbContext`, `CasinoRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs`, [`Background/CasinoKeeper.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Infrastructure/Background/CasinoKeeper.cs), `Random/` (`CasinoRandom`, [`ShoeCardSource`](../../../Backend/src/AuctionServer.Modules.Casino/Infrastructure/Random/ShoeCardSource.cs)) |

[`CasinoModuleExtensions.AddCasinoModule`](../../../Backend/src/AuctionServer.Modules.Casino/CasinoModuleExtensions.cs) takes the connection string and a `CasinoOptions` instance and validates it up front. The checks require the nested `Roulette` and `Blackjack` sections to be present (the binder leaves a missing nested section as `null`), `PurchaseTimeout` at least 10 minutes (the dead-letter horizon, see Decisions), per game `1 <= MinBet <= MaxBet` with both limits whole numbers, `MaxBetsPerSpin` within `[1, 50]` and `HandTimeout` within `[30 s, 1 d]`. The method registers `CasinoDbContext`, the `OutboxProcessor` and `CasinoKeeper` hosted services, the options singleton, `ICasinoRandom` (production: `RandomNumberGenerator.GetInt32`) and `ICardSource` (production: `ShoeCardSource`) as singletons and `ICasinoRepository` as scoped. Like Banking and Pawnshop the module reads and writes through EF Core: queries use `AsNoTracking`, writes load tracked entities guarded by their `Version` concurrency tokens.

The Wallets side of the chips flow lives in `Modules.Wallets`: `CasinoChipPurchaseRequestedEventHandler` debits through the existing `Wallet.Withdraw` (no turnover gate, only `InsufficientFundsException` is caught) and `CasinoCashOutEventHandler` credits through the new `Wallet.ReceiveCasinoCashOut`, which, like `ReceiveTransfer`, never touches `LifetimeTurnover`. See [wallets.md](wallets.md).

## Running

```bash
# from Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Casino --startup-project src/AuctionServer.Api --context CasinoDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Casino --startup-project src/AuctionServer.Api --context CasinoDbContext
dotnet test tests/AuctionServer.Modules.Casino.Tests
```

Migrations live in [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Casino/Infrastructure/Persistence/Migrations). `20261017131446_Initial_Casino` creates the chip account and purchase tables (with the filtered unique index for one purchase in flight) plus the outbox and inbox tables, `20261017133312_Add_Casino_Roulette` adds the spin table and its owned bets table, and `20261017134452_Add_Casino_Blackjack` adds the blackjack hands table with the player and dealer cards as `integer[]` columns.

## Configuration

The whole `Casino` section of `appsettings.json` binds to `CasinoOptions`, and a missing section stops the host. The payout tables (roulette pays `stake * 36 / covered pockets`, blackjack pays 3:2 for a natural) and the six-deck shoe are domain constants on purpose: no configuration value can flip the house edge.

| Key | Default | Effect |
|---|---|---|
| `Casino:PurchaseTimeout` | `00:15:00` | after this the keeper expires an unanswered chip purchase, validated `>= 10 min` |
| `Casino:Roulette:MinBet`, `MaxBet` | `1`, `1000` | per-bet limits of the roulette table, whole chips |
| `Casino:Roulette:MaxBetsPerSpin` | `20` | how many bets one spin accepts, validated within `[1, 50]` |
| `Casino:Blackjack:MinBet`, `MaxBet` | `5`, `2000` | stake limits of the blackjack table, whole chips |
| `Casino:Blackjack:HandTimeout` | `00:05:00` | after this the keeper auto-stands an abandoned hand, validated within `[30 s, 1 d]` |

## Data model

`CasinoAccounts`:

| Column | Type | Notes |
|---|---|---|
| `Id` | `integer` | primary key, identity |
| `UserId` | `uuid` | unique; the account is created on the first purchase request |
| `Balance` | `numeric(18,2)` | current chips |
| `LifetimeBought`, `LifetimeCashedOut` | `numeric(18,2)` | counters for the profile and for spotting a drained account |
| `CreatedOn` | `timestamptz` | |
| `Version` | `uuid` | concurrency token, regenerated by every mutating method |

`CasinoChipPurchases`:

| Column | Type | Notes |
|---|---|---|
| `Id` | `integer` | primary key, identity |
| `PublicPurchaseId` | `uuid` | unique, carried by every purchase event |
| `UserId` | `uuid` | unique while `Status = 0`, so one purchase in flight per player. Raw integer in the filter, never renumber `ChipPurchaseStatus` |
| `Amount` | `numeric(18,2)` | whole chips, equals the wallet money debited |
| `Status` | `integer` | `Pending = 0`, `Completed = 1`, `Rejected = 2`, `Expired = 3`. With `RequestedOn` in a composite index for the keeper |
| `RequestedOn`, `ResolvedOn?` | `timestamptz` | |
| `RejectionReason` | `text(256)?` | from Wallets, or `Purchase timed out` from the keeper, cleared by a late completion |
| `Version` | `uuid` | concurrency token |

`CasinoRouletteSpins` (immutable, no `Version`) holds `Id` (`bigint`), a unique `PublicSpinId`, `UserId`, the winning `Pocket` (`smallint`, 0-36), `TotalStake`, `TotalPayout` and `PlacedOn` with a (`UserId`, `PlacedOn`) index; its bets are an owned collection in `CasinoRouletteBets` (`Type`, `Selection?` for a straight number, dozen or column, `Stake`, `Payout`). `CasinoBlackjackHands` holds `Id` (`bigint`), a unique `PublicHandId`, `UserId` (unique while `Status = 0`, one active hand per player), `Status` (`InProgress = 0`, `Completed = 1`), `Stake` (doubled in place by a double down), `Doubled`, `PlayerCards` and `DealerCards` as `integer[]` card codes 0-51 (the `text[]` precedent is `OutboxMessage.Errors`), `Outcome?` (`Win`, `Lose`, `Push`, `Blackjack`), `Payout?`, `AutoStood`, `StartedOn`, `LastActionOn` (with `Status` in a composite index for the keeper), `CompletedOn?` and `Version`. `DealerCards[1]` is the hole card: while a hand is in progress every DTO exposes only `VisibleDealerCards`, which cuts the list to the upcard.

`CasinoOutboxMessages` and `CasinoProcessedMessages` are the module's copies of the outbox and inbox tables.

## API

All eight routes require a JWT.

| Method and route | Request | Response | Handler |
|---|---|---|---|
| `GET /api/casino` | none | 200 with the chip balance, both lifetime counters, the latest purchase with status and reason, the active blackjack hand (hole card hidden) and both tables' limits. A player who never bought chips gets balance 0, not 404, because entry is free | `GetCasinoQueryHandler` |
| `POST /api/casino/chips/purchases` | `{ amount }`, whole | 201 with `PublicPurchaseId` at once; the wallet debit is asynchronous, a rejection shows up in GET after two outbox polls. A second purchase in flight answers 409 through the filtered unique index | `PurchaseChipsCommandHandler` |
| `POST /api/casino/chips/cashouts` | `{ amount }`, up to 2 decimals | 202; chips leave the account at once, the wallet credit is asynchronous. 400 over the balance, 404 without an account | `CashOutChipsCommandHandler` |
| `POST /api/casino/roulette/spins` | `{ bets: [{ type, selection?, stake }] }` | 200 with the pocket, its color, per-bet payouts and the new balance; the whole spin is synchronous. 400 for bets outside the limits or a stake sum over the balance | `SpinRouletteCommandHandler` |
| `GET /api/casino/roulette/spins` | none | 200 with the 20 latest spins, bets included | `GetRouletteSpinsQueryHandler` |
| `POST /api/casino/blackjack/hands` | `{ stake }`, whole | 201 with the dealt hand; a natural settles immediately with the payout already credited. 409 for a second active hand through the filtered unique index | `StartBlackjackHandCommandHandler` |
| `POST /api/casino/blackjack/hands/{publicHandId}/actions` | `{ action }`: `Hit`, `Stand` or `Double` | 200 with the hand after the action; the hand id sits in the route, so a click from a stale browser tab hits the old hand and gets 409 instead of acting on a new one. A foreign hand answers 404 exactly like a missing one | `ActOnBlackjackHandCommandHandler` |
| `GET /api/casino/blackjack/hands` | none | 200 with the 20 latest completed hands, both full hands revealed | `GetBlackjackHandsQueryHandler` |

## Games and the house edge

**Roulette** is european, a single zero. One spin takes up to `MaxBetsPerSpin` bets of the types `Straight` (`Selection` 0-36), `Red`, `Black`, `Odd`, `Even`, `Low` (1-18), `High` (19-36), `Dozen` and `Column` (`Selection` 1-3). A bet covering `n` pockets pays `stake * 36 / n`, and zero loses every outside bet, so every bet type returns exactly `36/37` of its stake in expectation; the domain test sums the payouts over all 37 pockets and pins the total to exactly `36 * stake` per type. The handler draws the pocket through `ICasinoRandom.Next(37)` and the domain resolves it like it receives `now`: randomness stays at the edge, the domain is deterministic.

**Blackjack** v1 offers Hit, Stand and Double (first two cards only); split, insurance and surrender are future extensions. A natural pays 3:2, the dealer stands on soft 17, peeks at the hole card under an ace or a ten-value upcard, and a shoe of six decks is fresh every hand. `ShoeCardSource` draws uniformly from the six decks minus the cards already dealt in the hand, which is statistically identical to shuffling a fresh shoe while persisting no card order, so the database never knows the next card. Player 21 stands automatically, a player bust ends the hand without the dealer playing, and a dealer natural found by the peek ends the hand before any action.

The blackjack edge is measured, not copied from textbooks, because the v1 rules differ from them (no split, no surrender). A one-off console (outside the repository) played 10 000 000 hands with seed `20261017` on the real domain classes and a simplified basic strategy without splits: house edge **1.084 % of the initial stake** (1.002 % of the total amount wagered, doubles included). The anchor check matched the closed-form natural probability for six decks, `4608/97032 = 4.7489 %`, with 4.7446 % measured. Both games therefore sink money in expectation; the numbers hold for this strategy, not for blackjack in general.

## Events

| Direction | Event | Handler and effect |
|---|---|---|
| published | `CasinoChipPurchaseRequestedEvent` | written by `PurchaseChipsCommandHandler` in the same save as the new `Pending` purchase (and the account, on the first purchase). Consumed by Wallets, which debits through `Wallet.Withdraw`, with no turnover gate |
| consumed | `CasinoChipPurchaseCompletedEvent` | `CasinoChipPurchaseCompletedEventHandler` runs `purchase.Complete` and `account.ReceivePurchase` with the inbox row in one save. `Complete` is legal from `Pending` and from `Expired`, so a late reply still credits the chips |
| consumed | `CasinoChipPurchaseRejectedEvent` | `CasinoChipPurchaseRejectedEventHandler` runs `purchase.Reject` with the reason. On an `Expired` purchase the reject is a silent no-op, because Wallets did not debit and the keeper already freed the index slot |
| published | `CasinoCashOutEvent` | written by `CashOutChipsCommandHandler` in the same save as the chip debit. Consumed by Wallets, which credits through `Wallet.ReceiveCasinoCashOut`, so cash-outs never build `LifetimeTurnover` |

Gameplay publishes nothing: spins and blackjack actions are synchronous writes inside the module, so only purchases and cash-outs load the outbox.

## The keeper

[`CasinoKeeper`](../../../Backend/src/AuctionServer.Modules.Casino/Infrastructure/Background/CasinoKeeper.cs) is a `BackgroundService` on a 5000 ms loop with two sweeps, each saving once per cycle.

1. Expire stale purchases. `Pending` purchases older than `PurchaseTimeout` (at most 50 per cycle) go through `Expire`, which stores `Purchase timed out` and frees the one-purchase-in-flight slot.
2. Auto-stand abandoned hands. `InProgress` hands whose `LastActionOn` is older than `HandTimeout` (at most 50) go through `AutoStand`, which plays the dealer, settles the hand, flags it `AutoStood` and credits any payout to the chip account loaded in the same cycle. A race with a player action fails the cycle on the `Version` token, and the next cycle skips the hand because it is no longer abandoned.

The keeper has no tests by repository convention; `Expire` and `AutoStand` are tested on the entities.

## Decisions

- Money flows through chips, not through the wallet per bet. A wallet debit per spin would drag the 3-9 s purchase saga into every bet; buying chips once makes gameplay a synchronous write on `ChipAccount.Balance` guarded by the `Version` token. The exchange is 1:1 with no fee, so the only sink is the house edge.
- Casino money never builds `LifetimeTurnover`. A player hedging red and black loses on average only 1/37 of the wagered sum, so turnover-counting cash-outs would sell the pawnshop's 1M gate for about 28k. `Wallet.ReceiveCasinoCashOut` mirrors `ReceiveTransfer` through the private `Credit(amount, countsTowardTurnover: false)` choke point.
- A late `CasinoChipPurchaseCompletedEvent` still credits the chips. This is a deliberate departure from the pawnshop's "late replies dead-letter" rule: purchases are separate `ChipPurchase` rows (the `Loan` pattern), not fields on the account (the `Shop` pattern), so an `Expired` row stays matchable and `Complete` accepts it. In the pawnshop a late completion costs the player because the pending id is cleared; here the player's wallet was already debited, and tolerating the late reply is one extra legal state transition.
- Payout tables and the deck count are domain constants. Configuration sets table limits only; it cannot make a bet pay more than `36/n` or a natural more than 3:2, the same thought as `PayoutRate < 1` in the pawnshop.
- Whole-chip stakes and purchases, cash-outs to 2 decimals. Roulette payouts (`36/n` over 1, 12 or 18 pockets) and 3:2 on a whole stake are exact in `numeric(18,2)`, so no rounding rule exists; the 3:2 half-chips are the reason cash-outs accept 2 decimals, otherwise 0.5 chips would strand on the account.
- Randomness sits at the edge. Handlers draw from `ICasinoRandom` (`RandomNumberGenerator.GetInt32`) or `ICardSource` and the domain receives the result as a parameter, so every rule is deterministic under test (`ScriptedCardSource` scripts whole hands) and a rejected action (409 on a race) leaks nothing, because its draw was neither saved nor shown.
- The hole card is hidden by the DTO shape, not by filtering. No response type for an in-progress hand has a property with the full dealer hand, and an integration test parses the raw JSON of the start response to prove the hole card code is absent. The card still sits in the database row from the deal, which is accepted: database access reveals it, the API does not.

Accepted risks, recorded by the owner on 2026-10-17:

- Variance creates money. On average the casino is a sink, but a single straight bet returns 36 times the stake; the table limits cap one spin, while nothing caps a balance. No rate limiter exists on the game endpoints, like everywhere else in the API.
- Spin spam versus the saga. A bot spinning nonstop can win the `Version` race against the Completed handler on every one of its 5 attempts, dead-lettering the purchase with the wallet debited and no chips credited. The repair is reviving the dead row, which works precisely because a late completion is tolerated. The same spam can repeatedly fail the keeper's hand sweep cycle and delay other players' auto-stands.
- A dead cash-out loses the chips. A `CasinoCashOutEvent` that dead-letters leaves the chips deducted and the wallet uncredited, visible only in `IsDead`; pawnshop payouts share this risk.
- Spins, bets and hands are kept forever, like pawnshop stock; the GET endpoints cap history at 20 and a retention sweep is deferred. Gameplay writes no outbox rows, so outbox throughput is loaded only by purchases and cash-outs.

## Related documents

- [README.md](README.md) - backend overview, running, configuration, tests.
- [messaging.md](messaging.md) - outbox, inbox, retry policy, the event registry.
- [wallets.md](wallets.md) - `ReceiveCasinoCashOut` and both Wallets-side casino handlers.
- [banking.md](banking.md), [pawnshop.md](pawnshop.md) - the turnover gates the casino must not feed.
