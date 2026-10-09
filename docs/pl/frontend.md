# Frontend (planowany)

> Wersja polska. Angielski odpowiednik 1:1: [../en/frontend.md](../en/frontend.md)

Ten moduł jeszcze nie istnieje: repozytorium nie zawiera folderu `Frontend/`, `package.json` ani TypeScriptu. Ta strona zapisuje cel, to, co backend już oferuje klientowi, i to, czego mu wciąż brakuje, żeby frontend mógł zacząć od faktów, a nie od założeń.

## Status

Planowany. Poprzednie README nazywało go „Angular frontend", a usunięta notatka projektowa (`AGENTS.md`) umieszczała go jako „UI/FRONTEND" przed API gatewayem; nie zapisano decyzji o wersji frameworka, układzie repozytorium ani projekcie graficznym.

## Projekt docelowy

- Aplikacja jednostronicowa w Angularze, która rozmawia z backendem wyłącznie przez planowany API gateway (dziś wołałaby host bezpośrednio na `http://localhost:5244`).
- Przepływy gracza: rejestracja i logowanie, przeglądanie aktywnych aukcji, podgląd aukcji ze snapshotem przedmiotu, składanie ofert, zarządzanie ekwipunkiem (crafting, sprzedaż do sklepu, wystawienie przedmiotu), odczyt sald portfela.
- Uwierzytelnianie JWT z `POST /api/users/login` przechowywanym po stronie klienta i wysyłanym jako bearer token; tokeny graczy wygasają po 15 minutach, więc klient potrzebuje ponownego logowania albo przyszłego przepływu odświeżania.

## Co backend już zapewnia

| Potrzeba | Dostępne dziś |
|---|---|
| publiczne przeglądanie bez logowania | `GET /api/auctions?limit=N` (aktywne aukcje uporządkowane po `EndsOn`), `GET /api/auctions/{id}` (dowolny status, z `CancellationReason`), `GET /api/wallets/{id}` |
| konta | `POST /api/users/register`, `POST /api/users/login` zwracający `{ token }` z claimem roli w środku |
| akcje za bearer tokenem | `POST /api/auctions`, `POST /api/auctions/{id}/bid`, `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| odpowiedzi czytelne maszynowo | nazwy właściwości w camelCase, enumy serializowane jako stringi, odpowiedzi `201` z nowym id i nagłówkiem `Location`, jeden kształt błędu `{ "error": "..." }` dla błędów domenowych i walidacji (błędy bindowania dają w Production puste 400) |

## Czego brakuje

- Brak polityki CORS w hoście, więc przeglądarka z innego origin jest blokowana, dopóki ktoś jej nie doda.
- Brak dokumentu OpenAPI (pakiet jest referencowany, ale nie zarejestrowany), więc klienta nie da się wygenerować ze specyfikacji.
- Brak historii ofert i brak kanału push: klient musi odpytywać `GET /api/auctions/{id}`, żeby zobaczyć zmiany ceny, a świeżo utworzona aukcja pozostaje `Pending` do dwóch cykli odpytywania outboxa, zanim pojawi się na liście.
- Żaden endpoint nie listuje własnych aukcji użytkownika ani aukcji, w których aktualnie prowadzi.

## Widoki (trasy)

| Kandydat na widok | Endpointy backendu, których by używał |
|---|---|
| lista aukcji | `GET /api/auctions` |
| szczegóły aukcji z licytacją | `GET /api/auctions/{id}`, `POST /api/auctions/{id}/bid` |
| wystawienie przedmiotu na sprzedaż | `GET /api/inventory`, `POST /api/auctions` |
| ekwipunek z craftingiem i sklepem | `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| portfel | `GET /api/wallets/{id}` z własnym `PublicUserId` użytkownika wziętym z tokenu |
| rejestracja i logowanie | `POST /api/users/register`, `POST /api/users/login` |

## Decyzje

- Angular został wskazany jako framework frontendu w pierwotnej notatce projektowej; wersja i narzędzia są otwarte.
- W projekcie docelowym frontend rozmawia tylko z gatewayem; dopóki gateway nie istnieje, wołałby host bezpośrednio, co najpierw wymaga CORS i OpenAPI po stronie hosta ([ARCHITECTURE.md](ARCHITECTURE.md#znane-ograniczenia)).

## Powiązane dokumenty

- [backend/README.md](backend/README.md) - kontrakt błędów i schematy uwierzytelniania, które klient musi obsłużyć.
- [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - endpointy w szczegółach.
- [infrastructure.md](infrastructure.md) - gateway, z którym frontend ma rozmawiać.
