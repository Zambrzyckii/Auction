# AuctionServer — working conventions

> English version. Polish 1:1 counterpart: [../pl/CONVENTIONS.md](../pl/CONVENTIONS.md)

These are the rules the repository follows today, taken from the code and the git history, plus the documentation rules introduced with this documentation set. Where the code deviates from a rule, the deviation is recorded in [ARCHITECTURE.md](ARCHITECTURE.md#known-limitations) rather than hidden here.

## 1. Repository and git

- One long-lived branch, `main`; feature work was merged once through a GitLab merge request (`Create-Identity-Endpoint`), otherwise committed directly.
- Commit messages are short English sentences describing the change (`Add inbox to Inventory Module`), without type prefixes.
- Secrets never enter the repository: the connection string, the JWT key and the bot API key live in user secrets or environment variables; `.env` is ignored and `.env.example` documents the two variables nothing reads yet.
- `bin/`, `obj/`, `.idea/` and `CLAUDE.md` are ignored; `AuctionServer.sln.DotSettings.user` is tracked.

## 2. Documentation

- Documentation is bilingual: every file under `docs/en/` has a twin with the same name under `docs/pl/`, the same number of lines, the same headings on the same lines and the same table rows; root `README.md` pairs with `README.pl.md`.
- Line 3 of every page is the language switch (`> English version. Polish 1:1 counterpart: ...` / `> Wersja polska. Angielski odpowiednik 1:1: ...`); ADRs carry the link in their **Status** bullet instead.
- One paragraph is one line, so the two languages can be compared line by line; identifiers, paths, ports and commands stay in English in both.
- Code is referenced by relative links to files, never by line numbers; identifiers are quoted exactly as they appear in the code.
- Diagrams are Mermaid sources under `docs/diagrams/src/`, named `<page>-<nn>-<section>.mmd`, rendered by `python3 docs/diagrams/render.py` into a light and a dark SVG and embedded with `<picture>`; labels are English only and shared by both languages. A diagram is introduced by one sentence and followed by numbered steps or an explanatory paragraph.
- Every page ends with `## Related documents`. Module chapters follow Overview, Running, Configuration, Data model, API, Events, Decisions.
- Standing documents and when they change: `VISION.md` on scope changes, `CONVENTIONS.md` on rule changes, `DECISIONS.md` on every decision, `STATE.md` after every state-changing session, `CHANGELOG.md` at milestones, `ARCHITECTURE.md` and its diagrams on every architecture change, `adr/NNN-title.md` for decisions with lasting consequences (Status, Context, Decision, Consequences).

## 3. Code conventions

- One module is one `.csproj` with `Presentation/`, `Application/`, `Domain/` and `Infrastructure/`; the host wires it with `Add<Name>Module` and `Map<Name>Endpoints`.
- Modules reference only `AuctionServer.Shared.Integration`; they never reference each other and never query another module's tables.
- Integration events are `record` types with `Guid EventId` as the first parameter, registered by name in `IntegrationEventTypes`; the outbox row `Id` is the event's `EventId`.
- Domain exceptions are nested classes in one static container per module (`AuctionExceptions`, `WalletExceptions`, `InventoryException`, `IdentityException`) deriving from `AppException(message, statusCode)`; endpoints contain no try/catch.
- Validators live next to their command (`<Command>Validator : AbstractValidator<Command>`), use the lambda overloads for time-dependent rules and are executed by `ValidationBehaviour`.
- Every aggregate (`Auction`, `Wallet`, `Item`) carries a `Guid Version` concurrency token regenerated inside every mutating method; invariants are checked in the entity, not in handlers.
- Saves that move money or settle state pass `CancellationToken.None`; reads pass the request token.
- Table names carry the module prefix (`WalletsOutboxMessages`, `InventoryItems`); the Auctions `OutboxMessages` table predates the rule.
- Migrations are created per module context with `--startup-project src/AuctionServer.Api` and the module's `--output-dir`.
- Uniqueness with a condition uses a filtered unique index (`HasFilter`), not application checks alone.
- Authorization policies are referenced by their string names `"Bot"` and `"BotProvisioning"`.
- Names, comments, commits and branches are English; comments appear only where the code is not self-explanatory.

## 4. Testing

- Each module has one xUnit project with offline tests (`Application/`, `Domain/`, `Infrastructure/`) and an `IntegrationTests/` namespace that runs against PostgreSQL started by Testcontainers (`postgres:latest`), never against a mocked database.
- Integration fixtures are collection fixtures named `<Module>PostgresFixture`; API-level tests use `WebApplicationFactory<Program>` (`CustomApi`).
- Test methods are named `Method_WhenCondition_ShouldResult` and follow arrange, act, assert.
- CI runs the offline Auctions tests in `unit-tests` and everything else in `integration-tests`; both jobs must pass.

## 5. Configuration and secrets

- Settings are read through `IConfiguration`; local values come from `dotnet user-secrets` on `src/AuctionServer.Api`, CI and containers use environment variables with `__`.
- Required keys: `ConnectionStrings:DefaultConnection`, `Jwt:Key` (at least 32 characters), `Bots:ApiKey`, `Wallets:StartingFunds`; `Jwt:Issuer` and `Jwt:Audience` have defaults in `appsettings.json`.
- Migrations are applied by `dotnet ef database update`, never at application startup.

## 6. Definition of done

1. The code builds and the relevant tests pass, including the integration tests of the touched module.
2. New or changed behaviour is described in the module chapter and, when it crosses modules, in `ARCHITECTURE.md`, in English and Polish.
3. Diagrams touched by the change are updated in `docs/diagrams/src/` and re-rendered.
4. `STATE.md` reflects the new state; a decision with lasting consequences gets a row in `DECISIONS.md` or an ADR.
5. The parity of `docs/en` and `docs/pl` holds (same files, same line counts, same headings).

## Related documents

- [README.md](README.md) - documentation index.
- [ARCHITECTURE.md](ARCHITECTURE.md) - where the conventions are visible in the structure.
- [backend/README.md](backend/README.md) - running, configuration and tests in detail.
