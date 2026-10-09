# Diagram sources

Every diagram in the documentation is authored in [Mermaid](https://mermaid.js.org/) under `src/` and committed as two pre-rendered SVGs next to this file: `<name>.svg` for light mode and `<name>.dark.svg` for dark mode. The pages embed them with a `<picture>` element, so GitHub and GitLab show the variant that matches the reader's colour scheme, at full size and without the interactive Mermaid viewer. Diagram labels are English only; the Polish and English pages embed the same files.

## Re-rendering

Requirements: Node.js 18 or newer and Python 3. The first run lets `npx` download `@mermaid-js/mermaid-cli`.

```bash
python3 docs/diagrams/render.py                  # all diagrams
python3 docs/diagrams/render.py settlement       # only sources whose file name contains "settlement"
```

If mermaid-cli reports `Could not find chrome-headless-shell (ver. X)`, install that exact build into Puppeteer's cache once and run the script again:

```bash
npx -y @puppeteer/browsers install chrome-headless-shell@X --path ~/.cache/puppeteer
```

## Conventions

- Sources are written for the light theme (`theme.light.json`). `render.py` derives the dark variant by swapping the palette listed at the top of the script and rendering with `theme.dark.json`, so a source never needs two copies.
- Node classes, one colour per part of the system: `client` (HTTP clients, orange), `host` (the `AuctionServer.Api` project, indigo), `identity` (amber), `wallets` (emerald), `auctions` (sky blue), `inventory` (rose), `shared` (`AuctionServer.Shared.Integration` and cross-cutting pieces, slate), `db` (PostgreSQL, purple) and `planned` (parts that do not exist yet, grey with a dashed border). Apply them with `:::auctions` or `class A,B auctions`; the `classDef` block at the end of each flowchart defines the colours.
- File names follow `<page>-<nn>-<section>.mmd`, for example `architecture-05-close-and-settlement.mmd` is the fifth diagram of `docs/en/ARCHITECTURE.md` (and of its Polish twin).
- Keep diagrams small enough to read on a laptop screen; split a flow into two diagrams rather than adding a ninth participant.
