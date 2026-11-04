# Infrastructure

Configuration for the services around the backend, mounted by the root `compose.yaml`.

## observability/

The telemetry pipeline. The API exports traces, metrics and logs over OTLP to the collector,
which fans them out to the storage backends. Grafana reads both backends and is the only
published endpoint (http://127.0.0.1:3000, default credentials admin/admin).

| File | Service | Role |
|---|---|---|
| `otel-collector.yaml` | otel/opentelemetry-collector-contrib | receives OTLP on 4317, exports traces to Tempo and metrics to a Prometheus scrape endpoint on 8889; logs go to the collector's own stdout until a log backend is added |
| `prometheus.yml` | prom/prometheus | scrapes the collector every 10 s |
| `tempo.yaml` | grafana/tempo | stores traces on a local volume, 48 h retention |
| `grafana-datasources.yaml` | grafana/grafana | provisions the Prometheus and Tempo datasources |

The API only sends telemetry when the `Observability` configuration section is present and
enabled; `compose.yaml` sets it through environment variables. Without the section the host
runs exactly as before.

## gateway/

The nginx gateway, the only published entry point (http://localhost:8080). `nginx.conf` is the
whole configuration, mounted read-only into `nginx:1.28.3-alpine`. It proxies `/api/` and `/health`
to the api, opens `/openapi/` to loopback and private networks only, limits each client address
(anonymous 20 r/s, with an `Authorization` header 60 r/s, login and register 1 r/s), caps request
bodies at 64 KB (4 MB for the avatar upload), compresses JSON, writes one JSON access log line per
request to stdout and re-resolves the api through Docker's DNS every 5 s. Check a change with
`docker run --rm -v "$PWD/Infrastructure/gateway/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:1.28.3-alpine nginx -t`.
The full description is in `docs/en/infrastructure.md` and the decision in ADR-006.

## secrets/

Gitignored secret files for the whole stack. `gen-secrets.sh` generates six random `*.secret`
values plus two derived files (the PgBouncer userlist and the RabbitMQ defaults config) and never
overwrites an existing `.secret`. Only the generator and the `*.example` templates are tracked.
Run it once before the first `docker compose up`; the rotation steps are in `docs/en/operations.md`.

## vault/

The OpenBao side of phase six. `vault-init.sh` runs as a one-shot compose service on every stack
start and seeds the dev-mode vault: the `auction-api` policy, the AppRole, the five application
secrets under `secret/auction/api` and the `role-id`/`secret-id` files the api reads at startup.
`vault-persistent.hcl` is the raft configuration used by the `compose.vault-persistent.yaml`
overlay, whose manual unseal drill is described in `docs/en/operations.md` and ADR-014.

## k6/

Load scenarios for the `k6` service behind the `loadtest` Compose profile. `browse.js`,
`bid-storm.js` and `mixed.js` target the api directly, `gateway-limits.js` targets the gateway
(`docker compose run --rm -e BASE_URL=http://gateway k6 run gateway-limits.js`). Raw results go to
the ignored `results/`, the recorded numbers to `docs/en/performance.md`.
