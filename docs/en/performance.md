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

  Since phase six the scenarios that seed bots (`mixed.js`, `bid-storm.js`) additionally need the generated key, `-e BOTS_API_KEY="$(cat Infrastructure/secrets/bots-api-key.secret)"` — the fallback in `lib/config.js` no longer matches a real key.

- `browse.js` sends anonymous reads (70% list, 20% detail, 10% bid history) at a constant arrival rate, 50/s for 60 s by default. These are the three queries the phase-four cache serves.
- `bid-storm.js` lets 10 self-funded bots hammer one auction. The design answer to a storm is a 409 (one pending bid per auction), so 409s are classified as expected; the 400s (a confirmed leader re-bidding, an amount overtaken in flight) stay in the failure rate under a loosened threshold.
- `mixed.js` is 85% reads and 15% bids, and its `visibility_lag` trend measures the time from an accepted `POST /bid` to the bid appearing in `GET /bids`, the outbox pipeline as a player experiences it.
- `gateway-limits.js` runs four 20-second windows against the gateway (anonymous below and above its limit, with a token above its limit, login above its limit), and its thresholds assert that each window gets the 200s and 429s it should.
- Thresholds, chosen from the first baseline with headroom: failure rate < 1% (bid-storm < 6%), HTTP p95 < 67 ms, `visibility_lag` p95 < 9 s since 2026-11-07, when the hardening entry measured the pipeline's ceiling at ~8.5 s (< 8 s from 2026-11-01, when phase four priced in the 2 s bids TTL, and < 6 s before that). A threshold breach fails the run with exit code 99.

## Hardening — 2026-11-07, commit `d766780`

Phase seven hardened the stack around an untouched pipeline: the api now runs non-root on a read-only filesystem, every authenticated write passes the host's per-user token-bucket limiter, and `pgbackup` idles next to postgres. This entry proves the hardening costs nothing on the HTTP path and records the visibility-lag tail honestly. Fresh `down -v && up -d --build --wait` at the frozen limits, the image checked against HEAD, three `mixed.js` runs — the usual pair plus a tiebreaker after the second run breached the threshold. HTTP stayed at 1.5-2.0 ms p95 with 0% failures out of ~2500 requests per run; `mixed.js` treats only 2xx, 400 and 409 as expected, so zero failures also proves the limiter invisible to legitimate load (ten bidders share ~4 bids/s, far under the 5 tokens/s refill of one user's hot-write bucket). All eight outboxes and the delivery table ended every run with zero pending and zero dead rows.

| Run | Accepted bids | med | p90 | p95 | p99 | max | p95 threshold (8 s) |
|---|---|---|---|---|---|---|---|
| 1 | 29 | 6.05 s | 7.52 s | 7.82 s | 8.02 s | 8.02 s | passed |
| 2 | 27 | 7.02 s | 8.02 s | 8.02 s | 8.40 s | 8.53 s | breached |
| 3 | 27 | 6.52 s | 8.52 s | 8.87 s | 9.03 s | 9.03 s | breached |

- The medians (6.05-7.02 s) straddle the phase-five pair's 6.52 s, so the middle of the distribution did not move: the two 3 s polls plus the 2 s bids TTL still dominate, and no phase-seven change sits on that path — the limiter decides in microseconds before the handler, and the broker-outage catch runs only when the broker is down.
- The tail did move: two of three runs breach the 8 s threshold at p95, where the phase-five pair passed at 7.52 s with p99/max grazing 7.9-8.0 s. With ~27 accepted bids per run, p95 is the second-worst sample, so this is single bids catching all three waits near their worst — two full 3 s polls plus a full 2 s TTL plus the 0.5 s probe granularity stack to ~8.5 s before jitter. The entries since phase four recorded that the pipeline has no room at this threshold; these runs crossed the line itself. On 2026-11-07 the owner raised the threshold to 9 s, the measured ceiling plus margin, rather than shorten a poll or accept red pairs ([DECISIONS.md](DECISIONS.md)); it still catches any real regression, such as a third hop.

## RabbitMQ transport — 2026-11-04, commit `d73baa2`

Phase five switched the Compose api to the Rabbit transport (ADR-013): every outbox hand-off now crosses the broker before it reaches the delivery store. This entry confirms the broker leg does not move `visibility_lag`. Compose defaults at the frozen limits (cache on, L1 plus L2, the broker at 1 CPU and 384 MB), the api image rebuilt and checked younger than the head commit, two `mixed.js` runs. HTTP p95 stayed at 1.4-1.6 ms with 0% failures, and the eight outboxes, the delivery table and the broker queue ended empty.

