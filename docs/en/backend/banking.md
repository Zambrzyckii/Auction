# Banking module

> English version. Polish 1:1 counterpart: [../../pl/backend/banking.md](../../pl/backend/banking.md)

`AuctionServer.Modules.Banking` grants loans from fixed, configured offers, gated by the lifetime wallet turnover: to take an offer the player must have historically received at least its `RequiredTurnover` in economy credits, whatever the current balance is. A loan is repaid in a single collection at maturity, pulled by a keeper; when the funds do not cover the debt the bank takes what is there, charges a one-time penalty and retries automatically. Disbursement creates money, collection destroys principal, interest and penalty (nobody is credited), so the bank is a faucet with a built-in sink, the mirror of the warehouse-wars money sink. Four endpoints live under `/api/bank`, all behind JWT.

## Overview

| Area | Files |
|---|---|
| Endpoints | [`Presentation/BankEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Banking/Presentation/BankEndpoints.cs), request record `CreateLoanRequest` |
| Commands and queries | `Application/Command/CreateLoan/` and `Application/Command/RepayLoan/` (command, handler, validator each), `Application/Queries/GetOffers/` (query, handler, `LoanOfferDto`), `Application/Queries/GetLoans/` (query, handler, `LoanDto`) |
| Options | `Application/Options/BankingOptions.cs` (`BankingOptions`, `LoanOfferDefinition`) |
| Event handlers | `Application/Handlers/LoanApprovedEventHandler.cs`, `LoanRejectedEventHandler.cs`, `LoanRepaymentCollectedEventHandler.cs` |
| Domain | [`Domain/Entities/Loan.cs`](../../../Backend/src/AuctionServer.Modules.Banking/Domain/Entities/Loan.cs), `Domain/Enums/LoanStatus.cs`, [`Domain/Exceptions/BankingExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Banking/Domain/Exceptions/BankingExceptions.cs) |
| Infrastructure | `Persistence/` (`BankingDbContext`, `BankingRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs`, [`Background/BankKeeper.cs`](../../../Backend/src/AuctionServer.Modules.Banking/Infrastructure/Background/BankKeeper.cs) |

[`BankingModuleExtensions.AddBankingModule`](../../../Backend/src/AuctionServer.Modules.Banking/BankingModuleExtensions.cs) takes the connection string and a `BankingOptions` instance and validates it up front: offers non-empty with unique names of at most 64 characters, `Principal > 0`, `0 < InterestRate <= 1`, `Term >= 10 s`, `RequiredTurnover >= 0`, `PenaltyRate` within `[0, 1]`, `CollectionRetryInterval > 0` and both `ApprovalTimeout` and `CollectionPendingTimeout` at least 10 minutes (the dead-letter horizon, see Decisions). It registers `BankingDbContext`, the `OutboxProcessor` and `BankKeeper` hosted services, the options singleton and `IBankingRepository` as scoped. Like Wallets the module reads and writes through EF Core (no Dapper); queries use `AsNoTracking`, writes load a tracked loan guarded by the `Version` concurrency token.

The Wallets side of both sagas lives in `Modules.Wallets`: `Application/Handlers/LoanRequestedEventHandler.cs` (turnover gate plus credit through `Wallet.DisburseLoan`) and `LoanRepaymentRequestedEventHandler.cs` (best-effort debit through `Wallet.CollectUpTo`). See [wallets.md](wallets.md).

## Running

```bash
# from Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Banking --startup-project src/AuctionServer.Api --context BankingDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Banking --startup-project src/AuctionServer.Api --context BankingDbContext
dotnet test tests/AuctionServer.Modules.Banking.Tests
```

Migrations live in [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Banking/Infrastructure/Persistence/Migrations): `20261015110057_Initial_Banking` creates all three tables with the filtered unique index.

## Configuration

The whole `Banking` section of `appsettings.json` binds to `BankingOptions`; a missing section stops the host.

| Key | Default | Effect |
|---|---|---|
| `Banking:PenaltyRate` | `0.20` | one-time penalty charged on the remainder when a collection requested at or past `DueOn` leaves debt |
| `Banking:CollectionRetryInterval` | `00:02:00` | pause between collection attempts on an `Overdue` loan |
| `Banking:CollectionPendingTimeout` | `00:15:00` | after this a `CollectionPending` loan is aborted back to its previous state; validated `>= 10 min` |
| `Banking:ApprovalTimeout` | `00:15:00` | after this a `PendingApproval` loan is rejected; validated `>= 10 min` |
| `Banking:Offers` | `Quick` 200 / 0.10 / `00:01:00` / turnover 400, `Standard` 1000 / 0.15 / `00:10:00` / 2000, `Long` 5000 / 0.25 / `00:30:00` / 10000 | the fixed catalogue; each loan copies the offer as a snapshot, so changing the config never rewrites existing debts. Do not override the array from env vars in compose (merge by index) |

## Data model

`BankingLoans`:

| Column | Type | Notes |
|---|---|---|
| `Id` | `integer` | primary key, identity |
| `PublicLoanId` | `uuid` | unique public identifier, used in routes and events |
| `UserId` | `uuid` | unique while `Status IN (0, 1, 2, 3)` - one open loan per player, raw integers in the filter, never renumber `LoanStatus` |
| `OfferName` | `text(64)` | snapshot of the offer |
| `Principal`, `RequiredTurnover` | `numeric(18,2)` | snapshot |
| `InterestRate`, `PenaltyRate` | `numeric(5,4)` | snapshot |
| `Term` | `interval` | snapshot |
| `TotalDue` | `numeric(18,2)` | `Principal + Round(Principal * InterestRate, 2, AwayFromZero)`, frozen at `Create` |
| `Penalty` | `numeric(18,2)` | charged exactly once, see Decisions |
| `AmountRepaid` | `numeric(18,2)` | grows with every collection |
| `Status` | `integer` | `PendingApproval = 0`, `Active = 1`, `CollectionPending = 2`, `Overdue = 3`, `Repaid = 4`, `Rejected = 5` |
| `RequestedOn` | `timestamptz` | approval-timeout cutoff |
| `DueOn` | `timestamptz?` | set by `Approve(now)` to `now + Term`; with `Status` in a composite index for the keeper sweeps |
| `LastCollectionRequestedOn` | `timestamptz?` | retry and abort cutoff; also decides early vs late in `ApplyCollection` |
| `OverdueSince` | `timestamptz?` | the penalty-charged marker, set once, never cleared |
| `RepaidOn` | `timestamptz?` | set when `Outstanding` reaches zero |
| `RejectionReason` | `text(256)?` | from Wallets or the keeper |
| `Version` | `uuid` | concurrency token, regenerated by every mutating method |

`Outstanding => TotalDue + Penalty - AmountRepaid` is computed in the entity and not mapped. `BankingOutboxMessages` and `BankingProcessedMessages` are the module's copies of the outbox and inbox tables.

## API

All four routes require a JWT.

| Method and route | Request | Response | Handler |
|---|---|---|---|
| `GET /api/bank/offers` | - | 200 with `LoanOfferDto` list straight from configuration (no database): name, principal, interest rate, `TotalDue` precomputed through `Loan.ComputeTotalDue`, term, required turnover | `GetOffersQueryHandler` |
| `GET /api/bank/loans` | - | 200 with the caller's `LoanDto` list, newest first, at most 50 | `GetLoansQueryHandler` |
| `POST /api/bank/loans` | `{ offerName }` | 201 with `PublicLoanId` immediately; the approval is asynchronous - a rejection (insufficient turnover) shows up in GET after ~6-9 s. Unknown offer answers 404 before the open-loan check, so a typo cannot reveal account state; a second open loan answers 409 via the filtered unique index | `CreateLoanCommandHandler` |
| `POST /api/bank/loans/{id}/repayments` | empty body | 202; the collection is asynchronous. A foreign loan answers 404 exactly like a missing one, before any entity guard, so loan ids cannot be probed; `LoanCollectionInProgressException` and `LoanAlreadyRepaidException` answer 409 | `RepayLoanCommandHandler` |

## Events

| Direction | Event | Handler and effect |
|---|---|---|
| published | `LoanRequestedEvent` | written by `CreateLoanCommandHandler` in the same save as the new `PendingApproval` loan; consumed by Wallets, where `Wallet.DisburseLoan(principal, requiredTurnover)` checks the gate and credits atomically (the disbursement itself counts toward turnover) |
| consumed | `LoanApprovedEvent` | `LoanApprovedEventHandler` runs `Approve(UtcNow)`: `Active`, `DueOn = now + Term` |
| consumed | `LoanRejectedEvent` | `LoanRejectedEventHandler` stores the reason; `Rejected` frees the unique-index slot immediately, so the player can retry at once |
| published | `LoanRepaymentRequestedEvent` | written by `BankKeeper` (matured `Active`, `Overdue` retries) or by `RepayLoanCommandHandler`, always with `Amount = Outstanding`; consumed by Wallets, where `Wallet.CollectUpTo` takes `min(AvailableFunds, amount)` - locked funds are untouchable and zero is a legal answer |
| consumed | `LoanRepaymentCollectedEvent` | `LoanRepaymentCollectedEventHandler` runs `ApplyCollection(collected, now)`: full coverage moves to `Repaid`, a partial collection requested before `DueOn` returns to `Active` without penalty, a partial collection at or past `DueOn` moves to `Overdue` with the one-time penalty on the remainder |

Late replies to a loan that has already moved on are not tolerated: the handlers do not catch `InvalidLoanStateTransitionException`, so the message retries and dead-letters visibly instead of being skipped silently.

## The keeper

[`BankKeeper`](../../../Backend/src/AuctionServer.Modules.Banking/Infrastructure/Background/BankKeeper.cs) is a `BackgroundService` on a 5000 ms loop. Each cycle runs four sweeps in safety-nets-first order, each loading at most 50 loans and saving the aggregate mutations together with the outbox rows in one `SaveChangesAsync`: rejects `PendingApproval` loans older than `ApprovalTimeout` ("Approval timed out"), aborts `CollectionPending` loans older than `CollectionPendingTimeout` (`AbortCollection` returns the loan to `Active` or `Overdue` by `OverdueSince` and never charges anything - a lost message is not the player's fault), requests collection for `Active` loans with `DueOn` in the past, and retries `Overdue` loans whose last request is older than `CollectionRetryInterval`. The keeper has no tests by repository convention; every decision lives in `Loan` and is tested there.

## Decisions

- Flat per-term interest: `TotalDue = Principal + Round(Principal * InterestRate, 2, MidpointRounding.AwayFromZero)`, computed once at `Create` and frozen. An annual rate would round to 0.00 at minute-scale terms. The explicit `AwayFromZero` avoids the default banker's rounding, which sends an exact half-cent down to the nearest even digit. Consequence of flat interest: there is no early-repayment discount.
- The turnover gate lives in Wallets, not Banking: only Wallets sees every money movement, and modules cannot read each other's tables, so the grant is a request/approve/reject saga mirroring the funds-lock saga. The gate check and the credit are a single entity call (`Wallet.DisburseLoan`), hence atomic in one save.
- `LifetimeTurnover` counts economy credits only (`AddFunds`: shop sales, auction settlement, bot top-ups, pawnshop payouts) plus loan disbursements. Player transfers are excluded (an A to B to A loop would pump both counters for free) and so are starting funds (a fresh player starts at turnover 0, by the owner's example). Historical balances cannot be backfilled, so wallets existing before the migration also start at 0.
- The penalty is charged exactly once, guarded by `OverdueSince == null` rather than `Penalty > 0`: a small remainder legally rounds to a 0.00 penalty, and the amount-based guard would then re-charge (and move the date) on every later failed collection.
- `ApprovalTimeout` and `CollectionPendingTimeout` are validated `>= 10 min` because that is the dead-letter horizon: the outbox backoff is 20+40+80+160 s (about 5 minutes) per leg and a saga round trip has two legs. A timeout shorter than the horizon would let the keeper abort a collection whose reply is still coming, reopening the double-collection and free-principal races. Replies that arrive after the state moved on dead-letter visibly instead.
- Money locked under auction bids and warehouse-war fees is deliberately uncollectable (`CollectUpTo` sees only `AvailableFunds`), so a player can leverage a loan into a war; if the war is lost the loan goes `Overdue` with a penalty. That is intended pressure, not a bug.
- `Wallet.CollectUpTo` returns zero without touching `Version`: an empty collection changes nothing, so it must not generate an UPDATE that could trip a concurrent funds lock on the same wallet.

Accepted risks, recorded by the owner on 2026-10-15:

- Loan laundering through throwaway accounts stays possible: registration is free, so a player can borrow, transfer the principal to a second account and abandon the debt, and the turnover gate itself can be farmed by wash-trading auctions between own accounts (transfers are excluded from turnover, auction settlements are not). Accepted while the economy is played by bots at portfolio scale; the deferred mitigations are an account-age requirement, a transfer block while a loan is open and counterparty-weighted turnover.
- The bank ignores `IsSuspendedWallet` on disbursement and collection, consistent with every other credit path in Wallets.
- A dead outbox row revived by hand can replay a collection message after the keeper has already aborted that collection; the timeout math only covers messages that die on their own. Reviving dead letters is an operator action, not a game path.

## Related documents

- [README.md](README.md) - backend overview, running, configuration, tests.
- [messaging.md](messaging.md) - outbox, inbox, retry policy, the event registry.
- [wallets.md](wallets.md) - `LifetimeTurnover`, `DisburseLoan`, `CollectUpTo` and both Wallets-side handlers.
