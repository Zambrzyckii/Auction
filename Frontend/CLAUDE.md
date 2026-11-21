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
consent (ADR-015) outside the UI/UX pass. Styling follows the UI/UX pass section below.

## UI/UX pass

The pixel-art UI/UX pass runs on the `ui-ux` branch since 2026-11-17 (`docs/en/DECISIONS.md`). These
rules bind every change it makes.

- Existing templates keep every class name, element type and visible text that a spec selects or
  asserts. New styling hooks onto them or wraps markup in new presentational components.
- Existing `.ts` files keep their logic. They may gain imports and `imports` entries.
- The look lives in new files under `src/app/pixel/`, apart from the logic in `core/` and
  `features/`. `pixel/street/` holds the canvas scenes, whose drawing modules import nothing from
  Angular. `pixel/<feature>/` holds the frame that a page of `features/<feature>/` wraps itself in,
  such as `pixel/auth/door-page.ts` for login and register and `pixel/welcome/street-page.ts` for
  the welcome page. Presentational components take inputs, emit outputs and inject no services.
- Code in `pixel/` imports nothing from `core/` or `features/`, and `features/` holds no
  stylesheet. A page imports from `pixel/` only the frames and components it puts in its template
  and the types they take. `features/auth/reveal-password.ts` stays with the login and register
  forms, because it flips the type of the password field.
- Pixels stay crisp. Sprites scale by whole numbers with `image-rendering: pixelated` and no smoothing.
- Motion animates `transform` and `opacity` or draws on a canvas, honours `prefers-reduced-motion` and
  pauses off screen.
- The specs run on jsdom, which has no canvas, `matchMedia` or `IntersectionObserver`. Code that needs
  them checks for them first and loads its art with a dynamic import behind that check.
- Packages that give a better pixel-art result are allowed for this pass, each named with its reason.
  The pass is not bound by the plain-SCSS rule or the per-package consent of 2026-11-08
  (`docs/en/DECISIONS.md:107` and `:132`).
- Fonts and other new third-party assets are CC0, CC-BY or OFL only, self-hosted under `public/`
  and listed with source and licence in `CREDITS.md`.
- `/welcome`, `/login` and `/register` show no top bar. The street's buildings are the navigation
  and the door pages lead back to the street. `styles.scss` hides the bar with
  `body:has(app-welcome, app-door-page) .topbar`, so renaming those selectors or that class
  brings the bar back.
- The pixel fonts, the `--m-*` tokens and the default `--u: 3px` live in
  `src/app/pixel/street/_street-theme.scss`, which `styles.scss` loads once. Components use the
  tokens and declare no `@font-face`.
- The global stylesheet holds no width or height media query. Chromium re-creates the `@font-face`
  faces of a stylesheet whose viewport media query flips, which drops the loaded pixel fonts and
  lets a canvas redraw its text in a fallback font. Each page frame switches `--u` to 2px up to
  700 px in its own stylesheet, and the door frame also below 916 px of window height.
- The welcome street fits the window height. `pixel/street/street-fit.ts` keeps the width scale and
  cuts up to `MAX_SKY_ROWS` (14) sky rows above the billboard, and drops to a smaller scale only
  where the 640-column street still covers the window. The street frame measures the pitch with
  `appHeightProbe` and passes it to `<app-street-scene>` as `reserve`.
- A wrapper component cannot style content projected into it, because emulated encapsulation
  scopes its styles to its own template. The door pages therefore style the projected login and
  register forms from the global partial `src/app/pixel/auth/_door-sheet.scss`, with every rule
  under `app-door-page`. The street frame needs no such partial, because it renders the hidden
  building links itself from its `links` and `paths` inputs.
- Firefox keeps a text field at least as tall as the normal line height of its font and ignores a
  smaller `line-height`, so the door sheet inputs set `height: calc(27px + var(--u) * 6)`. Without
  it every field grows by about 5 px in Firefox and /register scrolls at 1906x917.