| Pipeline | Run | Accepted bids | med | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| outbox + delivery, in-process (2026-11-01 pair) | 1 | 30 | 6.51 s | 7.02 s | 7.30 s | 8.24 s | 8.53 s |
| outbox + delivery, in-process (2026-11-01 pair) | 2 | 29 | 6.52 s | 7.52 s | 7.52 s | 7.52 s | 7.52 s |
| outbox + broker + delivery (`d73baa2`) | 1 | 30 | 6.52 s | 7.07 s | 7.52 s | 7.52 s | 7.53 s |
| outbox + broker + delivery (`d73baa2`) | 2 | 30 | 6.52 s | 7.52 s | 7.52 s | 7.88 s | 8.02 s |

- The medians are identical (6.52 s) and every percentile sits inside the ~0.3 s run-to-run noise, so the broker leg costs milliseconds: both 3 s polls still dominate the lag, exactly as ADR-011 predicted and ADR-013 records.
- Both runs pass the 8 s threshold with the same ~0.5 s of headroom at p95 as before the broker; p99/max still graze 7.9-8.0 s, so the no-room-for-a-third-hop observation stands.

## Delivery split — 2026-11-01, commit `82d0e00`

Stage six of the review cleanup split publishing into transport and delivery (ADR-011), which added a second 3 s polling hop (the outbox courier hands over, the `DeliveryProcessor` delivers) to every event. This entry measures that hop's cost on `visibility_lag` before phase five. Compose defaults at the frozen limits (cache on, L1 plus L2), two `mixed.js` runs per pipeline. The first pair accidentally ran against a stale api image built before the split and was kept as a same-day baseline of the single-hop pipeline. HTTP p95 stayed at 1.5-1.7 ms with 0% failures in all four runs, and all eight outboxes plus the delivery table ended with zero pending and zero dead rows.

| Pipeline | Run | Accepted bids | med | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| single hop (pre-split image) | 1 | 32 | 6.02 s | 6.97 s | 7.02 s | 7.36 s | 7.52 s |
| single hop (pre-split image) | 2 | 33 | 6.02 s | 7.02 s | 7.02 s | 7.02 s | 7.02 s |
| outbox + delivery (`82d0e00`) | 1 | 30 | 6.51 s | 7.02 s | 7.30 s | 8.24 s | 8.53 s |
| outbox + delivery (`82d0e00`) | 2 | 29 | 6.52 s | 7.52 s | 7.52 s | 7.52 s | 7.52 s |

- The second hop costs about half a second at the median (6.02 s to 6.5 s) and 0.3-0.5 s at p95 (7.02 s to 7.3-7.5 s), far below the worst case of a full extra 3 s poll, because the delivery claim runs continuously under load.
- Both split-pipeline runs pass the 8 s threshold with about 0.5 s of headroom, so phase five starts from a passing baseline. Single p99/max samples already graze 8.2-8.5 s, so the pipeline has no room for a third hop.
- The same-day single-hop pair lands on the phase-four entry (med 6.01 s, p95 7.29 s), which bounds run-to-run noise at about 0.3 s on p95.
## Redis cache — 2026-11-01, commit `e688772`

Phase four puts a TTL read cache (HybridCache, in-process L1 plus Redis L2, 2 s per query kind) behind the Auctions module's `IAuctionReadCache` seam, filled on read by a MediatR behavior for the three anonymous queries. Both rows of a pair use the same api image at the frozen limits; "off" runs with `Cache:Enabled=false`, "on" with the Compose defaults (L1 plus L2, `redis:7.2-alpine` capped at 64 MB). "pg CPU" is the average of per-second `docker stats` samples on the postgres container during the run.

| Scenario | Load | req/s | p50 | p95 | p99 | max | Failures | pg CPU |
|---|---|---|---|---|---|---|---|---|
| browse, cache off | 50 iters/s, 60 s | 46.2 | 0.37 ms | 0.95 ms | 1.33 ms | 139 ms | 0% | 2.6% |
| browse, cache on | 50 iters/s, 60 s | 43.6 | 0.37 ms | 0.94 ms | 1.24 ms | 142 ms | 0% | 2.4% |
| mixed, cache off | 30 iters/s, 60 s | 25.2 | 0.36 ms | 1.64 ms | 45.5 ms | 553 ms | 0% | 2.2% |
| mixed, cache on | 30 iters/s, 60 s | 25.2 | 0.39 ms | 1.55 ms | 8.17 ms | 150 ms | 0% | 2.4% |

