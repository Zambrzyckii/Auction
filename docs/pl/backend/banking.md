# Moduł Banking

> Wersja polska. Angielski odpowiednik 1:1: [../../en/backend/banking.md](../../en/backend/banking.md)

`AuctionServer.Modules.Banking` udziela pożyczek ze stałych, skonfigurowanych ofert, bramkowanych skumulowanym obrotem portfela: żeby wziąć ofertę, gracz musi historycznie otrzymać we wpływach z gospodarki co najmniej jej `RequiredTurnover`, niezależnie od bieżącego salda. Pożyczka jest spłacana jednym pobraniem w terminie zapadalności, ściąganym przez keepera; gdy środki nie pokrywają długu, bank bierze to, co jest, nalicza jednorazową karę i ponawia automatycznie. Wypłata tworzy pieniądze, pobranie niszczy kapitał, odsetki i karę (nikt nie jest uznawany), więc bank jest kranem z wbudowanym zlewem, lustrzanym odbiciem zlewu pieniędzy z wojen magazynowych. Cztery endpointy żyją pod `/api/bank`, wszystkie za JWT.

## Przegląd

| Obszar | Pliki |
|---|---|
| Endpointy | [`Presentation/BankEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Banking/Presentation/BankEndpoints.cs), rekord żądania `CreateLoanRequest` |
| Komendy i zapytania | `Application/Command/CreateLoan/` i `Application/Command/RepayLoan/` (komenda, handler, walidator w każdym), `Application/Queries/GetOffers/` (zapytanie, handler, `LoanOfferDto`), `Application/Queries/GetLoans/` (zapytanie, handler, `LoanDto`) |
| Opcje | `Application/Options/BankingOptions.cs` (`BankingOptions`, `LoanOfferDefinition`) |
| Handlery zdarzeń | `Application/Handlers/LoanApprovedEventHandler.cs`, `LoanRejectedEventHandler.cs`, `LoanRepaymentCollectedEventHandler.cs` |
| Domena | [`Domain/Entities/Loan.cs`](../../../Backend/src/AuctionServer.Modules.Banking/Domain/Entities/Loan.cs), `Domain/Enums/LoanStatus.cs`, [`Domain/Exceptions/BankingExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Banking/Domain/Exceptions/BankingExceptions.cs) |
| Infrastruktura | `Persistence/` (`BankingDbContext`, `BankingRepository`, `Migrations/`), `Configuration/`, `Outbox/`, `Inbox/`, `Background/OutboxProcessor.cs`, [`Background/BankKeeper.cs`](../../../Backend/src/AuctionServer.Modules.Banking/Infrastructure/Background/BankKeeper.cs) |

[`BankingModuleExtensions.AddBankingModule`](../../../Backend/src/AuctionServer.Modules.Banking/BankingModuleExtensions.cs) przyjmuje connection string i instancję `BankingOptions` i waliduje ją na starcie: oferty niepuste z unikalnymi nazwami do 64 znaków, `Principal > 0`, `0 < InterestRate <= 1`, `Term >= 10 s`, `RequiredTurnover >= 0`, `PenaltyRate` w przedziale `[0, 1]`, `CollectionRetryInterval > 0` oraz zarówno `ApprovalTimeout`, jak i `CollectionPendingTimeout` co najmniej 10 minut (horyzont dead letter, zobacz Decyzje). Rejestruje `BankingDbContext`, hosted services `OutboxProcessor` i `BankKeeper`, singleton opcji oraz `IBankingRepository` jako scoped. Jak Wallets moduł czyta i pisze przez EF Core (bez Dappera): zapytania używają `AsNoTracking`, zapisy ładują śledzoną pożyczkę chronioną tokenem współbieżności `Version`.

Strona Wallets obu sag żyje w `Modules.Wallets`: `Application/Handlers/LoanRequestedEventHandler.cs` (bramka obrotu plus uznanie przez `Wallet.DisburseLoan`) i `LoanRepaymentRequestedEventHandler.cs` (obciążenie best effort przez `Wallet.CollectUpTo`). Zobacz [wallets.md](wallets.md).

## Uruchomienie

```bash
# z Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Banking --startup-project src/AuctionServer.Api --context BankingDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Banking --startup-project src/AuctionServer.Api --context BankingDbContext
dotnet test tests/AuctionServer.Modules.Banking.Tests
```

