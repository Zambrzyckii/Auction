# ADR-004: Ścieżka odczytu Dapperem w Auctions, EF Core wszędzie indziej

- **Status:** przyjęta (2026-07-06) · EN: [../../en/adr/004-dapper-read-path-in-auctions.md](../../en/adr/004-dapper-read-path-in-auctions.md)
- **Kontekst:** notatka projektowa przypisuje Auctions „full CQRS (EF Core for writes, Dapper for complex reads)", a Wallets CQS; lista aukcji to jedyny publiczny odczyt listowy w API, podczas gdy pozostałe moduły czytają pojedyncze wiersze po kluczu.
- **Decyzja:** zapytania Auctions wykonują surowy SQL Dapperem przez `ISqlConnectionFactory` i zwracają dedykowane DTO; zapisy Auctions oraz cały dostęp Wallets, Inventory i Identity zostają na EF Core (`AsNoTracking` do odczytów).
- **Konsekwencje:** lista omija śledzenie zmian i token `Version` oraz mapuje kolumny po nazwie, więc zmiany nazw kolumn trzeba odzwierciedlać w stringach SQL; dla dwóch zapytań istnieją dwa DTO o identycznych polach; moduł niesie dwa style dostępu do danych i bezpośrednią zależność od Npgsql.
