# Frontend (MVP)

> Wersja polska. Angielski odpowiednik 1:1: [../en/frontend.md](../en/frontend.md)

Scaffold istnieje od 2026-11-08: `Frontend/` zawiera workspace Angular CLI 22 (komponenty standalone, sygnały, zoneless change detection, Vitest, SCSS) z dev-serverem proxującym `/api` na gateway. Widoki MVP weszły 2026-11-10, więc ta strona zapisuje to, co klient robi dziś, co backend mu oferuje i czego mu wciąż brakuje.

## Status

MVP weszło 2026-11-10 na stacku rozstrzygniętym w [ADR-015](adr/015-angular-frontend-stack.md) i wierszach DECISIONS.md z 2026-11-08. Sześć widoków pokrywa przepływy gracza, trasy dla zalogowanych siedzą za guardem tokenu, a 401 czyści sesję i przekierowuje na login z returnUrl (refresh tokeny czekają jako issue #18). Bez kanału push klient odpytuje. Detal aukcji i jego historia ofert odświeżają się co 2,5 s, portfel i ekwipunek co 5 s, lista co 10 s, a przy 5xx lub błędach sieci poller wycofuje się wykładniczo do 30 s, podczas gdy 429 honoruje `Retry-After`. 200 z endpointu oferty znaczy tylko tyle, że oferta czeka. Widok detalu uznaje ją za potwierdzoną, gdy historia wymieni id gracza z tą kwotą, a po dwudziestu cichych sekundach ostrzega. UI MVP pozostaje celowo surowe, czytelne jedynie do testów ręcznych; właściwy UI/UX to osobna odnoga planu na końcu projektu, a widok "moje aukcje" czeka na swój endpoint po MVP.

## Projekt docelowy

- Aplikacja jednostronicowa w Angularze, która rozmawia z backendem wyłącznie przez API gateway na `http://localhost:8080`, który istnieje od 2026-10-23.
- Przepływy gracza: rejestracja i logowanie, przeglądanie aktywnych aukcji, podgląd aukcji ze snapshotem przedmiotu, składanie ofert, zarządzanie ekwipunkiem (crafting, sprzedaż do sklepu, wystawienie przedmiotu), odczyt sald portfela.
- Uwierzytelnianie JWT z `POST /api/users/login` przechowywanym po stronie klienta i wysyłanym jako bearer token; tokeny graczy wygasają po 15 minutach, więc klient potrzebuje ponownego logowania albo przyszłego przepływu odświeżania.

## Co backend już zapewnia

| Potrzeba | Dostępne dziś |
|---|---|
| publiczne przeglądanie bez logowania | `GET /api/auctions?limit=N` (aktywne aukcje uporządkowane po `EndsOn`), `GET /api/auctions/{id}` (dowolny status, z `CancellationReason`), `GET /api/auctions/{id}/bids` (potwierdzone oferty, najnowsze najpierw) |
| konta | `POST /api/users/register`, `POST /api/users/login` zwracający `{ token }` z claimem roli w środku |
| akcje za bearer tokenem | `POST /api/auctions`, `POST /api/auctions/{id}/bid`, `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| odpowiedzi czytelne maszynowo | nazwy właściwości w camelCase, enumy serializowane jako stringi, odpowiedzi `201` z nowym id i nagłówkiem `Location`, jeden kształt błędu `{ "error": "..." }` dla błędów domenowych i walidacji (błędy bindowania dają w Production puste 400) |

## Czego brakuje

- Brak kanału push: klient musi odpytywać `GET /api/auctions/{id}`, żeby zobaczyć zmiany ceny, a świeżo utworzona aukcja pozostaje `Pending` do dwóch cykli odpytywania outboxa, zanim pojawi się na liście.
- Żaden endpoint nie listuje własnych aukcji użytkownika ani aukcji, w których aktualnie prowadzi.

## Widoki (trasy)

| Widok (trasa) | Endpointy backendu, których używa |
|---|---|
| lista aukcji (`/auctions`) | `GET /api/auctions?limit=50` |
| szczegóły aukcji z licytacją i historią (`/auctions/:id`) | `GET /api/auctions/{id}`, `GET /api/auctions/{id}/bids`, `POST /api/auctions/{id}/bid` |
| wystawienie przedmiotu na sprzedaż (`/auctions/new`, za guardem) | `GET /api/inventory`, `POST /api/auctions` |
| ekwipunek z craftingiem i sklepem (`/inventory`, za guardem) | `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| portfel (`/wallet`, za guardem) | `GET /api/wallets/{id}` z własnym `PublicUserId` użytkownika wziętym z tokenu |
| rejestracja i logowanie (`/register`, `/login`) | `POST /api/users/register` z auto-loginem po 201, `POST /api/users/login` |

## Decyzje

- Angular 22 z domyślnymi ustawieniami CLI, czystym SCSS i Signal Forms, zdecydowane 2026-11-08; zob. [ADR-015](adr/015-angular-frontend-stack.md).
- Frontend rozmawia tylko z gatewayem, który przepuszcza preflighty CORS do hosta (sprawdzone 2026-10-23, preflight z `http://localhost:4200` dostaje 204 z pasującym `Access-Control-Allow-Origin`). Host ma CORS dla `http://localhost:4200`, dokument OpenAPI pod `/openapi/v1.json` (przez gateway otwarty dla sieci prywatnych) i ścieżki zdrowia `/health`, `/health/live` i `/health/ready`.

## Powiązane dokumenty

- [backend/README.md](backend/README.md) - kontrakt błędów i schematy uwierzytelniania, które klient musi obsłużyć.
- [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - endpointy w szczegółach.
- [infrastructure.md](infrastructure.md) - gateway, z którym frontend ma rozmawiać.
