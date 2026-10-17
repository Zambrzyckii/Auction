# Moduł Casino

> Wersja polska. Angielski odpowiednik 1:1: [../../en/backend/casino.md](../../en/backend/casino.md)

`AuctionServer.Modules.Casino` to pierwszy ciągły zlew pieniędzy w gospodarce: każdą grę gracz statystycznie przegrywa, a przewaga kasyna zabiera udział z każdego postawionego żetonu. Wejście jest darmowe. Gracz wymienia pieniądze z portfela 1:1 na żetony kasyna przez asynchroniczną sagę zakupu z Wallets, gra w ruletkę europejską i blackjacka synchronicznie na saldzie żetonów, a żetony wypłaca 1:1 z powrotem do portfela. Wypłacone pieniądze nigdy nie budują `LifetimeTurnover`, więc kasynem nie da się farmić bramek banku ani lombardu. Osiem endpointów żyje pod `/api/casino`, wszystkie za JWT. Każdy wynik losuje serwer, a przyszły frontend tylko go animuje.

## Przegląd

| Obszar | Pliki |
|---|---|
| Endpointy | [`Presentation/CasinoEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Presentation/CasinoEndpoints.cs), rekordy żądań `PurchaseChipsRequest`, `CashOutChipsRequest`, `SpinRouletteRequest`, `StartBlackjackHandRequest`, `BlackjackActionRequest` |
| Komendy i zapytania | `Application/Command/PurchaseChips/`, `CashOutChips/`, `SpinRoulette/`, `StartBlackjackHand/` i `ActOnBlackjackHand/` (komenda, handler, walidator w każdym; komendy spinu i blackjacka mają własne DTO), `Application/Queries/GetCasino/`, `GetRouletteSpins/` i `GetBlackjackHands/` (zapytanie, handler i DTO w każdym) |
| Opcje | `Application/Options/CasinoOptions.cs` (`CasinoOptions`, `RouletteOptions`, `BlackjackOptions`) |
| Handlery zdarzeń | `Application/Handlers/CasinoChipPurchaseCompletedEventHandler.cs`, `CasinoChipPurchaseRejectedEventHandler.cs` |
| Domena | [`Domain/Entities/ChipAccount.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/ChipAccount.cs), [`ChipPurchase.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/ChipPurchase.cs), [`RouletteBet.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/RouletteBet.cs), [`RouletteSpin.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/RouletteSpin.cs), [`BlackjackHand.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Entities/BlackjackHand.cs), `Domain/Cards/` (`Card`, `HandValue`, `ICardSource`), `Domain/Enums/` (`ChipPurchaseStatus`, `RouletteBetType`, `BlackjackHandStatus`, `BlackjackOutcome`, `BlackjackAction`), [`Domain/Exceptions/CasinoExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Domain/Exceptions/CasinoExceptions.cs) |
| Infrastruktura | `Persistence/` (`CasinoDbContext`, `CasinoRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs`, [`Background/CasinoKeeper.cs`](../../../Backend/src/AuctionServer.Modules.Casino/Infrastructure/Background/CasinoKeeper.cs), `Random/` (`CasinoRandom`, [`ShoeCardSource`](../../../Backend/src/AuctionServer.Modules.Casino/Infrastructure/Random/ShoeCardSource.cs)) |

[`CasinoModuleExtensions.AddCasinoModule`](../../../Backend/src/AuctionServer.Modules.Casino/CasinoModuleExtensions.cs) przyjmuje connection string i instancję `CasinoOptions` i waliduje ją na starcie. Kontrole wymagają obecności zagnieżdżonych sekcji `Roulette` i `Blackjack` (binder zostawia brakującą zagnieżdżoną sekcję jako `null`), `PurchaseTimeout` co najmniej 10 minut (horyzont dead letter, zobacz Decyzje), per gra `1 <= MinBet <= MaxBet` z oboma limitami całkowitymi, `MaxBetsPerSpin` w przedziale `[1, 50]` oraz `HandTimeout` w przedziale `[30 s, 1 d]`. Metoda rejestruje `CasinoDbContext`, hosted services `OutboxProcessor` i `CasinoKeeper`, singleton opcji, `ICasinoRandom` (produkcyjnie `RandomNumberGenerator.GetInt32`) i `ICardSource` (produkcyjnie `ShoeCardSource`) jako singletony oraz `ICasinoRepository` jako scoped. Jak Banking i Pawnshop moduł czyta i pisze przez EF Core: zapytania używają `AsNoTracking`, zapisy ładują śledzone encje chronione tokenami współbieżności `Version`.

Strona Wallets przepływu żetonów żyje w `Modules.Wallets`: `CasinoChipPurchaseRequestedEventHandler` obciąża przez istniejące `Wallet.Withdraw` (bez bramki obrotu, łapany jest tylko `InsufficientFundsException`), a `CasinoCashOutEventHandler` uznaje przez nowe `Wallet.ReceiveCasinoCashOut`, które jak `ReceiveTransfer` nigdy nie rusza `LifetimeTurnover`. Zobacz [wallets.md](wallets.md).

## Uruchomienie

```bash
# from Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Casino --startup-project src/AuctionServer.Api --context CasinoDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Casino --startup-project src/AuctionServer.Api --context CasinoDbContext
dotnet test tests/AuctionServer.Modules.Casino.Tests
```

Migracje żyją w [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Casino/Infrastructure/Persistence/Migrations). `20261017131446_Initial_Casino` tworzy tabele konta żetonów i zakupów (z filtrowanym unikalnym indeksem na jeden zakup w locie) oraz tabele outboxa i inboxa, `20261017133312_Add_Casino_Roulette` dodaje tabelę spinów z posiadaną tabelą zakładów, a `20261017134452_Add_Casino_Blackjack` dodaje tabelę rozdań blackjacka z kartami gracza i krupiera jako kolumnami `integer[]`.

## Konfiguracja

Cała sekcja `Casino` z `appsettings.json` binduje się do `CasinoOptions`, a brak sekcji zatrzymuje hosta. Tabele wypłat (ruletka płaci `stawka * 36 / pokryte kieszenie`, blackjack płaci 3:2 za naturala) i sześć talii w bucie to celowo stałe domeny: żadna wartość konfiguracji nie może odwrócić przewagi kasyna.

| Klucz | Domyślnie | Efekt |
|---|---|---|
| `Casino:PurchaseTimeout` | `00:15:00` | po tym czasie keeper wygasza zakup żetonów bez odpowiedzi, walidowane `>= 10 min` |
| `Casino:Roulette:MinBet`, `MaxBet` | `1`, `1000` | limity pojedynczego zakładu stołu ruletki, pełne żetony |
| `Casino:Roulette:MaxBetsPerSpin` | `20` | ile zakładów przyjmuje jeden spin, walidowane w `[1, 50]` |
| `Casino:Blackjack:MinBet`, `MaxBet` | `5`, `2000` | limity stawki stołu blackjacka, pełne żetony |
| `Casino:Blackjack:HandTimeout` | `00:05:00` | po tym czasie keeper automatycznie pasuje porzucone rozdanie, walidowane w `[30 s, 1 d]` |

## Model danych

`CasinoAccounts`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `Id` | `integer` | klucz główny, identity |
| `UserId` | `uuid` | unikalny; konto powstaje przy pierwszym żądaniu zakupu |
| `Balance` | `numeric(18,2)` | bieżące żetony |
| `LifetimeBought`, `LifetimeCashedOut` | `numeric(18,2)` | liczniki pod profil i do wykrywania osuszonego konta |
| `CreatedOn` | `timestamptz` | |
| `Version` | `uuid` | token współbieżności, odnawiany przez każdą mutującą metodę |

`CasinoChipPurchases`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `Id` | `integer` | klucz główny, identity |
| `PublicPurchaseId` | `uuid` | unikalny, niesiony przez każde zdarzenie zakupu |
| `UserId` | `uuid` | unikalny, dopóki `Status = 0`, więc jeden zakup w locie na gracza. Surowa liczba w filtrze, nigdy nie przenumerowywać `ChipPurchaseStatus` |
| `Amount` | `numeric(18,2)` | pełne żetony, równe pobranym pieniądzom z portfela |
| `Status` | `integer` | `Pending = 0`, `Completed = 1`, `Rejected = 2`, `Expired = 3`. Z `RequestedOn` w złożonym indeksie dla keepera |
| `RequestedOn`, `ResolvedOn?` | `timestamptz` | |
| `RejectionReason` | `text(256)?` | z Wallets albo `Purchase timed out` od keepera, czyszczony przez spóźnione zakończenie |
| `Version` | `uuid` | token współbieżności |

`CasinoRouletteSpins` (niezmienny, bez `Version`) trzyma `Id` (`bigint`), unikalny `PublicSpinId`, `UserId`, wygrywającą kieszeń `Pocket` (`smallint`, 0-36), `TotalStake`, `TotalPayout` i `PlacedOn` z indeksem (`UserId`, `PlacedOn`); jego zakłady to posiadana kolekcja w `CasinoRouletteBets` (`Type`, `Selection?` dla numeru, tuzinu lub kolumny, `Stake`, `Payout`). `CasinoBlackjackHands` trzyma `Id` (`bigint`), unikalny `PublicHandId`, `UserId` (unikalny, dopóki `Status = 0`, jedno aktywne rozdanie na gracza), `Status` (`InProgress = 0`, `Completed = 1`), `Stake` (podwajaną w miejscu przez double), `Doubled`, `PlayerCards` i `DealerCards` jako kody kart 0-51 w `integer[]` (precedens `text[]` to `OutboxMessage.Errors`), `Outcome?` (`Win`, `Lose`, `Push`, `Blackjack`), `Payout?`, `AutoStood`, `StartedOn`, `LastActionOn` (ze `Status` w złożonym indeksie dla keepera), `CompletedOn?` i `Version`. `DealerCards[1]` to zakryta karta: dopóki rozdanie trwa, każde DTO pokazuje wyłącznie `VisibleDealerCards`, które ucina listę do odkrytej karty.

`CasinoOutboxMessages` i `CasinoProcessedMessages` to kopie tabel outboxa i inboxa tego modułu.

## API

Wszystkie osiem tras wymaga JWT.

| Metoda i trasa | Żądanie | Odpowiedź | Handler |
|---|---|---|---|
| `GET /api/casino` | brak | 200 z saldem żetonów, oboma licznikami lifetime, ostatnim zakupem ze statusem i powodem, aktywnym rozdaniem blackjacka (zakryta karta ukryta) i limitami obu stołów. Gracz, który nigdy nie kupił żetonów, dostaje saldo 0, nie 404, bo wejście jest darmowe | `GetCasinoQueryHandler` |
| `POST /api/casino/chips/purchases` | `{ amount }`, całkowite | 201 z `PublicPurchaseId` natychmiast; obciążenie portfela jest asynchroniczne, odrzucenie pojawia się w GET po dwóch odpytaniach outboxa. Drugi zakup w locie odpowiada 409 przez filtrowany unikalny indeks | `PurchaseChipsCommandHandler` |
| `POST /api/casino/chips/cashouts` | `{ amount }`, do 2 miejsc | 202; żetony schodzą z konta natychmiast, uznanie portfela jest asynchroniczne. 400 ponad saldo, 404 bez konta | `CashOutChipsCommandHandler` |
| `POST /api/casino/roulette/spins` | `{ bets: [{ type, selection?, stake }] }` | 200 z kieszenią, jej kolorem, wypłatami per zakład i nowym saldem; cały spin jest synchroniczny. 400 za zakłady poza limitami albo sumę stawek ponad saldo | `SpinRouletteCommandHandler` |
| `GET /api/casino/roulette/spins` | brak | 200 z 20 ostatnimi spinami razem z zakładami | `GetRouletteSpinsQueryHandler` |
| `POST /api/casino/blackjack/hands` | `{ stake }`, całkowita | 201 z rozdanym rozdaniem; natural rozlicza się natychmiast z już uznaną wypłatą. 409 za drugie aktywne rozdanie przez filtrowany unikalny indeks | `StartBlackjackHandCommandHandler` |
| `POST /api/casino/blackjack/hands/{publicHandId}/actions` | `{ action }`: `Hit`, `Stand` albo `Double` | 200 z rozdaniem po akcji; id rozdania siedzi w trasie, więc kliknięcie ze starej karty przeglądarki trafia w stare rozdanie i dostaje 409, zamiast zagrać w nowym. Cudze rozdanie odpowiada 404 dokładnie jak brakujące | `ActOnBlackjackHandCommandHandler` |
| `GET /api/casino/blackjack/hands` | brak | 200 z 20 ostatnimi zakończonymi rozdaniami, oba pełne układy odkryte | `GetBlackjackHandsQueryHandler` |

## Gry i przewaga kasyna

**Ruletka** jest europejska, z jednym zerem. Jeden spin przyjmuje do `MaxBetsPerSpin` zakładów typów `Straight` (`Selection` 0-36), `Red`, `Black`, `Odd`, `Even`, `Low` (1-18), `High` (19-36), `Dozen` i `Column` (`Selection` 1-3). Zakład pokrywający `n` kieszeni płaci `stawka * 36 / n`, a zero przegrywa każdy zakład zewnętrzny, więc każdy typ zakładu zwraca w oczekiwaniu dokładnie `36/37` stawki; test domeny sumuje wypłaty po wszystkich 37 kieszeniach i przybija sumę do dokładnie `36 * stawka` per typ. Handler losuje kieszeń przez `ICasinoRandom.Next(37)`, a domena rozstrzyga ją tak, jak dostaje `now`: losowość zostaje na brzegu, domena jest deterministyczna.

**Blackjack** v1 oferuje Hit, Stand i Double (tylko na dwóch pierwszych kartach); split, insurance i surrender to przyszłe rozszerzenia. Natural płaci 3:2, krupier staje na soft 17, podgląda zakrytą kartę przy asie albo karcie za dziesięć na wierzchu, a but sześciu talii jest świeży co rozdanie. `ShoeCardSource` losuje jednostajnie z sześciu talii minus karty już rozdane w rozdaniu, co jest statystycznie tożsame z tasowaniem świeżego buta bez przechowywania kolejności kart, więc baza nigdy nie zna następnej karty. 21 gracza pasuje automatycznie, bust gracza kończy rozdanie bez gry krupiera, a natural krupiera znaleziony podglądem kończy rozdanie przed jakąkolwiek akcją.

Przewaga blackjacka jest zmierzona, nie przepisana z podręczników, bo reguły v1 od nich odbiegają (bez splitu i surrendera). Jednorazowa konsola (poza repozytorium) rozegrała 10 000 000 rozdań z ziarnem `20261017` na prawdziwych klasach domeny i uproszczonej strategii podstawowej bez splitów: przewaga kasyna to **1.084 % stawki początkowej** (1.002 % całego obrotu z podwojeniami). Kotwica zgodziła się z zamkniętym wzorem na prawdopodobieństwo naturala dla sześciu talii, `4608/97032 = 4.7489 %`, wobec zmierzonych 4.7446 %. Obie gry są więc w oczekiwaniu zlewem pieniędzy; liczby dotyczą tej strategii, nie blackjacka w ogóle.

## Zdarzenia

| Kierunek | Zdarzenie | Handler i efekt |
|---|---|---|
| publikowane | `CasinoChipPurchaseRequestedEvent` | pisane przez `PurchaseChipsCommandHandler` w tym samym zapisie co nowy zakup `Pending` (i konto przy pierwszym zakupie). Konsumowane przez Wallets, które obciąża przez `Wallet.Withdraw`, bez bramki obrotu |
| konsumowane | `CasinoChipPurchaseCompletedEvent` | `CasinoChipPurchaseCompletedEventHandler` uruchamia `purchase.Complete` i `account.ReceivePurchase` z wierszem inboxa w jednym zapisie. `Complete` jest legalne z `Pending` i z `Expired`, więc spóźniona odpowiedź nadal uznaje żetony |
| konsumowane | `CasinoChipPurchaseRejectedEvent` | `CasinoChipPurchaseRejectedEventHandler` uruchamia `purchase.Reject` z powodem. Na zakupie `Expired` odrzucenie to cichy no-op, bo Wallets nie obciążyło, a keeper już zwolnił miejsce w indeksie |
| publikowane | `CasinoCashOutEvent` | pisane przez `CashOutChipsCommandHandler` w tym samym zapisie co zejście żetonów. Konsumowane przez Wallets, które uznaje przez `Wallet.ReceiveCasinoCashOut`, więc wypłaty nigdy nie budują `LifetimeTurnover` |

Rozgrywka niczego nie publikuje: spiny i akcje blackjacka to synchroniczne zapisy wewnątrz modułu, więc outbox obciążają tylko zakupy i wypłaty.

## Keeper

[`CasinoKeeper`](../../../Backend/src/AuctionServer.Modules.Casino/Infrastructure/Background/CasinoKeeper.cs) to `BackgroundService` z pętlą 5000 ms i dwoma zamiataniami, każde z jednym zapisem na cykl.

1. Wygaszanie przeterminowanych zakupów. Zakupy `Pending` starsze niż `PurchaseTimeout` (najwyżej 50 na cykl) przechodzą przez `Expire`, które zapisuje `Purchase timed out` i zwalnia miejsce jednego zakupu w locie.
2. Automatyczne pasowanie porzuconych rozdań. Rozdania `InProgress` z `LastActionOn` starszym niż `HandTimeout` (najwyżej 50) przechodzą przez `AutoStand`, które gra krupierem, rozlicza rozdanie, oznacza je `AutoStood` i uznaje ewentualną wypłatę na koncie żetonów załadowanym w tym samym cyklu. Wyścig z ruchem gracza wywraca cykl na tokenie `Version`, a następny cykl pomija rozdanie, bo nie jest już porzucone.

Keeper nie ma testów zgodnie z konwencją repozytorium; `Expire` i `AutoStand` są testowane na encjach.

## Decyzje

- Pieniądze płyną przez żetony, nie przez portfel per zakład. Obciążenie portfela per spin wciągałoby sagę zakupu z jej 3-9 s w każdy zakład; jednorazowe kupno żetonów robi z rozgrywki synchroniczny zapis na `ChipAccount.Balance` chroniony tokenem `Version`. Wymiana jest 1:1 bez opłaty, więc jedynym zlewem jest przewaga kasyna.
- Pieniądze z kasyna nigdy nie budują `LifetimeTurnover`. Gracz stawiający jednocześnie na czerwone i czarne traci średnio tylko 1/37 obrotu, więc wypłaty liczone do obrotu sprzedawałyby bramkę 1M lombardu za około 28 tysięcy. `Wallet.ReceiveCasinoCashOut` to lustro `ReceiveTransfer` przez prywatny punkt przewężenia `Credit(amount, countsTowardTurnover: false)`.
- Spóźnione `CasinoChipPurchaseCompletedEvent` nadal uznaje żetony. To świadome odejście od lombardowej reguły "spóźnione odpowiedzi trafiają do martwych": zakupy to osobne wiersze `ChipPurchase` (wzór `Loan`), nie pola na koncie (wzór `Shop`), więc wiersz `Expired` zostaje dopasowywalny, a `Complete` go przyjmuje. W lombardzie spóźnione zakończenie kosztuje gracza, bo oczekujące id jest czyszczone; tu portfel gracza został już obciążony, a tolerowanie spóźnionej odpowiedzi to jedno dodatkowe legalne przejście stanu.
- Tabele wypłat i liczba talii to stałe domeny. Konfiguracja ustawia tylko limity stołów; nie może sprawić, by zakład płacił więcej niż `36/n`, a natural więcej niż 3:2, ta sama myśl co `PayoutRate < 1` w lombardzie.
- Stawki i zakupy w pełnych żetonach, wypłaty do 2 miejsc. Wypłaty ruletki (`36/n` dla 1, 12 albo 18 kieszeni) i 3:2 z pełnej stawki są dokładne w `numeric(18,2)`, więc reguła zaokrąglania nie istnieje; połówki żetonów z 3:2 to powód, dla którego wypłaty przyjmują 2 miejsca, inaczej 0.5 żetonu utknęłoby na koncie.
- Losowość siedzi na brzegu. Handlery losują z `ICasinoRandom` (`RandomNumberGenerator.GetInt32`) albo `ICardSource`, a domena dostaje wynik jako parametr, więc każda reguła jest deterministyczna w testach (`ScriptedCardSource` skryptuje całe rozdania), a odrzucona akcja (409 przy wyścigu) niczego nie ujawnia, bo jej losowanie nie zostało ani zapisane, ani pokazane.
- Zakrytą kartę ukrywa kształt DTO, nie filtrowanie. Żaden typ odpowiedzi trwającego rozdania nie ma właściwości z pełną ręką krupiera, a test integracyjny parsuje surowy JSON odpowiedzi startu i dowodzi, że kodu zakrytej karty tam nie ma. Karta od rozdania siedzi w wierszu bazy, co jest zaakceptowane: dostęp do bazy ją ujawnia, API nie.

Zaakceptowane ryzyka, zapisane przez właściciela 2026-10-17:

- Wariancja tworzy pieniądze. Średnio kasyno jest zlewem, ale pojedynczy zakład prosty zwraca 36 razy stawkę; limity stołów ograniczają jeden spin, a salda nie ogranicza nic. Na endpointach gier nie ma rate limitera, jak wszędzie w API.
- Spam spinów kontra saga. Bot kręcący bez przerwy może wygrywać wyścig o `Version` z handlerem Completed przy każdej z jego 5 prób, posyłając zakup do martwych z obciążonym portfelem i bez żetonów. Naprawą jest wskrzeszenie martwego wiersza, co działa dokładnie dlatego, że spóźnione zakończenie jest tolerowane. Ten sam spam może wielokrotnie wywracać cykl zamiatania rozdań i opóźniać automatyczne pasowanie u innych graczy.
- Martwa wypłata gubi żetony. `CasinoCashOutEvent`, który trafi do martwych, zostawia żetony zdjęte i portfel nieuznany, widoczne tylko w `IsDead`; wypłaty lombardu dzielą to ryzyko.
- Spiny, zakłady i rozdania zostają na zawsze, jak magazyn lombardu; endpointy GET tną historię do 20, a zamiatanie retencji jest odroczone. Rozgrywka nie pisze wierszy outboxa, więc przepustowość outboxa obciążają tylko zakupy i wypłaty.

## Dokumenty powiązane

- [README.md](README.md) - przegląd backendu, uruchomienie, konfiguracja, testy.
- [messaging.md](messaging.md) - outbox, inbox, polityka ponowień, rejestr zdarzeń.
- [wallets.md](wallets.md) - `ReceiveCasinoCashOut` i oba handlery kasyna po stronie Wallets.
- [banking.md](banking.md), [pawnshop.md](pawnshop.md) - bramki obrotu, których kasyno nie może karmić.
