# Moduł Wallets

> Wersja polska. Angielski odpowiednik 1:1: [../../en/backend/wallets.md](../../en/backend/wallets.md)

`AuctionServer.Modules.Wallets` trzyma wirtualne pieniądze: jeden portfel na użytkownika z saldem dostępnym, saldem zablokowanym i licznikiem skumulowanego obrotu, tworzony automatycznie przy rejestracji, obciążany i zasilany przez zdarzenia aukcji i sklepu, przenoszony między graczami przez przelewy z append-only historią, blokowany jako wpisowe wojen magazynowych, uznawany i obciążany przez sagi banku, obciążany za zakupy w lombardzie, zasilany wypłatami lombardu, wymieniany 1:1 na żetony kasyna i z powrotem oraz wystawiony przez cztery endpointy pod `/api/wallets`. Jego outbox odpowiada na zdarzenie innym zdarzeniem w sześciu sagach: blokady środków dla ofert, blokady wpisowego dla wojen magazynowych, udzielenia pożyczki, pobrania pożyczki, płatności lombardu i zakupu żetonów kasyna.

## Przegląd

| Obszar | Pliki |
|---|---|
| Endpointy | [`Presentation/WalletEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Wallets/Presentation/WalletEndpoints.cs), rekordy żądań `AddFundsRequest`, `TransferRequest` |
| Komendy i zapytania | `Application/Command/AddFunds/` i `Application/Command/TransferFunds/` (komenda, handler, walidator w każdym), `Application/Queries/GetWallet/` (zapytanie, handler, `WalletDto`), `Application/Queries/GetWalletTransfers/` (zapytanie, handler, `TransferDto`), `Application/Options/WalletsOptions.cs` |
| Handlery zdarzeń | `Application/Handlers/UserRegisteredEventHandler.cs`, `BidPlacedEventHandler.cs`, `AuctionFinishedEventHandler.cs`, `ItemSoldToShopEventHandler.cs`, `FundsLockRequestedEventHandler.cs`, `FundsUnlockRequestedEventHandler.cs`, `WarehouseEntryLockRequestedEventHandler.cs`, `WarehouseWonEventHandler.cs`, `LoanRequestedEventHandler.cs`, `LoanRepaymentRequestedEventHandler.cs`, `PawnshopPaymentRequestedEventHandler.cs`, `PawnshopPayoutEventHandler.cs`, `CasinoChipPurchaseRequestedEventHandler.cs`, `CasinoCashOutEventHandler.cs` |
| Domena | [`Domain/Entities/Wallet.cs`](../../../Backend/src/AuctionServer.Modules.Wallets/Domain/Entities/Wallet.cs), `Domain/Entities/Transfer.cs`, [`Domain/Exceptions/WalletExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Wallets/Domain/Exceptions/WalletExceptions.cs) |
| Infrastruktura | `Persistence/` (`WalletDbContext`, `WalletRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs` |

[`WalletModuleExtensions.AddWalletsModule`](../../../Backend/src/AuctionServer.Modules.Wallets/WalletModuleExtensions.cs) przyjmuje connection string i środki startowe, odrzuca niedodatnią kwotę przez `ArgumentOutOfRangeException`, rejestruje `WalletDbContext`, hosted service `OutboxProcessor`, singleton `WalletsOptions` oraz `IWalletRepository` jako scoped. Moduł jest CQS, a nie CQRS: odczyty używają nieśledzącego `GetUserWalletByIdAsyncReadOnly` (`AsNoTracking`), zapisy ładują śledzony portfel przez `GetUserWalletByIdAsync` i zapisują jedną z metod zapisu repozytorium.

## Uruchomienie

```bash
# z Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Wallets --startup-project src/AuctionServer.Api --context WalletDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Wallets --startup-project src/AuctionServer.Api --context WalletDbContext
dotnet test tests/AuctionServer.Modules.Wallets.Tests
```

Migracje leżą w [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Wallets/Infrastructure/Persistence/Migrations): `20260708083704_Initial_Wallets`, `20260815151947_Add_Wallets_Inbox`, `20260830054657_Add_Wallets_Outbox`, `20261014072728_Add_Wallets_Funds_Locks`, `20261014093258_Add_Wallets_Transfers` i `20261015104857_Add_Wallets_Turnover`. Projekt testowy zawiera jedyne testy współbieżności w rozwiązaniu (`WalletConcurrencyTests`: dwa konteksty zmieniają ten sam portfel i drugi zapis rzuca wyjątek) oraz smoke test API (`WalletApiSmokeTests`: `POST /funds` zwraca 200 dla tokenu `Bot` i 403 dla tokenu `User`).

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
| `LifetimeTurnover` | `numeric(18,2)` | suma wszystkich wpływów z gospodarki, jakie kiedykolwiek otrzymał (sprzedaże do sklepu, rozliczenia aukcji, doładowania botów, wypłaty pożyczek, wypłaty lombardu); przelewy, środki startowe i wypłaty z kasyna się nie liczą; nigdy nie maleje; bramkuje oferty banku i lokal lombardu oraz napędza poziomy graczy. Nie da się uzupełnić historii wstecz, portfele sprzed migracji startują od 0 |
| `RewardedLevel` | `integer` | najwyższy poziom już wypłacony, znacznik wysokiej wody podnoszony wyłącznie przez `AwardLevelRewards`; portfele sprzed migracji startują od 0 i nadrabiają przy pierwszym liczącym wpływie |
| `IsSuspendedWallet` | `boolean` | ustawiane tylko przez `SuspendAccount`, które nie ma wywołań; indeks unikalny na `UserId` jest filtrowany po `"IsSuspendedWallet" = false`, ale `UserId` jest też kluczem głównym, więc ten indeks nie dodaje żadnego ograniczenia |
| `Version` | `uuid` | token współbieżności, generowany na nowo przez każdą metodę pieniężną |

Moduł posiada też `WalletsFundsLocks`, księgę blokad per oferta (`Id`, `WalletUserId`, `PublicAuctionId`, `Amount`, `Status` z `Active = 0`, `Released = 1`, `Consumed = 2`; indeks unikalny na `WalletUserId, PublicAuctionId` filtrowany na `"Status" = 0` pilnuje jednej aktywnej blokady na aukcję w portfelu), `WalletsTransfers`, czyli append-only historię przelewów (`Id`, indeksowane `SenderUserId` i `RecipientUserId`, `Amount`, `SentOn`; zapisywaną w tej samej transakcji co dwie zmiany sald i celowo poza agregatem, bo żaden niezmiennik jej nie czyta, a wiersz należy do dwóch portfeli naraz), oraz `WalletsOutboxMessages` i `WalletsProcessedMessages`, opisane w [messaging.md](messaging.md). `Wallet` jest korzeniem agregatu: księga to kolekcja owned w EF, a każda blokada zmienia się wyłącznie przez metodę `Wallet`. Niezmienniki żyją w encji:

| Metoda | Reguła | Efekt |
|---|---|---|
| `AddFunds(amount)` | `amount > 0` | `AvailableFunds += amount`, `LifetimeTurnover += amount` (wpływ z gospodarki) |
| `ReceiveTransfer(amount)` | `amount > 0` | `AvailableFunds += amount`, obrót nietknięty; woła ją wyłącznie `TransferFundsCommandHandler` |
| `GrantStartingFunds(amount)` | `amount > 0` | `AvailableFunds += amount`, obrót nietknięty; woła ją wyłącznie `UserRegisteredEventHandler` |
| `ReceiveCasinoCashOut(amount)` | `amount > 0` | `AvailableFunds += amount`, obrót nietknięty; woła ją wyłącznie `CasinoCashOutEventHandler`, więc hedgowana gra w kasynie nie może farmić bramek obrotu |
| `DisburseLoan(principal, requiredTurnover)` | `LifetimeTurnover >= requiredTurnover`, potem reguły `Credit` | bramka obrotu i uznanie w jednym atomowym wywołaniu; wypłata wlicza się do obrotu |
| `PayForPawnshop(amount, requiredTurnover)` | `LifetimeTurnover >= requiredTurnover`, potem reguły `Withdraw` | bramka obrotu i obciążenie w jednym atomowym wywołaniu, wszystko albo nic, obrót nietknięty |
| `CollectUpTo(amount)` | `amount > 0` | obciąża o `min(AvailableFunds, amount)` i zwraca tę kwotę; zero jest legalnym wynikiem i nie rusza `Version`; zablokowane środki nigdy nie są pobierane |
| `Withdraw(amount)` | `amount > 0`, `AvailableFunds >= amount` | `AvailableFunds -= amount`; zablokowane środki nietknięte |
| `LockFunds(auctionId, amount)` | `amount > 0`, `AvailableFunds >= amount`, brak aktywnej blokady dla aukcji | dodaje `Active` `FundsLock` i przenosi `amount` z dostępnych do zablokowanych |
| `ReleaseLock(auctionId)` | istnieje aktywna blokada dla aukcji | oznacza ją `Released` i przenosi jej kwotę z powrotem do dostępnych |
| `ConsumeLock(auctionId)` | istnieje aktywna blokada dla aukcji | oznacza ją `Consumed`, zmniejsza `LockedFunds`; pieniądze opuszczają portfel; zwraca kwotę |
| `SpendLock(id, amount)` | `amount > 0`, istnieje aktywna blokada dla id, `amount <= lock.Amount` | oznacza blokadę `Consumed`, zmniejsza `LockedFunds` o całą blokadę, resztę (`lock.Amount - amount`) oddaje do `AvailableFunds`; wydana kwota opuszcza obieg |
| `SuspendAccount()`, `UnsuspendAccount()` | — | przełączają `IsSuspendedWallet`; brak wywołań w `src/` |

Poziomy graczy żyją tam, gdzie żyje obrót. [`PlayerLevels`](../../../Backend/src/AuctionServer.Modules.Wallets/Domain/PlayerLevels.cs) trzyma stałe: poziom `n` wymaga `1000 * n^2` życiowego obrotu i płaci `10 * n^2`, a `MaxRewardedLevel = 100` ogranicza drabinę, więc pełna wspinaczka przy 10 000 000 obrotu płaci dokładnie 3 383 500. Licząca gałąź prywatnego `Credit` woła `AwardLevelRewards`, całkowitoliczbową pętlę, która podnosi `RewardedLevel` dopóki kolejny próg jest osiągnięty, i dodaje zsumowane nagrody wprost do `AvailableFunds`, nigdy przez `Credit`, więc nagroda nie może karmić obrotu, który ją wypłaca. Przekroczone poziomy stają się jednym scalonym rekordem `LevelUp(FromLevel, ToLevel, Reward)` na niemapowanej liście, a nadpisane `WalletDbContext.SaveChangesAsync` drenuje tę listę z każdego śledzonego portfela do wierszy outboxa `PlayerLevelledUpEvent` (jeden świeży `Guid` jako `Id` wiersza i `EventId` naraz) przed zapisem bazowym, więc pieniądze, znacznik poziomu i zdarzenie commitują się razem, którakolwiek z pięciu ścieżek wpływu je wywołała.

| Wyjątek | Status | Komunikat |
|---|---|---|
| `InvalidAmountException` | 400 | `Amount must be greater than zero` |
| `InsufficientFundsException` | 400 | `Not enough funds on account` |
| `LockNotFoundException` | 404 | `No active funds lock for auction {id}` |
| `LockAlreadyExistsException` | 409 | `Funds lock for this auction already exists` |
| `UserWithThisIdDontHaveWallet` | 404 | `User with this ID {id} doesnt exists` |
| `WalletAlreadyExistException` | 409 | `Wallet already exists` |
| `InsufficientTurnoverException` | 409 | `Lifetime turnover {current} is below the required {required}`; jej komunikat staje się powodem odrzucenia pożyczki albo płatności lombardu |
| `EventAlreadyProcessedException` | 409 | `Event was already processed`; rzucany przez repozytorium i łapany przez handlery zdarzeń |

## API

| Metoda i trasa | Auth | Żądanie | Odpowiedź | Handler |
|---|---|---|---|---|
| `GET /api/wallets/{id}` | JWT, tylko właściciel | `id` to `PublicUserId` użytkownika i musi równać się claimowi `NameIdentifier` wołającego | 200 `{ availableFunds, lockedFunds, lifetimeTurnover }` (`WalletDto`), 401 bez tokenu, 403 dla cudzego portfela, 404 gdy portfel nie istnieje; obrót pozwala klientowi porównać się z progami ofert banku i lokalu lombardu | `GetWalletQueryHandler` |
| `GET /api/wallets/{id}/transfers` | JWT, tylko właściciel | `id` musi równać się claimowi `NameIdentifier` wołającego | 200 z listą `TransferDto` (`senderUserId`, `recipientUserId`, `amount`, `sentOn`), najnowsze najpierw; 401, 403 i 404 jak wyżej | `GetWalletTransfersQueryHandler` |
| `POST /api/wallets/funds` | JWT z polityką `Bot` | `{ amount }`, większe od zera | 200 z pustym ciałem; zasila własny portfel wołającego | `AddFundsCommandHandler` |
| `POST /api/wallets/transfers` | JWT | `{ recipientUserId, amount }`; nadawcą jest wołający | 200 z pustym ciałem; 400 dla niedodatniej kwoty, przelewu do siebie lub braku środków, 404 dla odbiorcy bez portfela | `TransferFundsCommandHandler` |

`AddFundsCommandHandler` bierze id portfela z claimu `NameIdentifier`, woła `AddFunds` i zapisuje z `CancellationToken.None`. `TransferFundsCommandHandler` ładuje oba śledzone portfele (404 dla nieznanego odbiorcy), woła `Withdraw` na nadawcy i `ReceiveTransfer` na odbiorcy (przelew nie buduje obrotu) i zapisuje je razem z wierszem historii `Transfer` w jednym `SaveChangesAsync`; przelew do siebie nigdy nie dociera do handlera, bo odrzuca go walidator. Każda inna zmiana salda pochodzi ze zdarzenia.

## Zdarzenia

| Kierunek | Zdarzenie | Handler i efekt |
|---|---|---|
| konsumowane | `UserRegisteredEvent` | `UserRegisteredEventHandler` tworzy `Wallet { UserId = PublicUserId }`, woła `GrantStartingFunds(StartingFunds)` (bez obrotu) i zapisuje przez `AddWalletAsync`; naruszenie unikalności staje się `WalletAlreadyExistException`, który jest połykany, więc dla tego zdarzenia nie ma wiersza inboxa |
| konsumowane | `FundsLockRequestedEvent` | `FundsLockRequestedEventHandler` woła `LockFunds(PublicAuctionId, Amount)` i odpowiada z outboxa `FundsLockedEvent` albo `FundsLockRejectedEvent` przy braku środków lub zduplikowanej blokadzie; jeden `SaveUserFundsWithInboxAndOutboxAsync` |
| konsumowane | `BidPlacedEvent` | potwierdzenie oferty z Auctions; `BidPlacedEventHandler` zwalnia blokadę poprzedniego lidera (`ReleaseLock(PublicAuctionId)`), gdy `PreviousWinningUserId` jest ustawione; jeden `SaveUserFundsWithInboxAsync` |
| konsumowane | `FundsUnlockRequestedEvent` | `FundsUnlockRequestedEventHandler` zwalnia blokadę potwierdzoną za późno; brak blokady to poprawny wynik; jeden `SaveUserFundsWithInboxAsync` |
| konsumowane | `AuctionFinishedEvent` | `AuctionFinishedEventHandler` kończy, gdy `WinnerUserId` lub `FinalPrice` jest null; w przeciwnym razie `winner.ConsumeLock(PublicAuctionId)`, `seller.AddFunds` ze skonsumowaną kwotą i wiersz outboxa `AuctionSettledEvent` w jednym `SaveUserFundsWithInboxAndOutboxAsync` |
| konsumowane | `ItemSoldToShopEvent` | `ItemSoldToShopEventHandler` woła `AddFunds(Price)` na portfelu właściciela; `SaveUserFundsWithInboxAsync` |
| publikowane | `AuctionSettledEvent` | zapisywane przez `AuctionFinishedEventHandler`; konsumowane przez Inventory, które przenosi przedmiot |
| publikowane | `FundsLockedEvent`, `FundsLockRejectedEvent` | zapisywane przez `FundsLockRequestedEventHandler`; konsumowane przez Auctions, które potwierdza albo odrzuca ofertę oczekującą |
| konsumowane | `WarehouseEntryLockRequestedEvent` | `WarehouseEntryLockRequestedEventHandler` blokuje wpisowe tą samą księgą `LockFunds` (id magazynu trafia do kolumny `PublicAuctionId`) i odpowiada `WarehouseEntryLockedEvent` albo `WarehouseEntryLockRejectedEvent`; jedno `SaveUserFundsWithInboxAndOutboxAsync` |
| konsumowane | `WarehouseWonEvent` | `WarehouseWonEventHandler` woła `SpendLock(PublicWarehouseId, FinalPrice)` na portfelu zwycięzcy: cena znika (zlew pieniędzy), reszta wpisowego wraca do dostępnych; jedno `SaveUserFundsWithInboxAsync` |
| publikowane | `WarehouseEntryLockedEvent`, `WarehouseEntryLockRejectedEvent` | zapisywane przez `WarehouseEntryLockRequestedEventHandler`; konsumowane przez Warehouses, które potwierdza albo usuwa uczestnika |
| konsumowane | `LoanRequestedEvent` | `LoanRequestedEventHandler` woła `DisburseLoan(Principal, RequiredTurnover)` i odpowiada `LoanApprovedEvent` albo `LoanRejectedEvent` z komunikatem `InsufficientTurnoverException`; jedno `SaveUserFundsWithInboxAndOutboxAsync` |
| konsumowane | `LoanRepaymentRequestedEvent` | `LoanRepaymentRequestedEventHandler` woła `CollectUpTo(Amount)` i zawsze odpowiada `LoanRepaymentCollectedEvent(AmountCollected)`, nawet dla zera; jedno `SaveUserFundsWithInboxAndOutboxAsync` |
| publikowane | `LoanApprovedEvent`, `LoanRejectedEvent` | zapisywane przez `LoanRequestedEventHandler`; konsumowane przez Banking, które aktywuje albo odrzuca pożyczkę |
| publikowane | `LoanRepaymentCollectedEvent` | zapisywane przez `LoanRepaymentRequestedEventHandler`; konsumowane przez Banking, które stosuje pobranie |
| konsumowane | `PawnshopPaymentRequestedEvent` | `PawnshopPaymentRequestedEventHandler` woła `PayForPawnshop(Amount, RequiredTurnover)` i odpowiada `PawnshopPaymentCompletedEvent` albo `PawnshopPaymentRejectedEvent` z komunikatem `InsufficientTurnoverException` lub `InsufficientFundsException`, wszystko w jednym `SaveUserFundsWithInboxAndOutboxAsync` |
| konsumowane | `PawnshopPayoutEvent` | `PawnshopPayoutEventHandler` woła `AddFunds(Amount)` na portfelu właściciela, więc wypłaty budują obrót, zapisywane w jednym `SaveUserFundsWithInboxAsync` |
| publikowane | `PawnshopPaymentCompletedEvent`, `PawnshopPaymentRejectedEvent` | zapisywane przez `PawnshopPaymentRequestedEventHandler` i konsumowane przez Pawnshop, które aktywuje lokal, instaluje bota albo odrzuca płatność |
| konsumowane | `CasinoChipPurchaseRequestedEvent` | `CasinoChipPurchaseRequestedEventHandler` obciąża przez `Withdraw(Amount)` (bez bramki obrotu) i odpowiada `CasinoChipPurchaseCompletedEvent` albo `CasinoChipPurchaseRejectedEvent` z komunikatem `InsufficientFundsException`, wszystko w jednym `SaveUserFundsWithInboxAndOutboxAsync` |
| konsumowane | `CasinoCashOutEvent` | `CasinoCashOutEventHandler` woła `ReceiveCasinoCashOut(Amount)`, więc wypłaty z kasyna nigdy nie budują obrotu; jedno `SaveUserFundsWithInboxAsync` |
| publikowane | `CasinoChipPurchaseCompletedEvent`, `CasinoChipPurchaseRejectedEvent` | zapisywane przez `CasinoChipPurchaseRequestedEventHandler` i konsumowane przez Casino, które uznaje żetony albo odrzuca zakup |
| publikowane | `PlayerLevelledUpEvent` | zapisywane przez nadpisane `WalletDbContext.SaveChangesAsync`, które drenuje oczekujące awanse każdego śledzonego portfela przed zapisem bazowym; konsumowane przez Profiles, które odbija poziom |

Boty są rejestrowane przez to samo `UserRegisteredEvent`, więc portfel bota też startuje ze `StartingFunds`; zdarzenie nie niesie roli.

## Decyzje

- Salda nigdy nie mogą zejść poniżej zera, bo każda reguła jest sprawdzana wewnątrz `Wallet`, zanim pole się zmieni; handlery i repozytorium nie dodają własnej arytmetyki.
- `Version` to token współbieżności generowany na nowo przy każdej metodzie pieniężnej, więc dwie równoległe zmiany jednego portfela kończą się jednym `DbUpdateConcurrencyException`; testy współbieżności przypinają to zachowanie.
- Wszystkie zapisy pieniężne przekazują `CancellationToken.None` do `SaveChangesAsync`, więc klient, który rozłączy się w trakcie żądania, nie zostawi zmiany zastosowanej w połowie.
- Odczyty i zapisy używają EF Core (CQS); ścieżka odczytu Dapperem istnieje tylko w Auctions.
- Środki są blokowane, zanim oferta zacznie prowadzić: każda blokada to wiersz `FundsLock` powiązany z jedną aukcją, `LockedFunds` zawsze równa się sumie aktywnych blokad, a zwolnienie i rozliczenie biorą kwotę z księgi, więc błędne zdarzenie nie przeniesie złej kwoty.
- Przelew to jedna lokalna transakcja wewnątrz modułu (dwa śledzone portfele plus wiersz historii w jednym zapisie) i nie publikuje zdarzenia integracyjnego, bo żaden inny moduł na niego nie reaguje; historia jest append-only, a przelew wydaje wyłącznie `AvailableFunds`, nigdy pieniądze zablokowane.
- Księga `FundsLock` jest celowo generyczna: jej kluczem jest dowolny `Guid`, więc wpisowe magazynów reużywa te same wiersze, to samo zdarzenie zwrotu i te same niezmienniki co oferty aukcyjne, a `SpendLock` to jedyna metoda, która niszczy pieniądze zamiast je przenosić.
- Każdy wpływ przechodzi przez prywatny helper `Credit(amount, countsTowardTurnover)`, jedyne miejsce, w którym `LifetimeTurnover` może rosnąć. Cztery publiczne metody uznania niosą intencję w nazwach (`AddFunds` liczy, `ReceiveTransfer`, `GrantStartingFunds` i `ReceiveCasinoCashOut` nie), zamiast wystawiać boolean w miejscach wywołania. Obciążenia, zwolnienia blokad i reszta ze `SpendLock` nigdy nie dotykają licznika, bo obrót mierzy otrzymane pieniądze, a nie pieniądze przesuwane w kółko.
- `ReceiveCasinoCashOut` celowo nie buduje obrotu: gracz stawiający w ruletce jednocześnie na czerwone i czarne traci średnio tylko 1/37 obrotu, więc wypłaty liczone do obrotu sprzedawałyby bramkę 1M lombardu za około 28 tysięcy. Własny pieniądz gracza tylko wraca z żetonów, jak przy przelewie.
- `CollectUpTo` działa z założenia w trybie best effort: bank musi zawsze dostać odpowiedź, nawet "pobrano zero", inaczej saga pożyczki utknęłaby w `CollectionPending`. Zerowe pobranie niczego nie zmienia, więc nie generuje na nowo `Version` i nie może przewrócić równoległej blokady środków.
- Progi i nagrody poziomów to stałe domeny w `PlayerLevels`, jak tabele wypłat kasyna: żadna wartość konfiguracji nie zmieni, ile płaci poziom. Nagrody celowo omijają `Credit`, więc kran nie może karmić własnej bramki, a drenaż siedzi w `SaveChangesAsync` zamiast w pięciu miejscach wywołań wpływów, jedno przewężenie zamiast pięciu handlerów do synchronizacji.
- `PayForPawnshop` jest lustrem `DisburseLoan`. Bramka obrotu i obciążenie to jedno wywołanie, więc odrzucony zakup niczego nie zmienia. Obciążenie idzie przez `Withdraw`, które nigdy nie dotyka `LifetimeTurnover`, więc wydatki w lombardzie nie mogą zniekształcić bramki. Wypłaty przychodzą przez `AddFunds` jak każdy inny wpływ z gospodarki, więc wliczają się do obrotu.

## Powiązane dokumenty

- [README.md](README.md) - przegląd backendu, uruchomienie, konfiguracja, testy.
- [messaging.md](messaging.md) - outbox, inbox, polityka ponowień.
- [auctions.md](auctions.md) - skąd pochodzą `BidPlacedEvent` i `AuctionFinishedEvent`.
- [inventory.md](inventory.md) - sprzedaż do sklepu i transfer przedmiotu po rozliczeniu.
- [identity.md](identity.md) - rejestracja, która tworzy portfel.
- [banking.md](banking.md) - oferty pożyczek, bramka obrotu i obie sagi banku.
- [pawnshop.md](pawnshop.md) - płatności za lokal i boty oraz wypłaty, które rozlicza Wallets.
- [casino.md](casino.md) - zakupy żetonów i wypłaty, które rozlicza Wallets.
