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

## Session

`Session` under `core/auth/` owns the token pair in `localStorage` (`auction.token` and
`auction.refresh`) and the token signal. `SessionRefresher` renews the JWT a minute before
`exp`, is injected once in `App` and is the only code that posts `/api/users/refresh`. Keep
these invariants:

- `authInterceptor` returns early for non-`/api/` URLs and the four `AUTH_ROUTES` before it
  injects `SessionRefresher`. The refresher's constructor may send a request through the
  same interceptor, so moving that `inject` above the check risks a DI cycle (NG0200) at startup.
- `Session` never injects `ProfileDirectory` or `SessionRefresher`, because both inject
  `Session`. Code that ends a session clears the directory itself (`handleUnauthorized` in
  `unauthorized.ts` and the refresher's 400 path).
- A 400 from `/refresh` is the only refresh outcome that ends the session. A network failure,
  409, 429 or 5xx keeps the pair and hands back the current JWT.
- jsdom has no `navigator.locks`, so `withRefreshLock` runs the task without a lock in specs.
- Timer specs use Vitest fake timers and call `await vi.advanceTimersByTimeAsync(0)` before
  `TestBed.tick()`, so the code after an awaited POST runs before the assertions.

## Push

`PushClient` under `core/push/` holds the `GET /api/push` stream and is started only from `App`,
whose effect on the session token calls `connect()` on every token change and disconnects on
logout. `connect()` is a no-op while a stream runs for the same `userId`, so a silent refresh
never restarts the stream, and `open()` reads `session.token()` each time it opens. A view never
calls `connect()`. It subscribes with one `refreshOn(poller, topic)` line in its constructor and
keeps its poller as the fallback. Specs replace `PushClient` with `pushStub()` from
`src/testing/push-stub.ts`.
