# Frontend

> English version. Polish 1:1 counterpart: [../pl/frontend.md](../pl/frontend.md)

The scaffold exists since 2026-11-08: `Frontend/` holds an Angular 22 CLI workspace (standalone components, signals, zoneless change detection, Vitest, SCSS) with the dev server proxying `/api` to the gateway. The MVP views shipped on 2026-11-10 and the module views on 2026-11-14, so this page records what the client does today, what the backend offers it and what it still lacks.

## Status

The module views shipped on 2026-11-14 on the stack decided in [ADR-015](adr/015-angular-frontend-stack.md): every backend module now has a view (transfers, bank loans, casino chips with roulette and blackjack, the pawnshop, warehouse wars, own and public profiles with friends and invites) next to the MVP auctions, inventory and wallet. Signed-in routes sit behind a token guard, and a 401 clears the session and redirects to login with a returnUrl (refresh tokens wait as issue #18). Without a push channel the client polls, and each view picks its rhythm: the auction detail and its bids every 2.5 s, the warehouse war detail every second during bidding and every 2.5 s otherwise, wallets, the inventory and the warehouse list every 5 s, the auction list, the game histories and the invites every 10 s, and the saga-driven views (a pending chip purchase, a pending pawnshop payment, a pending loan) drop to 2 s while something is in flight; on 5xx and network failures the poller backs off exponentially up to 30 s and a 429 honours `Retry-After`. Action buttons sit behind prechecks that mirror the server's guard order, reusing its refusal texts where the client knows them, and client-side constants (loan statuses, roulette bet types, card labels, the warehouse tier table, the invite lifetime, the blackjack hand timeout) mirror the backend configuration, so config drift surfaces as a visible "Unknown tier" label instead of a crash; the server stays the authority and the prechecks are hints. Views remember what the server will not repeat: a reloaded blackjack hand is reconciled instead of overwritten, and a warehouse entry fee rejected by the wallet is detected from the client's own join timestamp, because the API keeps no trace of the rejection. Every batch was verified by a scripted Playwright run against the compose stack, and the final pass reran the module flows on a stack rebuilt from scratch. The UI stays deliberately bare, readable for manual testing only; the real UI/UX pass is a separate branch of the plan at the end of the project.

## Target design

- An Angular single-page application that talks to the backend only through the API gateway on `http://localhost:8080`, which exists since 2026-10-23.
- Player flows: register and log in, browse and run auctions, manage the inventory and the wallet, transfer money, take and repay loans, play roulette and blackjack on casino chips, run a pawnshop, fight warehouse wars with friends and keep a public profile.
- Authentication with the JWT from `POST /api/users/login` stored on the client and sent as a bearer token; player tokens expire after 15 minutes, so the client needs a re-login or a future refresh flow.

## What the backend provides

| Need | Available today |
|---|---|
| public browsing without login | `GET /api/auctions?limit=N` (active auctions ordered by `EndsOn`), `GET /api/auctions/{id}` (any status, with `CancellationReason`), `GET /api/auctions/{id}/bids` (confirmed bids, newest first) |
| accounts | `POST /api/users/register`, `POST /api/users/login` returning `{ token }` with the role claim inside |
| auctions and inventory behind a bearer token | `POST /api/auctions`, `POST /api/auctions/{id}/bid`, `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| money | `GET /api/wallets/{id}`, `GET /api/wallets/{id}/transfers`, `POST /api/wallets/transfers` |
| bank loans | `GET /api/bank/offers`, `GET /api/bank/loans`, `POST /api/bank/loans`, `POST /api/bank/loans/{id}/repayments` |
| casino | `GET /api/casino`, `POST /api/casino/chips/purchases`, `POST /api/casino/chips/cashouts`, `GET` and `POST /api/casino/roulette/spins`, `POST /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands/{id}/actions` |
| pawnshop | `GET /api/pawnshop` (404 before the premises are bought), `GET /api/pawnshop/offers`, `POST /api/pawnshop`, `POST /api/pawnshop/bot`, `POST /api/pawnshop/stock/{id}/withdraw` |
| warehouse wars | `GET /api/warehouses?limit=N`, `GET /api/warehouses/{id}`, `POST /api/warehouses/{id}/join`, `POST /api/warehouses/{id}/leave`, `POST /api/warehouses/{id}/bids` |
| profiles, friends and invites | `GET /api/profiles/me`, `GET /api/profiles/{id}`, `GET /api/profiles/{id}/avatar`, the own-profile writes under `/api/profiles/me/...` (privacy, socials, avatar), the friend lifecycle under `/api/profiles/friends/...`, `GET` and `POST /api/profiles/warehouse-invites` |
| machine-readable responses | camelCase property names, enums serialized as strings, `201` responses with the new id and a `Location` header, one error shape `{ "error": "..." }` for domain, validation and binding errors (binding failures joined on 2026-11-14 through `RouteHandlerOptions.ThrowOnBadRequest`) |

## What is missing

- No push channel: everything above is polling, and a freshly created auction stays `Pending` for up to two outbox polling cycles before it appears in the list.
- No endpoint lists a user's own auctions, and none lists their past warehouse wars: a settled or cancelled war drops out of the public list, so the client cannot show a war history.
- No profile search and no batch profile endpoint: views resolve usernames one `GET /api/profiles/{id}` at a time and cache them client-side for the session.
- Warehouse invites carry no id and no accept or decline action: the client can only follow the link or let the invite expire.
- The avatar endpoint requires a JWT, so a public page cannot show avatars without a signed-in session.
- The warehouse tier table (entry fees and raise increments) and the blackjack hand timeout live only in the backend configuration: the client mirrors them as constants and labels a tier it does not know "Unknown tier" instead of guessing.

## Views (routes)

| View (route) | Backend endpoints it uses |
|---|---|
| auction list (`/auctions`) | `GET /api/auctions?limit=50` |
| auction detail with bidding and history (`/auctions/:id`) | `GET /api/auctions/{id}`, `GET /api/auctions/{id}/bids`, `POST /api/auctions/{id}/bid`, `GET /api/profiles/{id}` for the bidder names |
| list an item for sale (`/auctions/new`, guarded) | `GET /api/inventory`, `POST /api/auctions` |
| inventory with crafting and shop (`/inventory`, guarded) | `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| wallet (`/wallet`, guarded) | `GET /api/wallets/{id}` with the user's own `PublicUserId` taken from the token |
| transfers (`/transfers`, guarded) | `GET /api/wallets/{id}`, `GET /api/wallets/{id}/transfers`, `POST /api/wallets/transfers`, `GET /api/profiles/me` for the friends datalist, `GET /api/profiles/{id}` for the party labels |
| bank (`/bank`, guarded) | `GET /api/bank/offers`, `GET /api/bank/loans`, `POST /api/bank/loans`, `POST /api/bank/loans/{id}/repayments`, `GET /api/wallets/{id}` for the prechecks |
| casino chips (`/casino`, guarded) | `GET /api/casino`, `POST /api/casino/chips/purchases`, `POST /api/casino/chips/cashouts`, `GET /api/wallets/{id}` |
| roulette (`/casino/roulette`, guarded) | `GET /api/casino`, `GET /api/casino/roulette/spins`, `POST /api/casino/roulette/spins` |
| blackjack (`/casino/blackjack`, guarded) | `GET /api/casino`, `GET /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands/{id}/actions` |
| pawnshop (`/pawnshop`, guarded) | `GET /api/pawnshop`, `GET /api/pawnshop/offers`, `POST /api/pawnshop`, `POST /api/pawnshop/bot`, `POST /api/pawnshop/stock/{id}/withdraw`, `GET /api/wallets/{id}` |
| warehouse war list with invites (`/warehouses`, guarded) | `GET /api/warehouses?limit=20`, `GET /api/profiles/warehouse-invites` |
| warehouse war detail (`/warehouses/:id`, guarded) | `GET /api/warehouses/{id}`, `GET /api/wallets/{id}`, `GET /api/profiles/me` for the friend select, `POST /api/warehouses/{id}/join`, `POST /api/warehouses/{id}/leave`, `POST /api/warehouses/{id}/bids`, `POST /api/profiles/warehouse-invites` |
| own profile (`/profile`, guarded) | `GET /api/profiles/me`, `PUT /api/profiles/me/privacy`, `PUT /api/profiles/me/socials`, the avatar upload and delete under `/api/profiles/me/avatar`, the friend-request accept and decline, `POST /api/profiles/friends/requests`, `DELETE /api/profiles/friends/{userId}` |
| public player profile (`/profiles/:id`, guarded) | `GET /api/profiles/{id}`, `GET /api/profiles/me`, `POST /api/profiles/friends/requests`, the friend-request accept for a crossed request, `DELETE /api/profiles/friends/{userId}` |
| register and login (`/register`, `/login`) | `POST /api/users/register` with an auto-login after the 201, `POST /api/users/login` |

## Client-side rules and mirrored constants

Eight features (transfers, casino, blackjack, roulette, bank, pawnshop, auctions, profiles) keep their prechecks, poll rhythms and mirrored constants in a pure `<feature>-rules.ts` module next to their components (`social-links.ts` plays that role for the social links), tested without TestBed; the register validators and the warehouse invite lifetime still live in their component files. The constants below mirror backend configuration or validators and must follow any backend change:

| Client constant (module) | Mirrors |
|---|---|
| `PASSWORD_REQUIREMENTS` and the 30-character caps (`register.ts`) | the register validator: the password-strength rule and the username, name and surname length limits |
| `WAREHOUSE_TIERS`, `MIN_PLAYERS` (`warehouse-rules.ts`) | the warehouse tier table: entry fees, raise increments and the minimum player count |
| `INVITE_TTL_MS` (`warehouse-list.ts`) | the warehouse invite lifetime (15 minutes) |
| `HAND_TIMEOUT_MS` (`blackjack-rules.ts`) | the blackjack auto-stand timeout (5 minutes) |
| `CARD_RANKS`, `CARD_SUITS` (`blackjack-rules.ts`) | the card encoding of the casino deck (rank from `code % 13`, suit from `code / 13`) |
| `MIN_LEAD_MS`, `MAX_LEAD_MS` (`auction-rules.ts`) | the auction end-time window (one minute to thirty days) |
| `OPEN_LOAN_STATUSES` (`bank-rules.ts`) | the statuses the bank counts as an open loan |
| `RARITY_ORDER` (`pawnshop-rules.ts`) | the rarity ladder bot upgrades must climb strictly upward |
| `AVATAR_MAX_BYTES`, `AVATAR_TYPES`, `MAX_FRIENDS` (`profile-rules.ts`) | the avatar size and format limits and the 100-friends cap |
| `MAX_SOCIAL_LINKS`, `SOCIAL_PLATFORMS`, `SOCIAL_DOMAINS` (`social-links.ts`) | the social-link validator: at most six links, one per known platform, on its domain |
| `ROULETTE_BET_TYPES` and the selection ranges (`roulette-rules.ts`) | the roulette bet types with their selection ranges |

## Decisions

- Angular 22 with the CLI defaults, plain SCSS and Signal Forms, decided 2026-11-08; see [ADR-015](adr/015-angular-frontend-stack.md).
- The frontend talks only to the gateway, which passes CORS preflights through to the host (checked on 2026-10-23, a preflight from `http://localhost:4200` gets 204 with the matching `Access-Control-Allow-Origin`). The host has CORS for `http://localhost:4200`, the OpenAPI document at `/openapi/v1.json` (open to private networks through the gateway) and the health routes `/health`, `/health/live` and `/health/ready`.
- Module views before the AI bots, decided 2026-11-12 (see the DECISIONS.md rows of that day): the remaining modules shipped as nine batches on the existing API with no backend changes, each batch verified by a scripted browser run on the live stack, with a bot account from variant B minting the turnover the bank, pawnshop and warehouse scenarios need.

## Related documents

- [backend/README.md](backend/README.md) - the error contract and the authentication schemes a client must handle.
- [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - the MVP endpoints in detail.
- [backend/profiles.md](backend/profiles.md), [backend/warehouses.md](backend/warehouses.md), [backend/banking.md](backend/banking.md), [backend/pawnshop.md](backend/pawnshop.md), [backend/casino.md](backend/casino.md) - the module-view endpoints in detail.
- [infrastructure.md](infrastructure.md) - the gateway the frontend is meant to talk to.
