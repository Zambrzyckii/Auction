# Bots (planned)

> English version. Polish 1:1 counterpart: [../pl/bots.md](../pl/bots.md)

This module does not exist yet: the repository contains no `Bots/` folder and no Python code. What exists is the backend side of the contract: a `Bot` role, an API-key-protected provisioning endpoint, long-lived tokens and two bot-only endpoints.

## Status

Planned. The deleted design note (`AGENTS.md`) describes "AI BOTS" as autonomous actors that listen to market events on RabbitMQ and send commands through the API gateway, written in Python; neither the broker nor the gateway exists, so a first bot would have to poll the HTTP API.

## Target design

- Python processes, each running under its own bot account.
- Input: market events (`AuctionActivatedEvent`, `BidPlacedEvent`, `AuctionFinishedEvent`) consumed from RabbitMQ once the transport is in place.
- Output: commands through the gateway, which means the same HTTP endpoints players use plus the bot-only ones.
- Purpose, as far as it is recorded: "AI market bots" that act in the market on their own; the bot-only endpoints (minting items, adding funds) show that bots are meant to put items and money into circulation.

## What the backend provides

| Need | Available today |
|---|---|
| account | `POST /api/users/bots` with the `X-Api-Key` header equal to `Bots:ApiKey`; returns `{ publicUserId }`; the account gets `Role.Bot` and a wallet with `Wallets:StartingFunds` |
| session | `POST /api/users/login` returns a token valid for 24 hours for a bot account (15 minutes for players) |
| bot-only actions | `POST /api/wallets/funds` (top up the bot's own wallet) and `POST /api/inventory/items` (mint an item with a chosen name and rarity into the bot's own inventory), both behind the `Bot` policy |
| market actions | the same endpoints as players: create auctions, bid, craft, sell to the shop, read auctions and wallets |

## What is missing

- No event feed outside the process: `AuctionActivatedEvent` and the other events reach only in-process MediatR handlers, so a bot cannot subscribe to anything until the RabbitMQ transport exists.
- No gateway and no rate limiting, so a bot talks straight to the host and nothing throttles it.
- No bid history and no "my auctions" query, so a bot has to remember what it did.
- No token revocation and no endpoint to disable an account, so a bot token stays valid for its full 24 hours.

## API

The endpoints a bot would call, in the order of a typical session: `POST /api/users/bots` (once, by the provisioner), `POST /api/users/login`, `POST /api/inventory/items`, `POST /api/auctions`, `GET /api/auctions?limit=100`, `POST /api/auctions/{id}/bid`, `GET /api/wallets/{id}`. Request and response shapes are in the module chapters linked below.

## Decisions

- Bots are first-class accounts with a role rather than a separate authentication path, so every market action by a bot goes through the same validation and events as a player's.
- Provisioning is protected by an API key that only the operator holds; a bot token cannot create other bots, which `BotProvisioningApiTests` pins down.
- Python was named as the bots' language in the original design note; nothing else has been decided.

## Related documents

- [backend/identity.md](backend/identity.md) - provisioning, roles and token lifetimes.
- [backend/wallets.md](backend/wallets.md) and [backend/inventory.md](backend/inventory.md) - the bot-only endpoints.
- [infrastructure.md](infrastructure.md) - the broker and the gateway the bots depend on.
