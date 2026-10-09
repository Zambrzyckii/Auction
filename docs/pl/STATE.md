# AuctionServer — aktualny stan

> Wersja polska. Angielski odpowiednik 1:1: [../en/STATE.md](../en/STATE.md)
>
> Ostatnia aktualizacja: 2026-10-09

## Faza

**Backend kompletny dla głównego przepływu, żaden inny moduł nierozpoczęty.** Ostatni commit z kodem to `e684e33` z 2026-08-30 (69 commitów od 2026-07-06); od tego czasu jedyną zmianą jest ten zestaw dokumentacji. Rejestracja, logowanie, utworzenie aukcji, oferta, zamknięcie i rozliczenie działają od początku do końca w jednym procesie, ze znanymi lukami wymienionymi niżej.

## Co istnieje

- `Backend/`: host `AuctionServer.Api`, moduły Identity, Wallets, Auctions i Inventory oraz projekt kontraktów `Shared.Integration`; 13 endpointów, 9 zdarzeń integracyjnych, 11 tabel, cztery `OutboxProcessor`y i `AuctionCloser`.
- Testy: cztery projekty xUnit, 214 metod testowych (115 offline, 99 integracyjnych przez Testcontainers), żadna nie przekracza granicy modułu.
- CI: `.gitlab-ci.yml` z `build`, `unit-tests` i `integration-tests`.
- Dokumentacja: `docs/en` i `docs/pl` z tym zestawem stron i 13 wyrenderowanymi diagramami; główne `README.md` i `README.pl.md`.
- Poza repozytorium: frontend, boty, gateway, broker wiadomości, Dockerfile, plik Compose.

## Środowisko deweloperskie

- .NET SDK 10.0.301 i `dotnet-ef` 10.0.9; każdy projekt celuje w `net10.0`.
- Docker dla lokalnego PostgreSQL i dla Testcontainers (`postgres:latest` w testach, `postgres:16-alpine` sugerowany do uruchomień lokalnych).
- Node.js 26 i Python 3 tylko do przerenderowania diagramów (`docs/diagrams/render.py`).
- IDE: Rider (`Backend/.idea/` jest ignorowany, `AuctionServer.sln.DotSettings.user` jest śledzony).

## Znane luki

- Oferta jest przyjmowana przed sprawdzeniem środków licytującego, a `LockedFunds` nie ma powiązania z ofertą; saga rezerwacji per oferta jest zaprojektowana, ale niezaimplementowana.
- Brak CORS, OpenAPI, health checków i migracji na starcie; bez dwóch pierwszych nie da się podłączyć klienta przeglądarkowego.
- `GET /api/wallets/{id}` jest anonimowy; pełna lista jest w [ARCHITECTURE.md](ARCHITECTURE.md#znane-ograniczenia).

## Następny krok

Implementacja sagi rezerwacji środków (pesymistyczna oferta `Pending` potwierdzana przez Wallets, `FundsLock` per oferta), pierwszej pozycji w [VISION.md](VISION.md); kolejność pozostałych pozycji czeka na decyzję właściciela w tamtym dokumencie.

## Powiązane dokumenty

- [VISION.md](VISION.md) - co jest planowane.
- [CHANGELOG.md](CHANGELOG.md) - jak projekt tu doszedł.
- [ARCHITECTURE.md](ARCHITECTURE.md) - jak jest zbudowany i czego brakuje.
