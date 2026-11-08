# Frontend (in progress)

> English version. Polish 1:1 counterpart: [../pl/frontend.md](../pl/frontend.md)

The scaffold exists since 2026-11-08: `Frontend/` holds an Angular 22 CLI workspace (standalone components, signals, zoneless change detection, Vitest, SCSS) with the dev server proxying `/api` to the gateway. The views are not built yet, so this page still records the target, what the backend already offers a client and what it still lacks.

## Status

In progress since 2026-11-08. The stack and the repository layout are decided in [ADR-015](adr/015-angular-frontend-stack.md) and the DECISIONS.md rows of that date, and the views land batch by batch. The MVP UI stays deliberately bare, readable for manual testing only; the real UI/UX pass is a separate branch of the plan at the end of the project.

## Target design

- An Angular single-page application that talks to the backend only through the API gateway on `http://localhost:8080`, which exists since 2026-10-23.
- Player flows: register and log in, browse active auctions, see an auction with its item snapshot, place bids, manage the inventory (craft, sell to the shop, list an item), read the wallet balances.
- Authentication with the JWT from `POST /api/users/login` stored on the client and sent as a bearer token; player tokens expire after 15 minutes, so the client needs a re-login or a future refresh flow.

## What the backend provides

| Need | Available today |
|---|---|
| public browsing without login | `GET /api/auctions?limit=N` (active auctions ordered by `EndsOn`), `GET /api/auctions/{id}` (any status, with `CancellationReason`), `GET /api/auctions/{id}/bids` (confirmed bids, newest first) |
| accounts | `POST /api/users/register`, `POST /api/users/login` returning `{ token }` with the role claim inside |
| actions behind a bearer token | `POST /api/auctions`, `POST /api/auctions/{id}/bid`, `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| machine-readable responses | camelCase property names, enums serialized as strings, `201` responses with the new id and a `Location` header, one error shape `{ "error": "..." }` for domain and validation errors (binding errors return an empty 400 in Production) |

## What is missing

- No push channel: the client has to poll `GET /api/auctions/{id}` to see price changes, and a freshly created auction stays `Pending` for up to two outbox polling cycles before it appears in the list.
- No endpoint lists a user's own auctions or the auctions they currently lead.

## Views (routes)

| Candidate view | Backend endpoints it would use |
|---|---|
| auction list | `GET /api/auctions` |
| auction detail with bidding | `GET /api/auctions/{id}`, `GET /api/auctions/{id}/bids`, `POST /api/auctions/{id}/bid` |
| list an item for sale | `GET /api/inventory`, `POST /api/auctions` |
| inventory with crafting and shop | `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| wallet | `GET /api/wallets/{id}` with the user's own `PublicUserId` taken from the token |
| register and login | `POST /api/users/register`, `POST /api/users/login` |

## Decisions

- Angular 22 with the CLI defaults, plain SCSS and Signal Forms, decided 2026-11-08; see [ADR-015](adr/015-angular-frontend-stack.md).
- The frontend talks only to the gateway, which passes CORS preflights through to the host (checked on 2026-10-23, a preflight from `http://localhost:4200` gets 204 with the matching `Access-Control-Allow-Origin`). The host has CORS for `http://localhost:4200`, the OpenAPI document at `/openapi/v1.json` (open to private networks through the gateway) and the health routes `/health`, `/health/live` and `/health/ready`.

## Related documents

- [backend/README.md](backend/README.md) - the error contract and the authentication schemes a client must handle.
- [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - the endpoints in detail.
- [infrastructure.md](infrastructure.md) - the gateway the frontend is meant to talk to.
