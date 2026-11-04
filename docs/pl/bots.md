# Boty (planowane)

> Wersja polska. Angielski odpowiednik 1:1: [../en/bots.md](../en/bots.md)

Ten moduł jeszcze nie istnieje: repozytorium nie zawiera folderu `Bots/` ani kodu w Pythonie. Istnieje natomiast backendowa strona kontraktu: rola `Bot`, endpoint provisioningu chroniony kluczem API, długowieczne tokeny i dwa endpointy tylko dla botów.

## Status

Planowane. Usunięta notatka projektowa (`AGENTS.md`) opisuje „AI BOTS" jako autonomicznych aktorów, którzy nasłuchują zdarzeń rynkowych na RabbitMQ i wysyłają komendy przez API gateway, napisanych w Pythonie. Od 2026-11-04 broker działa w stacku Compose i feed rynkowy istnieje (zobacz [Feed rynkowy](#feed-rynkowy)), więc pierwszy bot może subskrybować zamiast odpytywać.

## Projekt docelowy

- Procesy w Pythonie, każdy działający na własnym koncie bota.
- Wejście: zdarzenia rynkowe (`AuctionActivatedEvent`, `BidPlacedEvent`, `AuctionFinishedEvent`, `AuctionCancelledEvent`) konsumowane z exchange'a RabbitMQ `auctionserver.market`, żywego od 2026-11-04.
- Wyjście: komendy przez gateway, czyli te same endpointy HTTP, których używają gracze, plus endpointy tylko dla botów. Kolejka RabbitMQ służy botom wyłącznie do odczytu. Komenda nigdy nie podróżuje przez brokera, a każdy zapis bota to zwykłe synchroniczne wywołanie HTTP, takie samo jak gracza ([ADR-008](adr/008-synchronous-writes-outbox-boundary.md)).
- Cel, na tyle, na ile jest zapisany: „boty rynkowe AI", które samodzielnie działają na rynku; endpointy tylko dla botów (tworzenie przedmiotów, dodawanie środków) pokazują, że boty mają wprowadzać przedmioty i pieniądze do obiegu.

## Feed rynkowy

Od 2026-11-04 host publikuje ponownie cztery publiczne zdarzenia aukcyjne na trwałym exchange'u topic `auctionserver.market`, z nazwą typu zdarzenia jako kluczem routingu (`AuctionActivatedEvent`, `BidPlacedEvent`, `AuctionFinishedEvent`, `AuctionCancelledEvent`; allowlistą jest zbiór `MarketEvents` hosta, zobacz [ADR-013](adr/013-rabbitmq-transport.md)). Wiadomość niesie id zdarzenia we właściwości AMQP `MessageId`, nazwę typu w `Type` i surowy JSON zdarzenia jako body, te same kształty, które konsumują handlery (zobacz [katalog zdarzeń](backend/messaging.md#katalog-zdarzen)). Feed jest tylko do konsumpcji i at-least-once: bot deklaruje własną kolejkę, wiąże ją z wybranymi kluczami routingu (albo `#` dla wszystkich czterech) i musi tolerować duplikaty, deduplikując po `MessageId`, gdy jego akcje nie są naturalnie idempotentne. Broker słucha na `rabbitmq:5672` wewnątrz composowej sieci `data` z deweloperskimi poświadczeniami `auction`/`auction`, a UI zarządzania na `127.0.0.1:15672` pokazuje exchange'e i kolejki na żywo. Żaden port AMQP nie jest opublikowany na hosta, więc proces bota albo dołącza do sieci Compose, albo czeka na operacyjną decyzję o wystawieniu brokera.

## Co backend już zapewnia

| Potrzeba | Dostępne dziś |
|---|---|
| konto | `POST /api/users/bots` z nagłówkiem `X-Api-Key` równym `Bots:ApiKey`; zwraca `{ publicUserId }`; konto dostaje `Role.Bot` i portfel ze `Wallets:StartingFunds` |
| sesja | `POST /api/users/login` zwraca token ważny 24 godziny dla konta bota (15 minut dla graczy) |
| akcje tylko dla botów | `POST /api/wallets/funds` (doładowanie własnego portfela bota) i `POST /api/inventory/items` (utworzenie przedmiotu o wybranej nazwie i rzadkości w ekwipunku samego bota), oba za polityką `Bot` |
| akcje rynkowe | te same endpointy co gracze: tworzenie aukcji, licytacja, crafting, sprzedaż do sklepu, odczyt aukcji i portfeli |

## Czego brakuje

- Brak kodu botów: feed istnieje, ale nic go jeszcze nie konsumuje, nie ma też skryptu provisioningu.
- Gateway ogranicza bota jak każdego klienta po adresie (60 żądań na sekundę z tokenem bearer) i nie odróżnia botów, bo strefa botów po `X-Api-Key` wypadła ([ADR-006](adr/006-nginx-gateway.md)). Kilka botów na jednej maszynie dzieli jeden adres, a więc jedną pulę 60 żądań na sekundę.
- Brak historii ofert i zapytania „moje aukcje", więc bot musi pamiętać, co zrobił.
- Brak unieważniania tokenów i endpointu wyłączającego konto, więc token bota pozostaje ważny przez pełne 24 godziny.

## API

Endpointy, które wołałby bot, w kolejności typowej sesji: `POST /api/users/bots` (raz, przez provisionera), `POST /api/users/login`, `POST /api/inventory/items`, `POST /api/auctions`, `GET /api/auctions?limit=100`, `POST /api/auctions/{id}/bid`, `GET /api/wallets/{id}`. Kształty żądań i odpowiedzi są w rozdziałach modułów podlinkowanych niżej.

## Decyzje

- Boty to pełnoprawne konta z rolą, a nie osobna ścieżka uwierzytelniania, więc każda akcja rynkowa bota przechodzi przez tę samą walidację i te same zdarzenia co akcja gracza.
- Provisioning jest chroniony kluczem API, który ma tylko operator; token bota nie może tworzyć innych botów, co przypinają `BotProvisioningApiTests`.
- Python został wskazany jako język botów w pierwotnej notatce projektowej; nic więcej nie zdecydowano.
- Mutujące żądania nie są kolejkowane, ani dla botów, ani dla graczy. Jedyną granicą asynchroniczności jest outbox, zob. [ADR-008](adr/008-synchronous-writes-outbox-boundary.md).

## Powiązane dokumenty

- [backend/identity.md](backend/identity.md) - provisioning, role i czasy życia tokenów.
- [backend/wallets.md](backend/wallets.md) i [backend/inventory.md](backend/inventory.md) - endpointy tylko dla botów.
- [infrastructure.md](infrastructure.md) - broker i gateway, od których zależą boty, z sekcją brokera pod [Broker komunikatów](infrastructure.md#broker-komunikatow).
