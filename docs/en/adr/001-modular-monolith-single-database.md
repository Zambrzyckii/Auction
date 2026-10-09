# ADR-001: Modular monolith on one database with module-prefixed tables

- **Status:** accepted (2026-07-06, written down 2026-08-03) · PL: [../../pl/adr/001-modular-monolith-single-database.md](../../pl/adr/001-modular-monolith-single-database.md)
- **Context:** the project wants microservice-grade boundaries (independent modules, event-driven integration) in a portfolio-sized code base with one developer, one deployable and one PostgreSQL instance.
- **Decision:** one ASP.NET Core host with one `.csproj` per module, a single shared contracts project (`Shared.Integration`), one physical database in which every module owns its `DbContext`, its migrations and its tables, and no cross-module project reference or query.
- **Consequences:** isolation is enforced by convention, not by schemas or the compiler; all contexts share `__EFMigrationsHistory`, so table names must stay unique (the Auctions `OutboxMessages` table predates the prefix rule); ids cross modules as copied Guids without foreign keys, so integrity between modules is a matter of events, not constraints.
