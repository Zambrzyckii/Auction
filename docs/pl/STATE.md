# AuctionServer — aktualny stan

> Wersja polska. Angielski odpowiednik 1:1: [../en/STATE.md](../en/STATE.md)
>
> Ostatnia aktualizacja: 2026-10-15

## Faza

**Backend kompletny dla głównego przepływu, żaden inny moduł nierozpoczęty.** 2026-10-14 wszedł timeout aukcji oczekującej i saga rezerwacji środków dla ofert, a tego samego dnia pierwsza partia rozgrywkowa: pakiet startowy i przelewy między graczami. 2026-10-15 wszedł piąty moduł, Warehouses, z wojnami magazynowymi z trzeciego punktu roadmapy. Wcześniej ostatnim commitem z kodem był `e684e33` z 2026-08-30. Rejestracja, logowanie, utworzenie aukcji, oferta, zamknięcie i rozliczenie działają od początku do końca w jednym procesie, ze znanymi lukami wymienionymi niżej; cały łańcuch, łącznie z obiema sagami, został 2026-10-14 zweryfikowany ręcznie na stacku Compose, a łańcuch wojny magazynowej (zaopatrzenie, blokady wpisowego, pilnowane podbicia, rozliczenie z odkryciem i zwrotami) tak samo 2026-10-15, z pięcioma czystymi outboxami po próbie.

## Co istnieje

- `Backend/`: host `AuctionServer.Api`, moduły Identity, Wallets, Auctions, Inventory i Warehouses oraz projekt kontraktów `Shared.Integration`; 21 endpointów, 20 zdarzeń integracyjnych, 19 tabel, pięć `OutboxProcessor`ów, `AuctionCloser` i `WarehouseKeeper`.
- Testy: pięć projektów xUnit, 344 metody testowe (177 offline, 167 integracyjnych przez Testcontainers), żadna nie przekracza granicy modułu.
- CI: `.gitlab-ci.yml` i jego lustro na GitHub Actions `.github/workflows/ci.yml`, oba z `build`, `unit-tests` i `integration-tests`.
- Dokumentacja: `docs/en` i `docs/pl` z tym zestawem stron i 14 wyrenderowanymi diagramami; główne `README.md` i `README.pl.md`.
- `Backend/Dockerfile` i `compose.yaml` w korzeniu (API + PostgreSQL, migracje aplikowane na starcie za flagą `Database:MigrateOnStartup`).
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

2026-10-14 właściciel zdecydował, że przed frontendem Angular backend rośnie o funkcje rozgrywki. Pierwsza partia (pakiet startowy, przelewy między graczami) weszła tego samego dnia, a wojny magazynowe 2026-10-15. Następny w roadmapie [VISION.md](VISION.md) jest bank udzielający pożyczek.

## Powiązane dokumenty

- [VISION.md](VISION.md) - co jest planowane.
- [CHANGELOG.md](CHANGELOG.md) - jak projekt tu doszedł.
- [ARCHITECTURE.md](ARCHITECTURE.md) - jak jest zbudowany i czego brakuje.
