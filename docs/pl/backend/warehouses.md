# Moduł Warehouses

> Wersja polska. Angielski odpowiednik 1:1: [../../en/backend/warehouses.md](../../en/backend/warehouses.md)

`AuctionServer.Modules.Warehouses` prowadzi wojny magazynowe: utrzymywaną przez serwer pulę magazynów z ukrytą zawartością, lobby o ograniczonym składzie (3-5 graczy), wpisowe będące zarazem budżetem podbić, szybkie okna podbić liczone w sekundach i odsłonięcie manifestu dopiero po rozliczeniu. Gracze nigdy nie widzą prawdziwej wartości, tylko celowo zwodnicze widełki. Zwycięzca płaci cenę końcową w nicość (zlew pieniędzy), przegrani odzyskują wpisowe, a przedmioty są mintowane w Inventory w cenach wylosowanych podczas wyceny. Pięć endpointów żyje pod `/api/warehouses`, wszystkie za JWT.

## Przegląd

| Obszar | Pliki |
|---|---|
| Endpointy | [`Presentation/WarehouseEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Presentation/WarehouseEndpoints.cs), rekord żądania `PlaceWarehouseBidRequest` |
| Komendy i zapytania | `Application/Command/JoinWarehouseWar/`, `Application/Command/LeaveWarehouseWar/` i `Application/Command/PlaceWarehouseBid/` (komenda, handler, walidator w każdym), `Application/Queries/GetWarehouses/` (zapytanie, handler, `WarehouseSummaryDto`), `Application/Queries/GetWarehouseById/` (zapytanie, handler, `WarehouseDetailsDto`, `ManifestItemDto`) |
| Opcje i estymaty | `Application/Options/` (`WarehousesOptions`, `WarehouseTierDefinition`, `RarityWeight`, `EstimateVariant`), [`Application/Estimates/EstimateGenerator.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Application/Estimates/EstimateGenerator.cs) |
| Handlery zdarzeń | `Application/Handlers/WarehouseStockedEventHandler.cs`, `WarehouseEntryLockedEventHandler.cs`, `WarehouseEntryLockRejectedEventHandler.cs` |
| Domena | [`Domain/Entities/WarehouseWar.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Domain/Entities/WarehouseWar.cs), `Domain/Entities/WarehouseParticipant.cs`, `Domain/Entities/StockItem.cs`, `Domain/Enums/` (`WarehouseWarStatus`, `ParticipantState`), [`Domain/Exceptions/WarehouseExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Domain/Exceptions/WarehouseExceptions.cs) |
| Infrastruktura | `Persistence/` (`WarehouseDbContext`, `WarehouseRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs`, [`Background/WarehouseKeeper.cs`](../../../Backend/src/AuctionServer.Modules.Warehouses/Infrastructure/Background/WarehouseKeeper.cs) |

[`WarehouseModuleExtensions.AddWarehousesModule`](../../../Backend/src/AuctionServer.Modules.Warehouses/WarehouseModuleExtensions.cs) przyjmuje connection string i instancję `WarehousesOptions` i waliduje ją na starcie: `PoolSize > 0`, `MinPlayers >= 2`, `MaxPlayers >= MinPlayers`, co najmniej jeden tier i jeden wariant estymaty, dodatnie wpisowe, podbicia i wagi oraz wyłącznie znane rzadkości (`Common`, `Rare`, `Epic`, `Legendary`). Rejestruje `WarehouseDbContext`, hosted services `OutboxProcessor` i `WarehouseKeeper`, singleton opcji oraz `IWarehouseRepository` jako scoped. Jak Wallets moduł czyta i pisze przez EF Core (bez Dappera): zapytania używają nieśledzących metod repozytorium, zapisy ładują śledzoną wojnę.

## Uruchomienie

```bash
# z Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Warehouses --startup-project src/AuctionServer.Api --context WarehouseDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Warehouses --startup-project src/AuctionServer.Api --context WarehouseDbContext
dotnet test tests/AuctionServer.Modules.Warehouses.Tests
```

Migracje żyją w [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Warehouses/Infrastructure/Persistence/Migrations): `20261014171153_Initial_Warehouses` i `20261014191955_Add_Warehouses_Lobby`.

## Konfiguracja

Cała sekcja `Warehouses` z `appsettings.json` binduje się do `WarehousesOptions`; brak sekcji zatrzymuje hosta.

| Klucz | Domyślnie | Efekt |
|---|---|---|
| `Warehouses:PoolSize` | `3` | ile wojen w stanie `Stocking` lub `Open` keeper utrzymuje naraz |
| `Warehouses:MinPlayers` | `3` | liczba potwierdzonych graczy potrzebna do startu odliczania |
| `Warehouses:MaxPlayers` | `5` | pojemność lobby; komplet startuje licytację natychmiast |
| `Warehouses:JoinCountdown` | `00:00:30` | czas od osiągnięcia minimum do startu licytacji |
| `Warehouses:RaiseWindow` | `00:00:10` | czas otwarcia bieżącego podbicia; każde podbicie go resetuje |
| `Warehouses:LobbyTimeout` | `00:10:00` | po tym czasie lobby bez zaplanowanego odliczania (i wojna utknięta w `Stocking`) jest anulowane ze zwrotami |
| `Warehouses:Tiers` | `Small` (3-5 przedmiotów, wpisowe 500, podbicia 10/50/100), `Medium` (4-7, 2500, 50/100/250/500), `Large` (5-10, 15000, 100/250/500/1000) | publiczne parametry wojny: zakres liczby przedmiotów, wagi rzadkości, wpisowe i dozwolone podbicia |
| `Warehouses:EstimateVariants` | waga 30: 0.3-0.7x, waga 40: 0.8-1.2x, waga 30: 1.3-2.5x | tabela zwodzenia: na wojnę losowany jest jeden wariant, który skaluje prawdziwą wartość do publicznych widełek |

## Model danych

`WarehousesWars`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `Id` | `integer` | klucz główny, identity |
| `PublicWarehouseId` | `uuid` | unikalny identyfikator publiczny, używany w trasach i zdarzeniach |
| `Tier` | `text(32)` | nazwa tieru, z którego wylosowano wojnę |
| `Status` | `integer` | `Stocking = 0`, `Open = 1`, `Bidding = 2`, `Settled = 3`, `Cancelled = 4` |
| `TotalValue` | `numeric(18,2)` | prawdziwa wartość manifestu; nigdy nie opuszcza serwera, żadne DTO jej nie wystawia |
| `EstimateMin`, `EstimateMax` | `numeric(18,2)` | publiczne, celowo zwodnicze widełki |
| `EntryFee` | `numeric(18,2)` | kopiowane z tieru; zarazem budżet podbić gracza |
| `CurrentPrice` | `numeric(18,2)` | startuje z 0, rośnie o podbicia |
| `CurrentLeaderId` | `uuid?` | gracz, który podbił ostatni; po rozliczeniu zwycięzca |
| `BiddingStartsOn` | `timestamp?` | ustawione = odliczanie zaplanowane; w przeszłości = skład zamrożony |
| `BiddingEndsOn` | `timestamp?` | okno podbić; resetowane każdym podbiciem |
| `CancellationReason` | `text?` | ustawiane przez `Cancel`, np. `No bids placed`, `Lobby timed out` |
| `CreatedOn` | `timestamp` | używane przez timeout lobby |
| `Version` | `uuid` | token współbieżności odnawiany każdą metodą mutującą; przegrany wyścig podbić kończy się 409 |

Moduł posiada też `WarehousesParticipants`, kolekcję owned agregatu `WarehouseWar` (`Id`, FK `WarehouseWarId` z kasowaniem kaskadowym, `UserId`, `State` z `PendingLock = 0`, `Active = 1`; unikalny indeks na `WarehouseWarId, UserId`) - inaczej niż `AuctionsBids` uczestnicy biorą udział w niezmiennikach (pojemność, kto może podbijać), więc żyją wewnątrz agregatu i mutują wyłącznie jego metodami. `WarehousesStockItems` (`Id`, indeksowane `PublicWarehouseId`, `Name(100)`, `Rarity(16)`, `Price`) stoi poza agregatem jak `Bid`: nic się o nią nie waliduje, to ukryty manifest zapisywany raz po wycenie. `WarehousesOutboxMessages` i `WarehousesProcessedMessages` opisuje [messaging.md](messaging.md).

| Metoda | Reguła | Efekt |
|---|---|---|
| `Create(tier, entryFee)` | `entryFee > 0` | nowa wojna w `Stocking` |
| `OpenLobby(totalValue, min, max)` | status `Stocking`; `totalValue > 0`, `0 < min <= max` | zapisuje wartość i widełki, otwiera lobby |
| `Join(userId, maxPlayers)` | status `Open`, odliczanie nieskończone, nie jest jeszcze uczestnikiem, poniżej pojemności | dodaje uczestnika `PendingLock`; miejsce jest zarezerwowane zanim wpisowe się potwierdzi |
| `Leave(userId)` | status `Open`, odliczanie nieskończone, jest uczestnikiem | usuwa uczestnika |
| `ConfirmParticipant(userId, min, max, countdown)` | status `Open`, jest uczestnikiem | aktywuje uczestnika; przy `minPlayers` aktywnych ustawia raz `BiddingStartsOn = now + countdown`, przy `maxPlayers` nadpisuje na `now` |
| `RemoveParticipant(userId)` | jest uczestnikiem | zwalnia miejsce po odrzuconej blokadzie wpisowego |
| `StartBidding(minPlayers, raiseWindow)` | status `Open`, odliczanie zaplanowane, dość aktywnych graczy | `Bidding` plus pierwsze okno podbić |
| `Raise(userId, increment, allowedIncrements, raiseWindow)` | status `Bidding`, okno otwarte, wołający aktywny, nie prowadzi, increment ze zbioru tieru, `CurrentPrice + increment <= EntryFee` | nowy lider, wyższa cena, świeże okno |
| `Settle()` | status `Bidding`, istnieje lider | `Settled` |
| `Cancel(reason)` | nie `Settled` ani `Cancelled` | `Cancelled` plus powód |

| Wyjątek | Status |
|---|---|
| `WarehouseNotFoundException` | 404 |
| `ParticipantNotFoundException` | 404 |
| `InvalidEntryFeeException`, `InvalidEstimateException`, `InvalidIncrementException`, `BudgetExceededException` | 400 |
| `WarNotStockingException`, `WarNotOpenException`, `WarNotBiddingException`, `JoinCountdownFinishedException`, `RaiseWindowClosedException`, `ParticipantNotActiveException`, `AlreadyLeadingException`, `CountdownNotStartedException`, `NotEnoughPlayersException`, `InvalidWarStateTransitionException`, `EventAlreadyProcessedException` | 409 |

## API

Wszystkie pięć tras wymaga JWT.

| Metoda i trasa | Żądanie | Odpowiedź | Handler |
|---|---|---|---|
| `GET /api/warehouses?limit=` | `limit` 1-100, wymagany | 200 z listą `WarehouseSummaryDto`: wojny `Open` i `Bidding`, najstarsze pierwsze - tier, widełki, wpisowe, bieżąca cena, liczba przedmiotów, gracze/max, timery; nigdy `TotalValue` | `GetWarehousesQueryHandler` |
| `GET /api/warehouses/{id}` | `id` to `PublicWarehouseId` | 200 z `WarehouseDetailsDto`: pola podsumowania plus stan wołającego (`IsParticipant`, `ParticipantState`, `IsLeader`), `CancellationReason`, a po `Settled` pełny `Manifest` (nazwa, rzadkość, cena per przedmiot); 404 dla nieznanego id | `GetWarehouseByIdQueryHandler` |
| `POST /api/warehouses/{id}/join` | puste body; dołącza wołający | 200 natychmiast; blokada wpisowego jest asynchroniczna - klient odpytuje GET aż `ParticipantState` zmieni się na `Active` albo uczestnik zniknie; 409 przy komplecie, ponownym dołączeniu lub skończonym odliczaniu | `JoinWarehouseWarCommandHandler` |
| `POST /api/warehouses/{id}/leave` | puste body | 200; usuwa uczestnika i zleca zwrot wpisowego; 404 gdy nie jest uczestnikiem, 409 po odliczaniu | `LeaveWarehouseWarCommandHandler` |
| `POST /api/warehouses/{id}/bids` | `{ increment }` ze zbioru tieru | 200; podbicie działa synchronicznie (bez sagi - budżetem jest już zablokowane wpisowe); strażnicy domeny odpowiadają 400/409, przegrany wyścig zapisu 409 przez token `Version` | `PlaceWarehouseBidCommandHandler` |

## Zdarzenia

| Kierunek | Zdarzenie | Handler i efekt |
|---|---|---|
| publikowane | `WarehouseStockRequestedEvent` | pisane przez `WarehouseKeeper` przy uzupełnianiu puli: nowa wojna `Stocking` plus wylosowana lista rzadkości w jednym zapisie; konsumowane przez Inventory, które wycenia bez tworzenia przedmiotów |
| konsumowane | `WarehouseStockedEvent` | `WarehouseStockedEventHandler` sumuje wycenione ceny, losuje publiczne widełki przez `EstimateGenerator`, otwiera lobby i zapisuje wiersze manifestu plus wiersz inboxa w jednym zapisie |
| publikowane | `WarehouseEntryLockRequestedEvent` | pisane przez `JoinWarehouseWarCommandHandler` w tej samej transakcji co nowy uczestnik; konsumowane przez Wallets, które blokuje wpisowe |
| konsumowane | `WarehouseEntryLockedEvent` | `WarehouseEntryLockedEventHandler` potwierdza uczestnika (i działa logika odliczania); gdy wojna nie jest już `Open` albo gracz zdążył wyjść, emituje zamiast tego `FundsUnlockRequestedEvent`, więc osierocona blokada zawsze wraca |
| konsumowane | `WarehouseEntryLockRejectedEvent` | `WarehouseEntryLockRejectedEventHandler` zwalnia zarezerwowane miejsce; brak uczestnika jest poprawnym wynikiem |
| publikowane | `FundsUnlockRequestedEvent` | ścieżka zwrotów, reużyta z sagi aukcji (jej konsument w Wallets toleruje brak blokady): przy wyjściu, przy osieroconych blokadach, dla każdego aktywnego uczestnika anulowanej wojny i dla przegranych rozliczonej |
| publikowane | `WarehouseWonEvent` | pisane przez keepera przy rozliczeniu wojny, niesie zwycięzcę, cenę końcową i pełny manifest; konsumowane przez Wallets (`SpendLock`: cena końcowa opuszcza obieg, reszta wpisowego wraca) i przez Inventory (mintuje manifest przez `Item.CreateWithPrice` w wycenionych cenach); MediatR odpala Wallets pierwsze, więc pieniądze zawsze ruszają się przed przedmiotami |

## Keeper

[`WarehouseKeeper`](../../../Backend/src/AuctionServer.Modules.Warehouses/Infrastructure/Background/WarehouseKeeper.cs) to `BackgroundService` z pętlą 1000 ms (okna podbić mają 5-10 s, więc kadencja 10 s znana z `AuctionClosera` byłaby za gruba). Każdy cykl wykonuje cztery zamiatania, każde zapisujące swoje zmiany i wiersze outboxa w jednym `SaveChangesAsync`: startuje licytacje, gdzie odliczanie minęło (albo anuluje lobby, które spadło poniżej minimum), rozlicza lub anuluje wojny z wygasłym oknem podbić, anuluje lobby i wojny `Stocking` starsze niż `LobbyTimeout` oraz uzupełnia pulę do `PoolSize` świeżo wylosowanymi tierami i rzadkościami.

## Decyzje

- Wpisowe jest budżetem podbić. Saga blokady środków trwa 3-9 s (dwa cykle outboxa), co nie mieści się w oknie podbić 5-10 s, więc pieniądze blokują się raz, w spokojnej fazie lobby, a każde podbicie to czysto lokalna operacja agregatu ograniczona `EntryFee`. Wyścigi podbić rozstrzyga token `Version` (przegrany dostaje 409 i ponawia).
- Dedykowane zdarzenia blokady wpisowego zamiast reużycia `FundsLockRequestedEvent`: odpowiedź `FundsLockedEvent` ma w procesie konsumenta w Auctions, który dla id magazynu rzuciłby `AuctionNotFoundException` i po pięciu próbach uśmiercił odpowiedź w dead letter. `FundsUnlockRequestedEvent` JEST reużyte do zwrotów, bo jego jedyny konsument toleruje brak blokady - co czyni też nadmiarowe zwroty bezpiecznymi, a moduł woli nadmiarowy zwrot niż uwięzione wpisowe.
- Reguła anty-przecieku: wszystko, co publiczne (wpisowe, podbicia, cena startowa 0), wynika wyłącznie z tieru; z prawdziwej wartości wynikają tylko widełki i przechodzą przez `EstimateGenerator`, który losuje ważony wariant zwodzenia, skaluje, zaokrągla do dziesiątek i przycina od dołu do 10.
- Bez pre-mintingu: Inventory nie umie trzymać przedmiotów "niczyich" (unikalny indeks na `LockedForAuctionId` dopuszcza jeden przedmiot na id aukcji, nie ma użytkownika-domu, `TransferTo` wymaga zablokowanego przedmiotu). Zamiast tego Inventory wycenia na przejściowych wynikach `Item.Create`, które nigdy nie są zapisywane, manifest żyje w `WarehousesStockItems`, a prawdziwe przedmioty mintują się dopiero przy rozliczeniu z manifestu niesionego zdarzeniem, idempotentnie przez inbox.
- Cena końcowa to zlew pieniędzy: nie istnieje sprzedawca, więc `Wallet.SpendLock` konsumuje blokadę zwycięzcy, oddaje resztę, a sama cena znika. Znane ograniczenie: zmintowane przedmioty można sprzedać do sklepu za `OfficialPrice` (kran pieniędzy), więc jeśli typowe ceny końcowe będą niżej typowych wartości manifestów, wojny drukują pieniądze; dźwigniami są warianty zwodzenia i strojenie tierów.
- Uczestnicy `PendingLock` rezerwują miejsce przed zapłatą, inaczej pięć równoczesnych dołączeń przeszłoby kontrolę pojemności. Odrzucona blokada zwalnia miejsce; blokada potwierdzona po tym, jak wojna poszła dalej, wraca gałęzią osieroconych blokad.

## Powiązane dokumenty

- [README.md](README.md) - przegląd backendu, uruchamianie, konfiguracja, testy.
- [messaging.md](messaging.md) - outbox, inbox, polityka ponowień.
- [wallets.md](wallets.md) - blokada wpisowego, `SpendLock` i zwroty.
- [inventory.md](inventory.md) - wycena i mint przy rozliczeniu.
