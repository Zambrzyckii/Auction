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
