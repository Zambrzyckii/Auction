# Operations

Hands-on procedures for running the compose stack. Every step on this page was exercised against the live stack on 2026-11-04.

## Secret files

`Infrastructure/secrets/gen-secrets.sh` creates everything the stack needs. Run it once before the first `docker compose up`. Six random values land in `*.secret` files, and two derived files are rebuilt on every run, the PgBouncer userlist and the RabbitMQ defaults config. Existing `.secret` files are never overwritten, so re-running is safe.

Git ignores the whole directory except the generator and the `*.example` templates.

The stack consumes the files in three ways.

- Compose file secrets mounted under `/run/secrets`. PostgreSQL and Redis read their passwords there, and both vault containers read the dev root token.
- Plain read-only mounts for the two derived files. PgBouncer gets `pgbouncer-userlist.txt` as its `auth_file`, RabbitMQ gets `rabbitmq-defaults.conf` as a `conf.d` entry (the image hard-rejects the `RABBITMQ_DEFAULT_PASS_FILE` variable, so a config file is the supported route).
- `vault-init` reads the same files and seeds the application secrets into OpenBao under `secret/auction/api`.

To rotate an infrastructure password, edit its `.secret` file, run `gen-secrets.sh` again to refresh the derived files, recreate the affected service and restart the api (it caches values read from the vault). PostgreSQL is the exception, its data directory keeps the password from the first initialization, so a change there needs `docker volume rm proj_pgdata` (dev data is lost) or a manual `ALTER ROLE`.

## The dev vault lifecycle

The `vault` service runs OpenBao in dev mode, in-memory, auto-unsealed, root token taken from `vault-root-token.secret`. Every restart wipes it clean.

`vault-init` reseeds it on every `docker compose up -d`. It enables AppRole and the KV v2 engine, writes the `auction-api` policy (read on `secret/data/auction/api` only), creates the AppRole, stores the five application secrets and leaves fresh `role-id` and `secret-id` files in the `vaultcreds` volume.

The api reads the vault once at startup, so after anything reseeds the vault, restart the api with `docker compose restart api`. While the vault is away the api fails fast with `Vault at 'http://vault:8200' is unreachable or timed out` and its restart policy keeps retrying until the vault returns. After restarting only the vault container, run `docker compose up -d` again so `vault-init` reruns, then restart the api.

## The unseal drill (persistent mode)

`compose.vault-persistent.yaml` switches the vault to raft storage (volume `vaultdata`) with a manual unseal, the behavior real deployments have. The drill, verified end to end:

1. `docker compose -f compose.yaml -f compose.vault-persistent.yaml up -d vault`
2. First time only, initialize and keep the output somewhere safe:
   `docker compose exec -e BAO_ADDR=http://127.0.0.1:8200 vault bao operator init -key-shares=1 -key-threshold=1`
3. Unseal:
   `docker compose exec -e BAO_ADDR=http://127.0.0.1:8200 vault bao operator unseal <unseal key>`
4. Copy the `Initial Root Token` value into `Infrastructure/secrets/vault-root-token.secret` so `vault-init` can log in.
5. `docker compose -f compose.yaml -f compose.vault-persistent.yaml up -d`, then `docker compose restart api`.
6. Restart the vault and run `bao status`. `Initialized true` with `Sealed true` means the data survived and the seal is back. Repeat step 3 and the stack recovers on its own.

Returning to dev mode takes three steps. Regenerate the root token file with `rm Infrastructure/secrets/vault-root-token.secret && ./Infrastructure/secrets/gen-secrets.sh`, because dev mode refuses a root token in the `s.` service-token format (hit live during the drill). Then `docker compose up -d --force-recreate vault vault-init` and `docker compose restart api`. Finally `docker volume rm proj_vaultdata` discards the raft data.

## Database backups

The `pgbackup` service (`prodrigestivill/postgres-backup-local:16-alpine`) runs `pg_dump` against PostgreSQL directly, bypassing PgBouncer, because transaction pooling breaks the single long session a dump needs. The schedule is `@daily` (midnight) and every run rotates three buckets inside the `pgbackups` volume. `daily/` keeps 7 copies, `weekly/` 4 and `monthly/` 6, each bucket cleaned independently, with the newest dump always linked as `last/auctionserver-latest.sql.gz`.

To take a backup on demand, for example before a risky migration:

```
docker compose exec pgbackup /backup.sh
```

## The restore drill

Verified end to end on 2026-11-04 (4 users and 40 tables matched between the source and the restored copy).

1. Create a scratch database:
   `docker compose exec postgres psql -U auction -d postgres -c 'CREATE DATABASE auctionserver_drill'`
2. Restore the latest dump into it:
   `docker compose exec pgbackup sh -c 'export PGPASSWORD=$(cat /run/secrets/postgres_password); zcat /backups/last/auctionserver-latest.sql.gz | psql -h postgres -U auction -d auctionserver_drill -q -v ON_ERROR_STOP=1'`
3. Compare a few counts against the source, for example `SELECT count(*) FROM "Users"` and the `information_schema.tables` total.
4. Drop the scratch database:
   `docker compose exec postgres psql -U auction -d postgres -c 'DROP DATABASE auctionserver_drill'`

To replace the real database instead, stop the api first (`docker compose stop api`), drop and recreate `auctionserver` the same way, restore into it and start the api again. The dump contains plain SQL, so a restore needs an empty database, not a schema-migrated one.

## Reviving dead outbox rows

A broker outage no longer parks outbox rows: the processors release their leases and wait (hardening phase, 2026-11-07, amendment in ADR-013). A row still dead-letters when the failure is tied to the message itself, after five attempts. The Prometheus rule `OutboxDeadMessages` fires when that happens (`OutboxPublishFailing` warns earlier about sustained failures); there is no Alertmanager, so check the alerts in Grafana Explore or the Prometheus API.

To revive the parked rows of one module after fixing the cause, reset their counters, here for Identity:

```sql
UPDATE "IdentityOutboxMessages"
SET "IsDead" = FALSE, "AttemptCount" = 1, "NextAttemptOn" = now()
WHERE "IsDead";
```

The eight outbox tables are `OutboxMessages` (Auctions), `IdentityOutboxMessages`, `WalletsOutboxMessages`, `InventoryOutboxMessages`, `WarehousesOutboxMessages`, `BankingOutboxMessages`, `PawnshopOutboxMessages` and `CasinoOutboxMessages`. A dead letter on the delivery side lives per recipient in `DeliveryMessages` and is revived with the same UPDATE against that table. The `Errors` column keeps the failure history, so read it before reviving.

## Troubleshooting

| Symptom | Meaning | Fix |
|---|---|---|
| api logs `Vault at ... unreachable or timed out` | vault down or still sealed | start or unseal the vault, the api retries by itself |
| api logs `denied reading ... policy does not cover it` | policy and path disagree | compare the policy in `vault-init.sh` with `Vault__SecretPath` |
| api logs `has no secret at ...` | vault up but never seeded | `docker compose up -d` so `vault-init` reruns |
| `vault-init` exits 2 with a 403 on `sys/internal/ui/mounts` | KV engine missing on a fresh persistent vault | already handled in the script (`bao secrets enable`), rerun it |
| RabbitMQ management UI rejects the login | the password is generated now | user `auction`, password in `rabbitmq-password.secret` |
