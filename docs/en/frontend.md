# Frontend

> English version. Polish 1:1 counterpart: [../pl/frontend.md](../pl/frontend.md)

The scaffold exists since 2026-11-08: `Frontend/` holds an Angular 22 CLI workspace (standalone components, signals, zoneless change detection, Vitest, SCSS) with the dev server proxying `/api` to the gateway. The MVP views shipped on 2026-11-10 and the module views on 2026-11-14, so this page records what the client does today, what the backend offers it and what it still lacks.

## Status

The module views shipped on 2026-11-14 on the stack decided in [ADR-015](adr/015-angular-frontend-stack.md): every backend module now has a view (transfers, bank loans, casino chips with roulette and blackjack, the pawnshop, warehouse wars, own and public profiles with friends and invites) next to the MVP auctions, inventory and wallet. Signed-in routes sit behind a guard that lets the player in with a live JWT or a stored refresh token. Since 2026-11-16 the client renews the 15-minute JWT silently through a rotated refresh token (issue #18 and [ADR-017](adr/017-refresh-token-rotation.md), the session section below has the details). A refresh refused with 400 ends the session and redirects to login with a returnUrl only from a guarded route, so a public page simply turns anonymous. A 401 from any other API call still clears the session and redirects to login with a returnUrl. Polling is the baseline and each view picks its rhythm: the auction detail and its bids every 2.5 s, the warehouse war detail every second during bidding and every 2.5 s otherwise, wallets, the inventory and the warehouse list every 5 s, the auction list, the game histories and the invites every 10 s, and the saga-driven views (a pending chip purchase, a pending pawnshop payment, a pending loan) drop to 2 s while something is in flight; on 5xx and network failures the poller backs off exponentially up to 30 s and a 429 honours `Retry-After`. Action buttons sit behind prechecks that mirror the server's guard order, reusing its refusal texts where the client knows them, and the client-side constants listed below (loan statuses, roulette bet types, card labels, validator limits) mirror the backend configuration, while the tariffs and deadlines the client used to mirror (the warehouse increments, the invite expiry, the blackjack auto-stand) come from the server since stage three. The server stays the authority and the prechecks are hints. Views remember what the server will not repeat: a reloaded blackjack hand is reconciled instead of overwritten, and a warehouse entry fee rejected by the wallet is detected from the client's own join timestamp, because the API keeps no trace of the rejection. Every batch was verified by a scripted Playwright run against the compose stack, and the final pass reran the module flows on a stack rebuilt from scratch. Since 2026-11-17 the pixel-art UI/UX pass runs on the `ui-ux` branch, and since 2026-11-19 every view behind the street wears the global pixel skin from `src/app/pixel/skin/`, which hooks onto the markup the views already have, so no template changed for it, except the three auction templates, which gained the tile, the chip and the leading-row hooks that `src/app/pixel/skin/_hall.scss` styles. Since 2026-11-19 the auction pages show each item's own pixel sprite on a rarity tile and tick their countdowns every second, drawn by `src/app/pixel/items/`. Since 2026-11-20 the inventory is a shelf of item cards sortable by rarity, price, name and status, with a workshop whose press turns three items of one rarity into one of the next. The war manifest, the pawnshop stock and the listing form show the same item art, and the inner pages use the whole window with live touches that stop under reduced motion. The welcome page and the login and register pages hide the shell's top bar (`body:has(app-welcome, app-door-page) .topbar` in `styles.scss`), because the street's buildings are the navigation and the door pages lead back to the street. Stage three (2026-11-14 to 2026-11-15) closed the API gaps this page used to list. Own auctions and the war history come from `GET /api/auctions/mine` and `GET /api/warehouses/mine`, the war detail carries the tier increments, the server sends the invite expiry and the blackjack auto-stand deadline, and an invite can be declined. Since 2026-11-15 the views resolve usernames in batches through `GET /api/profiles?ids=`, pick friends and transfer recipients through a username search and load avatars with a plain `<img>` from the anonymous avatar route. Since 2026-11-15 the client also listens to the nudges the host streams over `GET /api/push` ([ADR-016](adr/016-server-sent-events-push.md)). `App` opens one stream per tab after login and a view refreshes its poller the moment its topic arrives, so an outcome reaches the screen within a second instead of one poll late (the push client section below has the details).

## Target design

- An Angular single-page application that talks to the backend only through the API gateway on `http://localhost:8080`, which exists since 2026-10-23.
- Player flows: register and log in, browse and run auctions, manage the inventory and the wallet, transfer money, take and repay loans, play roulette and blackjack on casino chips, run a pawnshop, fight warehouse wars with friends and keep a public profile.
- Authentication with the JWT from `POST /api/users/login` stored on the client and sent as a bearer token. A player JWT lives 15 minutes and the client renews it silently with the rotated refresh token from the same response, so a player logs in again only after seven days without a refresh, after a logout or after a detected reuse. A bot gets no refresh token and lives on its 24-hour JWT.

## What the backend provides

| Need | Available today |
|---|---|
| public browsing without login | `GET /api/auctions?limit=N` (active auctions ordered by `EndsOn`), `GET /api/auctions/{id}` (any status, with `CancellationReason`), `GET /api/auctions/{id}/bids` (confirmed bids, newest first) |
| own auctions | `GET /api/auctions/mine` (the caller's auctions in every status, newest first, at most 50) |
| accounts | `POST /api/users/register`, `POST /api/users/login` returning `{ token, refreshToken }` with the role claim inside the JWT and a null `refreshToken` for a bot, `POST /api/users/refresh` trading a refresh token for a new pair, `POST /api/users/logout` revoking it (200 with an empty body, also for an unknown token) |
| auctions and inventory behind a bearer token | `POST /api/auctions`, `POST /api/auctions/{id}/bid`, `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| money | `GET /api/wallets/{id}`, `GET /api/wallets/{id}/transfers`, `POST /api/wallets/transfers` |
| bank loans | `GET /api/bank/offers`, `GET /api/bank/loans`, `POST /api/bank/loans`, `POST /api/bank/loans/{id}/repayments` |
| casino | `GET /api/casino`, `POST /api/casino/chips/purchases`, `POST /api/casino/chips/cashouts`, `GET` and `POST /api/casino/roulette/spins`, `POST /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands/{id}/actions` (every hand shape carries `autoStandOn`, null once the hand is completed) |
| pawnshop | `GET /api/pawnshop` (404 before the premises are bought), `GET /api/pawnshop/offers`, `POST /api/pawnshop`, `POST /api/pawnshop/bot`, `POST /api/pawnshop/stock/{id}/withdraw` |
| warehouse wars | `GET /api/warehouses?limit=N`, `GET /api/warehouses/{id}` (with the tier's `increments`), `POST /api/warehouses/{id}/join`, `POST /api/warehouses/{id}/leave`, `POST /api/warehouses/{id}/bids` |
| warehouse war history | `GET /api/warehouses/mine` (every war the caller joined, any status, newest first, at most 50) |
| profiles, friends and invites | `GET /api/profiles/me`, `GET /api/profiles/{id}`, `GET /api/profiles?ids=` (up to 50 summaries at once), `GET /api/profiles/search?q=` (username prefix, at most 20 rows), `GET /api/profiles/{id}/avatar` (no token needed), the own-profile writes under `/api/profiles/me/...` (privacy, socials, avatar), the friend lifecycle under `/api/profiles/friends/...`, `GET` and `POST /api/profiles/warehouse-invites`, `POST /api/profiles/warehouse-invites/{publicInviteId}/decline` |
| push notifications | `GET /api/push`, a Server-Sent Events stream behind the JWT: `event: connected` first, `ping` after 15 s of silence and the nudge topics `AuctionChanged`, `AuctionListChanged`, `WalletChanged`, `WarehouseChanged`, `LoanChanged`, `CasinoChanged` and `PawnshopChanged` with `{"auctionId"}`, `{"warehouseId"}` or `{}` as data ([ADR-016](adr/016-server-sent-events-push.md)) |
| machine-readable responses | camelCase property names, enums serialized as strings, `201` responses with the new id and a `Location` header, one error shape `{ "error": "..." }` for domain, validation and binding errors (binding failures joined on 2026-11-14 through `RouteHandlerOptions.ThrowOnBadRequest`) |

## What is missing

- No nudge for friend requests, warehouse invites, transfers and war raises, so those views still converge on their poll rhythm ([ADR-016](adr/016-server-sent-events-push.md) lists the consumer-side states that stay on polling). The username search runs without an index by design. The push channel assumes one api instance.

## Views (routes)

| View (route) | Backend endpoints it uses |
|---|---|
| welcome page with the street (`/welcome`) | none, the street, the pitch and the calls to action are static |
| auction list (`/auctions`) | `GET /api/auctions?limit=50` |
| auction detail with bidding and history (`/auctions/:id`) | `GET /api/auctions/{id}`, `GET /api/auctions/{id}/bids`, `POST /api/auctions/{id}/bid`, `GET /api/profiles?ids=` for the bidder names |
| list an item for sale (`/auctions/new`, guarded) | `GET /api/inventory`, `POST /api/auctions` |
| own auctions (`/auctions/mine`, guarded) | `GET /api/auctions/mine` |
| inventory with crafting and shop (`/inventory`, guarded) | `GET /api/inventory`, `POST /api/inventory/craft`, `POST /api/inventory/{id}/sell` |
| wallet (`/wallet`, guarded) | `GET /api/wallets/{id}` with the user's own `PublicUserId` taken from the token |
| transfers (`/transfers`, guarded) | `GET /api/wallets/{id}`, `GET /api/wallets/{id}/transfers`, `POST /api/wallets/transfers`, `GET /api/profiles/me` for the friends in the recipient picker, `GET /api/profiles/search?q=` for its suggestions, `GET /api/profiles?ids=` for the party labels |
| bank (`/bank`, guarded) | `GET /api/bank/offers`, `GET /api/bank/loans`, `POST /api/bank/loans`, `POST /api/bank/loans/{id}/repayments`, `GET /api/wallets/{id}` for the prechecks |
| casino chips (`/casino`, guarded) | `GET /api/casino`, `POST /api/casino/chips/purchases`, `POST /api/casino/chips/cashouts`, `GET /api/wallets/{id}` |
| roulette (`/casino/roulette`, guarded) | `GET /api/casino`, `GET /api/casino/roulette/spins`, `POST /api/casino/roulette/spins` |
| blackjack (`/casino/blackjack`, guarded) | `GET /api/casino`, `GET /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands`, `POST /api/casino/blackjack/hands/{id}/actions` |
| pawnshop (`/pawnshop`, guarded) | `GET /api/pawnshop`, `GET /api/pawnshop/offers`, `POST /api/pawnshop`, `POST /api/pawnshop/bot`, `POST /api/pawnshop/stock/{id}/withdraw`, `GET /api/wallets/{id}` |
| warehouse war list with invites (`/warehouses`, guarded) | `GET /api/warehouses?limit=20`, `GET /api/profiles/warehouse-invites` |
| warehouse war detail (`/warehouses/:id`, guarded) | `GET /api/warehouses/{id}`, `GET /api/wallets/{id}`, `GET /api/profiles/me` for the friend select, `POST /api/warehouses/{id}/join`, `POST /api/warehouses/{id}/leave`, `POST /api/warehouses/{id}/bids`, `POST /api/profiles/warehouse-invites` |
| warehouse war history (`/warehouses/mine`, guarded) | `GET /api/warehouses/mine` |
| own profile (`/profile`, guarded) | `GET /api/profiles/me`, `PUT /api/profiles/me/privacy`, `PUT /api/profiles/me/socials`, the avatar upload and delete under `/api/profiles/me/avatar`, the friend-request accept and decline, `POST /api/profiles/friends/requests` with `GET /api/profiles/search?q=` feeding the add-friend picker, `DELETE /api/profiles/friends/{userId}` |
| public player profile (`/profiles/:id`, guarded) | `GET /api/profiles/{id}`, `GET /api/profiles/me`, `POST /api/profiles/friends/requests`, the friend-request accept for a crossed request, `DELETE /api/profiles/friends/{userId}` |
| register and login (`/register`, `/login`) | `POST /api/users/register` with an auto-login after the 201, `POST /api/users/login`, followed by `POST /api/users/logout` for a refresh token still stored from a previous session once the login succeeded |

## Session

`TokenStorage` keeps the JWT under `auction.token` and the refresh token under `auction.refresh` in `localStorage`. `Session.applyTokens` writes both and then the token signal, `clear()` removes both, and `logout()` clears the pair and posts the old refresh token to `POST /api/users/logout` without waiting for the answer. `SessionRefresher` (`core/auth/session-refresher.ts`) renews the JWT `REFRESH_LEAD_MS` (60 s) before its `exp`, from a timer on the token signal, once at startup and from the interceptor before a request whose token is due. One tab rotates at most once per `REFRESH_MIN_INTERVAL_MS` (30 s), concurrent callers share one promise, and tabs take turns through the Web Locks API under the lock `auction.refresh`, which an origin without HTTPS other than localhost lacks, so there the rotation runs without a lock. Under the lock the refresher reads the storage again and adopts a pair another tab already rotated instead of posting its own, and it drops a response when the stored refresh token changed while the request was in flight. A 400 ends the session, while a network failure, 409, 429 or 5xx keeps the pair and hands back the current JWT, which the API still accepts within its five-minute clock skew. The interceptor sends the four auth routes (`/api/users/login`, `/register`, `/refresh` and `/logout`) without a bearer token, so they count against the gateway's anonymous rate limit. The guard lets a player in with a live JWT or a stored refresh token, and the startup refresh holds the first requests until the new JWT arrives. Every tab listens to the `storage` event for both keys, so a rotation, a login or a logout in one tab reaches the others without a request.

## Push client

`PushClient` (`core/push/push-client.ts`) opens `GET /api/push` with `fetch` and the bearer token, because `EventSource` cannot send headers, and feeds the body through `parseSseChunk` (`core/push/sse.ts`), which splits the stream on blank lines, joins multi-line `data` and keeps an unfinished tail for the next chunk. Only `App` starts it. An effect on the session token calls `connect()` on every token change and disconnects on logout. `connect()` does nothing while a stream runs for the same `userId` and restarts the stream for a different user, so a tab holds one stream, a reload opens exactly one new one and a silent refresh leaves the running stream alone. `open()` reads the session token at the moment it opens, so the reconnect after the host ends the stream at the old token's `exp` already carries the rotated JWT. A view never touches the stream itself.

A view adds one `refreshOn(poller, topic)` line per poller in its constructor (`core/push/refresh-on.ts`), which calls `poller.refresh()` when the topic arrives, optionally only when the data matches the view's id (`idMatches('auctionId', id)`), and optionally once more after `settleMs`. The refresh is skipped while the poller is backing off (error status 0, 429 or 5xx), so a nudge never overrides `Retry-After`. Polling stays the fallback and is unchanged.

The reconnect policy sits in `shouldReconnect` and `failureOf`. A 401 clears the session through the same `handleUnauthorized` as the interceptor and stops, an expired token stops, a 429 waits for `Retry-After`, a network failure or a 5xx backs off exponentially up to 30 s through the pollers' `nextDelay`, and a clean end reconnects at once unless the stream lived under `PUSH_MIN_STREAM_MS` (5 s), which counts as a failure. The backoff resets only after a stream that lived that long, so a fifth tab evicted by the host's four-stream cap backs off up to 30 s instead of evicting another tab every second. A 401 logs the player out through `handleUnauthorized` only while the token should still be valid for more than `PUSH_CLOCK_SKEW_MS` (5 min), a 401 at the token's end just stops the stream, and the client never opens a stream with a token that has already expired, so a stale token on a public page does not force a login. The expiry checks read the current session token, so after a silent refresh the stream reconnects instead of stopping, and a stream stopped at expiry starts again with the next token the effect sees. Specs replace `PushClient` with `pushStub()` from `src/testing/push-stub.ts`, and the client's own spec stubs `fetch` with `ReadableStream` responses.

| Topic | Views that refresh on it |
|---|---|
| `AuctionChanged` with `{"auctionId"}` | the auction detail (the auction and its bids) when the id matches, once more after `AUCTION_SETTLE_MS`, own auctions when the id is in the list |
| `AuctionListChanged` | the auction list (once more after `AUCTION_SETTLE_MS`) |
| `WalletChanged` | wallet, transfers, bank, casino chips, pawnshop, warehouse war detail |
| `LoanChanged` | bank |
| `CasinoChanged` | casino chips, roulette, blackjack |
| `PawnshopChanged` | pawnshop |
| `WarehouseChanged` with `{"warehouseId"}` | the warehouse war detail when the id matches, the war list, the war history when the id is in its list |

## Client-side rules and mirrored constants

Ten features (transfers, casino, blackjack, roulette, bank, pawnshop, auctions, profiles, warehouses, welcome) keep their prechecks, poll rhythms and mirrored constants in a pure `<feature>-rules.ts` module next to their components (`social-links.ts` plays that role for the social links), tested without TestBed; the register validators still live in their component file. The constants below mirror backend configuration or validators and must follow any backend change:

| Client constant (module) | Mirrors |
|---|---|
| `PASSWORD_REQUIREMENTS` and the 30-character caps (`register.ts`), and the password sentence in `register.html`, shown as the hint and as the error | the register validator: the password-strength rule and the username, name and surname length limits |
| `CARD_RANKS`, `CARD_SUITS` (`blackjack-rules.ts`) | the card encoding of the casino deck (rank from `code % 13`, suit from `code / 13`) |
| `MIN_LEAD_MS`, `MAX_LEAD_MS` (`auction-rules.ts`) | the auction end-time window (one minute to thirty days) |
| `OPEN_LOAN_STATUSES` (`bank-rules.ts`) | the statuses the bank counts as an open loan |
| `RARITY_ORDER` (`pawnshop-rules.ts`) | the rarity ladder bot upgrades must climb strictly upward |
| `AVATAR_MAX_BYTES`, `AVATAR_TYPES`, `MAX_FRIENDS` (`profile-rules.ts`) | the avatar size and format limits and the 100-friends cap |
| `SEARCH_MIN_LENGTH` (`profile-rules.ts`) | the two-character lower bound of the username search validator; the picker sends nothing below it and never searches for a full player id |
| `MAX_SOCIAL_LINKS`, `SOCIAL_PLATFORMS`, `SOCIAL_DOMAINS` (`social-links.ts`) | the social-link validator: at most six links, one per known platform, on its domain |
| `ROULETTE_BET_TYPES` and the selection ranges (`roulette-rules.ts`) | the roulette bet types with their selection ranges |
| `PushTopic` (`push-topics.ts`) | the seven topic names of the host's `PushTopics` (`Infrastructure/Push`), the only `event:` names the client subscribes to |
| `PUSH_CLOCK_SKEW_MS` (`push-client.ts`) | the five-minute default `ClockSkew` of the host's JWT validation (`TokenValidationParameters` in `Program.cs`, not overridden), the window in which the API still accepts a token the push endpoint already refuses |
| `REFRESH_LEAD_MS` (`session-refresher.ts`) | not a mirror but a bound. The 60 s lead must stay well below `JwtTokenFactory.PlayerTokenLifetime` (15 min in `JwtTokenFactory.cs`), so the timer fires about 14 minutes after a JWT is issued. A lead at or above the lifetime would rotate every `REFRESH_MIN_INTERVAL_MS` |
| `AUCTION_SETTLE_MS` (`push-topics.ts`) | the 2 s read-cache TTL of the Auctions module (`Auctions:ReadCache`, ADR-009). A nudge can land inside the TTL and read a stale snapshot, so the auction views refresh once more after it |
| `STARTING_FUNDS` (`pixel/starting-funds.ts`, read by the street frame in `pixel/welcome/street-page.ts` and the register stamp in `pixel/auth/door-page.ts`), the billboard copy in `pixel/street/city.ts` and the canvas `aria-label` in `pixel/street/street-scene.html` | the starting funds of a new wallet (`StartingFunds`, 300 in the API settings) |

## Decisions

- Angular 22 with the CLI defaults, plain SCSS and Signal Forms, decided 2026-11-08; see [ADR-015](adr/015-angular-frontend-stack.md).
- The frontend talks only to the gateway, which passes CORS preflights through to the host (checked on 2026-10-23, a preflight from `http://localhost:4200` gets 204 with the matching `Access-Control-Allow-Origin`). The host has CORS for `http://localhost:4200`, the OpenAPI document at `/openapi/v1.json` (open to private networks through the gateway) and the health routes `/health`, `/health/live` and `/health/ready`.
- Module views before the AI bots, decided 2026-11-12 (see the DECISIONS.md rows of that day): the remaining modules shipped as nine batches on the existing API with no backend changes, each batch verified by a scripted browser run on the live stack, with a bot account from variant B minting the turnover the bank, pawnshop and warehouse scenarios need.
- The API gaps and the push channel before the AI bots, decided 2026-11-14 (see the DECISIONS.md rows of that day and [ADR-016](adr/016-server-sent-events-push.md)): own auctions and the war history read on the server, server-side deadlines for invites and blackjack hands, batched profile lookups with a username search, an anonymous avatar route and a Server-Sent Events nudge stream, closed between 2026-11-14 and 2026-11-15 with the Angular client consuming all of it.
- Rotated refresh tokens with a silent refresh in the client before the AI bots, decided 2026-11-15 (see the DECISIONS.md rows of that day and [ADR-017](adr/017-refresh-token-rotation.md)). They replace the re-login after 15 minutes chosen at the kickoff, shipped between 2026-11-15 and 2026-11-16 and passed a scripted browser run on a stack rebuilt from scratch.

## Related documents

- [backend/README.md](backend/README.md) - the error contract and the authentication schemes a client must handle.
- [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - the MVP endpoints in detail.
- [backend/profiles.md](backend/profiles.md), [backend/warehouses.md](backend/warehouses.md), [backend/banking.md](backend/banking.md), [backend/pawnshop.md](backend/pawnshop.md), [backend/casino.md](backend/casino.md) - the module-view endpoints in detail.
- [infrastructure.md](infrastructure.md) - the gateway the frontend is meant to talk to.
