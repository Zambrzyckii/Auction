# ADR-001: Modular monolith na jednej bazie z tabelami z prefiksem modułu

- **Status:** przyjęta (2026-07-06, spisana 2026-08-03) · EN: [../../en/adr/001-modular-monolith-single-database.md](../../en/adr/001-modular-monolith-single-database.md)
- **Kontekst:** projekt chce granic klasy mikroserwisów (niezależne moduły, integracja przez zdarzenia) w bazie kodu wielkości portfolio z jednym deweloperem, jednym artefaktem wdrożeniowym i jedną instancją PostgreSQL.
- **Decyzja:** jeden host ASP.NET Core z jednym `.csproj` na moduł, jeden współdzielony projekt kontraktów (`Shared.Integration`), jedna fizyczna baza, w której każdy moduł posiada swój `DbContext`, swoje migracje i swoje tabele, oraz brak referencji projektowych i zapytań między modułami.
- **Konsekwencje:** izolacja jest egzekwowana konwencją, nie schematami ani kompilatorem; wszystkie konteksty dzielą `__EFMigrationsHistory`, więc nazwy tabel muszą pozostać unikalne (tabela `OutboxMessages` w Auctions jest starsza niż reguła prefiksu); id przekraczają moduły jako kopiowane Guidy bez kluczy obcych, więc spójność między modułami to kwestia zdarzeń, nie ograniczeń bazy.
