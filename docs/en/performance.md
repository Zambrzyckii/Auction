# AuctionServer — performance

> English version. Polish 1:1 counterpart: [../pl/performance.md](../pl/performance.md)

Every change that claims a performance or reliability effect is measured with k6 before and after, and the runs land here, newest first. A number without the commit, the limits and the load it was taken under is a rumor, so every entry records all three.

## Method

- The whole stack runs on one host through `docker compose` with frozen resource limits: `api` 2 CPUs and 1 GB, `postgres` 1 CPU and 512 MB, and since phase two `gateway` 1 CPU and 128 MB. Changing the limits invalidates every earlier entry, so they stay frozen for the duration of the infrastructure plan.
- k6 (`grafana/k6:2.3.0`, the `loadtest` Compose profile) runs inside the Compose network and targets `http://api:8080` directly, so the numbers stay comparable now that the gateway sits in front of the api. Only `gateway-limits.js` and the gateway rows go through the gateway, started with `-e BASE_URL=http://gateway`.
- The scenarios live in [`Infrastructure/k6/`](../../Infrastructure/k6/) and seed their own data through the public API (a seller, auctions from the starter pack, self-funded bot bidders). A run is started with, for example:

  ```bash
  docker compose run --rm k6 run browse.js --summary-export=results/browse.json
  ```

- `browse.js` sends anonymous reads (70% list, 20% detail, 10% bid history) at a constant arrival rate, 50/s for 60 s by default. These are the three queries the phase-four cache will serve.
- `bid-storm.js` lets 10 self-funded bots hammer one auction. The design answer to a storm is a 409 (one pending bid per auction), so 409s are classified as expected; the 400s (a confirmed leader re-bidding, an amount overtaken in flight) stay in the failure rate under a loosened threshold.
- `mixed.js` is 85% reads and 15% bids, and its `visibility_lag` trend measures the time from an accepted `POST /bid` to the bid appearing in `GET /bids`, the outbox pipeline as a player experiences it.
- `gateway-limits.js` runs four 20-second windows against the gateway (anonymous below and above its limit, with a token above its limit, login above its limit), and its thresholds assert that each window gets the 200s and 429s it should.
- Thresholds, chosen from the first baseline with headroom: failure rate < 1% (bid-storm < 6%), HTTP p95 < 67 ms, `visibility_lag` p95 < 6 s. A threshold breach fails the run with exit code 99.

## Gateway — 2026-10-23, commit `32b9507`

Phase two puts nginx in front of the api. Inside Compose every k6 virtual user shares one client address, so through the gateway the anonymous scenario is capped at 20 requests per second. The overhead is therefore measured at 15 iterations per second, once directly and once through the gateway, and `gateway-limits.js` pushes every rate-limit zone past its limit. The gateway runs with 1 CPU and 128 MB.

| Scenario | Load | req/s | p50 | p95 | p99 | max | Failures |
|---|---|---|---|---|---|---|---|
| browse, direct, cold api | 15 iters/s, 60 s | 13.9 | 0.82 ms | 1.24 ms | 4.92 ms | 343 ms | 0% |
| browse, direct, warm api | 15 iters/s, 60 s | 13.8 | 0.87 ms | 1.45 ms | 2.56 ms | 140 ms | 0% |
| browse, through the gateway | 15 iters/s, 60 s | 14.0 | 0.92 ms | 1.24 ms | 1.69 ms | 143 ms | 0% |

| `gateway-limits.js` window, 20 s each | Passed | 429 | Expected passes |
|---|---|---|---|
| anonymous, 15/s | 301 | 0 | all, below the limit |
| anonymous, 40/s | 440 | 360 | 20/s × 20 s + burst 40 = 440 |
| with a token, 90/s | 1320 | 481 | 60/s × 20 s + burst 120 = 1320 |
| login, 3/s | 25 | 35 | 1/s × 20 s + burst 5 = 25 |

- The gateway adds about 0.05 to 0.1 ms to the median. The two direct runs differ more in their tails (p99 4.92 against 2.56 ms) than the warm direct run differs from the gateway run, so at this load the extra hop costs less than the noise.
- The cold run went first on a freshly recreated api, which explains its 343 ms max. The roughly 140 ms max of the other runs is the setup, not the load. Registration and login hash with BCrypt and take 135 to 142 ms each, while a list request takes about 1 ms. This corrects the baseline note below, which blamed JIT.
- Every pass count equals rate times duration plus burst, to the request, so each zone behaves exactly as configured.
- These rows isolate the gateway at a load the anonymous zone allows. They are not comparable with the baseline's 50 iterations per second, which stays the reference for the api itself.

## Baseline — 2026-10-23, commit `4eb831b`

The reference point for phases two to six, taken on the fresh telemetry stack with no gateway, no pooler and no cache.

| Scenario | Load | req/s | p50 | p95 | p99 | max | Failures |
|---|---|---|---|---|---|---|---|
| browse | 50 iters/s, 60 s | 45.5 | 0.76 ms | 1.12 ms | 1.45 ms | 138 ms | 0% |
| bid-storm | 10 bots, no pacing, 60 s | 86.4 | 0.91 ms | 1.65 ms | 3.47 ms | 143 ms | 4.41% (domain 400s) |
| mixed | 30 iters/s, 85/15, 60 s | 27.0 | 0.80 ms | 1.46 ms | 8.06 ms | 142 ms | 0% |

- `visibility_lag` (mixed): med 3.01 s, p90 4.36 s, p95 4.52 s, p99 5.02 s, max 5.02 s. This is the measured cost of the two-poll outbox pipeline, previously only estimated at 3-9 s; phase five (RabbitMQ) is expected to cut it, phases two to four must not move it.
- bid-storm domain outcomes: 20 bids accepted, 3620 rejected with 409 (the pending-bid lock working as designed, a confirmation needs two outbox polls), 356 rejected with 400. Acceptance throughput is bounded by the saga, not by HTTP capacity.
- Every `max` around 140 ms is the setup's registration and login, which hash with BCrypt (corrected during phase two, the original note blamed JIT on a cold endpoint). The percentiles show the API under load.
- Reading the table: at these loads the API is nowhere near its limits, sub-millisecond medians on 2 CPUs. The baseline exists so the pooler and the cache phases can prove their effect (or honestly show its absence at one instance) instead of claiming it.
