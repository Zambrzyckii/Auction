# Bots (planned)

> English version. Polish 1:1 counterpart: [../pl/bots.md](../pl/bots.md)

This module does not exist yet: the repository contains no `Bots/` folder and no Python code. What exists is the backend side of the contract: a `Bot` role, an API-key-protected provisioning endpoint, long-lived tokens and two bot-only endpoints.

## Status

Planned. The deleted design note (`AGENTS.md`) describes "AI BOTS" as autonomous actors that listen to market events on RabbitMQ and send commands through the API gateway, written in Python. Since 2026-11-04 the broker runs in the Compose stack and the market feed exists (see [The market feed](#the-market-feed)), so a first bot can subscribe instead of polling.

## Target design

- Python processes, each running under its own bot account.
- Input: market events (`AuctionActivatedEvent`, `BidPlacedEvent`, `AuctionFinishedEvent`, `AuctionCancelledEvent`) consumed from the RabbitMQ exchange `auctionserver.market`, live since 2026-11-04.
- Output: commands through the gateway, which means the same HTTP endpoints players use plus the bot-only ones. The RabbitMQ queue is consume-only for bots. A command never travels through the broker, and every bot write is an ordinary synchronous HTTP call like a player's ([ADR-008](adr/008-synchronous-writes-outbox-boundary.md)).
- Purpose, as far as it is recorded: "AI market bots" that act in the market on their own; the bot-only endpoints (minting items, adding funds) show that bots are meant to put items and money into circulation.

## The market feed

Since 2026-11-04 the host re-publishes the four public auction events on the durable topic exchange `auctionserver.market`, with the event type name as the routing key (`AuctionActivatedEvent`, `BidPlacedEvent`, `AuctionFinishedEvent`, `AuctionCancelledEvent`; the allowlist is the host's `MarketEvents` set, see [ADR-013](adr/013-rabbitmq-transport.md)). A message carries the event id in the AMQP `MessageId` property, the type name in `Type` and the raw event JSON as the body, the same shapes the handlers consume (see the [event catalog](backend/messaging.md#event-catalog)). The feed is consume-only and at-least-once: a bot declares its own queue, binds it with the routing keys it wants (or `#` for all four) and must tolerate duplicates, deduplicating on `MessageId` when its actions are not naturally idempotent. The broker listens on `rabbitmq:5672` inside the Compose `data` network with the user `auction` and the generated password from `Infrastructure/secrets/rabbitmq-password.secret` (since phase six, [ADR-014](adr/014-openbao-secrets.md)), and the management UI on `127.0.0.1:15672` shows the exchanges and queues live. No AMQP port is published to the host, so a bot process either joins the Compose network or waits for an operational decision to expose the broker.

## What the backend provides

| Need | Available today |
|---|---|
| account | `POST /api/users/bots` with the `X-Api-Key` header equal to `Bots:ApiKey`; returns `{ publicUserId }`; the account gets `Role.Bot` and a wallet with `Wallets:StartingFunds` |
| session | `POST /api/users/login` returns a token valid for 24 hours for a bot account (15 minutes for players) |
| bot-only actions | `POST /api/wallets/funds` (top up the bot's own wallet) and `POST /api/inventory/items` (mint an item with a chosen name and rarity into the bot's own inventory), both behind the `Bot` policy |
| market actions | the same endpoints as players: create auctions, bid, craft, sell to the shop, read auctions and wallets |

## What is missing

- No bot code: the feed exists, but nothing consumes it yet, and no provisioning script exists either.
- The gateway limits a bot like any other client by its address (60 requests per second with a bearer token) and does not tell bots apart, because the bot zone keyed on `X-Api-Key` was left out ([ADR-006](adr/006-nginx-gateway.md)). Several bots on one machine share one address and therefore one bucket of 60 requests per second.
- No bid history and no "my auctions" query, so a bot has to remember what it did.
- No token revocation and no endpoint to disable an account, so a bot token stays valid for its full 24 hours.

## API

The endpoints a bot would call, in the order of a typical session: `POST /api/users/bots` (once, by the provisioner), `POST /api/users/login`, `POST /api/inventory/items`, `POST /api/auctions`, `GET /api/auctions?limit=100`, `POST /api/auctions/{id}/bid`, `GET /api/wallets/{id}`. Request and response shapes are in the module chapters linked below.

## Decisions

- Bots are first-class accounts with a role rather than a separate authentication path, so every market action by a bot goes through the same validation and events as a player's.
- Provisioning is protected by an API key that only the operator holds; a bot token cannot create other bots, which `BotProvisioningApiTests` pins down.
- Python was named as the bots' language in the original design note; nothing else has been decided.
- Mutating requests are not queued, for bots or players. The outbox is the only asynchrony boundary, see [ADR-008](adr/008-synchronous-writes-outbox-boundary.md).

## Related documents

- [backend/identity.md](backend/identity.md) - provisioning, roles and token lifetimes.
- [backend/wallets.md](backend/wallets.md) and [backend/inventory.md](backend/inventory.md) - the bot-only endpoints.
- [infrastructure.md](infrastructure.md) - the broker and the gateway the bots depend on, with the broker section under [Message broker](infrastructure.md#message-broker).