Migracje żyją w [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Banking/Infrastructure/Persistence/Migrations): `20261015110057_Initial_Banking` tworzy wszystkie trzy tabele z filtrowanym unikalnym indeksem.

## Konfiguracja

Cała sekcja `Banking` z `appsettings.json` binduje się do `BankingOptions`; brak sekcji zatrzymuje hosta.

| Klucz | Domyślnie | Efekt |
|---|---|---|
| `Banking:PenaltyRate` | `0.20` | jednorazowa kara naliczana od reszty, gdy pobranie zlecone w `DueOn` lub później zostawia dług |
| `Banking:CollectionRetryInterval` | `00:02:00` | przerwa między próbami pobrania dla pożyczki `Overdue` |
| `Banking:CollectionPendingTimeout` | `00:15:00` | po tym czasie pożyczka `CollectionPending` jest cofana do poprzedniego stanu; walidowane `>= 10 min` |
| `Banking:ApprovalTimeout` | `00:15:00` | po tym czasie pożyczka `PendingApproval` jest odrzucana; walidowane `>= 10 min` |
| `Banking:Offers` | `Quick` 200 / 0.10 / `00:01:00` / obrót 400, `Standard` 1000 / 0.15 / `00:10:00` / 2000, `Long` 5000 / 0.25 / `00:30:00` / 10000 | stały katalog; każda pożyczka kopiuje ofertę jako snapshot, więc zmiana konfiguracji nigdy nie przepisuje istniejących długów. Nie nadpisuj tablicy ze zmiennych środowiskowych w compose (scalanie po indeksie) |

## Model danych

`BankingLoans`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `Id` | `integer` | klucz główny, identity |
| `PublicLoanId` | `uuid` | unikalny identyfikator publiczny, używany w trasach i zdarzeniach |
| `UserId` | `uuid` | unikalny dopóki `Status IN (0, 1, 2, 3)` - jedna otwarta pożyczka na gracza, surowe liczby całkowite w filtrze, nigdy nie renumeruj `LoanStatus` |
| `OfferName` | `text(64)` | snapshot oferty |
| `Principal`, `RequiredTurnover` | `numeric(18,2)` | snapshot |
| `InterestRate`, `PenaltyRate` | `numeric(5,4)` | snapshot |
| `Term` | `interval` | snapshot |
| `TotalDue` | `numeric(18,2)` | `Principal + Round(Principal * InterestRate, 2, AwayFromZero)`, zamrożone w `Create` |
| `Penalty` | `numeric(18,2)` | naliczana dokładnie raz, zobacz Decyzje |
| `AmountRepaid` | `numeric(18,2)` | rośnie z każdym pobraniem |
| `Status` | `integer` | `PendingApproval = 0`, `Active = 1`, `CollectionPending = 2`, `Overdue = 3`, `Repaid = 4`, `Rejected = 5` |
| `RequestedOn` | `timestamptz` | granica timeoutu zatwierdzenia |
| `DueOn` | `timestamptz?` | ustawiane przez `Approve(now)` na `now + Term`; ze `Status` w indeksie złożonym dla zamiatań keepera |
| `LastCollectionRequestedOn` | `timestamptz?` | granica ponowienia i przerwania; decyduje też, czy pobranie jest wczesne, czy późne, w `ApplyCollection` |
| `OverdueSince` | `timestamptz?` | znacznik naliczonej kary, ustawiany raz, nigdy czyszczony |
| `RepaidOn` | `timestamptz?` | ustawiane, gdy `Outstanding` dochodzi do zera |
| `RejectionReason` | `text(256)?` | z Wallets albo od keepera |
| `Version` | `uuid` | token współbieżności odnawiany każdą metodą mutującą |

`Outstanding => TotalDue + Penalty - AmountRepaid` jest liczone w encji i niemapowane. `BankingOutboxMessages` i `BankingProcessedMessages` to kopie modułu tabel outboxa i inboxa.

## API

Wszystkie cztery trasy wymagają JWT.

