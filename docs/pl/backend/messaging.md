# Komunikaty: Shared.Integration, outbox i inbox

> Wersja polska. Angielski odpowiednik 1:1: [../../en/backend/messaging.md](../../en/backend/messaging.md)

`AuctionServer.Shared.Integration` to jedyny projekt referencowany przez każdy moduł, a tabele outboxa i inboxa to jedyna droga, którą moduły wpływają na siebie nawzajem. Ten rozdział opisuje projekt współdzielony, wiersz outboxa i jego procesor, politykę ponowień i martwych wiadomości, wzorzec inboxa po stronie konsumenta, szew publishera, który zastąpiłby broker wiadomości, oraz katalog dziewięciu zdarzeń integracyjnych.

## Przegląd

[`AuctionServer.Shared.Integration`](../../../Backend/src/AuctionServer.Shared.Integration/AuctionServer.Shared.Integration.csproj) celuje w `net10.0`, zależy wyłącznie od `MediatR` i `FluentValidation` i zawiera cztery foldery:

| Folder | Zawartość |
|---|---|
| `Events/` | dziewięć typów `record` implementujących `INotification` z MediatR; każdy rekord zaczyna się od `Guid EventId` |
| `Exceptions/` | `AppException(message, statusCode)`, abstrakcyjna baza każdego wyjątku domenowego, oraz `RequestValidationException` (400) |
| `Messaging/` | `IIntegrationEventPublisher` (szew publishera) i `IntegrationEventTypes` (rejestr nazwa→typ używany do deserializacji wierszy outboxa) |
| `Validators/` | `ValidationBehaviour<,>`, behavior pipeline'u MediatR uruchamiający walidatory FluentValidation przed handlerem |

Moduły zależą od tego projektu dla kontraktów zdarzeń i bazy wyjątków; host dodatkowo implementuje `IIntegrationEventPublisher` w [`InProcessEventPublisher`](../../../Backend/src/AuctionServer.Api/Infrastructure/Messaging/InProcessEventPublisher.cs).

## Outbox

Diagram pokazuje jedno zdarzenie wędrujące z transakcji modułu produkującego do transakcji modułu konsumującego.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../diagrams/backend-messaging-01-outbox-to-inbox.dark.svg">
  <img alt="Diagram: z outboxa do inboxa" src="../../diagrams/backend-messaging-01-outbox-to-inbox.svg">
</picture>

Każdy moduł ma własną kopię [`OutboxMessage`](../../../Backend/src/AuctionServer.Modules.Auctions/Infrastructure/Outbox/OutboxMessage.cs) i [`OutboxProcessor`](../../../Backend/src/AuctionServer.Modules.Auctions/Infrastructure/Background/OutboxProcessor.cs); cztery kopie różnią się tylko używanym `DbContext`em oraz, w Identity, dwoma publicznymi setterami (`Errors`, `IsDead`) i klasą procesora bez `sealed`. Tabele to `OutboxMessages` (Auctions, bez wywołania `ToTable`), `WalletsOutboxMessages`, `InventoryOutboxMessages` i `IdentityOutboxMessages`.

| Kolumna | Typ | Znaczenie |
|---|---|---|
| `Id` | `uuid` | klucz główny; producenci ustawiają go na `EventId` zdarzenia (jeden wyjątek, zobacz katalog) |
| `Type` | `text` | nazwa klasy zdarzenia (`nameof(...)`), klucz do `IntegrationEventTypes` |
| `Content` | `text` | zdarzenie zserializowane przez `System.Text.Json` |
| `CreatedOn` | `timestamptz` | ustawiane na `DateTime.UtcNow` przy tworzeniu wiersza; kolejność odpytywania |
| `ProcessedOn` | `timestamptz`, nullowalna | ustawiane przez `MarkAsProcessed` po udanej publikacji |
| `AttemptCount` | `integer` | startuje od 1; inkrementowane przez `FailedAttempt` |
| `Errors` | `text[]` | jeden komunikat wyjątku na nieudaną próbę, nigdy nie przycinane |
| `IsDead` | `boolean` | ustawiane przez `MarkMessageAsDead`; martwe wiersze są wyłączone z odpytywania |
| `NextAttemptOn` | `timestamptz`, nullowalna | najwcześniejszy czas kolejnej próby, liczony przez `FailedAttempt` |