- Latency did not move, and that is the honest headline: at these loads postgres sits under 3% CPU, so there was no database pain for the cache to relieve and the sub-millisecond medians stay sub-millisecond. What changed is the work behind them: the `AuctionServer.Auctions.Cache` meter counted 9662 hits against 774 misses across the cache-on runs (92.6% hit ratio), so roughly thirteen out of fourteen reads never reached postgres. The benefit at one instance is capacity headroom, not speed.
- L2 is almost idle at one instance: Redis itself answered 12 keyspace hits against 762 misses, because L1 and L2 expire together (`Expiration == LocalCacheExpiration`), so whatever L1 just lost, L2 had lost too. Redis starts earning its keep with a second api instance or across an api restart; today it is wiring proven ahead of need, exactly as the phase plan assumed.
- `visibility_lag` (mixed) p95 moved from 6.02 s (the same breach of the old 6 s threshold that the PgBouncer entry recorded) to 7.29 s, med from 3.76 s to 6.01 s: an accepted bid now also waits out the 2 s bids TTL before `GET /bids` shows it, on top of the two outbox polls. The increase stays within the TTL, as designed and documented in [backend/auctions.md](backend/auctions.md). The owner raised the threshold to 8 s (the 6 s outbox pipeline plus the 2 s TTL) rather than shorten the TTL or exclude bids from the cache; the pre-existing drift of the outbox lag itself stays an open item for the broker phase.

## PgBouncer — 2026-10-24, commit `f0f5aaa`

Phase three puts PgBouncer (transaction pooling, `default_pool_size` 25, reserve 10) between the api and postgres. Both rows of a pair use the same api image and the frozen limits, "direct" connects straight to postgres and "pooled" goes through `pgbouncer:6432` with `No Reset On Close=true`. The storm is `browse.js` at 2000 iterations per second for 30 s, the load that exhausted postgres before the pooler. "DB" is the peak number of `auction` backends inside the postgres container, sampled once per second.

| Scenario | Load | req/s | p50 | p95 | p99 | max | Failures | DB |
|---|---|---|---|---|---|---|---|---|
| browse, direct | 50 iters/s, 60 s | 46.0 | 0.80 ms | 1.23 ms | 1.96 ms | 172 ms | 0% | 11 |
| browse, pooled | 50 iters/s, 60 s | 46.0 | 0.78 ms | 1.06 ms | 1.77 ms | 172 ms | 0% | 3 |
| bid-storm, direct | 10 bots, 60 s | 84.0 | 0.97 ms | 1.75 ms | 3.67 ms | 167 ms | 4.78% | 11 |
| bid-storm, pooled | 10 bots, 60 s | 82.9 | 0.84 ms | 1.44 ms | 2.72 ms | 150 ms | 4.77% | 4 |
| mixed, direct | 30 iters/s, 60 s | 24.5 | 0.82 ms | 1.58 ms | 7.89 ms | 146 ms | 0% | 11 |
| mixed, pooled | 30 iters/s, 60 s | 24.5 | 0.84 ms | 1.70 ms | 8.13 ms | 146 ms | 0% | 4 |
| storm, direct | 2000 iters/s, 30 s | 1737.8 | 0.51 ms | 1.42 ms | 58.02 ms | 576 ms | 0%, 402 dropped | 29, then 100 |
| storm, pooled | 2000 iters/s, 30 s | 1609.3 | 0.41 ms | 0.63 ms | 1.88 ms | 132 ms | 0%, 0 dropped | 11 |

- At the regular loads the pooler costs nothing measurable, the differences sit inside the noise, and the whole api is served by 3-4 backends instead of 11.
- The storm is the point of the phase. Direct, Npgsql opened all 100 connections postgres allows, kept them idle after the run and an administrative `psql` was refused with "sorry, too many clients already" (the 29 in the table is what the per-second sampler caught during the run). Pooled, postgres peaked at 11 backends and returned there after the run. The tail collapsed (p99 from 58 ms to 1.9 ms, max from 576 ms to 132 ms) and no iterations were dropped, at the price of about 7% of throughput, the cost of queueing in the pooler instead of overloading postgres.
- Both mixed runs breached the `visibility_lag` threshold the same way (p95 6.03 s against the allowed 6 s, med 5.3-5.5 s against the baseline's 3.0 s), so the pooler is not the cause. The drift happened between the baseline and this measurement, with the data accumulated in the persistent volume as the unverified suspect, and stays an open item.

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

- `visibility_lag` (mixed): med 3.01 s, p90 4.36 s, p95 4.52 s, p99 5.02 s, max 5.02 s. This is the measured cost of the two-poll outbox pipeline, previously only estimated at 3-9 s. Phases two to four must not move it. Phase five (RabbitMQ) was expected to cut it at the time, but since the delivery split both polls stay whatever the transport (ADR-011, ADR-013).
- bid-storm domain outcomes: 20 bids accepted, 3620 rejected with 409 (the pending-bid lock working as designed, a confirmation needs two outbox polls), 356 rejected with 400. Acceptance throughput is bounded by the saga, not by HTTP capacity.
- Every `max` around 140 ms is the setup's registration and login, which hash with BCrypt (corrected during phase two, the original note blamed JIT on a cold endpoint). The percentiles show the API under load.
- Reading the table: at these loads the API is nowhere near its limits, sub-millisecond medians on 2 CPUs. The baseline exists so the pooler and the cache phases can prove their effect (or honestly show its absence at one instance) instead of claiming it.