| Metoda i trasa | Żądanie | Odpowiedź | Handler |
|---|---|---|---|
| `GET /api/bank/offers` | - | 200 z listą `LoanOfferDto` prosto z konfiguracji (bez bazy): nazwa, kapitał, oprocentowanie, `TotalDue` policzone z góry przez `Loan.ComputeTotalDue`, termin, wymagany obrót | `GetOffersQueryHandler` |
| `GET /api/bank/loans` | - | 200 z listą `LoanDto` wołającego, najnowsze pierwsze, maksymalnie 50 | `GetLoansQueryHandler` |
| `POST /api/bank/loans` | `{ offerName }` | 201 z `PublicLoanId` natychmiast; zatwierdzenie jest asynchroniczne - odrzucenie (niewystarczający obrót) pojawia się w GET po ~6-9 s. Nieznana oferta odpowiada 404 przed sprawdzeniem otwartej pożyczki, więc literówka nie może ujawnić stanu konta; druga otwarta pożyczka odpowiada 409 przez filtrowany unikalny indeks | `CreateLoanCommandHandler` |
| `POST /api/bank/loans/{id}/repayments` | puste body | 202; pobranie jest asynchroniczne. Cudza pożyczka odpowiada 404 dokładnie jak brakująca, przed jakimkolwiek strażnikiem encji, więc nie da się sondować id pożyczek; `LoanCollectionInProgressException` i `LoanAlreadyRepaidException` odpowiadają 409 | `RepayLoanCommandHandler` |

## Zdarzenia

| Kierunek | Zdarzenie | Handler i efekt |
|---|---|---|
| publikowane | `LoanRequestedEvent` | pisane przez `CreateLoanCommandHandler` w tym samym zapisie co nowa pożyczka `PendingApproval`; konsumowane przez Wallets, gdzie `Wallet.DisburseLoan(principal, requiredTurnover)` sprawdza bramkę i uznaje atomowo (sama wypłata wlicza się do obrotu) |
| konsumowane | `LoanApprovedEvent` | `LoanApprovedEventHandler` uruchamia `Approve(UtcNow)`: `Active`, `DueOn = now + Term` |
| konsumowane | `LoanRejectedEvent` | `LoanRejectedEventHandler` zapisuje powód; `Rejected` natychmiast zwalnia miejsce w unikalnym indeksie, więc gracz może spróbować od razu |
| publikowane | `LoanRepaymentRequestedEvent` | pisane przez `BankKeeper` (pożyczki `Active` po terminie, ponowienia `Overdue`) albo przez `RepayLoanCommandHandler`, zawsze z `Amount = Outstanding`; konsumowane przez Wallets, gdzie `Wallet.CollectUpTo` bierze `min(AvailableFunds, amount)` - zablokowane środki są nietykalne, a zero jest legalną odpowiedzią |
| konsumowane | `LoanRepaymentCollectedEvent` | `LoanRepaymentCollectedEventHandler` uruchamia `ApplyCollection(collected, now)`: pełne pokrycie przenosi do `Repaid`, częściowe pobranie zlecone przed `DueOn` wraca do `Active` bez kary, częściowe pobranie w `DueOn` lub później przenosi do `Overdue` z jednorazową karą od reszty |

Spóźnione odpowiedzi do pożyczki, która już poszła dalej, nie są tolerowane: handlery nie łapią `InvalidLoanStateTransitionException`, więc wiadomość jest ponawiana i trafia do martwych widocznie, zamiast zostać po cichu pominięta.

## Keeper

[`BankKeeper`](../../../Backend/src/AuctionServer.Modules.Banking/Infrastructure/Background/BankKeeper.cs) to `BackgroundService` z pętlą 5000 ms. Każdy cykl wykonuje cztery zamiatania w kolejności najpierw siatek bezpieczeństwa, każde ładujące najwyżej 50 pożyczek i zapisujące mutacje agregatów razem z wierszami outboxa w jednym `SaveChangesAsync`: odrzuca pożyczki `PendingApproval` starsze niż `ApprovalTimeout` ("Approval timed out"), przerywa pożyczki `CollectionPending` starsze niż `CollectionPendingTimeout` (`AbortCollection` zwraca pożyczkę do `Active` albo `Overdue` według `OverdueSince` i niczego nie nalicza - zgubiona wiadomość nie jest winą gracza), zleca pobranie dla pożyczek `Active` z `DueOn` w przeszłości oraz ponawia pożyczki `Overdue`, których ostatnie żądanie jest starsze niż `CollectionRetryInterval`. Keeper nie ma testów zgodnie z konwencją repozytorium; każda decyzja żyje w `Loan` i jest tam testowana.

## Decyzje

