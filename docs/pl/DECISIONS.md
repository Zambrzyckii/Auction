# AuctionServer — rejestr decyzji

> Wersja polska. Angielski odpowiednik 1:1: [../en/DECISIONS.md](../en/DECISIONS.md)

Rejestr decyzji tylko do dopisywania, od najstarszych, z datą dnia podjęcia decyzji (dla kodu: datą commitu, który ją wprowadził). Tam, gdzie uzasadnienia nie zapisano w swoim czasie, wiersz mówi o tym wprost, zamiast je wymyślać; decyzje o trwałych konsekwencjach mają też ADR w [adr/](adr).

| Data | Decyzja | Autor | Uzasadnienie |
|---|---|---|---|
| 2026-07-06 | Modular monolith w .NET na jednej bazie PostgreSQL z jednym współdzielonym projektem kontraktów (`Shared.Integration`) | właściciel | zapisane w notatce projektowej z 2026-08-03 i README: ścisłe granice modułów i integracja przez zdarzenia ponad liczbę funkcji; zobacz ADR-001 |
| 2026-07-06 | Auctions używa CQRS: EF Core do zapisów, Dapper do odczytów | właściciel | notatka projektowa: „full CQRS (EF Core for writes, Dapper for complex reads)" dla Auctions; zobacz ADR-004 |
| 2026-07-07 | Wyjątki domenowe dziedziczą po `AppException(message, statusCode)` i są mapowane przez jeden globalny handler | właściciel | README: jeden handler wyjątków, żeby endpointy nie zawierały try/catch |
| 2026-07-07 | Transakcyjny outbox w Auctions | właściciel | notatka projektowa: zdarzenia zapisywane w tej samej transakcji co stan biznesowy; zobacz ADR-002 |
| 2026-07-08 | Tokeny współbieżności `Guid Version`; `DbUpdateConcurrencyException` mapowany na 409 | właściciel | notatka projektowa: optymistyczna współbieżność na zapisach finansowych, żeby zapobiec podwójnemu wydaniu |
| 2026-07-08 | Wallets używa CQS (EF Core do odczytów i zapisów) | właściciel | notatka projektowa: CQS dla Wallets, CQRS tylko tam, gdzie odczyty są złożone |
| 2026-08-03 | Testy integracyjne działają na prawdziwym PostgreSQL przez Testcontainers, bez mockowania bazy | właściciel | notatka projektowa, strategia testów |
| 2026-08-04 | Identity z hashowaniem haseł BCryptem i JWT HS256 | właściciel | uzasadnienie niezapisane |
| 2026-08-15 | Portfel tworzony automatycznie z `UserRegisteredEvent` przez outbox Identity | właściciel | README: automatyczne tworzenie portfela per użytkownik |
| 2026-08-15 | GitLab CI z `build`, `unit-tests` i `integration-tests` (docker-in-docker) | właściciel | uzasadnienie niezapisane |
| 2026-08-15 | `AuctionCloser` w tle zamyka wygasłe aukcje i emituje `AuctionFinishedEvent` | właściciel | README: automatyczne zamykanie atomowo ze zmianą stanu |
| 2026-08-15 | Inbox (`ProcessedMessages`) w Wallets dla idempotentnej konsumpcji | właściciel | README: rozliczenie dokładnie raz przy dostarczaniu co najmniej raz; zobacz ADR-002 |
| 2026-08-15 | Układ `src/` i `tests/` w `Backend/` | właściciel | uzasadnienie niezapisane |
| 2026-08-16 | FluentValidation przez behavior pipeline'u MediatR z kontraktem 400 | właściciel | README: spójny kontrakt błędów walidacji |
| 2026-08-16 | Martwe wiadomości outboxa z wykładniczym backoffem, pięć prób | właściciel | README: zawodzące wiadomości zachowują historię błędów i przestają być ponawiane w nieskończoność |
| 2026-08-16 | Moduł Inventory: poziomy rzadkości, crafting trzy do jednego, sklep oficjalny | właściciel | lista funkcji w README; same reguły nie mają zapisanego uzasadnienia |
| 2026-08-17 | Rozliczenie w Wallets idempotentne przez inbox | właściciel | README: dokładnie raz |
| 2026-08-26 | Szew `IIntegrationEventPublisher` i `EventId` na każdym zdarzeniu | właściciel | README: RabbitMQ jako zamiennik publishera in-process bez zmian w modułach; zobacz ADR-003 |
| 2026-08-29 | Enumy serializowane jako stringi w JSON | właściciel | uzasadnienie niezapisane |
| 2026-08-29 | Rola bota z tokenami 24-godzinnymi, schemat klucza API i endpointy tylko dla botów | właściciel | README: boty zakładane i zasilane przez dedykowane endpointy; czasy życia nie mają zapisanego uzasadnienia |
| 2026-08-29 | Konfigurowalne środki startowe (`Wallets:StartingFunds`) | właściciel | uzasadnienie niezapisane |
| 2026-08-29 | Aukcje tworzone jako `Pending` do potwierdzenia blokady przedmiotu przez Inventory; filtrowany indeks unikalny na jedną otwartą aukcję na przedmiot; inboxy w Auctions i Inventory | właściciel | README: aukcja nigdy nie dotyczy przedmiotu, którego sprzedawca nie może zablokować |
| 2026-08-30 | Outbox Wallets i `AuctionSettledEvent`; przedmiot jest przenoszony dopiero po rozliczeniu | właściciel | README: przedmiot przechodzi dopiero po pieniądzach |
| 2026-08-30 | Rezerwacja środków per oferta zaprojektowana (pesymistyczna oferta, księga blokad per oferta), ale niezaimplementowana | właściciel | notatka projektowa z 2026-08-30: oferta bez pokrycia psuje aukcję, dwa portfele i przedmiot |
| 2026-10-07 | Zestaw dokumentacji: dwujęzyczna EN/PL 1:1 w `docs/`, dokumenty stałe plus rozdziały modułów, diagramy Mermaid renderowane do SVG, poprzedni `docs/` przeniesiony poza repozytorium, README przepisane na front door | właściciel (z agentem) | poprzednia dokumentacja nie zgadzała się z kodem i nie była śledzona przez gita |
| 2026-10-07 | Rozdziały modułów żyją centralnie w `docs/{en,pl}/backend/`; każdy moduł planowany dostaje jedną stronę | właściciel (z agentem) | trzy z czterech modułów jeszcze nie istnieją; jeden indeks łatwiej utrzymać |
| 2026-10-07 | Etykiety diagramów tylko po angielsku, wspólne dla obu języków | agent (propozycja, przyjęta) | jedno źródło na diagram; polskie litery są problemem w etykietach Mermaid |

## Powiązane dokumenty

- [adr/](adr) - cztery rekordy decyzji architektonicznych.
- [CHANGELOG.md](CHANGELOG.md) - kamienie milowe, do których należą te decyzje.
- [CONVENTIONS.md](CONVENTIONS.md) - reguły, które z nich wynikają.
