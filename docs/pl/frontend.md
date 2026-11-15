# Frontend

> Wersja polska. Angielski odpowiednik 1:1: [../en/frontend.md](../en/frontend.md)

Szkielet istnieje od 2026-11-08: `Frontend/` to workspace Angular 22 CLI (komponenty standalone, sygnały, zoneless change detection, Vitest, SCSS) z dev serverem proxującym `/api` do gatewaya. Widoki MVP weszły 2026-11-10, a widoki modułów 2026-11-14, więc ta strona opisuje, co klient robi dziś, co oferuje mu backend i czego wciąż brakuje.

## Status

Widoki modułów weszły 2026-11-14 na stacku wybranym w [ADR-015](adr/015-angular-frontend-stack.md): każdy moduł backendu ma już widok (przelewy, pożyczki bankowe, żetony kasyna z ruletką i blackjackiem, lombard, wojny magazynowe, profil własny i publiczny ze znajomymi i zaproszeniami) obok aukcji, ekwipunku i portfela z MVP. Trasy zalogowane siedzą za guardem tokenu, a 401 czyści sesję i przekierowuje na login z returnUrl (refresh tokeny czekają jako issue #18). Polling jest bazą, a każdy widok dobiera swój rytm: detal aukcji i jej oferty co 2,5 s, detal wojny magazynowej co sekundę w trakcie licytacji i co 2,5 s poza nią, portfele, ekwipunek i lista magazynów co 5 s, lista aukcji, historie gier i zaproszenia co 10 s, a widoki oparte na sagach (oczekujący zakup żetonów, oczekująca płatność lombardu, oczekująca pożyczka) schodzą do 2 s, póki coś jest w locie; przy 5xx i błędach sieci poller wycofuje się wykładniczo do 30 s, a 429 honoruje `Retry-After`. Przyciski akcji stoją za precheckami, które odwzorowują kolejność guardów serwera i używają jego tekstów odmów tam, gdzie klient je zna, a wymienione niżej stałe po stronie klienta (statusy pożyczek, typy zakładów ruletki, etykiety kart, limity walidatorów) lustrzą konfigurację backendu, natomiast taryfy i terminy, które klient kiedyś lustrzył (przebicia magazynów, wygaśnięcie zaproszenia, auto-pasowanie w blackjacku), od etapu trzeciego przychodzą z serwera. Autorytetem pozostaje serwer, a prechecki są podpowiedziami. Widoki pamiętają to, czego serwer nie powtórzy: przeładowana ręka blackjacka jest rekoncyliowana zamiast nadpisywana, a wpisowe magazynu odrzucone przez portfel jest wykrywane z własnego stempla dołączenia klienta, bo API nie zostawia po odmowie żadnego śladu. Każda partia była weryfikowana skryptowym przebiegiem Playwright na stacku compose, a przebieg końcowy powtórzył przepływy modułów na stacku zbudowanym od zera. UI pozostaje celowo surowe, czytelne tylko do testów ręcznych; właściwy przebieg UI/UX to osobna gałąź planu na końcu projektu. Etap trzeci (od 2026-11-14 do 2026-11-15) domknął siedem braków API, które ta strona kiedyś wymieniała. Własne aukcje i historia wojen przychodzą z `GET /api/auctions/mine` i `GET /api/warehouses/mine`, detal wojny niesie przebicia taryfy, serwer wysyła wygaśnięcie zaproszenia i termin auto-pasowania w blackjacku, a zaproszenie można odrzucić. Od 2026-11-15 widoki rozwiązują nazwy użytkowników hurtem przez `GET /api/profiles?ids=`, wybierają znajomych i odbiorców przelewów przez wyszukiwarkę nazw i ładują awatary zwykłym `<img>` z anonimowej trasy awatara. Od 2026-11-15 klient słucha też nudge'ów, które host wysyła przez `GET /api/push` ([ADR-016](adr/016-server-sent-events-push.md)). `App` otwiera jeden strumień na kartę po zalogowaniu, a widok odświeża swój poller w chwili nadejścia swojego tematu, więc wynik trafia na ekran w ciągu sekundy zamiast o jeden poll później (szczegóły w sekcji o kliencie push poniżej).

## Docelowy kształt

- Aplikacja single-page w Angularze, która rozmawia z backendem wyłącznie przez gateway API na `http://localhost:8080`, istniejący od 2026-10-23.
- Przepływy gracza: rejestracja i logowanie, przeglądanie i prowadzenie aukcji, zarządzanie ekwipunkiem i portfelem, przelewy, branie i spłacanie pożyczek, ruletka i blackjack na żetonach kasyna, prowadzenie lombardu, wojny magazynowe ze znajomymi i publiczny profil.
- Uwierzytelnianie JWT z `POST /api/users/login`, przechowywanym po stronie klienta i wysyłanym jako bearer token; tokeny graczy wygasają po 15 minutach, więc klient potrzebuje ponownego logowania albo przyszłego przepływu refresh.

## Co zapewnia backend

| Potrzeba | Dostępne dziś |
|---|---|
| publiczne przeglądanie bez logowania | `GET /api/auctions?limit=N` (aktywne aukcje po `EndsOn`), `GET /api/auctions/{id}` (dowolny status, z `CancellationReason`), `GET /api/auctions/{id}/bids` (potwierdzone oferty, od najnowszych) |
| własne aukcje | `GET /api/auctions/mine` (aukcje wołającego w każdym statusie, od najnowszych, najwyżej 50) |
| konta | `POST /api/users/register`, `POST /api/users/login` zwracający `{ token }` z claimem roli w środku |
| aukcje i ekwipunek za bearer tokenem | `POST /api/auctions`, `POST /api/auctions/{id}/bid`, `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| pieniądze | `GET /api/wallets/{id}`, `GET /api/wallets/{id}/transfers`, `POST /api/wallets/transfers` |
| pożyczki bankowe | `GET /api/bank/offers`, `GET /api/bank/loans`, `POST /api/bank/loans`, `POST /api/bank/loans/{id}/repayments` |
| kasyno | `GET /api/casino`, `POST /api/casino/chips/purchases`, `POST /api/casino/chips/cashouts`, `GET` i `POST /api/casino/roulette/spins`, `POST /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands/{id}/actions` (każdy kształt ręki niesie `autoStandOn`) |
| lombard | `GET /api/pawnshop` (404 przed kupnem lokalu), `GET /api/pawnshop/offers`, `POST /api/pawnshop`, `POST /api/pawnshop/bot`, `POST /api/pawnshop/stock/{id}/withdraw` |
| wojny magazynowe | `GET /api/warehouses?limit=N`, `GET /api/warehouses/{id}` (z `increments` taryfy), `POST /api/warehouses/{id}/join`, `POST /api/warehouses/{id}/leave`, `POST /api/warehouses/{id}/bids` |
| historia wojen magazynowych | `GET /api/warehouses/mine` (każda wojna, do której wołający dołączył, dowolny status, od najnowszych, najwyżej 50) |
| profile, znajomi i zaproszenia | `GET /api/profiles/me`, `GET /api/profiles/{id}`, `GET /api/profiles?ids=` (do 50 podsumowań naraz), `GET /api/profiles/search?q=` (prefiks nazwy, najwyżej 20 wierszy), `GET /api/profiles/{id}/avatar` (bez tokenu), zapisy własnego profilu pod `/api/profiles/me/...` (prywatność, sociale, awatar), cykl życia znajomości pod `/api/profiles/friends/...`, `GET` i `POST /api/profiles/warehouse-invites`, `POST /api/profiles/warehouse-invites/{publicInviteId}/decline` |
| powiadomienia push | `GET /api/push`, strumień Server-Sent Events za JWT: najpierw `event: connected`, `ping` po 15 s ciszy i tematy nudge `AuctionChanged`, `AuctionListChanged`, `WalletChanged`, `WarehouseChanged`, `LoanChanged`, `CasinoChanged` i `PawnshopChanged` z `{"auctionId"}`, `{"warehouseId"}` albo `{}` jako danymi ([ADR-016](adr/016-server-sent-events-push.md)) |
| odpowiedzi czytelne maszynowo | nazwy pól camelCase, enumy serializowane jako stringi, odpowiedzi `201` z nowym id i nagłówkiem `Location`, jeden kształt błędu `{ "error": "..." }` dla błędów domenowych, walidacyjnych i bindowania (błędy bindowania dołączyły 2026-11-14 przez `RouteHandlerOptions.ThrowOnBadRequest`) |

## Czego brakuje

- Brak nudge'a dla zaproszeń do znajomych, zaproszeń do wojen, przelewów i podbić w wojnach, więc te widoki nadal zbiegają w swoim rytmie pollingu ([ADR-016](adr/016-server-sent-events-push.md) wymienia stany po stronie konsumenta, które zostają na pollingu). Wyszukiwanie nazw działa celowo bez indeksu. Kanał push zakłada jedną instancję api.

## Widoki (trasy)

| Widok (trasa) | Używane endpointy backendu |
|---|---|
| lista aukcji (`/auctions`) | `GET /api/auctions?limit=50` |
| detal aukcji z licytacją i historią (`/auctions/:id`) | `GET /api/auctions/{id}`, `GET /api/auctions/{id}/bids`, `POST /api/auctions/{id}/bid`, `GET /api/profiles?ids=` dla nazw licytujących |
| wystawienie przedmiotu (`/auctions/new`, za guardem) | `GET /api/inventory`, `POST /api/auctions` |
| własne aukcje (`/auctions/mine`, za guardem) | `GET /api/auctions/mine` |
| ekwipunek z craftingiem i sklepem (`/inventory`, za guardem) | `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| portfel (`/wallet`, za guardem) | `GET /api/wallets/{id}` z własnym `PublicUserId` użytkownika wziętym z tokenu |
| przelewy (`/transfers`, za guardem) | `GET /api/wallets/{id}`, `GET /api/wallets/{id}/transfers`, `POST /api/wallets/transfers`, `GET /api/profiles/me` dla znajomych w pickerze odbiorcy, `GET /api/profiles/search?q=` dla jego podpowiedzi, `GET /api/profiles?ids=` dla etykiet stron |
| bank (`/bank`, za guardem) | `GET /api/bank/offers`, `GET /api/bank/loans`, `POST /api/bank/loans`, `POST /api/bank/loans/{id}/repayments`, `GET /api/wallets/{id}` do precheck'ów |
| żetony kasyna (`/casino`, za guardem) | `GET /api/casino`, `POST /api/casino/chips/purchases`, `POST /api/casino/chips/cashouts`, `GET /api/wallets/{id}` |
| ruletka (`/casino/roulette`, za guardem) | `GET /api/casino`, `GET /api/casino/roulette/spins`, `POST /api/casino/roulette/spins` |
| blackjack (`/casino/blackjack`, za guardem) | `GET /api/casino`, `GET /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands/{id}/actions` |
| lombard (`/pawnshop`, za guardem) | `GET /api/pawnshop`, `GET /api/pawnshop/offers`, `POST /api/pawnshop`, `POST /api/pawnshop/bot`, `POST /api/pawnshop/stock/{id}/withdraw`, `GET /api/wallets/{id}` |
| lista wojen magazynowych z zaproszeniami (`/warehouses`, za guardem) | `GET /api/warehouses?limit=20`, `GET /api/profiles/warehouse-invites` |
| detal wojny magazynowej (`/warehouses/:id`, za guardem) | `GET /api/warehouses/{id}`, `GET /api/wallets/{id}`, `GET /api/profiles/me` do selecta znajomych, `POST /api/warehouses/{id}/join`, `POST /api/warehouses/{id}/leave`, `POST /api/warehouses/{id}/bids`, `POST /api/profiles/warehouse-invites` |
| historia wojen magazynowych (`/warehouses/mine`, za guardem) | `GET /api/warehouses/mine` |
| profil własny (`/profile`, za guardem) | `GET /api/profiles/me`, `PUT /api/profiles/me/privacy`, `PUT /api/profiles/me/socials`, upload i usunięcie awatara pod `/api/profiles/me/avatar`, przyjęcie i odrzucenie zaproszenia do znajomych, `POST /api/profiles/friends/requests` z `GET /api/profiles/search?q=` zasilającym picker dodawania znajomego, `DELETE /api/profiles/friends/{userId}` |
| publiczny profil gracza (`/profiles/:id`, za guardem) | `GET /api/profiles/{id}`, `GET /api/profiles/me`, `POST /api/profiles/friends/requests`, przyjęcie zaproszenia przy skrzyżowanych zaproszeniach, `DELETE /api/profiles/friends/{userId}` |
| rejestracja i logowanie (`/register`, `/login`) | `POST /api/users/register` z automatycznym logowaniem po 201, `POST /api/users/login` |

## Klient push

`PushClient` (`core/push/push-client.ts`) otwiera `GET /api/push` przez `fetch` z tokenem bearer, bo `EventSource` nie wysyła nagłówków, i przepuszcza ciało przez `parseSseChunk` (`core/push/sse.ts`), który dzieli strumień po pustych liniach, łączy wielolinijkowe `data` i zachowuje niedokończony ogon na następny chunk. Startuje go wyłącznie `App`. Efekt na tokenie sesji łączy po zalogowaniu i rozłącza po wylogowaniu, więc karta trzyma jeden strumień, a przeładowanie otwiera dokładnie jeden nowy. Widok nigdy nie dotyka strumienia sam.

Widok dodaje w konstruktorze jedną linię `refreshOn(poller, topic)` na poller (`core/push/refresh-on.ts`), która woła `poller.refresh()`, gdy nadejdzie temat, opcjonalnie tylko gdy dane pasują do id widoku (`idMatches('auctionId', id)`), i opcjonalnie jeszcze raz po `settleMs`. Odświeżenie jest pomijane, gdy poller jest w wycofaniu (status błędu 0, 429 lub 5xx), więc nudge nigdy nie nadpisuje `Retry-After`. Polling pozostaje fallbackiem i nie zmienia się.

Polityka ponawiania siedzi w `shouldReconnect` i `failureOf`. 401 czyści sesję tym samym `handleUnauthorized`, co interceptor, i kończy, wygasły token kończy, 429 czeka na `Retry-After`, błąd sieci lub 5xx wycofuje się wykładniczo do 30 s przez `nextDelay` pollerów, a czysty koniec łączy od razu, chyba że strumień żył krócej niż `PUSH_MIN_STREAM_MS` (5 s), co liczy się jako błąd. Wycofanie zeruje się dopiero po strumieniu, który żył tak długo, więc piąta karta wyparta przez limit czterech strumieni hosta wycofuje się do 30 s, zamiast co sekundę wypierać kolejną kartę. 401 wylogowuje gracza przez `handleUnauthorized` tylko wtedy, gdy token powinien być ważny jeszcze dłużej niż `PUSH_CLOCK_SKEW_MS` (5 min), 401 na końcu życia tokenu tylko kończy strumień, a klient nigdy nie otwiera strumienia tokenem, który już wygasł, więc nieświeży token na stronie publicznej nie wymusza logowania. Specy podmieniają `PushClient` na `pushStub()` z `src/testing/push-stub.ts`, a własny spec klienta stubuje `fetch` odpowiedziami z `ReadableStream`.

| Temat | Widoki, które się na nim odświeżają |
|---|---|
| `AuctionChanged` z `{"auctionId"}` | detal aukcji (aukcja i jej oferty), gdy id pasuje, jeszcze raz po `AUCTION_SETTLE_MS`, własne aukcje, gdy id jest na liście |
| `AuctionListChanged` | lista aukcji (jeszcze raz po `AUCTION_SETTLE_MS`) |
| `WalletChanged` | portfel, przelewy, bank, żetony kasyna, lombard, detal wojny magazynowej |
| `LoanChanged` | bank |
| `CasinoChanged` | żetony kasyna, ruletka, blackjack |
| `PawnshopChanged` | lombard |
| `WarehouseChanged` z `{"warehouseId"}` | detal wojny magazynowej, gdy id pasuje, lista wojen, historia wojen, gdy id jest na jej liście |

## Reguły po stronie klienta i lustrzane stałe

Osiem feature'ów (przelewy, kasyno, blackjack, ruletka, bank, lombard, aukcje, profile) trzyma swoje prechecki, rytmy pollingu i lustrzane stałe w czystym module `<feature>-rules.ts` obok komponentów (dla kont społecznościowych tę rolę gra `social-links.ts`), testowanym bez TestBed; walidatory rejestracji wciąż mieszkają w pliku komponentu. Poniższe stałe lustrzą konfigurację lub walidatory backendu i muszą podążać za każdą jego zmianą:

| Stała klienta (moduł) | Lustrzy |
|---|---|
| `PASSWORD_REQUIREMENTS` i limity 30 znaków (`register.ts`) | walidator rejestracji: regułę siły hasła oraz limity długości username, imienia i nazwiska |
| `CARD_RANKS`, `CARD_SUITS` (`blackjack-rules.ts`) | kodowanie kart talii kasyna (figura z `code % 13`, kolor z `code / 13`) |
| `MIN_LEAD_MS`, `MAX_LEAD_MS` (`auction-rules.ts`) | okno czasu zakończenia aukcji (od minuty do trzydziestu dni) |
| `OPEN_LOAN_STATUSES` (`bank-rules.ts`) | statusy, które bank liczy jako otwartą pożyczkę |
| `RARITY_ORDER` (`pawnshop-rules.ts`) | drabinę rzadkości, po której ulepszenia bota idą wyłącznie w górę |
| `AVATAR_MAX_BYTES`, `AVATAR_TYPES`, `MAX_FRIENDS` (`profile-rules.ts`) | limity rozmiaru i formatu awatara oraz limit 100 znajomych |
| `SEARCH_MIN_LENGTH` (`profile-rules.ts`) | dolna granica dwóch znaków z walidatora wyszukiwarki nazw; picker nic nie wysyła poniżej niej i nigdy nie szuka pełnego id gracza |
| `MAX_SOCIAL_LINKS`, `SOCIAL_PLATFORMS`, `SOCIAL_DOMAINS` (`social-links.ts`) | walidator kont społecznościowych: najwyżej sześć linków, po jednym na znaną platformę, na jej domenie |
| `ROULETTE_BET_TYPES` i zakresy selekcji (`roulette-rules.ts`) | typy zakładów ruletki z ich zakresami selekcji |
| `PushTopic` (`push-topics.ts`) | siedem nazw tematów z `PushTopics` hosta (`Infrastructure/Push`), jedyne nazwy `event:`, na które klient się zapisuje |
| `PUSH_CLOCK_SKEW_MS` (`push-client.ts`) | domyślne pięć minut `ClockSkew` walidacji JWT w hoście (`TokenValidationParameters` w `Program.cs`, nienadpisane), okno, w którym API wciąż przyjmuje token, którego endpoint push już odmawia |
| `AUCTION_SETTLE_MS` (`push-topics.ts`) | 2 s TTL cache odczytów modułu Auctions (`Auctions:ReadCache`, ADR-009). Nudge może trafić w TTL i odczytać nieświeżą migawkę, więc widoki aukcji odświeżają się jeszcze raz po nim |

## Decyzje

- Angular 22 z domyślnymi ustawieniami CLI, czysty SCSS i Signal Forms, zdecydowane 2026-11-08; zob. [ADR-015](adr/015-angular-frontend-stack.md).
- Frontend rozmawia tylko z gatewayem, który przepuszcza preflighty CORS do hosta (sprawdzone 2026-10-23, preflight z `http://localhost:4200` dostaje 204 z pasującym `Access-Control-Allow-Origin`). Host ma CORS dla `http://localhost:4200`, dokument OpenAPI pod `/openapi/v1.json` (otwarty dla sieci prywatnych przez gateway) i trasy zdrowia `/health`, `/health/live` i `/health/ready`.
- Widoki modułów przed botami AI, zdecydowane 2026-11-12 (zob. wiersze DECISIONS.md z tego dnia): pozostałe moduły weszły jako dziewięć partii na istniejącym API bez zmian w backendzie, każda partia zweryfikowana skryptowym przebiegiem przeglądarkowym na żywym stacku, z kontem bota z wariantu B mintującym obrót potrzebny scenariuszom banku, lombardu i magazynów.
- Siedem braków API i kanał push przed botami AI, decyzja z 2026-11-14 (zobacz wiersze DECISIONS.md z tego dnia i [ADR-016](adr/016-server-sent-events-push.md)): własne aukcje i historia wojen czytane na serwerze, terminy zaproszeń i rąk blackjacka z serwera, hurtowe pobieranie profili z wyszukiwarką nazw, anonimowa trasa awatara i strumień nudge'ów Server-Sent Events, domknięte między 2026-11-14 a 2026-11-15 z klientem Angular konsumującym to wszystko.

## Powiązane dokumenty

- [backend/README.md](backend/README.md) - kontrakt błędów i schematy uwierzytelniania, które klient musi obsłużyć.
- [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - endpointy MVP w szczegółach.
- [backend/profiles.md](backend/profiles.md), [backend/warehouses.md](backend/warehouses.md), [backend/banking.md](backend/banking.md), [backend/pawnshop.md](backend/pawnshop.md), [backend/casino.md](backend/casino.md) - endpointy widoków modułów w szczegółach.
- [infrastructure.md](infrastructure.md) - gateway, z którym frontend ma rozmawiać.
