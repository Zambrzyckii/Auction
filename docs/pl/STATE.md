# AuctionServer — aktualny stan

> Wersja polska. Angielski odpowiednik 1:1: [../en/STATE.md](../en/STATE.md)
>
> Ostatnia aktualizacja: 2026-10-22

## Faza

**Backend kompletny dla głównego przepływu, żaden inny moduł nierozpoczęty.** 2026-10-14 wszedł timeout aukcji oczekującej i saga rezerwacji środków dla ofert, a tego samego dnia pierwsza partia rozgrywkowa: pakiet startowy i przelewy między graczami. 2026-10-15 wszedł piąty moduł, Warehouses, z wojnami magazynowymi z trzeciego punktu roadmapy, szósty, Banking, z pożyczkami bramkowanymi obrotem z czwartego, oraz siódmy, Pawnshop, z botami pasywnego dochodu z piątego. Wcześniej ostatnim commitem z kodem był `e684e33` z 2026-08-30. Rejestracja, logowanie, utworzenie aukcji, oferta, zamknięcie i rozliczenie działają od początku do końca w jednym procesie, ze znanymi lukami wymienionymi niżej; cały łańcuch, łącznie z obiema sagami, został 2026-10-14 zweryfikowany ręcznie na stacku Compose, a łańcuch wojny magazynowej (zaopatrzenie, blokady wpisowego, pilnowane podbicia, rozliczenie z odkryciem i zwrotami) tak samo 2026-10-15, a łańcuch pożyczek (odrzucenie z powodu obrotu, udzielenie po doładowaniu, wcześniejsza spłata, pobranie przez keepera, kara za przeterminowanie z ponowieniem) tego samego dnia, z sześcioma czystymi outboxami po próbie. Łańcuch lombardu został tego samego dnia sprawdzony na żywo na stacku Compose 33 kontrolami, wszystkie przeszły. Próba objęła oferty, zakup lokalu z bramką obrotu, zakupy botów i ich konflikty, spawny, wycofanie, automatyczną sprzedaż z wypłatą oraz zero martwych i zero zalegających oczekujących wierszy we wszystkich siedmiu outboxach. 2026-10-17 wszedł ósmy moduł, Casino, z żetonami, ruletką i blackjackiem z szóstego punktu roadmapy; jego łańcuch (darmowe wejście, saga zakupu z odrzuceniem, hedgowany spin ruletki, ukryta zakryta karta, automatyczne pasowanie przez keepera, wypłata bez obrotu) został tego samego dnia sprawdzony na żywo na stacku Compose 34 kontrolami, wszystkie przeszły, z zerem martwych i zerem zalegających oczekujących wierszy we wszystkich ośmiu outboxach. 2026-10-22 wszedł dziewiąty moduł, Profiles, z profilami użytkowników z siódmego punktu roadmapy (poziomy napędzane obrotem liczone w Wallets, awatary w SeaweedFS, konta społecznościowe, znajomi, zaproszenia magazynowe); jego łańcuch (tworzenie profilu z rejestracji, nadrabianie poziomów z nagrodami, walidacja kont społecznościowych, pełny obieg awatara z odrzuceniami rozmiaru i formatu, cykl znajomości z auto-akceptacją krzyżowego zaproszenia, zaproszenia z konfliktami) został tego samego dnia sprawdzony na żywo na świeżym stacku Compose 53 kontrolami, wszystkie przeszły, z zerem martwych i zerem zalegających oczekujących wierszy we wszystkich ośmiu outboxach i zdarzeniami poziomów widocznymi w inboxie Profiles.

## Co istnieje

- `Backend/`: host `AuctionServer.Api`, moduły Identity, Wallets, Auctions, Inventory, Warehouses, Banking, Pawnshop, Casino i Profiles (wyłącznie konsumujący, bez outboxa) oraz projekt kontraktów `Shared.Integration`; 50 endpointów, 37 zdarzeń integracyjnych, 38 tabel, osiem `OutboxProcessor`ów, `AuctionCloser`, `WarehouseKeeper`, `BankKeeper`, `PawnshopKeeper` i `CasinoKeeper`.
- Testy: dziewięć projektów xUnit, 730 metod testowych (410 offline, 320 integracyjnych przez Testcontainers), żadna nie przekracza granicy modułu.
- CI: `.gitlab-ci.yml` i jego lustro na GitHub Actions `.github/workflows/ci.yml`, oba z `build`, `unit-tests` i `integration-tests`.
- Dokumentacja: `docs/en` i `docs/pl` z tym zestawem stron i 18 wyrenderowanymi diagramami; główne `README.md` i `README.pl.md`.
- `Backend/Dockerfile` i `compose.yaml` w korzeniu (API + PostgreSQL + SeaweedFS dla awatarów, migracje aplikowane na starcie za flagą `Database:MigrateOnStartup`).
- CORS dla skonfigurowanych originów frontendu (`Cors:AllowedOrigins`), dokument OpenAPI pod `/openapi/v1.json` i `/health` ze sprawdzeniem bazy.
- Poza repozytorium: frontend, boty, gateway, broker wiadomości.

## Środowisko deweloperskie

- .NET SDK 10.0.301 i `dotnet-ef` 10.0.9; każdy projekt celuje w `net10.0`.
- Docker dla lokalnego PostgreSQL i dla Testcontainers (`postgres:latest` w testach, `postgres:16-alpine` w `compose.yaml`); `docker compose up -d` stawia cały system na `http://localhost:8080`.
- Node.js 26 i Python 3 tylko do przerenderowania diagramów (`docs/diagrams/render.py`).
- IDE: Rider (`Backend/.idea/` jest ignorowany, `AuctionServer.sln.DotSettings.user` jest śledzony).

## Znane luki

- Nic już nie blokuje klienta przeglądarkowego; pozostałe mniejsze ograniczenia są wymienione w [ARCHITECTURE.md](ARCHITECTURE.md#znane-ograniczenia).

## Następny krok

2026-10-14 właściciel zdecydował, że przed frontendem Angular backend rośnie o funkcje rozgrywki. Pierwsza partia (pakiet startowy, przelewy między graczami) weszła tego samego dnia, wojny magazynowe, bank i lombard 2026-10-15, kasyno 2026-10-17, a profile użytkowników, ostatni punkt rozgrywkowy, 2026-10-22. Roadmapa [VISION.md](VISION.md) wskazuje teraz na pracę platformową: RabbitMQ za szwem publishera, frontend Angular, boty AI i API gateway; opcja prywatnego profilu pozostaje odłożona.

## Powiązane dokumenty

- [VISION.md](VISION.md) - co jest planowane.
- [CHANGELOG.md](CHANGELOG.md) - jak projekt tu doszedł.
- [ARCHITECTURE.md](ARCHITECTURE.md) - jak jest zbudowany i czego brakuje.
