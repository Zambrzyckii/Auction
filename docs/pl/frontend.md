# Frontend

> Wersja polska. Angielski odpowiednik 1:1: [../en/frontend.md](../en/frontend.md)

Szkielet istnieje od 2026-11-08: `Frontend/` to workspace Angular 22 CLI (komponenty standalone, sygnały, zoneless change detection, Vitest, SCSS) z dev serverem proxującym `/api` do gatewaya. Widoki MVP weszły 2026-11-10, a widoki modułów 2026-11-14, więc ta strona opisuje, co klient robi dziś, co oferuje mu backend i czego wciąż brakuje.

## Status

Widoki modułów weszły 2026-11-14 na stacku wybranym w [ADR-015](adr/015-angular-frontend-stack.md): każdy moduł backendu ma już widok (przelewy, pożyczki bankowe, żetony kasyna z ruletką i blackjackiem, lombard, wojny magazynowe, profil własny i publiczny ze znajomymi i zaproszeniami) obok aukcji, ekwipunku i portfela z MVP. Trasy zalogowane siedzą za guardem tokenu, a 401 czyści sesję i przekierowuje na login z returnUrl (refresh tokeny czekają jako issue #18). Bez kanału push klient polluje, a każdy widok dobiera swój rytm: detal aukcji i jej oferty co 2,5 s, portfele i ekwipunek co 5 s, listy co 10 s, a widoki oparte na sagach (oczekujący zakup żetonów, oczekująca płatność lombardu, odliczanie lub licytacja magazynu) schodzą do 2 s, póki coś jest w locie; przy 5xx i błędach sieci poller wycofuje się wykładniczo do 30 s, a 429 honoruje `Retry-After`. Przyciski akcji stoją za precheckami, które odwzorowują kolejność guardów serwera i dokładne teksty odmów, a stałe po stronie klienta (statusy pożyczek, typy zakładów ruletki, etykiety kart, tabela taryf magazynów, czas życia zaproszenia, timeout ręki blackjacka) lustrzą konfigurację backendu, więc dryf configu objawia się widoczną etykietą "Unknown tier" zamiast awarią; autorytetem pozostaje serwer, a prechecki są podpowiedziami. Widoki pamiętają to, czego serwer nie powtórzy: przeładowana ręka blackjacka jest rekoncyliowana zamiast nadpisywana, a wpisowe magazynu odrzucone przez portfel jest wykrywane z własnego stempla dołączenia klienta, bo API nie zostawia po odmowie żadnego śladu. Każda partia była weryfikowana skryptowym przebiegiem Playwright na stacku compose, a przebieg końcowy powtórzył przepływy modułów na stacku zbudowanym od zera. UI pozostaje celowo surowe, czytelne tylko do testów ręcznych; właściwy przebieg UI/UX to osobna gałąź planu na końcu projektu.

## Docelowy kształt

- Aplikacja single-page w Angularze, która rozmawia z backendem wyłącznie przez gateway API na `http://localhost:8080`, istniejący od 2026-10-23.
- Przepływy gracza: rejestracja i logowanie, przeglądanie i prowadzenie aukcji, zarządzanie ekwipunkiem i portfelem, przelewy, branie i spłacanie pożyczek, ruletka i blackjack na żetonach kasyna, prowadzenie lombardu, wojny magazynowe ze znajomymi i publiczny profil.
- Uwierzytelnianie JWT z `POST /api/users/login`, przechowywanym po stronie klienta i wysyłanym jako bearer token; tokeny graczy wygasają po 15 minutach, więc klient potrzebuje ponownego logowania albo przyszłego przepływu refresh.

## Co zapewnia backend

| Potrzeba | Dostępne dziś |
|---|---|
| publiczne przeglądanie bez logowania | `GET /api/auctions?limit=N` (aktywne aukcje po `EndsOn`), `GET /api/auctions/{id}` (dowolny status, z `CancellationReason`), `GET /api/auctions/{id}/bids` (potwierdzone oferty, od najnowszych) |
| konta | `POST /api/users/register`, `POST /api/users/login` zwracający `{ token }` z claimem roli w środku |
| aukcje i ekwipunek za bearer tokenem | `POST /api/auctions`, `POST /api/auctions/{id}/bid`, `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| pieniądze | `GET /api/wallets/{id}`, `GET /api/wallets/{id}/transfers`, `POST /api/wallets/transfers` |
| pożyczki bankowe | `GET /api/bank/offers`, `GET /api/bank/loans`, `POST /api/bank/loans`, `POST /api/bank/loans/{id}/repayments` |
| kasyno | `GET /api/casino`, `POST /api/casino/chips/purchases`, `POST /api/casino/chips/cashouts`, `GET` i `POST /api/casino/roulette/spins`, `POST /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands/{id}/actions` |
| lombard | `GET /api/pawnshop` (404 przed kupnem lokalu), `GET /api/pawnshop/offers`, `POST /api/pawnshop`, `POST /api/pawnshop/bot`, `POST /api/pawnshop/stock/{id}/withdraw` |
| wojny magazynowe | `GET /api/warehouses?limit=N`, `GET /api/warehouses/{id}`, `POST /api/warehouses/{id}/join`, `POST /api/warehouses/{id}/leave`, `POST /api/warehouses/{id}/bids` |
| profile, znajomi i zaproszenia | `GET /api/profiles/me`, `GET /api/profiles/{id}`, `GET /api/profiles/{id}/avatar`, zapisy własnego profilu pod `/api/profiles/me/...` (prywatność, sociale, awatar), cykl życia znajomości pod `/api/profiles/friends/...`, `GET` i `POST /api/profiles/warehouse-invites` |
| odpowiedzi czytelne maszynowo | nazwy pól camelCase, enumy serializowane jako stringi, odpowiedzi `201` z nowym id i nagłówkiem `Location`, jeden kształt błędu `{ "error": "..." }` dla błędów domenowych i walidacyjnych (błędy bindowania zwracają puste 400 w Production) |

## Czego brakuje

- Brak kanału push: wszystko powyżej to polling, a świeżo utworzona aukcja pozostaje `Pending` do dwóch cykli pollingu outboxa, zanim pojawi się na liście.
- Żaden endpoint nie listuje własnych aukcji użytkownika ani jego minionych wojen magazynowych: rozstrzygnięta lub anulowana wojna wypada z publicznej listy, więc klient nie pokaże historii wojen.
- Brak wyszukiwarki profili i endpointu batch: widoki rozwiązują nazwy użytkowników pojedynczymi `GET /api/profiles/{id}` i cache'ują je po stronie klienta na czas sesji.
- Zaproszenia magazynowe nie mają id ani akcji przyjęcia lub odrzucenia: klient może tylko przejść po linku albo pozwolić zaproszeniu wygasnąć.
- Endpoint awatara wymaga JWT, więc publiczna strona nie pokaże awatarów bez zalogowanej sesji.
- Tabela taryf magazynów (wpisowe i inkrementy podbić) oraz timeout ręki blackjacka żyją tylko w konfiguracji backendu: klient lustrzy je jako stałe, a nieznaną taryfę etykietuje "Unknown tier" zamiast zgadywać.

## Widoki (trasy)

| Widok (trasa) | Używane endpointy backendu |
|---|---|
| lista aukcji (`/auctions`) | `GET /api/auctions?limit=50` |
| detal aukcji z licytacją i historią (`/auctions/:id`) | `GET /api/auctions/{id}`, `GET /api/auctions/{id}/bids`, `POST /api/auctions/{id}/bid` |
| wystawienie przedmiotu (`/auctions/new`, za guardem) | `GET /api/inventory`, `POST /api/auctions` |
| ekwipunek z craftingiem i sklepem (`/inventory`, za guardem) | `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| portfel (`/wallet`, za guardem) | `GET /api/wallets/{id}` z własnym `PublicUserId` użytkownika wziętym z tokenu |
| przelewy (`/transfers`, za guardem) | `GET /api/wallets/{id}/transfers`, `POST /api/wallets/transfers` |
| bank (`/bank`, za guardem) | `GET /api/bank/offers`, `GET /api/bank/loans`, `POST /api/bank/loans`, `POST /api/bank/loans/{id}/repayments`, `GET /api/wallets/{id}` do precheck'ów |
| żetony kasyna (`/casino`, za guardem) | `GET /api/casino`, `POST /api/casino/chips/purchases`, `POST /api/casino/chips/cashouts`, `GET /api/wallets/{id}` |
| ruletka (`/casino/roulette`, za guardem) | `GET /api/casino`, `GET /api/casino/roulette/spins`, `POST /api/casino/roulette/spins` |
| blackjack (`/casino/blackjack`, za guardem) | `GET /api/casino`, `POST /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands/{id}/actions` |
| lombard (`/pawnshop`, za guardem) | `GET /api/pawnshop`, `GET /api/pawnshop/offers`, `POST /api/pawnshop`, `POST /api/pawnshop/bot`, `POST /api/pawnshop/stock/{id}/withdraw`, `GET /api/wallets/{id}` |
| lista wojen magazynowych z zaproszeniami (`/warehouses`, za guardem) | `GET /api/warehouses?limit=20`, `GET /api/profiles/warehouse-invites` |
| detal wojny magazynowej (`/warehouses/:id`, za guardem) | `GET /api/warehouses/{id}`, `GET /api/wallets/{id}`, `GET /api/profiles/me` do selecta znajomych, `POST /api/warehouses/{id}/join`, `POST /api/warehouses/{id}/leave`, `POST /api/warehouses/{id}/bids`, `POST /api/profiles/warehouse-invites` |
| profil własny (`/profile`, za guardem) | `GET /api/profiles/me`, `PUT /api/profiles/me/privacy`, `PUT /api/profiles/me/socials`, upload i usunięcie awatara pod `/api/profiles/me/avatar`, przyjęcie i odrzucenie zaproszenia do znajomych, `DELETE /api/profiles/friends/{userId}` |
| publiczny profil gracza (`/profiles/:id`, za guardem) | `GET /api/profiles/{id}`, `POST /api/profiles/friends/requests` |
| rejestracja i logowanie (`/register`, `/login`) | `POST /api/users/register` z automatycznym logowaniem po 201, `POST /api/users/login` |

## Decyzje

- Angular 22 z domyślnymi ustawieniami CLI, czysty SCSS i Signal Forms, zdecydowane 2026-11-08; zob. [ADR-015](adr/015-angular-frontend-stack.md).
- Frontend rozmawia tylko z gatewayem, który przepuszcza preflighty CORS do hosta (sprawdzone 2026-10-23, preflight z `http://localhost:4200` dostaje 204 z pasującym `Access-Control-Allow-Origin`). Host ma CORS dla `http://localhost:4200`, dokument OpenAPI pod `/openapi/v1.json` (otwarty dla sieci prywatnych przez gateway) i trasy zdrowia `/health`, `/health/live` i `/health/ready`.
- Widoki modułów przed botami AI, zdecydowane 2026-11-12 (zob. wiersze DECISIONS.md z tego dnia): pozostałe moduły weszły jako dziewięć partii na istniejącym API bez zmian w backendzie, każda partia zweryfikowana skryptowym przebiegiem przeglądarkowym na żywym stacku, z kontem bota z wariantu B mintującym obrót potrzebny scenariuszom banku, lombardu i magazynów.

## Powiązane dokumenty

- [backend/README.md](backend/README.md) - kontrakt błędów i schematy uwierzytelniania, które klient musi obsłużyć.
- [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - endpointy MVP w szczegółach.
- [backend/profiles.md](backend/profiles.md), [backend/warehouses.md](backend/warehouses.md), [backend/banking.md](backend/banking.md), [backend/pawnshop.md](backend/pawnshop.md), [backend/casino.md](backend/casino.md) - endpointy widoków modułów w szczegółach.
- [infrastructure.md](infrastructure.md) - gateway, z którym frontend ma rozmawiać.
