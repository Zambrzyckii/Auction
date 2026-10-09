# Moduł Wallets

> Wersja polska. Angielski odpowiednik 1:1: [../../en/backend/wallets.md](../../en/backend/wallets.md)

`AuctionServer.Modules.Wallets` trzyma wirtualne pieniądze: jeden portfel na użytkownika z saldem dostępnym i zablokowanym, tworzony automatycznie przy rejestracji, obciążany i zasilany przez zdarzenia aukcji i sklepu oraz wystawiony przez dwa endpointy pod `/api/wallets`. To jedyny moduł, który ma zarówno inbox, jak i outbox odpowiadający na zdarzenie innym zdarzeniem.

## Przegląd

| Obszar | Pliki |
|---|---|
| Endpointy | [`Presentation/WalletEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Wallets/Presentation/WalletEndpoints.cs), rekord żądania `AddFundsRequest` |
| Komendy i zapytania | `Application/Command/AddFunds/` (komenda, handler, walidator), `Application/Queries/GetWallet/` (zapytanie, handler, `WalletDto`), `Application/WalletsOptions.cs` |
| Handlery zdarzeń | `Application/Handlers/UserRegisteredEventHandler.cs`, `BidPlacedEventHandler.cs`, `AuctionFinishedEventHandler.cs`, `ItemSoldToShopEventHandler.cs` |
| Domena | [`Domain/Entities/Wallet.cs`](../../../Backend/src/AuctionServer.Modules.Wallets/Domain/Entities/Wallet.cs), [`Domain/Exceptions/WalletExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Wallets/Domain/Exceptions/WalletExceptions.cs) |
| Infrastruktura | `Persistence/` (`WalletDbContext`, `WalletRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs` |

[`WalletModuleExtensions.AddWalletsModule`](../../../Backend/src/AuctionServer.Modules.Wallets/WalletModuleExtensions.cs) przyjmuje connection string i środki startowe, odrzuca niedodatnią kwotę przez `ArgumentOutOfRangeException`, rejestruje `WalletDbContext`, hosted service `OutboxProcessor`, singleton `WalletsOptions` oraz `IWalletRepository` jako scoped. Moduł jest CQS, a nie CQRS: odczyty używają nieśledzącego `GetUserWalletByIdAsyncReadOnly` (`AsNoTracking`), zapisy ładują śledzony portfel przez `GetUserWalletByIdAsync` i zapisują jedną z metod zapisu repozytorium.

## Uruchomienie

```bash
# z Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Wallets --startup-project src/AuctionServer.Api --context WalletDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Wallets --startup-project src/AuctionServer.Api --context WalletDbContext
dotnet test tests/AuctionServer.Modules.Wallets.Tests
```

Migracje leżą w [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Wallets/Infrastructure/Persistence/Migrations): `20260708083704_Initial_Wallets`, `20260815151947_Add_Wallets_Inbox` i `20260830054657_Add_Wallets_Outbox`. Projekt testowy zawiera jedyne testy współbieżności w rozwiązaniu (`WalletConcurrencyTests`: dwa konteksty zmieniają ten sam portfel i drugi zapis rzuca wyjątek) oraz smoke test API (`WalletApiSmokeTests`: `POST /funds` zwraca 200 dla tokenu `Bot` i 403 dla tokenu `User`).

## Konfiguracja

| Klucz | Domyślnie | Efekt |
|---|---|---|
| `Wallets:StartingFunds` | `300` (`appsettings.json`) | czytany przez host na starcie i przekazywany do `AddWalletsModule`, które zapisuje go w `WalletsOptions(StartingFunds)`; `UserRegisteredEventHandler` dopisuje go do każdego nowego portfela |

Brak wartości zatrzymuje host (`Missing configuration value 'Wallets:StartingFunds'`); wartość zero lub mniejsza zawodzi w `AddWalletsModule`.

## Model danych

| Kolumna | Typ | Uwagi |
|---|---|---|
| `UserId` | `uuid` | klucz główny; równy `PublicUserId` z Identity z `UserRegisteredEvent` |
| `AvailableFunds` | `numeric(18,2)` | pieniądze, którymi użytkownik może licytować |
| `LockedFunds` | `numeric(18,2)` | pieniądze zatrzymane na aukcje, w których użytkownik aktualnie prowadzi |
| `IsSuspendedWallet` | `boolean` | ustawiane tylko przez `SuspendAccount`, które nie ma wywołań; indeks unikalny na `UserId` jest filtrowany po `"IsSuspendedWallet" = false`, ale `UserId` jest też kluczem głównym, więc ten indeks nie dodaje żadnego ograniczenia |
| `Version` | `uuid` | token współbieżności, generowany na nowo przez każdą metodę pieniężną |

Moduł posiada też `WalletsOutboxMessages` i `WalletsProcessedMessages`, opisane w [messaging.md](messaging.md). Niezmienniki żyją w encji:

| Metoda | Reguła | Efekt |
|---|---|---|
| `AddFunds(amount)` | `amount > 0` | `AvailableFunds += amount` |
| `LockFunds(amount)` | `amount > 0`, `AvailableFunds >= amount` | przenosi `amount` z dostępnych do zablokowanych |
| `UnlockFunds(amount)` | `amount > 0`, `LockedFunds >= amount` | przenosi `amount` z zablokowanych z powrotem do dostępnych |
| `SpendLockedFunds(amount)` | `amount > 0`, `LockedFunds >= amount` | `LockedFunds -= amount`; pieniądze opuszczają portfel |
| `SuspendAccount()`, `UnsuspendAccount()` | — | przełączają `IsSuspendedWallet`; brak wywołań w `src/` |

| Wyjątek | Status | Komunikat |
|---|---|---|
| `InvalidAmountException` | 400 | `Amount must be greater than zero` |
| `InsufficientFundsException` | 400 | `Not enough funds on account` |
| `InsufficientLockedFundsException` | 400 | `Not enough locked funds on account` |
| `UserWithThisIdDontHaveWallet` | 404 | `User with this ID {id} doesnt exists` |
| `WalletAlreadyExistException` | 409 | `Wallet already exists` |
| `EventAlreadyProcessedException` | 409 | `Event was already processed`; rzucany przez repozytorium i łapany przez handlery zdarzeń |

## API

| Metoda i trasa | Auth | Żądanie | Odpowiedź | Handler |
|---|---|---|---|---|
| `GET /api/wallets/{id}` | anonimowy | `id` to `PublicUserId` użytkownika | 200 `{ availableFunds, lockedFunds }` (`WalletDto`), 404 gdy portfel nie istnieje | `GetWalletQueryHandler` |
| `POST /api/wallets/funds` | JWT z polityką `Bot` | `{ amount }`, większe od zera | 200 z pustym ciałem; zasila własny portfel wołającego | `AddFundsCommandHandler` |

`AddFundsCommandHandler` bierze id portfela z claimu `NameIdentifier`, woła `AddFunds` i zapisuje z `CancellationToken.None`. Nie ma endpointu przenoszącego pieniądze między użytkownikami; każda inna zmiana salda pochodzi ze zdarzenia.

## Zdarzenia

| Kierunek | Zdarzenie | Handler i efekt |
|---|---|---|
| konsumowane | `UserRegisteredEvent` | `UserRegisteredEventHandler` tworzy `Wallet { UserId = PublicUserId }`, woła `AddFunds(StartingFunds)` i zapisuje przez `AddWalletAsync`; naruszenie unikalności staje się `WalletAlreadyExistException`, który jest połykany, więc dla tego zdarzenia nie ma wiersza inboxa |
| konsumowane | `BidPlacedEvent` | `BidPlacedEventHandler` blokuje `NewPrice` na portfelu nowego zwycięzcy i, gdy `PreviousWinningUserId` i `PreviousPrice` są ustawione, odblokowuje `PreviousPrice` na portfelu poprzedniego zwycięzcy; jeden `SaveUserFundsWithInboxAsync` |
| konsumowane | `AuctionFinishedEvent` | `AuctionFinishedEventHandler` kończy, gdy `WinnerUserId` lub `FinalPrice` jest null; w przeciwnym razie `winner.SpendLockedFunds(FinalPrice)`, `seller.AddFunds(FinalPrice)` i wiersz outboxa `AuctionSettledEvent` w jednym `SaveUserFundsWithInboxAndOutboxAsync` |
| konsumowane | `ItemSoldToShopEvent` | `ItemSoldToShopEventHandler` woła `AddFunds(Price)` na portfelu właściciela; `SaveUserFundsWithInboxAsync` |
| publikowane | `AuctionSettledEvent` | zapisywane przez `AuctionFinishedEventHandler`; konsumowane przez Inventory, które przenosi przedmiot |

Boty są rejestrowane przez to samo `UserRegisteredEvent`, więc portfel bota też startuje ze `StartingFunds`; zdarzenie nie niesie roli.

## Decyzje

- Salda nigdy nie mogą zejść poniżej zera, bo każda reguła jest sprawdzana wewnątrz `Wallet`, zanim pole się zmieni; handlery i repozytorium nie dodają własnej arytmetyki.
- `Version` to token współbieżności generowany na nowo przy każdej metodzie pieniężnej, więc dwie równoległe zmiany jednego portfela kończą się jednym `DbUpdateConcurrencyException`; testy współbieżności przypinają to zachowanie.
- Wszystkie zapisy pieniężne przekazują `CancellationToken.None` do `SaveChangesAsync`, więc klient, który rozłączy się w trakcie żądania, nie zostawi zmiany zastosowanej w połowie.
- Odczyty i zapisy używają EF Core (CQS); ścieżka odczytu Dapperem istnieje tylko w Auctions.
- Środki są blokowane po przyjęciu oferty, a `LockedFunds` to jedna zagregowana liczba bez powiązania z ofertą, dlatego oferta bez pokrycia zostawia pieniądze poprzedniego lidera zablokowane; rezerwacja per oferta jest planowana, zobacz [../VISION.md](../VISION.md).

## Powiązane dokumenty

- [README.md](README.md) - przegląd backendu, uruchomienie, konfiguracja, testy.
- [messaging.md](messaging.md) - outbox, inbox, polityka ponowień.
- [auctions.md](auctions.md) - skąd pochodzą `BidPlacedEvent` i `AuctionFinishedEvent`.
- [inventory.md](inventory.md) - sprzedaż do sklepu i transfer przedmiotu po rozliczeniu.
- [identity.md](identity.md) - rejestracja, która tworzy portfel.
