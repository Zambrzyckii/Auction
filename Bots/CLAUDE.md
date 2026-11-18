# CLAUDE.md

Commands and invariants for the Python market bot fleet. The design lives in `docs/en/bots.md`.

## Commands

All commands run from `Bots/`. The host has no global pip, so create the venv first.

```bash
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"   # one-time setup
.venv/bin/pytest -q                                # all tests (unit, sim, broker)
.venv/bin/pytest -q -m "not broker"                # without Docker
.venv/bin/pytest tests/unit/test_config.py -q     # one file
.venv/bin/ruff check . && .venv/bin/ruff format --check .
```

The broker tests need Docker and at least 3 GiB available memory (`free -g`).

## Running the fleet

```bash
docker compose --profile bots up -d --build bots   # from the repo root
docker compose logs -f bots
docker compose --profile bots stop bots
```

## Invariants

- Policy functions under `src/auction_bots/fleet/policies/` and the director's `control_step`
  are pure. They decide from their arguments only, with no IO and no real clock.
- Secrets never reach logs, repr, files or chat. That covers the API key, the AMQP password
  and the derived bot passwords.
- Every HTTP request goes through one `GatewayClient` with one shared `TokenBucket` kept below
  the gateway rate limit. Logins and provisioning also pass the `LoginGate`.
- Every account outside the fleet registry counts as human.
- The fleet changes nothing in `Backend/` or `Frontend/`. It is a pure client of the gateway
  and the market feed.
