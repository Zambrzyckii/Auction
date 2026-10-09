# Boty (planowane)

> Wersja polska. Angielski odpowiednik 1:1: [../en/bots.md](../en/bots.md)

Ten moduł jeszcze nie istnieje: repozytorium nie zawiera folderu `Bots/` ani kodu w Pythonie. Istnieje natomiast backendowa strona kontraktu: rola `Bot`, endpoint provisioningu chroniony kluczem API, długowieczne tokeny i dwa endpointy tylko dla botów.

## Status

Planowane. Usunięta notatka projektowa (`AGENTS.md`) opisuje „AI BOTS" jako autonomicznych aktorów, którzy nasłuchują zdarzeń rynkowych na RabbitMQ i wysyłają komendy przez API gateway, napisanych w Pythonie; ani broker, ani gateway nie istnieją, więc pierwszy bot musiałby odpytywać HTTP API.

## Projekt docelowy

- Procesy w Pythonie, każdy działający na własnym koncie bota.
- Wejście: zdarzenia rynkowe (`AuctionActivatedEvent`, `BidPlacedEvent`, `AuctionFinishedEvent`) konsumowane z RabbitMQ, gdy transport będzie gotowy.
- Wyjście: komendy przez gateway, czyli te same endpointy HTTP, których używają gracze, plus endpointy tylko dla botów.
- Cel, na tyle, na ile jest zapisany: „boty rynkowe AI", które samodzielnie działają na rynku; endpointy tylko dla botów (tworzenie przedmiotów, dodawanie środków) pokazują, że boty mają wprowadzać przedmioty i pieniądze do obiegu.

## Co backend już zapewnia

| Potrzeba | Dostępne dziś |
|---|---|
| konto | `POST /api/users/bots` z nagłówkiem `X-Api-Key` równym `Bots:ApiKey`; zwraca `{ publicUserId }`; konto dostaje `Role.Bot` i portfel ze `Wallets:StartingFunds` |
| sesja | `POST /api/users/login` zwraca token ważny 24 godziny dla konta bota (15 minut dla graczy) |
| akcje tylko dla botów | `POST /api/wallets/funds` (doładowanie własnego portfela bota) i `POST /api/inventory/items` (utworzenie przedmiotu o wybranej nazwie i rzadkości w ekwipunku samego bota), oba za polityką `Bot` |
| akcje rynkowe | te same endpointy co gracze: tworzenie aukcji, licytacja, crafting, sprzedaż do sklepu, odczyt aukcji i portfeli |

## Czego brakuje

- Brak strumienia zdarzeń poza procesem: `AuctionActivatedEvent` i pozostałe zdarzenia docierają tylko do handlerów MediatR w procesie, więc bot nie może niczego subskrybować, dopóki nie powstanie transport RabbitMQ.
- Brak gatewaya i brak limitowania żądań, więc bot rozmawia prosto z hostem i nic go nie dławi.
- Brak historii ofert i zapytania „moje aukcje", więc bot musi pamiętać, co zrobił.
- Brak unieważniania tokenów i endpointu wyłączającego konto, więc token bota pozostaje ważny przez pełne 24 godziny.

## API

Endpointy, które wołałby bot, w kolejności typowej sesji: `POST /api/users/bots` (raz, przez provisionera), `POST /api/users/login`, `POST /api/inventory/items`, `POST /api/auctions`, `GET /api/auctions?limit=100`, `POST /api/auctions/{id}/bid`, `GET /api/wallets/{id}`. Kształty żądań i odpowiedzi są w rozdziałach modułów podlinkowanych niżej.

## Decyzje

- Boty to pełnoprawne konta z rolą, a nie osobna ścieżka uwierzytelniania, więc każda akcja rynkowa bota przechodzi przez tę samą walidację i te same zdarzenia co akcja gracza.
- Provisioning jest chroniony kluczem API, który ma tylko operator; token bota nie może tworzyć innych botów, co przypinają `BotProvisioningApiTests`.
- Python został wskazany jako język botów w pierwotnej notatce projektowej; nic więcej nie zdecydowano.

## Powiązane dokumenty

- [backend/identity.md](backend/identity.md) - provisioning, role i czasy życia tokenów.
- [backend/wallets.md](backend/wallets.md) i [backend/inventory.md](backend/inventory.md) - endpointy tylko dla botów.
- [infrastructure.md](infrastructure.md) - broker i gateway, od których zależą boty.
