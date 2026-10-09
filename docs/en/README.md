# AuctionServer documentation

> English version. Polish 1:1 counterpart: [../pl/README.md](../pl/README.md)

AuctionServer is a gamified auction house built as a .NET 10 modular monolith on PostgreSQL: four modules in one process, talking through a transactional outbox and inbox. These pages describe how the system is put together, how an auction travels through it and what is planned; they are written for a developer who opens the repository for the first time. Every page exists in English and in Polish with the same structure.

## Reading order

1. [ARCHITECTURE.md](ARCHITECTURE.md) - the system context, the modules, the three auction flows, the data model and the known limitations. Start here.
2. [backend/README.md](backend/README.md) - the projects, how to run and configure the host, the request pipeline, the error contract and the tests.
3. [backend/messaging.md](backend/messaging.md) - the outbox, the inbox, the retry policy and the catalog of integration events.
4. [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - one chapter per module.
5. [STATE.md](STATE.md) and [VISION.md](VISION.md) - where the project stands and where it is going.
6. [CONVENTIONS.md](CONVENTIONS.md), [DECISIONS.md](DECISIONS.md) and [adr/](adr) - the rules and the reasons.
7. [frontend.md](frontend.md), [bots.md](bots.md), [infrastructure.md](infrastructure.md) - the modules that do not exist yet.

## Map

| Document | Answers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | What are the moving parts, how does an auction travel through them, where are the limits? |
| [backend/README.md](backend/README.md) | Which projects exist, how do I run and configure the backend, what does a request go through, how are tests organised? |
| [backend/messaging.md](backend/messaging.md) | How do modules talk, what happens when a handler fails, which events exist? |
| [backend/auctions.md](backend/auctions.md) | How are auctions created, activated, bid on and closed, and how are they read? |
| [backend/inventory.md](backend/inventory.md) | What is an item, how are items minted, crafted, sold, locked and transferred? |
| [backend/wallets.md](backend/wallets.md) | How is money locked, unlocked, spent and credited, and what can never happen to a balance? |
| [backend/identity.md](backend/identity.md) | How do registration, login, JWT and bot provisioning work? |
| [VISION.md](VISION.md) | What is the product, what do the terms mean, what is planned next? |
| [CONVENTIONS.md](CONVENTIONS.md) | How are code, tests and documentation kept, what is the definition of done? |
| [DECISIONS.md](DECISIONS.md) | Which decisions were taken when, and why? |
| [adr/](adr) | The four decisions with lasting consequences, in context, decision and consequences form. |
| [STATE.md](STATE.md) | What exists right now, what is the environment, what is the next step? |
| [CHANGELOG.md](CHANGELOG.md) | How did the project get here, milestone by milestone? |
| [frontend.md](frontend.md), [bots.md](bots.md), [infrastructure.md](infrastructure.md) | What is planned for each missing module, and what does the backend already offer it? |
| [../diagrams/README.md](../diagrams/README.md) | How are the diagrams authored and re-rendered? |

## Conventions

- Every page under `docs/en/` has a Polish twin under `docs/pl/` with the same file name, the same number of lines and the same headings; line 3 of each page links to the other language.
- Diagrams are authored in [Mermaid](https://mermaid.js.org/) under [`../diagrams/src/`](../diagrams/src) and committed as pre-rendered SVGs with a light and a dark variant, embedded with `<picture>` so GitLab and GitHub show the variant matching the reader's theme at full size. Colours are consistent across pages: orange for clients, indigo for the host, amber for Identity, green for Wallets, blue for Auctions, rose for Inventory, slate for shared pieces, purple for PostgreSQL and dashed grey for planned parts. After editing a source run `python3 docs/diagrams/render.py`.
- Code is referenced by relative links to files rather than line numbers, so the links stay valid as files change; identifiers are quoted exactly as they appear in the code.
- Everything in the repository is written in English; the `docs/pl` side is the only Polish text.

Running the project is described in the [root README](../../README.md#quick-start).

## Related documents

- [../../README.md](../../README.md) - the repository front door.
- [../diagrams/README.md](../diagrams/README.md) - the diagram toolchain.
