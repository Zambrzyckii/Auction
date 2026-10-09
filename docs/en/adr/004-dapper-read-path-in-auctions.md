# ADR-004: Dapper read path in Auctions, EF Core everywhere else

- **Status:** accepted (2026-07-06) · PL: [../../pl/adr/004-dapper-read-path-in-auctions.md](../../pl/adr/004-dapper-read-path-in-auctions.md)
- **Context:** the design note assigns "full CQRS (EF Core for writes, Dapper for complex reads)" to Auctions and CQS to Wallets; the auction listing is the only public, list-shaped read in the API, while the other modules read single rows by key.
- **Decision:** Auctions queries run raw SQL with Dapper through `ISqlConnectionFactory` and return dedicated DTOs; Auctions writes and all Wallets, Inventory and Identity access stay on EF Core (`AsNoTracking` for reads).
- **Consequences:** the listing bypasses change tracking and the `Version` token and maps columns by name, so column renames must be mirrored in the SQL strings; two DTOs with identical fields exist for the two queries; the module carries two data-access styles and a direct Npgsql dependency.