- The inner pages, everything but `/welcome`, `/login` and `/register`, get their look from the
  global skin in `src/app/pixel/skin/` (`_skin.scss` uses one partial per concern), which
  `styles.scss` loads as its last line through `meta.load-css`. Every skin rule sits under
  `body:not(:has(app-welcome, app-door-page))` through the `tools.inside` mixin, except the
  `color-scheme` rule, which sits on `:root` because the viewport scrollbar reads the root element.
  The wrapper adds two type selectors, so the skin beats the old base rules at `styles.scss:5-75`
  by specificity, not by order. A later rule overrides the skin only when it reaches that
  specificity, for example `body main button` against the skin's `button`. The skin hooks only onto
  elements and classes the templates already have, so a new page gets the look without a template
  change and the three frame pages stay untouched. The exception is the item templates and the war
  page, which gained these hooks for the item tiles, the shelf and the war scene, styled by
  `_hall.scss`, `_forms.scss`, `_inventory.scss`, `_workshop.scss` and `_war.scss`.
  - `auction-list.html` has `td.lot`, `span.lot-row` and `.rarity`.
  - `my-auctions.html` has `td.lot` and `span.lot-row` in both tables, and no `.rarity`.
  - `auction-detail.html` has `td.lot`, `span.lot-row`, `.rarity` and `tr.leading`, the only auction
    template with the leading row.
  - `warehouse-detail.html` (the manifest) and `stock-section.html` have `td.lot`, `span.lot-row`
    and `.rarity`.
  - `warehouse-detail.html` also has four war scene additions: the `<app-war-scene>` element,
    `p.stake` on the current price paragraph, `div.budget` (a progress bar with one inner `span`)
    and `p.heads` on the players paragraph. `_war.scss` styles the scene, `p.stake` and
    `div.budget`, and `p.heads` is an unstyled hook. The skin keys on the component's
    host. It gets the class `lit` when the door reveal of a settlement fires, which is at once under
    reduced motion. It gets it at once too when the page loads on a settled war or when no scene runs,
    and at the latest 4000 ms after a settlement the scene plays. A war that is not settled stays unlit.
    The host gets the attribute `data-wide="true"` when `window.innerWidth` is at least 1200. The
    attribute stands in for a width media query, which the global stylesheet may not hold.
  - `pawnshop.html` (the tier table) has `.rarity`.
  - `create-auction.html` has `app-item-preview` in the listing form.
  - `inventory.html` has `app-workshop`, `app-shelf-sort` and `ul.shelf` (with `.picking` while the
    workshop is open) of `li.card` (with `.fresh` on the crafted card). A card holds `.pick`, `.name`,
    `.rarity`, `.price`, `.cue`, `.status`, `.fit` and `.sell`. Its checkbox is `[disabled]` while a
    craft is pending or the card shows a fit reason, so an unfit card cannot be picked. A picked card
    carries `.picked`, a card with a fit reason `.unfit` and a card whose entrance has played
    `.dropped`. `_inventory.scss` styles the picked and unfit states through those classes instead of
    per-card `:has()`, and gives `li.card` `content-visibility: auto` with
    `contain-intrinsic-size: auto 260px`, which keeps Firefox style time flat at 174 cards.
- The skin holds no viewport media query (the `@font-face` reason above), sets no `animation` on form
  fields, because signal forms watch validity through their `ng-valid` and `ng-invalid` animations,
  and keeps `--u` at 3px at every width. A table wider than the page scrolls inside `main` or inside
  its panel (`overflow-x: auto`), the document itself never scrolls sideways.
- `pixel/items/` holds the item art. `sprites/names.ts` mirrors the bots' `ITEM_NAMES` plus the
  starters. The catalog and `pix.ts` load lazily through `bootStreet` behind the `ResizeObserver`
  guard, so jsdom specs never touch a 2d context. A new item name shows the mystery sprite until
  it gets a function, and `catalog.spec.ts` fails when `names.ts` lists a name without one.
- `pixel/inventory/` is the inventory frame. It holds the `sortItems` and `benchFit` pipes (sort
  ties fall to name, then id), `craft-watch.ts`, the `appDropOnce` directive, the sort bar
  `app-shelf-sort`, the workshop
  `app-workshop` and its press scene `workshop-scene.ts`, which loads lazily through `bootStreet`
  behind the same guard as the item art. Its components carry no stylesheet, because the
  workshop's rules would pass the 4 kB component warning, so `_inventory.scss` and
  `_workshop.scss` dress them. The workshop reads the craft only from its `pending` and `picked`
  inputs. A spent card stays hidden until a poll drops it, and the crafted card stays hidden until
  the press reveals it. The reveal comes at once when no scene ran, when the door rolls down and
  when the press loop pauses off screen, and in any case 4000 ms after the craft succeeds. A pick
  after the craft clears the result, so the crafted card shows at once. The card's pick banner
  (`li.card::before`) passes clicks through to the label.
- `pixel/warehouse/` is the war page frame. `war-yard.ts` is the canvas scene, which `war-scene.ts`
  loads lazily through `bootStreet` behind the same guard as the item art. `war-watch.ts` holds the
  pure helpers `warPhase`, `warLeader` and `warMove`, which turn two polls into the phase, the
  leader and the move (raise or settle) the scene plays. The `app-war-scene` component takes
  `status`, `players`, `isLeader`, `currentPrice` and `manifest` as inputs, and carries no
  stylesheet, because `_war.scss` dresses it.
- The skin sets the page density in `_base.scss` and `_panels.scss`. `main` has no max width, a
  `4u` top padding, each routed page is a grid with a `4u` gap between its blocks, and panels have a
  `4u` padding and a `3u` gap. `_base.scss` sets `max-width: none` on `main` because `src/styles.scss:18` still caps `main`
  at 56rem outside the skin, so deleting the declaration narrows every inner page to 896 px.
  `_wallet.scss` turns the three wallet rows into counters with the icons from
  `public/pixel/wallet/`. `_alive.scss` holds the neon titles, the entrance of shelf cards, table
  rows and wallet rows, the hover lift, the stamped notices and the tile hop. The tile shine lives
  in `pixel/items/item-tile.scss`. The entrance `x-drop` fills `backwards`, never `both`, because a
  held end frame with `opacity: 1` would beat the dimming of unfit cards while picking, as
  animation values outrank normal declarations. A shelf card drops once. `appDropOnce` marks it
  `.dropped` on the drop's `animationend` and the entrance selector skips `.dropped`, because a sort
  press moves the `@for` nodes and a moved node restarts its CSS animation. Every animation and transition in `_alive.scss`,
  `_inventory.scss`, `_workshop.scss` and `item-tile.scss` sits inside
  `prefers-reduced-motion: no-preference`, so the hover lift itself stays and only its transition
  goes. The button and games link transition in `_controls.scss` sits outside it, and a
  `prefers-reduced-motion: reduce` block there switches it off.
- The budgets in `angular.json` stay as they are unless the owner decides otherwise.

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
