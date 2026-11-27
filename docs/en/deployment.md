# Deployment

> English version. Polish 1:1 counterpart: [../pl/deployment.md](../pl/deployment.md)

Every push to `main` that passes CI is deployed to the production host without a manual step. CI builds one image per commit, the host pulls exactly that image and starts the stack with a production override that keeps every port on the loopback interface. The stack does not face the internet yet, because the gateway has no TLS ([infrastructure.md](infrastructure.md#what-is-missing)).

## Status

Continuous deployment landed on 2026-11-21. The production host runs the stack as the Compose project `auctions` with the telemetry services switched off, and there is no public entry point yet.

## Pipeline

1. Every job of [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs on the push to `main`.
2. `image` pushes `ghcr.io/zambrzyckii/auction` tagged `latest` and with the commit sha.
3. `deploy` waits for every test job and for `image`, then runs in the GitHub environment `production`, which accepts deployments from `main` only. One deployment runs at a time (concurrency group `deploy-production`) and the job gives up after 15 minutes.
4. The job loads the deploy key into `ssh-agent`, so the key never lands on the runner's disk, writes the host keys from a secret into `known_hosts` and sends `auctions <sha>` over SSH.
5. The host checks out the commit, pulls the image with the same sha and starts the stack. If anything fails, it starts the previous commit again.

## The deploy command

The CI key cannot open a shell. Its line in `authorized_keys` on the host is `command="/usr/local/bin/deploy",restrict`, so whatever the client sends reaches [`Infrastructure/deploy/deploy`](../../Infrastructure/deploy/deploy) in `SSH_ORIGINAL_COMMAND`, and `restrict` turns off terminals and every kind of forwarding. The script is installed owned by root, so the `deploy` user can run it but cannot change it.

The command is `<app> <sha>`. The app name may hold only lowercase letters, digits and dashes and needs a clone in `/srv/<app>/repo`, and the sha must be a full 40-character commit hash. Anything else is rejected before the script touches the host, which also rules out paths such as `../etc`.

| Step | What happens |
|---|---|
| lock | `flock` on `/srv/<app>/.lock`, so two deployments of one app never overlap |
| checkout | `git fetch --prune origin` and `git checkout --detach <sha>` in `/srv/<app>/repo` |
| start | `docker compose -p <app> -f compose.yaml -f compose.production.yaml` with `IMAGE_TAG=<sha>`, first `pull`, then `up -d --wait --wait-timeout 300 --remove-orphans` |
| rollback | on any failure, checkout of the previous commit and the same `up` with its sha |

Both Compose files come from the repository root, or from `deploy/` when the root has no `compose.yaml`. The script looks again after every checkout, so a rollback uses the layout of the commit it returns to.

| Exit code | Meaning |
|---|---|
| 0 | deployed |
| 1 | the deployment failed and the previous commit was started again |
| 2 | the command was rejected |
| 3 | another deployment of the same app is running |

When the rollback fails as well, the script stops at that command and exits with its code, and the job log shows which step it was.

## Production override

[`compose.production.yaml`](../../compose.production.yaml) adapts [`compose.yaml`](../../compose.yaml) to the host and is validated in the `compose-config` job with `IMAGE_TAG=ci`.

- `api` runs the GHCR image tagged `IMAGE_TAG` instead of building `Backend/`, and exports no telemetry (`Observability__Enabled` is `false`).
- `postgres` publishes no port and `gateway` publishes `127.0.0.1:8080` only. Docker writes its own firewall rules, so a port published on all interfaces would be public even with the host firewall closed.
- `otel-collector`, `prometheus`, `tempo` and `grafana` move behind the `observability` profile and start only with `--profile observability`.
- `pgbackup` probes its health every 15 s instead of the image's 5 minutes, so `up --wait` does not stall on its first probe.

## Secrets

| Secret | Purpose |
|---|---|
| `DEPLOY_HOST` | address of the production host |
| `DEPLOY_SSH_KEY` | private half of the deploy key, the only copy |
| `DEPLOY_KNOWN_HOSTS` | host keys of the production host, so the job refuses any other machine |

The three secrets live in the GitHub environment `production`, not in the repository, so a job on another branch never receives them. The application secrets never leave the host. [`Infrastructure/secrets/gen-secrets.sh`](../../Infrastructure/secrets/gen-secrets.sh) generates them there once, and because the files are gitignored a checkout never touches them. The host pulls from GHCR with a read-only token of its own.

## Preparing a host

1. Ubuntu with Docker Engine and the Compose plugin, SSH by key only and a firewall that admits only SSH.
2. A `deploy` user without sudo and with a locked password, in the `docker` group, whose only key carries the forced command.
3. The script installed owned by root with `sudo install -m 0755 -o root -g root Infrastructure/deploy/deploy /usr/local/bin/deploy`.
4. `/srv/auctions` owned by `deploy`, the repository cloned into `/srv/auctions/repo` as `deploy`, `gen-secrets.sh` run once and `docker login ghcr.io` with a `read:packages` token.
5. The environment `production` in the GitHub repository, limited to `main`, with the three secrets.

## Known limitations

- There is no TLS and no public entry point. The gateway is reached through an SSH tunnel such as `ssh -L 8080:127.0.0.1:8080 <host>`.
- After a host reboot the dev-mode vault comes back empty and the api restarts in a loop until `vault-init` runs again (issue #24, [STATE.md](STATE.md#known-gaps)).
- The rollback starts the previous commit with the image tagged by its sha, so it relies on every deployed commit coming from `main`, where CI pushes that image.
- Membership in the `docker` group is equivalent to root, so the forced command, not the group, is the security boundary of the deploy key.

## Related documents

- [infrastructure.md](infrastructure.md) - the services the override adapts.
- [operations.md](operations.md) - the secret files and the vault lifecycle.
- [ARCHITECTURE.md](ARCHITECTURE.md#build-and-ci) - the CI pipeline that ends in `deploy`.