Producent nigdy nie publikuje bezpośrednio: dodaje wiersz do `DbContext`u modułu i zapisuje go razem ze zmianą encji (`CreateAuctionAsync`, `SaveChangesWithOutboxAsync`, `AddUserWithOutboxAsync` oraz warianty inbox-i-outbox wymienione niżej), więc albo oba commitują się razem, albo żaden.

`OutboxProcessor` to `BackgroundService` rejestrowany przez każde wywołanie `Add<Module>Module`. Jego pętla uruchamia `ProcessPendingMessagesAsync`, loguje `Outbox processing cycle failed` przy dowolnym wyjątku i czeka 3 s (`Task.Delay(3000)`) przed kolejnym cyklem. Jeden cykl otwiera scope DI, pobiera `DbContext` modułu i `IIntegrationEventPublisher`, wybiera do 20 wierszy, w których `ProcessedOn` jest null, `IsDead` jest false, a `NextAttemptOn` jest null lub w przeszłości, uporządkowanych po `CreatedOn`, i obsługuje je po kolei: `PublishAsync(Id, Type, Content)`, potem `MarkAsProcessed()`, a przy wyjątku `FailedAttempt(e.Message)`, `MarkMessageAsDead()`, gdy `AttemptCount` przekroczy 5, oraz wpis w logu `Failed to process outbox message {MessageId}`. `SaveChangesAsync` wykonuje się po każdej wiadomości, więc jeden zatruty wiersz nie blokuje wierszy za nim.

## Ponowienia i martwe wiadomości

Diagram pokazuje stany jednego wiersza outboxa.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../diagrams/backend-messaging-02-outbox-message-lifecycle.dark.svg">
  <img alt="Diagram: cykl życia wiadomości outboxa" src="../../diagrams/backend-messaging-02-outbox-message-lifecycle.svg">
</picture>

`FailedAttempt` najpierw inkrementuje `AttemptCount`, a potem ustawia `NextAttemptOn = now + 2^AttemptCount × 5 s`, więc opóźnienia rosną od 20 s; procesor oznacza wiersz jako martwy, gdy `AttemptCount` jest większe niż 5, co następuje przy piątej nieudanej publikacji.

| Nieudana publikacja | `AttemptCount` po porażce | Czekanie przed kolejną próbą |
|---|---|---|
| 1. | 2 | 20 s |
| 2. | 3 | 40 s |
| 3. | 4 | 80 s |
| 4. | 5 | 160 s |
| 5. | 6 | brak, wiersz jest oznaczany jako martwy |

Martwy wiersz zachowuje pełną historię `Errors`, a nic w kodzie go nie odtwarza; ożywienie oznacza ręczne wyzerowanie `IsDead`. Cztery tabele można przejrzeć zwykłym zapytaniem, na przykład:

```sql
SELECT "Id", "Type", "AttemptCount", "Errors" FROM "OutboxMessages" WHERE "IsDead";
```

## Inbox

Moduł konsumujący trzyma tabelę `ProcessedMessages` z jedną znaczącą kolumną, `EventId` (klucz główny), plus `ProcessedOn`; encją jest [`ProcessedMessage`](../../../Backend/src/AuctionServer.Modules.Auctions/Infrastructure/Inbox/ProcessedMessage.cs), a tabele to `AuctionsProcessedMessages`, `WalletsProcessedMessages` i `InventoryProcessedMessages`. Identity nie konsumuje zdarzeń i nie ma inboxa. Każdy handler konsumujący wykonuje te same kroki:

