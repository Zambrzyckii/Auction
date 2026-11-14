# CLAUDE.md

This file covers the Angular client in `Frontend/`. The backend reference is `Backend/CLAUDE.md`,
the API contract a client must handle is `docs/en/frontend.md` with `docs/en/backend/README.md`,
and the stack decision is `docs/en/adr/015-angular-frontend-stack.md`.

## Commands

All commands run from `Frontend/` through `npx ng`. Do not run the global `ng` from the home
directory: a stray `/home/bob/package.json` makes `ng version` report misleading data there.

```bash
npm ci                      # restore dependencies from package-lock.json
npx ng serve                # dev server on :4200, /api proxied to the gateway (proxy.conf.json)
npx ng build                # production build into dist/
npx ng test --watch=false   # Vitest unit tests (jsdom), single run
```

API calls need the backend stack: `./Infrastructure/secrets/gen-secrets.sh` once, then
`docker compose up -d --build` from the repository root (gateway on `http://localhost:8080`).

## Stack

Angular 22 with the CLI defaults: standalone components, signals, zoneless change detection,
Vitest, plain SCSS (no component library) and Signal Forms. Under zoneless change detection a
plain class field mutated in a `subscribe` callback does not refresh the view; state that the
template reads belongs in a signal. New npm packages beyond the scaffold need the owner's
consent (ADR-015). The UI is deliberately bare; the UI/UX pass is a separate branch of the
plan at the end of the project, so do not invest in styling.
