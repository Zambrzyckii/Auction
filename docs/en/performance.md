# AuctionServer — performance

> English version. Polish 1:1 counterpart: [../pl/performance.md](../pl/performance.md)

Every change that claims a performance or reliability effect is measured with k6 before and after, and the runs land here, newest first. A number without the commit, the limits and the load it was taken under is a rumor, so every entry records all three.

## Method

- The whole stack runs on one host through `docker compose` with frozen resource limits: `api` 2 CPUs and 1 GB, `postgres` 1 CPU and 512 MB. Changing the limits invalidates every earlier entry, so they stay frozen for the duration of the infrastructure plan.
- k6 (`grafana/k6:2.3.0`, the `loadtest` Compose profile) runs inside the Compose network and targets `http://api:8080` directly, so the numbers stay comparable after the gateway lands in front of the api.
- The scenarios live in [`Infrastructure/k6/`](../../Infrastructure/k6/) and seed their own data through the public API (a seller, auctions from the starter pack, self-funded bot bidders). A run is started with, for example:

  ```bash
  docker compose run --rm k6 run browse.js --summary-export=results/browse.json
  ```

- `browse.js` sends anonymous reads (70% list, 20% detail, 10% bid history) at a constant arrival rate, 50/s for 60 s by default. These are the three queries the phase-four cache will serve.
- `bid-storm.js` lets 10 self-funded bots hammer one auction. The design answer to a storm is a 409 (one pending bid per auction), so 409s are classified as expected; the 400s (a confirmed leader re-bidding, an amount overtaken in flight) stay in the failure rate under a loosened threshold.
- `mixed.js` is 85% reads and 15% bids, and its `visibility_lag` trend measures the time from an accepted `POST /bid` to the bid appearing in `GET /bids`, the outbox pipeline as a player experiences it.
- Thresholds, chosen from the first baseline with headroom: failure rate < 1% (bid-storm < 6%), HTTP p95 < 67 ms, `visibility_lag` p95 < 6 s. A threshold breach fails the run with exit code 99.

## Baseline — 2026-10-23, commit `4eb831b`

The reference point for phases two to six, taken on the fresh telemetry stack with no gateway, no pooler and no cache.

| Scenario | Load | req/s | p50 | p95 | p99 | max | Failures |
|---|---|---|---|---|---|---|---|
| browse | 50 iters/s, 60 s | 45.5 | 0.76 ms | 1.12 ms | 1.45 ms | 138 ms | 0% |
| bid-storm | 10 bots, no pacing, 60 s | 86.4 | 0.91 ms | 1.65 ms | 3.47 ms | 143 ms | 4.41% (domain 400s) |
| mixed | 30 iters/s, 85/15, 60 s | 27.0 | 0.80 ms | 1.46 ms | 8.06 ms | 142 ms | 0% |

- `visibility_lag` (mixed): med 3.01 s, p90 4.36 s, p95 4.52 s, p99 5.02 s, max 5.02 s. This is the measured cost of the two-poll outbox pipeline, previously only estimated at 3-9 s; phase five (RabbitMQ) is expected to cut it, phases two to four must not move it.
- bid-storm domain outcomes: 20 bids accepted, 3620 rejected with 409 (the pending-bid lock working as designed, a confirmation needs two outbox polls), 356 rejected with 400. Acceptance throughput is bounded by the saga, not by HTTP capacity.
- Every `max` around 140 ms is the first-hit JIT cost of a cold endpoint; the percentiles show the warmed-up system.
- Reading the table: at these loads the API is nowhere near its limits, sub-millisecond medians on 2 CPUs. The baseline exists so the pooler and the cache phases can prove their effect (or honestly show its absence at one instance) instead of claiming it.
