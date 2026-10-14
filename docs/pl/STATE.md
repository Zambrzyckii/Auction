# AuctionServer — aktualny stan

> Wersja polska. Angielski odpowiednik 1:1: [../en/STATE.md](../en/STATE.md)
>
> Ostatnia aktualizacja: 2026-10-14

## Faza

**Backend kompletny dla głównego przepływu, żaden inny moduł nierozpoczęty.** 2026-10-14 wszedł timeout aukcji oczekującej i saga rezerwacji środków dla ofert. Wcześniej ostatnim commitem z kodem był `e684e33` z 2026-08-30. Rejestracja, logowanie, utworzenie aukcji, oferta, zamknięcie i rozliczenie działają od początku do końca w jednym procesie, ze znanymi lukami wymienionymi niżej.

## Co istnieje

- `Backend/`: host `AuctionServer.Api`, moduły Identity, Wallets, Auctions i Inventory oraz projekt kontraktów `Shared.Integration`; 13 endpointów, 14 zdarzeń integracyjnych, 12 tabel, cztery `OutboxProcessor`y i `AuctionCloser`.
- Testy: cztery projekty xUnit, 230 metod testowych (119 offline, 111 integracyjnych przez Testcontainers), żadna nie przekracza granicy modułu.
- CI: `.gitlab-ci.yml` z `build`, `unit-tests` i `integration-tests`.
- Dokumentacja: `docs/en` i `docs/pl` z tym zestawem stron i 13 wyrenderowanymi diagramami; główne `README.md` i `README.pl.md`.
- `Backend/Dockerfile` i `compose.yaml` w korzeniu (API + PostgreSQL, migracje aplikowane na starcie za flagą `Database:MigrateOnStartup`).
- Poza repozytorium: frontend, boty, gateway, broker wiadomości.

## Środowisko deweloperskie

- .NET SDK 10.0.301 i `dotnet-ef` 10.0.9; każdy projekt celuje w `net10.0`.
- Docker dla lokalnego PostgreSQL i dla Testcontainers (`postgres:latest` w testach, `postgres:16-alpine` w `compose.yaml`); `docker compose up -d` stawia cały system na `http://localhost:8080`.
- Node.js 26 i Python 3 tylko do przerenderowania diagramów (`docs/diagrams/render.py`).
- IDE: Rider (`Backend/.idea/` jest ignorowany, `AuctionServer.sln.DotSettings.user` jest śledzony).

## Znane luki

- Brak CORS, OpenAPI i health checków; bez dwóch pierwszych nie da się podłączyć klienta przeglądarkowego.
- `GET /api/wallets/{id}` jest anonimowy; pełna lista jest w [ARCHITECTURE.md](ARCHITECTURE.md#znane-ograniczenia).

## Następny krok

Saga rezerwacji środków weszła 2026-10-14; kolejność pozostałych pozycji [VISION.md](VISION.md) czeka na decyzję właściciela w tamtym dokumencie.

## Powiązane dokumenty

- [VISION.md](VISION.md) - co jest planowane.
- [CHANGELOG.md](CHANGELOG.md) - jak projekt tu doszedł.
- [ARCHITECTURE.md](ARCHITECTURE.md) - jak jest zbudowany i czego brakuje.
