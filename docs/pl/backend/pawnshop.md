# Moduł Pawnshop

> Wersja polska. Angielski odpowiednik 1:1: [../../en/backend/pawnshop.md](../../en/backend/pawnshop.md)

`AuctionServer.Modules.Pawnshop` daje doświadczonemu graczowi źródło pasywnego dochodu. Gdy skumulowany obrót portfela osiągnie skonfigurowany próg, gracz może kupić lokal, a w lokalu pracuje jeden bot. W stałym interwale bot "kupuje" towar (w rzeczywistości serwer go tworzy, a wycenia Inventory), trzyma każdy przedmiot w magazynie przez stałe okno, a potem sprzedaje go automatycznie. Sprzedany przedmiot znika z gospodarki, a właściciel dostaje stały ułamek jego ceny. W oknie właściciel może zamiast tego wycofać przedmiot, który staje się zwykłym przedmiotem Inventory wartym pełną cenę. Towar botów nigdy nie dotyka rynku aukcji. Jedynymi zlewami są jednorazowe zakupy (lokal, boty i bot wymieniony przy ulepszeniu), więc lombard jest kranem, którego tempo wyznacza wyłącznie konfiguracja. Pięć endpointów żyje pod `/api/pawnshop`, wszystkie za JWT.

## Przegląd

