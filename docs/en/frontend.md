# Frontend (planned)

> English version. Polish 1:1 counterpart: [../pl/frontend.md](../pl/frontend.md)

This module does not exist yet: the repository contains no `Frontend/` folder, no `package.json` and no TypeScript. This page records the target, what the backend already offers a client and what it still lacks, so that the frontend can start from facts rather than assumptions.

## Status

Planned. The previous README named it "Angular frontend" and the deleted design note (`AGENTS.md`) placed it as "UI/FRONTEND" in front of the API gateway; no framework version, repository layout or design has been decided in writing.

## Target design

- An Angular single-page application that talks to the backend only through the planned API gateway (today it would call the host directly at `http://localhost:5244`).
- Player flows: register and log in, browse active auctions, see an auction with its item snapshot, place bids, manage the inventory (craft, sell to the shop, list an item), read the wallet balances.
- Authentication with the JWT from `POST /api/users/login` stored on the client and sent as a bearer token; player tokens expire after 15 minutes, so the client needs a re-login or a future refresh flow.

## What the backend provides

| Need | Available today |
|---|---|
| public browsing without login | `GET /api/auctions?limit=N` (active auctions ordered by `EndsOn`), `GET /api/auctions/{id}` (any status, with `CancellationReason`), `GET /api/wallets/{id}` |
| accounts | `POST /api/users/register`, `POST /api/users/login` returning `{ token }` with the role claim inside |
| actions behind a bearer token | `POST /api/auctions`, `POST /api/auctions/{id}/bid`, `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| machine-readable responses | camelCase property names, enums serialized as strings, `201` responses with the new id and a `Location` header, one error shape `{ "error": "..." }` for domain and validation errors (binding errors return an empty 400 in Production) |

## What is missing

- No CORS policy in the host, so a browser on another origin is blocked until one is added.
- No OpenAPI document (the package is referenced but not registered), so a client cannot be generated from a specification.
- No bid history and no push channel: the client has to poll `GET /api/auctions/{id}` to see price changes, and a freshly created auction stays `Pending` for up to two outbox polling cycles before it appears in the list.
- No endpoint lists a user's own auctions or the auctions they currently lead.

## Views (routes)

| Candidate view | Backend endpoints it would use |
|---|---|
| auction list | `GET /api/auctions` |
| auction detail with bidding | `GET /api/auctions/{id}`, `POST /api/auctions/{id}/bid` |
| list an item for sale | `GET /api/inventory`, `POST /api/auctions` |
| inventory with crafting and shop | `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| wallet | `GET /api/wallets/{id}` with the user's own `PublicUserId` taken from the token |
| register and login | `POST /api/users/register`, `POST /api/users/login` |

## Decisions

- Angular was named as the frontend framework in the original design note; the version and the tooling are open.
- In the target design the frontend talks only to the gateway; until the gateway exists it would call the host directly, which first needs CORS and OpenAPI on the host side ([ARCHITECTURE.md](ARCHITECTURE.md#known-limitations)).

## Related documents

- [backend/README.md](backend/README.md) - the error contract and the authentication schemes a client must handle.
- [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - the endpoints in detail.
- [infrastructure.md](infrastructure.md) - the gateway the frontend is meant to talk to.
