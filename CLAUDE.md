# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository map

Gamified auction system. Only `Backend/` contains code — everything below it is a .NET 10 modular monolith
backed by PostgreSQL.

```
Backend/          the entire codebase (solution: AuctionServer.slnx)
Frontend/         planned Angular client, not started
Bots/             planned AI market bots, not started
Infrastructure/   planned RabbitMQ / API Gateway / compose setup, not started
```

The three non-Backend directories are **planned work** and may be absent from the tree entirely (git does not
track empty directories) — that is not a broken checkout. Do not scaffold anything into them unless asked.

## Entry point

All build, run, test and EF Core migration commands run from `Backend/`, and their canonical documentation —
including per-project test commands, the two-migration-folder trap in Auctions, and how the connection string
is supplied — lives in **`Backend/CLAUDE.md`**. Read that file before touching backend code; do not duplicate
its commands here.

Quick sanity check that the tree is healthy:

```bash
cd Backend && dotnet build AuctionServer.slnx
```

## Sources of truth, and how far to trust them

- **`Backend/CLAUDE.md`** — the canonical backend reference. As of 2026-08-11 a sample of its file:line
  citations and its "Aspirational vs. implemented" claims were re-checked against the code and held up; the
  rest were not audited. Re-verify any single citation you are about to act on.
- **`docs/`** — the bilingual documentation set (EN/PL, 1:1 structure): `docs/en/ARCHITECTURE.md` for how the
  system is built, `docs/en/VISION.md` for the target architecture and the roadmap. The original design note
  (`AGENTS.md`) was deleted on 2026-08-15; these pages replaced it. Read `Backend/CLAUDE.md`'s
  "Aspirational vs. implemented" section before building on any roadmap claim.
- **`README.md`** — recruitment-facing project overview (stack, architecture, done-vs-planned, how to run).
  Written for human readers; when it and the code drift apart, update it rather than trust it.

Where a document and the code disagree, the code wins — and the disagreement is worth reporting.

## Non-negotiable module rules

These come from the original design note (today `docs/en/VISION.md`, "Ground rules") and are enforced by
convention, not by the compiler — nothing stops you from breaking them, so they need active attention:

- One module = one `.csproj`, internally split into `Presentation` / `Application` / `Domain` / `Infrastructure`.
- **No cross-module database joins and no cross-module project references.** Modules communicate only through
  integration events. `AuctionServer.Shared.Integration` is the single shared project and the only legal
  contact surface between modules.
- Every module owns its own `DbContext` and its own migrations. They happen to share one physical database and
  one `__EFMigrationsHistory` table, so isolation is discipline, not a schema boundary.
- `Domain` and `Application` layers must stay free of ASP.NET Core types.
