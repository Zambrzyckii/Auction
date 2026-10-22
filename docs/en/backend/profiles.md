# Profiles module

> English version. Polish 1:1 counterpart: [../../pl/backend/profiles.md](../../pl/backend/profiles.md)

`AuctionServer.Modules.Profiles` is the ninth module and the social layer of the game: a public profile per player with a username snapshot, a level earned from wallet turnover, an avatar stored in SeaweedFS, up to six social links, friends with requests and acceptance, warehouse-war invites for friends, and a privacy toggle that hides everything except the username and the avatar from strangers. It is the first **consume-only** module: it publishes no events, so it has no outbox table, no `OutboxProcessor` and no keeper, only the inbox `ProfilesProcessedMessages`. Thirteen endpoints live under `/api/profiles`, all behind JWT.

## Overview

| Area | Files |
|---|---|
| Endpoints | [`Presentation/ProfilesEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Presentation/ProfilesEndpoints.cs), request records `ReplaceSocialLinksRequest`, `FriendRequestRequest`, `WarehouseInviteRequest` |
| Commands and queries | `Application/Command/ReplaceSocialLinks/`, `UploadAvatar/`, `DeleteAvatar/`, `RequestFriendship/`, `AcceptFriendRequest/`, `DeclineFriendRequest/`, `RemoveFriend/` and `CreateWarehouseInvite/` (command, handler, validator each), `Application/Queries/GetOwnProfile/`, `GetProfile/`, `GetAvatar/` and `GetWarehouseInvites/` (query, handler, DTOs each) |
| Options | `Application/Options/ProfilesOptions.cs` (`ProfilesOptions`, `AvatarOptions`, `InviteOptions`, `StorageOptions`) |
| Event handlers | `Application/Handlers/UserRegisteredEventHandler.cs`, `PlayerLevelledUpEventHandler.cs` |
| Storage seam | [`Application/Interfaces/IAvatarStorage.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Application/Interfaces/IAvatarStorage.cs), [`Infrastructure/Storage/S3AvatarStorage.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Infrastructure/Storage/S3AvatarStorage.cs) |
| Domain | [`Domain/Entities/UserProfile.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Entities/UserProfile.cs), [`SocialLink.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Entities/SocialLink.cs), [`Friendship.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Entities/Friendship.cs), [`WarehouseInvite.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Entities/WarehouseInvite.cs), [`Domain/SocialLinkPolicy.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/SocialLinkPolicy.cs), [`Domain/FriendshipPair.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/FriendshipPair.cs), [`Domain/AvatarImage.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/AvatarImage.cs), `Domain/Enums/` (`SocialPlatform`, `FriendshipStatus`), [`Domain/Exceptions/ProfilesExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Exceptions/ProfilesExceptions.cs) |
| Infrastructure | `Persistence/` (`ProfilesDbContext`, `ProfilesRepository`, `Migrations/`), `Configuration/`, `Inbox/`. No `Background/` folder: the module runs no hosted service |

[`ProfilesModuleExtensions.AddProfilesModule`](../../../Backend/src/AuctionServer.Modules.Profiles/ProfilesModuleExtensions.cs) takes the connection string and a `ProfilesOptions` instance and validates it up front: the `Avatar`, `Invites` and `Storage` sections must be present, `MaxBytes` within `[1 KiB, 5 MiB]`, `Lifetime` at least one minute, `ServiceUrl` an absolute http or https url (the scheme check matters, `Uri.TryCreate` happily parses `seaweedfs:8333` with `seaweedfs` as the scheme) and the bucket name 3 to 63 characters. The method registers `ProfilesDbContext`, the options singleton, the scoped `IProfilesRepository` and the `IAvatarStorage` singleton. It registers no hosted services, which makes Profiles the first module without an `OutboxProcessor`; see [messaging.md](messaging.md).

The Wallets side of the levels flow lives in `Modules.Wallets`: the `PlayerLevels` constants, `Wallet.RewardedLevel` and the overridden `WalletDbContext.SaveChangesAsync` that drains pending level-ups into outbox rows. See [wallets.md](wallets.md).

## Running

```bash
# from Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Profiles --startup-project src/AuctionServer.Api --context ProfilesDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Profiles --startup-project src/AuctionServer.Api --context ProfilesDbContext
dotnet test tests/AuctionServer.Modules.Profiles.Tests
```

Migrations live in [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Profiles/Infrastructure/Persistence/Migrations). `20261022112555_Initial_Profiles` creates the profile and inbox tables, `20261022160220_Add_Profiles_Socials` the owned social-links table, `20261022161705_Add_Profiles_Avatars` the three avatar columns, `20261022170106_Add_Profiles_Friendships` the friendships table with the unique pair index, `20261022170145_Add_Profiles_Warehouse_Invites` the invites table with the unique triple index and `20261022180614_Add_Profiles_Privacy` the `IsPrivate` column.

The avatar tests need Docker twice: the handlers run against the PostgreSQL Testcontainer with a `FakeAvatarStorage`, and `S3AvatarStorageTests` start a real `chrislusf/seaweedfs:4.48` container through the generic `ContainerBuilder` (`ProfilesStorageFixture`), the first non-PostgreSQL Testcontainer in the repository. `ProfilesApiSmokeTests` boot the whole host through `ProfilesCustomApi` and swap the storage for the fake with `ConfigureTestServices`.

## Configuration

The whole `Profiles` section of `appsettings.json` binds to `ProfilesOptions`, and a missing section stops the host. The level thresholds and rewards are domain constants in Wallets on purpose; configuration cannot change what a level pays.

| Key | Default | Effect |
|---|---|---|
| `Profiles:Avatar:MaxBytes` | `2097152` | maximum avatar file size, validated within `[1 KiB, 5 MiB]`; the endpoint filter caps the request body at this value plus 8 KiB of multipart overhead |
| `Profiles:Invites:Lifetime` | `00:15:00` | how long a warehouse invite stays visible, validated `>= 1 min`; expiry is read-time, nothing runs in the background |
| `Profiles:Storage:ServiceUrl` | `http://localhost:8333` | the SeaweedFS S3 gateway; Compose overrides it to `http://seaweedfs:8333` |
| `Profiles:Storage:Bucket` | `auctionserver-avatars` | created lazily on the first upload |
| `Profiles:Storage:ForcePathStyle` | `true` | path-style S3 urls (`host/bucket/key`); virtual-host style would put the bucket into the DNS name, which the Compose network cannot resolve |

## Data model

`ProfilesUserProfiles`:

| Column | Type | Notes |
|---|---|---|
| `UserId` | `uuid` | primary key, the public user id from Identity |
| `Username` | `text(64)` | snapshot from `UserRegisteredEvent`, fallback `Player` for legacy payloads without a username; relations always use ids |
| `Level` | `integer` | applied from `PlayerLevelledUpEvent`, monotonic |
| `IsPrivate` | `boolean` | default `false`; a private profile shows strangers only the username and the avatar |
| `AvatarContentType?` | `text(32)` | sniffed type, never the client's declaration |
| `AvatarHash?` | `text(64)` | SHA-256 of the stored bytes, hex; drives the `?v=` cache-buster and the ETag |
| `AvatarUpdatedOn?` | `timestamptz` | |
| `CreatedOn` | `timestamptz` | |
| `Version` | `uuid` | concurrency token, regenerated by every mutating method |

`ProfilesSocialLinks` (owned by the profile): composite primary key (`ProfileUserId`, `Platform`), `Url` `text(200)`, cascade delete from the profile. `SocialPlatform` (`Twitch = 0` ... `Website = 7`) is stored as the integer, never renumbered.

`ProfilesFriendships`:

| Column | Type | Notes |
|---|---|---|
| `PublicFriendshipId` | `uuid` | primary key, carried by the accept and decline routes |
| `RequesterId`, `AddresseeId` | `uuid` | who asked and who answers; both indexed |
| `UserLowId`, `UserHighId` | `uuid` | the same pair in canonical order with a unique index, so (A, B) and (B, A) are one relation. No SQL CHECK on purpose: .NET orders `Guid`s differently than PostgreSQL orders `uuid`s, and only the single writer's consistency matters |
| `Status` | `integer` | `Pending = 0`, `Accepted = 1`, never renumbered. Decline and remove delete the row, so no third state exists |
| `CreatedOn` | `timestamptz` | |

`ProfilesWarehouseInvites`: `Id` (`uuid`, primary key), `InviterId`, `InviteeId` (indexed), `PublicWarehouseId`, `CreatedOn`; a unique index on the (`InviterId`, `InviteeId`, `PublicWarehouseId`) triple blocks duplicates, and the repository translates the violation into a 409 like every unique-index backstop in the repository.

`ProfilesProcessedMessages` is the module's copy of the inbox table. There is no outbox table.

## API

All thirteen routes require a JWT.

| Method and route | Request | Response | Handler |
|---|---|---|---|
| `GET /api/profiles/me` | none | 200 with the own profile: username, `isPrivate`, level, `avatarUrl`, friends, incoming and outgoing pending friend requests, social links. 404 before the registration event is consumed | `GetOwnProfileQueryHandler` |
| `GET /api/profiles/{publicUserId}` | none | 200 with username, `isPrivate`, level, `avatarUrl`, accepted friends and social links; a private profile viewed by a stranger keeps only the username, `isPrivate` and `avatarUrl` and nulls the rest; 404 for players without a profile | `GetProfileQueryHandler` |
| `PUT /api/profiles/me/socials` | `{ links: [{ platform, url }] }` | 204; replaces the whole set, an empty list clears it. 400 for a seventh link, a duplicate platform, a non-https url or a host outside the platform's domain | `ReplaceSocialLinksCommandHandler` |
| `PUT /api/profiles/me/privacy` | `{ isPrivate }` | 204; idempotent, setting the value already in force does not touch the `Version` token | `SetProfilePrivacyCommandHandler` |
| `PUT /api/profiles/me/avatar` | multipart `file` | 200; the endpoint caps the body and reads the form itself, the bytes are sniffed, the declared content type is ignored. 400 for anything but jpeg, png or webp, 413 over the size limit, 503 when the storage is unreachable | `UploadAvatarCommandHandler` |
| `DELETE /api/profiles/me/avatar` | none | 204, idempotent | `DeleteAvatarCommandHandler` |
| `GET /api/profiles/{publicUserId}/avatar` | none | 200 streaming the bytes with the sniffed `Content-Type`, `X-Content-Type-Options: nosniff`, an `ETag` from the hash and `Cache-Control: private, max-age=86400`; 404 without an avatar or when the object vanished from storage | `GetAvatarQueryHandler` |
| `POST /api/profiles/friends/requests` | `{ userId }` | 201 with `publicFriendshipId` and `status`. A cross request (the target already asked the caller) auto-accepts and returns the existing relation as `Accepted`. 400 for self, 404 for an unknown player, 409 for a duplicate or a full friend list (100) | `RequestFriendshipCommandHandler` |
| `POST /api/profiles/friends/requests/{publicFriendshipId}/accept` | none | 200; only the addressee can accept, anyone else gets 404 so the route leaks nothing | `AcceptFriendRequestCommandHandler` |
| `POST /api/profiles/friends/requests/{publicFriendshipId}/decline` | none | 200; deletes the row, so a later re-request works. Only the addressee, others get 404 | `DeclineFriendRequestCommandHandler` |
| `DELETE /api/profiles/friends/{userId}` | none | 204; removes an accepted friendship or cancels a pending one and deletes the pair's warehouse invites in the same save. 404 when no relation exists | `RemoveFriendCommandHandler` |
| `POST /api/profiles/warehouse-invites` | `{ friendUserId, publicWarehouseId }` | 201; requires an accepted friendship (409 otherwise), purges expired invites first and answers 409 for a live duplicate | `CreateWarehouseInviteCommandHandler` |
| `GET /api/profiles/warehouse-invites` | none | 200 with the non-expired invites addressed to the caller, inviter username included, newest first | `GetWarehouseInvitesQueryHandler` |

## Avatars and SeaweedFS

The upload pipeline is defence in layers. The endpoint reads the form itself: it first caps the request body through `IHttpMaxRequestBodySizeFeature` at `MaxBytes` plus 8 KiB of multipart overhead and only then calls `ReadFormAsync`, so Kestrel aborts an oversized read with a 413 before the server buffers it (the host maps `BadHttpRequestException` to its own status code). The order is the point: minimal-API endpoint filters run after argument binding, so a bound `IFormFile` parameter would read the whole body before any filter could set the limit; the E2E probe caught exactly that, a 3 MB upload answered 400 from the handler instead of 413 from Kestrel, and the manual read is the fix. Reading the form by hand also means no bound form parameter, so the endpoint needs no antiforgery exemption, which `IFormFile` binding would demand since .NET 8. The handler re-checks the length, then [`AvatarImage.Sniff`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/AvatarImage.cs) identifies the format by magic bytes: `FF D8 FF` for jpeg, the full 8-byte png signature, `RIFF` at bytes 0-3 plus `WEBP` at 8-11 for webp. Everything else is rejected, the client's declared content type is never trusted, and SVG is rejected deliberately because a served SVG executes scripts (stored XSS). `ProfilesApiSmokeTests` proves a real multipart request answers 200 through the whole host pipeline.

Storage is SeaweedFS spoken to through its S3 gateway with `AWSSDK.S3` behind the `IAvatarStorage` seam. The object key is stable, `avatars/{userId:N}`, and a new upload overwrites it, so no orphan class exists. Object storage answers only exact-key GET and prefix listing, never queries by metadata, so every queryable fact about the avatar (type, hash, date) is a column on the profile row and the storage holds just the bytes with their `Content-Type`. The SHA-256 hash column feeds the `?v={first 12 hex}` cache-buster in `avatarUrl` and the ETag of the download proxy.

[`S3AvatarStorage`](../../../Backend/src/AuctionServer.Modules.Profiles/Infrastructure/Storage/S3AvatarStorage.cs) builds the client lazily (the constructor never touches the network, so host startup cannot fail on a dead storage), points it at `ServiceUrl` with `ForcePathStyle` and anonymous credentials, and sets both checksum modes to `WHEN_REQUIRED` because the SDK v4 default appends CRC trailers that S3-compatible stores reject. The bucket is created lazily on the first upload under a `SemaphoreSlim` with double-checked locking, tolerating `BucketAlreadyOwnedByYou`; the spike showed SeaweedFS does not auto-create buckets on object PUT. Network failures are translated into a 503 `AvatarStorageUnavailableException`, so a dead storage breaks avatar calls only, never the host. The handler writes storage first and the database second: there is no cross-system transaction, and the benign failure mode is an overwritten object with stale metadata, repaired by the next upload.

In Compose the `seaweedfs` service runs the pinned image `chrislusf/seaweedfs:4.48` with `server -s3 -dir=/data`, a named volume and a healthcheck, and publishes **no ports**: the gateway runs without authentication, so the Compose network is its only guard, and the API reaches it as `http://seaweedfs:8333`. See [infrastructure.md](../infrastructure.md).

## Levels

Levels are computed in Wallets, where the money lives, and only displayed here. Reaching `1000 * n^2` lifetime turnover awards level `n` and pays `10 * n^2` straight into `AvailableFunds`; both formulas and the 100-level cap are domain constants in `PlayerLevels` ([wallets.md](wallets.md)). Each award emits a `PlayerLevelledUpEvent` with absolute `PreviousLevel` and `NewLevel`, and `UserProfile.ApplyLevel` is monotonic: a lower or equal level is a full no-op, so outbox retries delivering events out of order cannot regress the profile, and the equal case does not even touch the `Version` token.

## Friends and warehouse invites

A friendship is one row for one pair. `FriendshipPair.Normalize` orders the two ids canonically into `UserLowId` and `UserHighId`, and the unique index on that pair makes (A, B) and (B, A) the same relation, whichever side asked. A request starts `Pending`; the addressee accepts (anyone else gets 404, so the route does not reveal whether the id exists) or declines, and decline deletes the row. When B requests A while A's request to B is still pending, the handler accepts the existing relation instead of throwing: both sides have expressed the intent, so the extra click would be ritual. A player can hold `Friendship.MaxFriends = 100` accepted friendships; the gate is checked for both sides at request time. Cash gifts between friends are the existing open `POST /api/wallets/transfers`, fee-free and turnover-free, so Profiles adds no money code.

A warehouse invite is a pointer, not a reservation: creating one checks the accepted friendship and the unique triple but never talks to Warehouses, reserves no lobby seat and does not verify the war still exists. The invitee reads the invites, opens the warehouse and joins through the normal `POST /api/warehouses/{id}/join`. Expiry is read-time, the list shows rows younger than `Profiles:Invites:Lifetime`, and the create handler opportunistically `ExecuteDeleteAsync`-purges expired rows before inserting, which keeps the unique triple from rejecting a re-invite blocked only by a dead row. Removing a friend deletes the pair's invites in the same save.

## Privacy

A profile is public by default. `PUT /api/profiles/me/privacy` flips `UserProfile.IsPrivate`, and `GetProfileQueryHandler` applies the rule at read time: the owner and accepted friends always get the full profile, while a stranger viewing a private profile receives only the username, the `isPrivate` flag and the `avatarUrl`, with the level, the member-since date, the friends and the social links nulled or empty. Friendship is checked through the same canonical pair lookup the invite handler uses, so the privacy read adds one indexed query only when the profile is actually private. The avatar download route stays open because the picture is the one thing a private profile still shows.

The username stays visible on purpose: it already appears in other players' friend lists and in pending friend requests, so hiding it on the profile route alone would fake a guarantee the module cannot keep. Friend requests to a private profile remain possible, consistent with there being no block list in v1.

## Events

| Direction | Event | Handler and effect |
|---|---|---|
| consumed | `UserRegisteredEvent` | `UserRegisteredEventHandler` creates the profile with the username snapshot; a null `Username` (legacy payloads from before the field existed) falls back to `Player`. Inbox-idempotent, the profile and the inbox row are saved together |
| consumed | `PlayerLevelledUpEvent` | `PlayerLevelledUpEventHandler` loads the profile (a missing one throws 404, so the event retries and dead-letters, a visible failure over a silent skip) and applies the absolute level monotonically |

The module publishes nothing. Social links, avatars, friends and invites are synchronous writes inside the module, so Profiles is the first module with an inbox and no outbox.

## Decisions

- Consume-only module. Profiles owns no fact another module needs, so it carries no outbox, no `OutboxProcessor` and no keeper, the first departure from the eight-copies rule; a future publisher would add the standard outbox copy back.
- Levels live in Wallets, display lives in Profiles. The award must be atomic with the money, so the level logic sits next to `LifetimeTurnover` behind the same save, and Profiles only mirrors the result.
- SeaweedFS behind a seam. `IAvatarStorage` keeps AWS types out of Domain and Application; the S3 dialect makes the storage swappable (MinIO, real S3) by changing one adapter and one options section.
- Object storage holds bytes, PostgreSQL holds facts. The storage is queried only by the stable key `avatars/{userId:N}`; everything the API filters or versions by (type, hash, date) is a profile column, because S3-style storage cannot filter by metadata.
- Content sniffing over declared types. The client's `Content-Type` is attacker-controlled; magic bytes decide, SVG is banned as XSS, and the proxy adds `nosniff` so browsers do not second-guess.
- Friend money stays in Wallets. Gifts reuse the open transfers endpoint, which already skips fees and turnover, so no new money path and no new gate to audit.
- Invites are pointers. No seat reservation and no saga with Warehouses; a stale invite costs one click on a dead lobby, a reservation would cost a cross-module protocol.
- The username is a snapshot. Nothing updates usernames today (`UpdateCredentials` has no callers), names are not unique, and every relation uses ids; a future rename means a new event, not a join into Identity.
- Privacy is a read-time rule, not a data change (owner decision, 2026-10-22). Accepted friends see the full private profile, because a friendship needs both sides' consent, and strangers keep the username, because friend lists and pending requests leak it anyway; hiding it in one route would be a false promise.

Accepted risks, recorded by the owner on 2026-10-22:

- Turnover can be farmed (wash trading, loan cycling, pawnshop flipping, bot `POST /funds`), so levels can be bought with patience. The quadratic thresholds with the 100-level cap bound the lifetime faucet to 3 383 500 per player against 10 000 000 turnover, rewards do not feed turnover back, and transfers never level anyone.
- Players registered before the module have no profile: their `GET /api/profiles/{id}` is 404 and their level events dead-letter. The repository stance is cleaning the dev database, a visible failure beats a silent skip.
- An invite can point at a war that filled up or ended, and expired rows lie in the table until the next create purges them.
- Avatars keep EXIF metadata (no re-encoding in v1), the avatar GET needs a JWT (a future `<img src>` needs a blob fetch), SeaweedFS is a single container with a local volume, and a lost object turns the profile's avatar into a 404.
- No rate limit on friend requests and no block list in v1; a decline deletes the row, so the same player can ask again.

## Related documents

- [README.md](README.md) - backend overview, running, configuration, tests.
- [messaging.md](messaging.md) - outbox, inbox, retry policy, the event registry.
- [wallets.md](wallets.md) - `PlayerLevels`, `RewardedLevel` and the level-up outbox drain.
- [identity.md](identity.md) - `UserRegisteredEvent` and the username snapshot.
- [warehouses.md](warehouses.md) - the wars the invites point at.
- [../infrastructure.md](../infrastructure.md) - the SeaweedFS service in Compose.