1. Woła `WasEventProcessedAsync(EventId)` i kończy, gdy id jest już zapisane.
2. Ładuje agregat i wykonuje zmianę domenową.
3. Dodaje `ProcessedMessage` z id zdarzenia oraz, gdy moduł odpowiada, `OutboxMessage` z odpowiedzią.
4. Zapisuje wszystko jednym wywołaniem repozytorium używającym `CancellationToken.None`, żeby anulowane żądanie nie przerwało zmiany pieniędzy lub stanu w połowie.
5. Łapie `EventAlreadyProcessedException` (409) swojego modułu i kończy: repozytorium rzuca go przy naruszeniu klucza głównego `ProcessedMessages`, i tak wykrywany jest równoległy duplikat.

| Handler | Moduł | Metoda zapisu | Odpowiedź |
|---|---|---|---|
| `UserRegisteredEventHandler` | Wallets | `AddWalletAsync` | brak; bez inboxa, duplikat rzuca `WalletAlreadyExistException`, który handler połyka |
| `BidPlacedEventHandler` | Wallets | `SaveUserFundsWithInboxAsync` | brak |
| `AuctionFinishedEventHandler` | Wallets | `SaveUserFundsWithInboxAndOutboxAsync` | `AuctionSettledEvent` |
| `ItemSoldToShopEventHandler` | Wallets | `SaveUserFundsWithInboxAsync` | brak |
| `ItemLockedEventHandler` | Auctions | `SaveChangesWithInboxAndOutboxAsync` | `AuctionActivatedEvent` |
| `ItemLockRejectedEventHandler` | Auctions | `SaveChangesWithInboxAsync` | brak |
| `ItemLockRequestedEventHandler` | Inventory | `SaveChangesWithInboxAndOutboxAsync` | `ItemLockedEvent` albo `ItemLockRejectedEvent` |
| `AuctionFinishedEventHandler` | Inventory | `SaveChangesWithInboxAsync` | brak |
| `AuctionSettledEventHandler` | Inventory | `SaveChangesWithInboxAsync` | brak |

Łapany jest wyłącznie `EventAlreadyProcessedException`. Brakujący agregat (`AuctionNotFoundException`, `UserWithThisIdDontHaveWallet`, `UserOrItemDoesntExistException`), reguła domenowa (`InsufficientFundsException`, `InsufficientLockedFundsException`, `ItemNotLockedException`, `InvalidAuctionStateTransitionException`) i `DbUpdateConcurrencyException` propagują do `OutboxProcessor`a producenta, gdzie liczą się jako nieudana próba. Zamysł to widoczna porażka: wiadomość, której nie da się zastosować, kończy jako martwa z zapisanym powodem, zamiast zostać pominięta.

## Szew publishera

[`IIntegrationEventPublisher`](../../../Backend/src/AuctionServer.Shared.Integration/Messaging/IIntegrationEventPublisher.cs) ma jedną metodę, `PublishAsync(Guid messageId, string type, string content, CancellationToken token)`. Host rejestruje dla niej `InProcessEventPublisher` jako serwis scoped w [`Program.cs`](../../../Backend/src/AuctionServer.Api/Program.cs); implementacja ignoruje `messageId`, woła [`IntegrationEventTypes.Deserialize(type, content)`](../../../Backend/src/AuctionServer.Shared.Integration/Messaging/IntegrationEventTypes.cs) i przekazuje wynik do `IPublisher.Publish` MediatR, który uruchamia handlery jeden po drugim w kolejności rejestracji DI (assembly Auctions, Wallets, Identity, Inventory). `Deserialize` rzuca `NotSupportedException` dla typu, którego nie ma w rejestrze, i `JsonException` dla pustego ładunku; oba trafiają do `Errors` wiersza outboxa.

Zastąpienie szyny in-process brokerem oznacza jedną nową implementację `IIntegrationEventPublisher`, która wysyła `Type` i `Content` do brokera, plus konsumenta po stronie hosta, który deserializuje przychodzące wiadomości w ten sam sposób i publikuje je do MediatR; moduły, ich outboxy i inboxy zostają bez zmian. Dodanie zdarzenia oznacza dodanie rekordu do `Events/` i jednej linii do rejestru; producent zapisuje `nameof(TheEvent)` w `Type`.

