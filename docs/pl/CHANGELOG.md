# AuctionServer — historia zmian

> Wersja polska. Angielski odpowiednik 1:1: [../en/CHANGELOG.md](../en/CHANGELOG.md)
>
> Wpisy na poziomie kamieni milowych, od najnowszych; każdy wpis ma datę dnia, w którym wykonano pracę.

- **2026-10-07** — **Zestaw dokumentacji**: dwujęzyczne `docs/en` i `docs/pl` (architektura, rozdziały backendu, dokumenty stałe, ADR-y, moduły planowane), 13 diagramów Mermaid wyrenderowanych do SVG, główne README przepisane na front door z polskim bliźniakiem; poprzedni folder `docs/` przeniesiony poza repozytorium.
- **2026-08-30** — **Domknięty łańcuch rozliczenia**: outbox Wallets i `AuctionSettledEvent`, handlery Inventory dla `AuctionFinishedEvent` (odblokowanie) i `AuctionSettledEvent` (transfer), `GET /api/auctions/{id}`, testy integracyjne Auctions; saga rezerwacji środków dla ofert zaprojektowana, ale niezaimplementowana.
- **2026-08-29** — **Saga blokady przedmiotu i boty**: aukcje tworzone jako `Pending`, `ItemLockRequestedEvent`, `ItemLockedEvent` i `ItemLockRejectedEvent`, `AuctionStatus` ze snapshotem przedmiotu, inboxy w Auctions i Inventory, rola `Bot` z tokenami 24-godzinnymi, schemat klucza API i `POST /api/users/bots`, tylko dla botów `POST /api/wallets/funds` i `POST /api/inventory/items`, konfigurowalne środki startowe, endpointy Inventory, enumy serializowane jako stringi, idempotentny konsument `BidPlacedEvent`.
- **2026-08-26** — **Warstwa aplikacji Inventory**: crafting, sprzedaż do sklepu, zapytania o przedmioty, outbox i migracja Inventory; szew `IIntegrationEventPublisher` i `EventId` na każdym zdarzeniu.
- **2026-08-16 / 2026-08-17** — **Walidacja, martwe wiadomości, moduł Inventory**: pipeline FluentValidation z kontraktem 400, martwe wiadomości outboxa z wykładniczym backoffem, encja i repozytorium `Item`, moduł Inventory podpięty do hosta, rozliczenie idempotentne przez inbox Wallets.
- **2026-08-15** — **Identity, closer, CI**: rejestracja i logowanie z BCryptem i JWT, portfel tworzony z `UserRegisteredEvent` przez outbox Identity, tworzenie aukcji z migracjami, `AuctionCloser`, inbox Wallets, pipeline GitLab CI, układ `src/` i `tests/`.
- **2026-08-03 / 2026-08-04** — **Testy integracyjne portfela i notatka projektowa**: migracja Auctions, testy portfela na Testcontainers, `AGENTS.md` z docelową architekturą (usunięty 2026-08-15), bazowa logika logowania i rejestracji.
- **2026-07-06 do 2026-07-08** — **Fundamenty**: struktura projektu, encja Auctions i infrastruktura CQRS, endpointy, `AppException`, outbox i migracje Auctions, Wallets z dodawaniem środków, endpointami, migracją i obsługą współbieżności, pierwsze README.

## Powiązane dokumenty

- [STATE.md](STATE.md) - aktualny stan.
- [DECISIONS.md](DECISIONS.md) - decyzje stojące za kamieniami milowymi.
