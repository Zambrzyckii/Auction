# auction-frontend

The Angular client of AuctionServer. The target, the API contract and the views live in
[docs/en/frontend.md](../docs/en/frontend.md); the stack decision is
[ADR-015](../docs/en/adr/015-angular-frontend-stack.md).

## Commands

All commands run from `Frontend/`.

```bash
npm ci                      # restore dependencies from package-lock.json
npx ng serve                # dev server on :4200, /api proxied to the gateway (proxy.conf.json)
npx ng build                # production build into dist/
npx ng test --watch=false   # Vitest unit tests, single run
```

API calls need the backend stack: `./Infrastructure/secrets/gen-secrets.sh` once, then
`docker compose up -d --build` from the repository root (gateway on `http://localhost:8080`).