## Katalog zdarzeń

| Zdarzenie | Ładunek (poza `EventId`) | Producent | Konsumenci | `Id` outboxa równe `EventId` |
|---|---|---|---|---|
| `UserRegisteredEvent` | `PublicUserId`, `Email` | Identity `RegisterCommandHandler`, `RegisterBotCommandHandler` | Wallets `UserRegisteredEventHandler` | tak |
| `ItemLockRequestedEvent` | `PublicAuctionId`, `PublicItemId`, `SellerUserId` | Auctions `CreateAuctionCommandHandler` | Inventory `ItemLockRequestedEventHandler` | tak |
| `ItemLockedEvent` | `PublicAuctionId`, `PublicItemId`, `ItemName`, `ItemRarity`, `OfficialPrice` | Inventory `ItemLockRequestedEventHandler` | Auctions `ItemLockedEventHandler` | tak |
| `ItemLockRejectedEvent` | `PublicAuctionId`, `PublicItemId`, `Reason` | Inventory `ItemLockRequestedEventHandler` | Auctions `ItemLockRejectedEventHandler` | tak |
| `AuctionActivatedEvent` | `PublicAuctionId`, `SellerUserId`, `PublicItemId`, `ItemName`, `ItemRarity`, `ItemOfficialPrice`, `CurrentPrice`, `EndsOn` | Auctions `ItemLockedEventHandler` | brak | tak |
| `BidPlacedEvent` | `PublicAuctionId`, `NewWinningUserId`, `PreviousWinningUserId?`, `NewPrice`, `PreviousPrice?` | Auctions `PlaceBidCommandHandler` | Wallets `BidPlacedEventHandler` | tak |
| `AuctionFinishedEvent` | `PublicAuctionId`, `SellerUserId`, `WinnerUserId?`, `FinalPrice?` | Auctions `AuctionCloser` | `AuctionFinishedEventHandler` w Wallets i Inventory | tak |
| `AuctionSettledEvent` | `PublicAuctionId`, `SellerUserId`, `WinnerUserId`, `FinalPrice` | Wallets `AuctionFinishedEventHandler` | Inventory `AuctionSettledEventHandler` | tak |
| `ItemSoldToShopEvent` | `PublicItemId`, `OwnerUserId`, `Price` | Inventory `SellItemToShopCommandHandler` | Wallets `ItemSoldToShopEventHandler` | nie, dwa osobne wywołania `Guid.NewGuid()` |

## Decyzje

- Outbox i inbox są skopiowane do każdego modułu zamiast leżeć w `Shared.Integration`, dzięki czemu projekt współdzielony pozostaje assembly z samymi kontraktami, bez zależności od EF Core; ceną są cztery identyczne klasy do utrzymania w synchronizacji (zobacz [ADR-002](../adr/002-transactional-outbox-and-inbox.md)).
- Szyna jest in-process, a publisher to szew, więc moduły od początku były pisane pod dostarczanie at-least-once i broker można wprowadzić bez ich dotykania (zobacz [ADR-003](../adr/003-in-process-event-bus-before-rabbitmq.md)).
- Handlery celowo wypuszczają nieoczekiwane wyjątki, więc wiadomość, której nie da się zastosować, staje się martwym wierszem z historią błędów, a nie cichym pominięciem.

## Powiązane dokumenty

- [README.md](README.md) - przegląd backendu, uruchomienie, konfiguracja, testy.
- [../ARCHITECTURE.md](../ARCHITECTURE.md) - trzy przepływy aukcji jako diagramy sekwencji.
- [auctions.md](auctions.md), [wallets.md](wallets.md), [inventory.md](inventory.md), [identity.md](identity.md) - producenci i konsumenci per moduł.
- [../adr/002-transactional-outbox-and-inbox.md](../adr/002-transactional-outbox-and-inbox.md), [../adr/003-in-process-event-bus-before-rabbitmq.md](../adr/003-in-process-event-bus-before-rabbitmq.md) - dwa ADR-y o komunikatach.