| Obszar | Pliki |
|---|---|
| Endpointy | [`Presentation/PawnshopEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Presentation/PawnshopEndpoints.cs), rekord żądania `BuyBotRequest` |
| Komendy i zapytania | `Application/Command/OpenPawnshop/`, `Application/Command/BuyBot/` i `Application/Command/WithdrawStockItem/` (komenda, handler, walidator w każdym), `Application/Queries/GetOffers/` (zapytanie, handler, `PawnshopOffersDto`, `BotTierDto`), `Application/Queries/GetPawnshop/` (zapytanie, handler, `PawnshopDto`, `StockItemDto`) |
| Opcje | `Application/Options/PawnshopOptions.cs` (`PawnshopOptions`, `BotTierDefinition`) |
| Handlery zdarzeń | `Application/Handlers/PawnshopPaymentCompletedEventHandler.cs`, `PawnshopPaymentRejectedEventHandler.cs`, `PawnshopStockedEventHandler.cs` |
| Domena | [`Domain/Entities/Shop.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Domain/Entities/Shop.cs), [`Domain/Entities/StockItem.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Domain/Entities/StockItem.cs) (z rekordem `PayoutBatch`), `Domain/Enums/` (`ShopStatus`, `StockItemStatus`, `PawnshopRarity`), [`Domain/Exceptions/PawnshopExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Domain/Exceptions/PawnshopExceptions.cs) |
| Infrastruktura | `Persistence/` (`PawnshopDbContext`, `PawnshopRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs`, [`Background/PawnshopKeeper.cs`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Infrastructure/Background/PawnshopKeeper.cs) |

[`PawnshopModuleExtensions.AddPawnshopModule`](../../../Backend/src/AuctionServer.Modules.Pawnshop/PawnshopModuleExtensions.cs) przyjmuje connection string i instancję `PawnshopOptions` i waliduje ją na starcie. Kontrole wymagają `PremisesPrice > 0`, `PremisesRequiredTurnover >= 0`, `StockSellDelay` w przedziale `[30 s, 7 d]`, zarówno `StockRequestTimeout`, jak i `PaymentTimeout` co najmniej 10 minut (horyzont dead letter, zobacz Decyzje) oraz co najmniej jednego tieru bota. Nazwy tierów muszą być unikalne bez względu na wielkość liter i mieć najwyżej 64 znaki, rzadkości muszą być zdefiniowane i unikalne między tierami, a każdy tier wymaga `Price > 0`, `SpawnInterval >= 10 s`, `PayoutRate` w przedziale `[0.01, 1)` i `StockSellDelay <= SpawnInterval * 100`. Metoda rejestruje `PawnshopDbContext`, hosted services `OutboxProcessor` i `PawnshopKeeper`, singleton opcji oraz `IPawnshopRepository` jako scoped. Jak Banking moduł czyta i pisze przez EF Core. Zapytania używają `AsNoTracking`, zapisy ładują śledzone encje chronione tokenami współbieżności `Version`.

Drugie połowy sag żyją w modułach, które są właścicielami danych. Wallets uruchamia `PawnshopPaymentRequestedEventHandler` (bramka obrotu plus obciążenie przez `Wallet.PayForPawnshop`) i `PawnshopPayoutEventHandler` (uznanie przez `AddFunds`), zobacz [wallets.md](wallets.md). Inventory uruchamia `PawnshopStockRequestedEventHandler` (wycenia towar bez zapisywania jakiegokolwiek przedmiotu) i `PawnshopItemWithdrawnEventHandler` (mintuje wycofany przedmiot przez `Item.CreateWithPrice`), zobacz [inventory.md](inventory.md).

## Uruchomienie

```bash
# from Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Pawnshop --startup-project src/AuctionServer.Api --context PawnshopDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Pawnshop --startup-project src/AuctionServer.Api --context PawnshopDbContext
dotnet test tests/AuctionServer.Modules.Pawnshop.Tests
```

Migracje żyją w [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Infrastructure/Persistence/Migrations). `20261015145524_Initial_Pawnshop` tworzy tabelę lombardów z filtrowanym unikalnym indeksem oraz tabele outboxa i inboxa, `20261015152831_Add_Pawnshop_Bot` dodaje kolumny snapshotu bota i oczekującego bota wraz z `NextSpawnOn` i jego indeksem, `20261015153604_Add_Pawnshop_Stock` dodaje kolumny oczekującego żądania towaru oraz tabelę `PawnshopStockItems`, a `20261015161815_Set_Pawnshop_Stock_Rate_Precision` zawęża `PendingStockPayoutRate` do `numeric(5,4)`, tak jak pozostałe stawki.

## Konfiguracja

Cała sekcja `Pawnshop` z `appsettings.json` binduje się do `PawnshopOptions`, a brak sekcji zatrzymuje hosta.

| Klucz | Domyślnie | Efekt |
|---|---|---|
| `Pawnshop:PremisesPrice` | `100000` | jednorazowa cena lokalu, pobierana przez Wallets |
| `Pawnshop:PremisesRequiredTurnover` | `1000000` | skumulowany obrót, jakiego gracz potrzebuje, zanim kupi lokal |
| `Pawnshop:StockSellDelay` | `00:05:00` | jak długo każdy utworzony przedmiot leży w magazynie przed automatyczną sprzedażą, co jest zarazem oknem wycofania |
| `Pawnshop:StockRequestTimeout` | `00:15:00` | po tym czasie żądanie spawnu bez odpowiedzi jest porzucane (jeden spawn stracony, harmonogram zachowany), walidowane `>= 10 min` |
| `Pawnshop:PaymentTimeout` | `00:15:00` | po tym czasie płatność za lokal lub bota bez odpowiedzi jest odrzucana z powodem "Payment timed out", walidowane `>= 10 min` |
| `Pawnshop:BotTiers` | cztery tiery poniżej | drabinka botów. Zakup kopiuje tier jako snapshot, więc zmiana konfiguracji nigdy nie przecenia bota już kupionego ani opłacanego. Nie nadpisuj tablicy ze zmiennych środowiskowych w compose (scalanie po indeksie) |

Domyślna drabinka wypłaca 0.5 ceny na każdym tierze. Dochód godzinowy to `3600 / SpawnInterval` razy średnia pasma rzadkości razy stawka wypłaty, a pasma pochodzą z `Item.RollPriceFor` w Inventory (`Random.Shared.Next` z wyłączoną górną granicą, czyli od 10 do 99, od 100 do 999, od 1 000 do 9 999 i od 10 000 do 99 999). Każdy tier zwraca swoją cenę w 15 do 18 godzin.

| Tier | Rzadkość | Cena | Spawn co | Średnia pasma | Wypłata na godzinę | Zwrot |
|---|---|---|---|---|---|---|
| `Pawn Clerk` | `Common` | 50 000 | 30 s | 54.5 | około 3 270 | około 15 h |
| `Appraiser` | `Rare` | 300 000 | 60 s | 549.5 | około 16 485 | około 18 h |
| `Dealer` | `Epic` | 1 500 000 | 120 s | 5 499.5 | około 82 490 | około 18 h |
| `Magnate` | `Legendary` | 5 000 000 | 300 s | 54 999.5 | około 330 000 | około 15 h |

## Model danych

`PawnshopShops`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `Id` | `integer` | klucz główny, identity |
| `PublicPawnshopId` | `uuid` | unikalny identyfikator publiczny, niesiony przez każde zdarzenie |
| `UserId` | `uuid` | unikalny dopóki `Status IN (0, 1)`, więc gracz ma najwyżej jeden żywy lombard. Surowe liczby całkowite w filtrze, nigdy nie renumeruj `ShopStatus` |
| `Status` | `integer` | `PendingPayment = 0`, `Active = 1`, `Rejected = 2` |
| `RequestedOn` | `timestamptz` | kiedy zażądano lokalu, porządkuje GET do najnowszego lombardu |
| `ActivatedOn` | `timestamptz?` | ustawiane, gdy płatność za lokal się zakończy |
| `RejectionReason` | `text(256)?` | z Wallets albo od keepera. Używane ponownie dla odrzuconego zakupu bota i czyszczone przez następny zakup lub zakończoną płatność |
| `PendingPaymentId`, `PendingPaymentRequestedOn` | `uuid?`, `timestamptz?` | jedyna płatność w locie. Odpowiedź musi nieść to id, a zarówno odrzucenie, jak i wygaśnięcie je czyszczą |
| `BotTierName`, `BotRarity`, `BotSpawnInterval`, `BotPayoutRate`, `BotPurchasedOn` | `text(64)?`, `integer?`, `interval?`, `numeric(5,4)?`, `timestamptz?` | snapshot zainstalowanego bota |
| `PendingBotTierName`, `PendingBotRarity`, `PendingBotSpawnInterval`, `PendingBotPayoutRate` | `text(64)?`, `integer?`, `interval?`, `numeric(5,4)?` | snapshot opłacanego bota, zamrożony w chwili żądania |
| `NextSpawnOn` | `timestamptz?` | kiedy keeper zleca następny spawn. Ze `Status` w indeksie złożonym dla zamiatania spawnów |
| `PendingStockRequestId`, `PendingStockRequestedOn` | `uuid?`, `timestamptz?` | jedyne żądanie spawnu w locie |
| `PendingStockPayoutRate` | `numeric(5,4)?` | stawka wypłaty bota zamrożona dla towaru z tego żądania |
| `Version` | `uuid` | token współbieżności, odnawiany przez każdą metodę mutującą |

`PawnshopStockItems`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `Id` | `integer` | klucz główny, identity |
| `PublicStockItemId` | `uuid` | unikalny identyfikator publiczny, używany w trasie wycofania i w zdarzeniu wycofania |
| `PublicPawnshopId` | `uuid` | lombard właściciel, bez klucza obcego |
| `UserId` | `uuid` | właściciel, skopiowany z lombardu, więc sprawdzenie własności nie potrzebuje joina. Ze `Status` w indeksie złożonym |
| `Name` | `text(100)` | `Pawned {Rarity} Good` |
| `Rarity` | `integer` | `PawnshopRarity`, lokalna kopia `ItemRarity` z Inventory |
| `Price` | `numeric(18,2)` | pełna cena wyceniona przez Inventory, zarazem cena wycofanego przedmiotu |
| `PayoutRate` | `numeric(5,4)` | zamrożona per przedmiot z żądania, które go utworzyło |
| `Status` | `integer` | `InStock = 0`, `Withdrawn = 1`, `Sold = 2`. Z `SellAfter` w indeksie złożonym dla zamiatania sprzedaży |
| `SpawnedOn`, `SellAfter` | `timestamptz` | `SellAfter = SpawnedOn + StockSellDelay` |
| `ResolvedOn` | `timestamptz?` | kiedy przedmiot wycofano lub sprzedano |
| `PayoutAmount` | `numeric(18,2)?` | ustawiane tylko przez sprzedaż, `Round(Price * PayoutRate, 2, AwayFromZero)` |
| `Version` | `uuid` | token współbieżności, rozstrzyga wycofanie ścigające się ze sprzedażą |

`PawnshopOutboxMessages` i `PawnshopProcessedMessages` to kopie modułu tabel outboxa i inboxa.

## API

Wszystkie pięć tras wymaga JWT.

| Metoda i trasa | Żądanie | Odpowiedź | Handler |
|---|---|---|---|
| `GET /api/pawnshop/offers` | brak | 200 z `PawnshopOffersDto` prosto z konfiguracji (bez bazy): cena lokalu i próg obrotu, `StockSellDelay` oraz lista tierów | `GetOffersQueryHandler` |
| `GET /api/pawnshop` | brak | 200 z najnowszym lombardem wołającego, razem z `Rejected` i jego powodem. Niesie zainstalowanego bota, nazwę opłacanego bota, `NextSpawnOn` i magazyn (każdy przedmiot `InStock` uporządkowany po `SellAfter` plus 20 ostatnio rozliczonych z ich `PayoutAmount`). 404, gdy gracz nigdy nie zażądał lokalu | `GetPawnshopQueryHandler` |
| `POST /api/pawnshop` | puste body | 201 z `PublicPawnshopId` natychmiast. Płatność jest asynchroniczna, więc odrzucenie (obrót lub środki) pojawia się w GET po dwóch odpytaniach outboxa. Drugi żywy lombard odpowiada 409 przez filtrowany unikalny indeks | `OpenPawnshopCommandHandler` |
| `POST /api/pawnshop/bot` | `{ tierName }` | 202, płatność jest asynchroniczna. Nieznany tier odpowiada 404 przed wyszukaniem lombardu, więc literówka nie może ujawnić stanu konta. 404 bez żywego lombardu. 409, gdy lokal jest jeszcze opłacany, w locie jest inna płatność albo tier nie jest ściśle wyższy od zainstalowanego bota | `BuyBotCommandHandler` |
| `POST /api/pawnshop/stock/{id}/withdraw` | puste body | 202, przedmiot trafia do Inventory asynchronicznie. Cudzy przedmiot odpowiada 404 dokładnie jak brakujący, przed jakimkolwiek strażnikiem stanu, więc id towaru nie da się sondować. 409, gdy przedmiotu nie ma już w magazynie albo jego okno się zamknęło | `WithdrawStockItemCommandHandler` |

## Zdarzenia

| Kierunek | Zdarzenie | Handler i efekt |
|---|---|---|
| publikowane | `PawnshopPaymentRequestedEvent` | pisane przez `OpenPawnshopCommandHandler` (cena lokalu i próg obrotu) albo `BuyBotCommandHandler` (cena tieru, próg 0) w tym samym zapisie co zmiana lombardu. Konsumowane przez Wallets, gdzie `Wallet.PayForPawnshop(amount, requiredTurnover)` sprawdza bramkę i obciąża atomowo, nie ruszając obrotu |
| konsumowane | `PawnshopPaymentCompletedEvent` | `PawnshopPaymentCompletedEventHandler` uruchamia `CompletePayment`. Lokal staje się `Active`, a płatność za bota instaluje oczekujący snapshot i ustawia `NextSpawnOn = now + SpawnInterval` |
| konsumowane | `PawnshopPaymentRejectedEvent` | `PawnshopPaymentRejectedEventHandler` uruchamia `RejectPayment`. Lokal staje się `Rejected`, co natychmiast zwalnia miejsce w unikalnym indeksie. Odrzucona płatność za bota zostawia lombard `Active` ze starym botem i zapisuje powód |
| publikowane | `PawnshopStockRequestedEvent` | pisane przez `PawnshopKeeper`, przy czym id wiersza outboxa, id zdarzenia i `PendingStockRequestId` są równe. Konsumowane przez Inventory, które losuje jedną cenę na żądaną rzadkość bez zapisywania jakiegokolwiek przedmiotu |
| konsumowane | `PawnshopStockedEvent` | `PawnshopStockedEventHandler` uruchamia `ReceiveStock`, które przyjmuje odpowiedź tylko wtedy, gdy jej `RequestId` pasuje do oczekującego żądania, i wstawia towar z `SellAfter = now + StockSellDelay` |
| publikowane | `PawnshopPayoutEvent` | pisane przez `PawnshopKeeper`, jedno na lombard na zamiatanie, z sumą wypłat sprzedanych przez niego przedmiotów. Konsumowane przez Wallets, które uznaje przez `AddFunds`, więc wypłaty wliczają się do `LifetimeTurnover` |
| publikowane | `PawnshopItemWithdrawnEvent` | pisane przez `WithdrawStockItemCommandHandler` w tym samym zapisie co zmiana przedmiotu. Konsumowane przez Inventory, które mintuje przedmiot `Available` dla właściciela w cenie z magazynu przez `Item.CreateWithPrice` |

Spóźnione odpowiedzi nie są tolerowane. Odpowiedź płatności, której `PaymentId` różni się od `PendingPaymentId`, albo odpowiedź towaru, której `RequestId` różni się od `PendingStockRequestId`, rzuca `InvalidShopStateTransitionException`. Handlery go nie łapią, więc wiadomość jest ponawiana i trafia do martwych widocznie, zamiast zostać po cichu pominięta.

## Keeper

[`PawnshopKeeper`](../../../Backend/src/AuctionServer.Modules.Pawnshop/Infrastructure/Background/PawnshopKeeper.cs) to `BackgroundService` z pętlą 5000 ms. Każdy cykl wykonuje cztery zamiatania w kolejności najpierw siatek bezpieczeństwa, a każde zamiatanie zapisuje zmiany encji razem z wierszami outboxa w jednym `SaveChangesAsync`.

1. Wygaszanie płatności. Lombardy, których płatność czeka dłużej niż `PaymentTimeout` (najwyżej 50 na cykl), przechodzą przez `ExpirePayment`, które odrzuca ją z powodem "Payment timed out" i czyści `PendingPaymentId`.
2. Wygaszanie żądań towaru. Lombardy, których żądanie spawnu jest starsze niż `StockRequestTimeout` (najwyżej 50), porzucają je przez `ExpireStockRequest`. `NextSpawnOn` zostaje bez zmian, więc zgubiona odpowiedź kosztuje jeden spawn i nic więcej.
3. Sprzedaż wymagalnego towaru. Do 200 przedmiotów `InStock` z `SellAfter` w przeszłości, najstarsze pierwsze, przechodzi przez `StockItem.SellDue`, które sprzedaje każdy przedmiot i grupuje wypłaty per lombard w rekordy `PayoutBatch`. Jedno `PawnshopPayoutEvent` na partię jest zapisywane w tym samym zapisie, więc przedmiot jest `Sold` dokładnie wtedy, gdy istnieje jego wiersz wypłaty.
4. Zlecanie wymagalnych spawnów. Aktywne lombardy z botem, bez żądania w locie i z `NextSpawnOn` w przeszłości (najwyżej 50) przechodzą przez `RequestSpawn`, które ustawia `NextSpawnOn = now + SpawnInterval`. Harmonogram jest zakotwiczony w żądaniu, więc po przestoju nie ma nadrabiania.

Sprzedaż działa przed spawnem, bo rusza pieniądze, a spawn działa ostatni jako jedyne zamiatanie tworzące nową pracę. Keeper nie ma testów zgodnie z konwencją repozytorium. Każda decyzja żyje w `Shop` i `StockItem` i jest tam testowana.

## Decyzje

- Jednorazowe zakupy są jedynymi zlewami. Lokal, boty i bot wyrzucony przez ulepszenie kosztują pieniądze, a czynszu i opłaty za wycofanie nie ma. Bieżący dochód to iloczyn tempa spawnów, pasma rzadkości i stawki wypłaty, wszystkich w konfiguracji.
- Wypłaty wliczają się do `LifetimeTurnover`, bo przychodzą przez `AddFunds` z Wallets jak każdy inny wpływ z gospodarki. Pętlę, w której pasywny obrót odblokowuje pożyczki bankowe, zaakceptowano celowo. Zakupy obciążają przez `Wallet.PayForPawnshop`, które nigdy nie obniża obrotu, więc wydatki nie zniekształcają bramki.
- Jeden lokal, jedno miejsce na bota i drabinka tylko w górę. Nowy bot zastępuje zainstalowanego bez zwrotu, a tier, który nie jest ściśle wyższy, odpowiada 409, bo zamiana w bok bez zwrotu karałaby tylko podwójne kliknięcie. Rzadkości są walidowane jako unikalne między tierami, więc drabinka ma najwyżej cztery stopnie.
- `PayoutRate < 1` jest walidowane celowo. Wycofanie w oknie zachowuje pełną cenę (przedmiot można sprzedać do sklepu albo wystawić na rynku), więc automatyczna sprzedaż jest zawsze warta mniej niż uwaga gracza. Ta różnica to premia za aktywność. Dolna granica `0.01` chroni tani przedmiot przed wypłatą 0.00, bo `AddFunds(0)` rzuca wyjątek, a wypłata trafiłaby do martwych.
- Okno wycofania zamyka się w `SellAfter`, a nie wtedy, gdy keeper akurat działa. `Withdraw` wymaga `now < SellAfter`, a `Sell` wymaga `now >= SellAfter`, więc wynik nie zależy od czasu keepera. Gdy wycofanie i sprzedaż zapisują się w tej samej chwili, token `Version` na przedmiocie przepuszcza dokładnie jedno z nich.
- Stawka wypłaty jest zamrożona per przedmiot. Stawka bota, który zlecił spawn, trafia do `PendingStockPayoutRate`, a stamtąd do każdego przedmiotu odpowiedzi, więc wymiana bota w trakcie żądania w locie albo gdy towar leży w magazynie nigdy go nie przecenia.
- Matematyka wypłaty to `Round(Price * PayoutRate, 2, MidpointRounding.AwayFromZero)` na przedmiot, sumowane per lombard. Jawne `AwayFromZero` zgadza się z odsetkami banku i omija zaokrąglanie bankiera, które posłałoby `15 * 0.015 = 0.225` w dół do 0.22.
- Spawn podąża za wzorcem wyceny magazynów z własnymi zdarzeniami. Inventory wycenia przejściowe przedmioty, których nigdy nie zapisuje, a odpowiedź odbija id żądania, bo lombard pyta wiele razy, podczas gdy magazyn jest zaopatrywany raz. Zdarzeń magazynowych nie reużyto, bo wtedy oba moduły konsumowałyby nawzajem swoje odpowiedzi i trafiały do martwych na obcych id.
- `PawnshopRarity` jest lokalną kopią `ItemRarity` z Inventory, bo moduły nie mogą się referencować, a rzadkości przekraczają granicę jako stringi. Dryf między obiema enumami wyłapie dopiero próba end-to-end.
- `StockRequestTimeout` i `PaymentTimeout` są walidowane `>= 10 min`, czyli ten sam horyzont dead letter co w Banking (dwa skoki po około pięć minut backoffu outboxa każdy). Krótszy timeout pozwoliłby keeperowi wygasić płatność, której zakończenie jeszcze nadchodzi.

Zaakceptowane ryzyka, zapisane przez właściciela 2026-10-15:

- Crafting wzmacnia wycofania. `Item.Craft` zamienia trzy przedmioty jednej rzadkości w jeden przedmiot następnej rzadkości z nowym losowaniem ceny, a każda średnia pasma jest około dziesięć razy większa od poprzedniej, więc każdy stopień mnoży wartość około 3.3 raza. Bot `Pawn Clerk` opróżniany ręcznie daje około 120 przedmiotów `Common` na godzinę, wartych około 6 540 po pełnej cenie albo około 21 980 po scraftowaniu w 40 przedmiotów `Rare`, wobec około 3 270 z automatycznej wypłaty. Ten sam kran już istnieje dla przedmiotów wygranych w wojnach magazynowych.
- Spóźnione `PawnshopPaymentCompletedEvent` kosztuje gracza. Gdy keeper już wygasił płatność, Wallets obciążył, ale lombard odrzuca odpowiedź (niezgodne `PaymentId`) i trafia ona do martwych. Odzwierciedla to bank, w którym spóźnione zatwierdzenie rozdałoby darmowy kapitał. Przy obu timeoutach na poziomie co najmniej horyzontu dead letter dotrzeć tam może tylko ręcznie wskrzeszony martwy wiersz. Odłożone łagodzenie to zdarzenie kompensacyjnego zwrotu, według poprawki "Compensate late funds lock confirmation" w Auctions.
- Rozliczony towar nigdy nie jest usuwany. Przedmioty `Sold` i `Withdrawn` zostają w `PawnshopStockItems` (bot `Pawn Clerk` dodaje około 2 880 wierszy na dobę), GET ogranicza rozliczoną historię do 20, a zamiatanie retencji jest poza zakresem.
- Przepustowość outboxa ogranicza populację botów. Każdy procesor outboxa dostarcza najwyżej 20 wierszy na odpytanie co 3 s, czyli około 24 000 wierszy na godzinę. Bot `Pawn Clerk` zapisuje około 240 wierszy outboxa Pawnshop na godzinę (jedno żądanie spawnu i jedna wypłata na spawn), więc około 100 takich botów nasyca moduł. Na skalę portfolio to w porządku, a dźwignią skalowania byłoby więcej przedmiotów na spawn, a nie więcej spawnów.
- Lombard ignoruje `IsSuspendedWallet` przy obciążeniu i uznaniu, spójnie z Banking i każdą inną ścieżką w Wallets.

## Powiązane dokumenty

- [README.md](README.md) - przegląd backendu, uruchamianie, konfiguracja, testy.
- [messaging.md](messaging.md) - outbox, inbox, polityka ponowień, rejestr zdarzeń.
- [wallets.md](wallets.md) - `PayForPawnshop` i oba handlery lombardu po stronie Wallets.
- [inventory.md](inventory.md) - handlery wyceny i mintowania po stronie Inventory.
- [banking.md](banking.md) - bramka obrotu i kształt sagi żądanie/odpowiedź, które lombard reużywa.