- Stałe oprocentowanie za cały okres: `TotalDue = Principal + Round(Principal * InterestRate, 2, MidpointRounding.AwayFromZero)`, liczone raz w `Create` i zamrożone. Roczna stopa zaokrągliłaby się do 0.00 przy terminach w skali minut. Jawne `AwayFromZero` omija domyślne zaokrąglanie bankiera, które posyła dokładne pół centa w dół do najbliższej parzystej cyfry. Konsekwencja stałego oprocentowania: brak rabatu za wcześniejszą spłatę.
- Bramka obrotu żyje w Wallets, nie w Banking: tylko Wallets widzi każdy ruch pieniędzy, a moduły nie mogą czytać nawzajem swoich tabel, więc udzielenie to saga żądanie/zatwierdzenie/odrzucenie odwzorowująca sagę blokady środków. Sprawdzenie bramki i uznanie to jedno wywołanie encji (`Wallet.DisburseLoan`), więc są atomowe w jednym zapisie.
- `LifetimeTurnover` liczy wyłącznie wpływy z gospodarki (`AddFunds`: sprzedaże do sklepu, rozliczenia aukcji, doładowania botów, wypłaty lombardu) plus wypłaty pożyczek. Przelewy między graczami są wyłączone (pętla A do B do A pompowałaby oba liczniki za darmo), tak samo środki startowe (świeży gracz startuje od obrotu 0, według przykładu właściciela) i wypłaty z kasyna (hedgowana ruletka recyklinguje pieniądze ze stratą 1/37 i kupowałaby bramki tanio). Historycznych sald nie da się uzupełnić wstecz, więc portfele istniejące przed migracją też startują od 0.
- Kara jest naliczana dokładnie raz, strzeżona przez `OverdueSince == null`, a nie przez `Penalty > 0`: mała reszta może legalnie zaokrąglić się do kary 0.00, a strażnik oparty na kwocie naliczyłby ją ponownie (i przesunął datę) przy każdym kolejnym nieudanym pobraniu.
- `ApprovalTimeout` i `CollectionPendingTimeout` są walidowane `>= 10 min`, bo to horyzont dead letter: backoff outboxa to 20+40+80+160 s (około 5 minut) na skok, a runda sagi ma dwa skoki. Timeout krótszy niż horyzont pozwoliłby keeperowi przerwać pobranie, którego odpowiedź jeszcze nadchodzi, i otworzyłby na nowo wyścigi podwójnego pobrania i wolnego kapitału. Odpowiedzi, które nadejdą po tym, jak stan poszedł dalej, trafiają do martwych widocznie.
- Pieniądze zablokowane pod oferty aukcyjne i wpisowe wojen magazynowych są celowo niepobieralne (`CollectUpTo` widzi tylko `AvailableFunds`), więc gracz może zadłużyć się na wojnę; jeśli wojna jest przegrana, pożyczka przechodzi w `Overdue` z karą. To zamierzona presja, nie błąd.
- `Wallet.CollectUpTo` zwraca zero bez ruszania `Version`: puste pobranie niczego nie zmienia, więc nie może generować UPDATE, który mógłby przewrócić równoległą blokadę środków na tym samym portfelu.

Zaakceptowane ryzyka, zapisane przez właściciela 2026-10-15:

- Pranie pożyczek przez konta jednorazowe pozostaje możliwe: rejestracja jest darmowa, więc gracz może pożyczyć, przelać kapitał na drugie konto i porzucić dług, a samą bramkę obrotu da się wyhodować wash-tradingiem aukcjami między własnymi kontami (przelewy są wyłączone z obrotu, rozliczenia aukcji nie). Zaakceptowane, dopóki w gospodarce grają boty na skalę portfolio; odłożone mitygacje to wymóg wieku konta, blokada przelewów przy otwartej pożyczce i obrót ważony kontrahentami.
- Bank ignoruje `IsSuspendedWallet` przy wypłacie i pobraniu, spójnie z każdą inną ścieżką uznań w Wallets.
- Ręcznie wskrzeszony martwy wiersz outboxa może powtórzyć wiadomość pobrania po tym, jak keeper już to pobranie wycofał; matematyka timeoutów pokrywa tylko wiadomości, które umierają same. Wskrzeszanie martwych wiadomości to działanie operatora, nie ścieżka gry.

## Powiązane dokumenty

- [README.md](README.md) - przegląd backendu, uruchamianie, konfiguracja, testy.
- [messaging.md](messaging.md) - outbox, inbox, polityka ponowień, rejestr zdarzeń.
- [wallets.md](wallets.md) - `LifetimeTurnover`, `DisburseLoan`, `CollectUpTo` i oba handlery po stronie Wallets.
