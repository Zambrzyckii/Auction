# Moduł Profiles

> Wersja polska. Angielski odpowiednik 1:1: [../../en/backend/profiles.md](../../en/backend/profiles.md)

`AuctionServer.Modules.Profiles` to dziewiąty moduł i warstwa społecznościowa gry: publiczny profil gracza ze snapshotem nazwy, poziom zdobywany z obrotu portfela, awatar przechowywany w SeaweedFS, do sześciu kont społecznościowych, znajomi z zaproszeniami i akceptacją, zaproszenia znajomych do wojen magazynowych oraz przełącznik prywatności, który ukrywa przed obcymi wszystko poza nazwą i awatarem. To pierwszy moduł **wyłącznie konsumujący**: nie publikuje żadnych zdarzeń, więc nie ma tabeli outboxa, nie ma `OutboxProcessor`a ani keepera, jedynie inbox `ProfilesProcessedMessages`. Trzynaście endpointów żyje pod `/api/profiles`, wszystkie za JWT.

## Przegląd

| Obszar | Pliki |
|---|---|
| Endpointy | [`Presentation/ProfilesEndpoints.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Presentation/ProfilesEndpoints.cs), rekordy żądań `ReplaceSocialLinksRequest`, `FriendRequestRequest`, `WarehouseInviteRequest` |
| Komendy i zapytania | `Application/Command/ReplaceSocialLinks/`, `UploadAvatar/`, `DeleteAvatar/`, `RequestFriendship/`, `AcceptFriendRequest/`, `DeclineFriendRequest/`, `RemoveFriend/` i `CreateWarehouseInvite/` (komenda, handler, walidator w każdym), `Application/Queries/GetOwnProfile/`, `GetProfile/`, `GetAvatar/` i `GetWarehouseInvites/` (zapytanie, handler, DTO w każdym) |
| Opcje | `Application/Options/ProfilesOptions.cs` (`ProfilesOptions`, `AvatarOptions`, `InviteOptions`, `StorageOptions`) |
| Handlery zdarzeń | `Application/Handlers/UserRegisteredEventHandler.cs`, `PlayerLevelledUpEventHandler.cs` |
| Szew storage | [`Application/Interfaces/IAvatarStorage.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Application/Interfaces/IAvatarStorage.cs), [`Infrastructure/Storage/S3AvatarStorage.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Infrastructure/Storage/S3AvatarStorage.cs) |
| Domena | [`Domain/Entities/UserProfile.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Entities/UserProfile.cs), [`SocialLink.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Entities/SocialLink.cs), [`Friendship.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Entities/Friendship.cs), [`WarehouseInvite.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Entities/WarehouseInvite.cs), [`Domain/SocialLinkPolicy.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/SocialLinkPolicy.cs), [`Domain/FriendshipPair.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/FriendshipPair.cs), [`Domain/AvatarImage.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/AvatarImage.cs), `Domain/Enums/` (`SocialPlatform`, `FriendshipStatus`), [`Domain/Exceptions/ProfilesExceptions.cs`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/Exceptions/ProfilesExceptions.cs) |
| Infrastruktura | `Persistence/` (`ProfilesDbContext`, `ProfilesRepository`, `Migrations/`), `Configuration/`, `Inbox/`. Bez folderu `Background/`: moduł nie uruchamia żadnego hosted service |

[`ProfilesModuleExtensions.AddProfilesModule`](../../../Backend/src/AuctionServer.Modules.Profiles/ProfilesModuleExtensions.cs) przyjmuje connection string i instancję `ProfilesOptions` i waliduje ją z góry: sekcje `Avatar`, `Invites` i `Storage` muszą istnieć, `MaxBytes` w `[1 KiB, 5 MiB]`, `Lifetime` co najmniej minuta, `ServiceUrl` jako absolutny url http lub https (sprawdzenie schematu ma znaczenie, `Uri.TryCreate` chętnie parsuje `seaweedfs:8333` ze schematem `seaweedfs`) i nazwa bucketa od 3 do 63 znaków. Metoda rejestruje `ProfilesDbContext`, singleton opcji, scoped `IProfilesRepository` oraz singleton `IAvatarStorage`. Nie rejestruje żadnych hosted services, co czyni Profiles pierwszym modułem bez `OutboxProcessor`a; zobacz [messaging.md](messaging.md).

Strona Wallets przepływu poziomów żyje w `Modules.Wallets`: stałe `PlayerLevels`, `Wallet.RewardedLevel` i nadpisane `WalletDbContext.SaveChangesAsync`, które drenuje oczekujące awanse do wierszy outboxa. Zobacz [wallets.md](wallets.md).

## Uruchamianie

```bash
# z Backend/
dotnet ef migrations add <Name> --project src/AuctionServer.Modules.Profiles --startup-project src/AuctionServer.Api --context ProfilesDbContext --output-dir Infrastructure/Persistence/Migrations
dotnet ef database update --project src/AuctionServer.Modules.Profiles --startup-project src/AuctionServer.Api --context ProfilesDbContext
dotnet test tests/AuctionServer.Modules.Profiles.Tests
```

Migracje żyją w [`Infrastructure/Persistence/Migrations/`](../../../Backend/src/AuctionServer.Modules.Profiles/Infrastructure/Persistence/Migrations). `20261022112555_Initial_Profiles` tworzy tabele profilu i inboxa, `20261022160220_Add_Profiles_Socials` tabelę owned kont społecznościowych, `20261022161705_Add_Profiles_Avatars` trzy kolumny awatara, `20261022170106_Add_Profiles_Friendships` tabelę znajomości z unikalnym indeksem pary, `20261022170145_Add_Profiles_Warehouse_Invites` tabelę zaproszeń z unikalnym indeksem trójki, a `20261022180614_Add_Profiles_Privacy` kolumnę `IsPrivate`.

Testy awatarów potrzebują Dockera dwa razy: handlery biegną na Testcontainerze PostgreSQL z `FakeAvatarStorage`, a `S3AvatarStorageTests` stawiają prawdziwy kontener `chrislusf/seaweedfs:4.48` przez generyczny `ContainerBuilder` (`ProfilesStorageFixture`), pierwszy nie-postgresowy Testcontainer w repozytorium. `ProfilesApiSmokeTests` bootują całego hosta przez `ProfilesCustomApi` i podmieniają storage na fake przez `ConfigureTestServices`.

## Konfiguracja

Cała sekcja `Profiles` z `appsettings.json` binduje się do `ProfilesOptions`, a brak sekcji zatrzymuje hosta. Progi i nagrody poziomów są celowo stałymi domeny w Wallets; konfiguracja nie może zmienić, ile płaci poziom.

| Klucz | Domyślnie | Działanie |
|---|---|---|
| `Profiles:Avatar:MaxBytes` | `2097152` | maksymalny rozmiar pliku awatara, walidowany w `[1 KiB, 5 MiB]`; endpoint ogranicza body żądania do tej wartości plus 8 KiB narzutu multipart |
| `Profiles:Invites:Lifetime` | `00:15:00` | jak długo widoczne jest zaproszenie magazynowe, walidowane `>= 1 min`; wygasanie jest odczytowe, nic nie działa w tle |
| `Profiles:Storage:ServiceUrl` | `http://localhost:8333` | bramka S3 SeaweedFS; Compose nadpisuje na `http://seaweedfs:8333` |
| `Profiles:Storage:Bucket` | `auctionserver-avatars` | tworzony leniwie przy pierwszym uploadzie |
| `Profiles:Storage:ForcePathStyle` | `true` | ścieżkowe adresy S3 (`host/bucket/klucz`); styl virtual-host wstawiłby bucket do nazwy DNS, której sieć Compose nie rozwiąże |

## Model danych

`ProfilesUserProfiles`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `UserId` | `uuid` | klucz główny, publiczne id użytkownika z Identity |
| `Username` | `text(64)` | snapshot z `UserRegisteredEvent`, fallback `Player` dla starych payloadów bez nazwy; relacje zawsze po id |
| `Level` | `integer` | nakładany z `PlayerLevelledUpEvent`, monotonicznie |
| `IsPrivate` | `boolean` | domyślnie `false`; profil prywatny pokazuje obcym tylko nazwę i awatar |
| `AvatarContentType?` | `text(32)` | typ ze sniffowania, nigdy deklaracja klienta |
| `AvatarHash?` | `text(64)` | SHA-256 zapisanych bajtów, hex; napędza cache-buster `?v=` i ETag |
| `AvatarUpdatedOn?` | `timestamptz` | |
| `CreatedOn` | `timestamptz` | |
| `Version` | `uuid` | token współbieżności, regenerowany przez każdą metodę mutującą |

`ProfilesSocialLinks` (owned przez profil): złożony klucz główny (`ProfileUserId`, `Platform`), `Url` `text(200)`, kasowanie kaskadowe z profilu. `SocialPlatform` (`Twitch = 0` ... `Website = 7`) jest zapisywany jako liczba i nigdy nie przenumerowywany.

`ProfilesFriendships`:

| Kolumna | Typ | Uwagi |
|---|---|---|
| `PublicFriendshipId` | `uuid` | klucz główny, niesiony przez trasy accept i decline |
| `RequesterId`, `AddresseeId` | `uuid` | kto pyta i kto odpowiada; oba indeksowane |
| `UserLowId`, `UserHighId` | `uuid` | ta sama para w porządku kanonicznym z unikalnym indeksem, więc (A, B) i (B, A) to jedna relacja. Celowo bez CHECK w SQL: .NET porządkuje `Guid`y inaczej niż PostgreSQL `uuid`, a liczy się tylko spójność jedynego pisarza |
| `Status` | `integer` | `Pending = 0`, `Accepted = 1`, nigdy nie przenumerowywany. Decline i remove kasują wiersz, więc trzeci stan nie istnieje |
| `CreatedOn` | `timestamptz` | |

`ProfilesWarehouseInvites`: `Id` (`uuid`, klucz główny), `InviterId`, `InviteeId` (indeksowane), `PublicWarehouseId`, `CreatedOn`; unikalny indeks na trójce (`InviterId`, `InviteeId`, `PublicWarehouseId`) blokuje duplikaty, a repozytorium tłumaczy naruszenie na 409, jak każdy bezpiecznik unikalnego indeksu w repozytorium.

`ProfilesProcessedMessages` to kopia tabeli inboxa tego modułu. Tabeli outboxa nie ma.

## API

Wszystkie trzynaście tras wymaga JWT.

| Metoda i trasa | Żądanie | Odpowiedź | Handler |
|---|---|---|---|
| `GET /api/profiles/me` | brak | 200 z własnym profilem: nazwa, `isPrivate`, poziom, `avatarUrl`, znajomi, przychodzące i wychodzące oczekujące zaproszenia, konta społecznościowe. 404 zanim zdarzenie rejestracji zostanie skonsumowane | `GetOwnProfileQueryHandler` |
| `GET /api/profiles/{publicUserId}` | brak | 200 z nazwą, `isPrivate`, poziomem, `avatarUrl`, zaakceptowanymi znajomymi i kontami; profil prywatny oglądany przez obcego zachowuje tylko nazwę, `isPrivate` i `avatarUrl`, a resztę nulluje; 404 dla graczy bez profilu | `GetProfileQueryHandler` |
| `PUT /api/profiles/me/socials` | `{ links: [{ platform, url }] }` | 204; wymienia cały zestaw, pusta lista czyści. 400 za siódmy link, duplikat platformy, url bez https albo host spoza domeny platformy | `ReplaceSocialLinksCommandHandler` |
| `PUT /api/profiles/me/privacy` | `{ isPrivate }` | 204; idempotentnie, ustawienie wartości już obowiązującej nie rusza tokenu `Version` | `SetProfilePrivacyCommandHandler` |
| `PUT /api/profiles/me/avatar` | multipart `file` | 200; endpoint sam ogranicza body i czyta formularz, bajty są sniffowane, deklarowany typ ignorowany. 400 za wszystko poza jpeg, png i webp, 413 ponad limit rozmiaru, 503 gdy storage nieosiągalny | `UploadAvatarCommandHandler` |
| `DELETE /api/profiles/me/avatar` | brak | 204, idempotentnie | `DeleteAvatarCommandHandler` |
| `GET /api/profiles/{publicUserId}/avatar` | brak | 200 streamując bajty ze sniffowanym `Content-Type`, `X-Content-Type-Options: nosniff`, `ETag` z hasha i `Cache-Control: private, max-age=86400`; 404 bez awatara albo gdy obiekt zniknął ze storage | `GetAvatarQueryHandler` |
| `POST /api/profiles/friends/requests` | `{ userId }` | 201 z `publicFriendshipId` i `status`. Krzyżowe zaproszenie (cel już zaprosił wołającego) auto-akceptuje i zwraca istniejącą relację jako `Accepted`. 400 za samego siebie, 404 za nieznanego gracza, 409 za duplikat albo pełną listę znajomych (100) | `RequestFriendshipCommandHandler` |
| `POST /api/profiles/friends/requests/{publicFriendshipId}/accept` | brak | 200; akceptować może tylko adresat, każdy inny dostaje 404, więc trasa niczego nie zdradza | `AcceptFriendRequestCommandHandler` |
| `POST /api/profiles/friends/requests/{publicFriendshipId}/decline` | brak | 200; kasuje wiersz, więc późniejsze ponowne zaproszenie działa. Tylko adresat, inni dostają 404 | `DeclineFriendRequestCommandHandler` |
| `DELETE /api/profiles/friends/{userId}` | brak | 204; usuwa zaakceptowaną znajomość albo anuluje oczekującą i kasuje zaproszenia magazynowe pary w tym samym zapisie. 404 gdy relacji nie ma | `RemoveFriendCommandHandler` |
| `POST /api/profiles/warehouse-invites` | `{ friendUserId, publicWarehouseId }` | 201; wymaga zaakceptowanej znajomości (inaczej 409), najpierw czyści wygasłe zaproszenia i odpowiada 409 za żywy duplikat | `CreateWarehouseInviteCommandHandler` |
| `GET /api/profiles/warehouse-invites` | brak | 200 z niewygasłymi zaproszeniami adresowanymi do wołającego, z nazwą zapraszającego, najnowsze pierwsze | `GetWarehouseInvitesQueryHandler` |

## Awatary i SeaweedFS

Pipeline uploadu to obrona warstwowa. Endpoint sam czyta formularz: najpierw ogranicza body żądania przez `IHttpMaxRequestBodySizeFeature` do `MaxBytes` plus 8 KiB narzutu multipart i dopiero wtedy woła `ReadFormAsync`, więc Kestrel zrywa za duży odczyt z 413, zanim serwer go zbuforuje (host mapuje `BadHttpRequestException` na jego własny status). Kolejność jest sednem: filtry endpointów minimal API działają po bindowaniu argumentów, więc bindowany parametr `IFormFile` przeczytałby całe body, zanim jakikolwiek filtr ustawi limit; sonda E2E złapała dokładnie to, upload 3 MB odpowiadał 400 z handlera zamiast 413 z Kestrela, a ręczny odczyt jest poprawką. Ręczne czytanie formularza oznacza też brak bindowanego parametru formularza, więc endpoint nie potrzebuje wyłączenia antiforgery, którego binding `IFormFile` wymagałby od .NET 8. Handler ponownie sprawdza długość, a potem [`AvatarImage.Sniff`](../../../Backend/src/AuctionServer.Modules.Profiles/Domain/AvatarImage.cs) rozpoznaje format po magic bytes: `FF D8 FF` dla jpeg, pełna 8-bajtowa sygnatura png, `RIFF` w bajtach 0-3 plus `WEBP` w 8-11 dla webp. Wszystko inne jest odrzucane, deklarowany typ klienta nigdy nie jest zaufany, a SVG jest odrzucone celowo, bo serwowany SVG wykonuje skrypty (stored XSS). `ProfilesApiSmokeTests` dowodzi, że prawdziwe żądanie multipart odpowiada 200 przez cały pipeline hosta.

Storage to SeaweedFS, do którego mówimy przez jego bramkę S3 klientem `AWSSDK.S3` za szwem `IAvatarStorage`. Klucz obiektu jest stabilny, `avatars/{userId:N}`, a nowy upload go nadpisuje, więc klasa sierot nie istnieje. Object storage odpowiada tylko na GET po dokładnym kluczu i listowanie po prefiksie, nigdy nie filtruje po metadanych, więc każdy przeszukiwalny fakt o awatarze (typ, hash, data) jest kolumną wiersza profilu, a storage trzyma same bajty z ich `Content-Type`. Kolumna hasha SHA-256 zasila cache-buster `?v={pierwsze 12 hex}` w `avatarUrl` i ETag proxy pobrania.

[`S3AvatarStorage`](../../../Backend/src/AuctionServer.Modules.Profiles/Infrastructure/Storage/S3AvatarStorage.cs) buduje klienta leniwie (konstruktor nigdy nie dotyka sieci, więc start hosta nie padnie na martwym storage), celuje nim w `ServiceUrl` z `ForcePathStyle` i anonimowymi poświadczeniami oraz ustawia oba tryby checksum na `WHEN_REQUIRED`, bo domyślne SDK v4 dokleja trailery CRC, które magazyny zgodne z S3 odrzucają. Bucket powstaje leniwie przy pierwszym uploadzie pod `SemaphoreSlim` z podwójnym sprawdzeniem, z tolerancją `BucketAlreadyOwnedByYou`; spike pokazał, że SeaweedFS nie tworzy bucketów automatycznie przy PUT obiektu. Awarie sieci są tłumaczone na 503 `AvatarStorageUnavailableException`, więc martwy storage psuje wyłącznie wywołania awatarowe, nigdy hosta. Handler pisze najpierw storage, potem bazę: transakcji między systemami nie ma, a łagodny tryb awarii to nadpisany obiekt z nieświeżymi metadanymi, naprawiany następnym uploadem.

W Compose serwis `seaweedfs` uruchamia przypięty obraz `chrislusf/seaweedfs:4.48` komendą `server -s3 -dir=/data`, z nazwanym wolumenem i healthcheckiem, i **nie publikuje portów**: bramka działa bez uwierzytelniania, więc sieć Compose jest jej jedyną strażą, a API sięga do niej jako `http://seaweedfs:8333`. Zobacz [infrastructure.md](../infrastructure.md).

## Poziomy

Poziomy są liczone w Wallets, tam gdzie żyją pieniądze, a tutaj tylko wyświetlane. Osiągnięcie `1000 * n^2` życiowego obrotu przyznaje poziom `n` i wypłaca `10 * n^2` wprost do `AvailableFunds`; obie formuły i limit 100 poziomów to stałe domeny w `PlayerLevels` ([wallets.md](wallets.md)). Każdy awans emituje `PlayerLevelledUpEvent` z absolutnymi `PreviousLevel` i `NewLevel`, a `UserProfile.ApplyLevel` jest monotoniczne: niższy lub równy poziom to pełny no-op, więc retry outboxa dostarczające zdarzenia w złej kolejności nie cofną profilu, a przypadek równy nie dotyka nawet tokenu `Version`.

## Znajomi i zaproszenia magazynowe

Znajomość to jeden wiersz na jedną parę. `FriendshipPair.Normalize` porządkuje oba id kanonicznie w `UserLowId` i `UserHighId`, a unikalny indeks na tej parze czyni (A, B) i (B, A) tą samą relacją, niezależnie kto pytał. Zaproszenie zaczyna jako `Pending`; adresat akceptuje (każdy inny dostaje 404, więc trasa nie zdradza, czy id istnieje) albo odrzuca, a odrzucenie kasuje wiersz. Gdy B zaprasza A, podczas gdy zaproszenie A do B wciąż wisi, handler akceptuje istniejącą relację zamiast rzucać: obie strony wyraziły intencję, więc dodatkowy klik byłby rytuałem. Gracz może mieć `Friendship.MaxFriends = 100` zaakceptowanych znajomości; brama jest sprawdzana dla obu stron przy zaproszeniu. Prezenty gotówkowe między znajomymi to istniejący otwarty `POST /api/wallets/transfers`, bez opłat i bez obrotu, więc Profiles nie dodaje żadnego kodu pieniędzy.

Zaproszenie magazynowe to wskaźnik, nie rezerwacja: utworzenie sprawdza zaakceptowaną znajomość i unikalną trójkę, ale nigdy nie rozmawia z Warehouses, nie rezerwuje miejsca w lobby i nie weryfikuje, czy wojna wciąż istnieje. Zaproszony czyta zaproszenia, otwiera magazyn i dołącza zwykłym `POST /api/warehouses/{id}/join`. Wygasanie jest odczytowe, lista pokazuje wiersze młodsze niż `Profiles:Invites:Lifetime`, a handler tworzenia oportunistycznie czyści wygasłe wiersze `ExecuteDeleteAsync` przed insertem, co chroni unikalną trójkę przed odrzuceniem ponownego zaproszenia zablokowanego wyłącznie przez martwy wiersz. Usunięcie znajomego kasuje zaproszenia pary w tym samym zapisie.

## Prywatność

Profil jest domyślnie publiczny. `PUT /api/profiles/me/privacy` przestawia `UserProfile.IsPrivate`, a `GetProfileQueryHandler` stosuje regułę przy odczycie: właściciel i zaakceptowani znajomi zawsze dostają pełny profil, obcy oglądający profil prywatny dostaje tylko nazwę, flagę `isPrivate` i `avatarUrl`, a poziom, data dołączenia, znajomi i konta społecznościowe są nullowane albo puste. Znajomość jest sprawdzana tym samym kanonicznym wyszukaniem pary, którego używa handler zaproszeń, więc odczyt prywatności dokłada jedno indeksowane zapytanie tylko wtedy, gdy profil faktycznie jest prywatny. Trasa pobrania awatara zostaje otwarta, bo zdjęcie to jedyna rzecz, którą profil prywatny nadal pokazuje.

Nazwa pozostaje widoczna celowo: i tak pojawia się na listach znajomych innych graczy i w oczekujących zaproszeniach, więc ukrycie jej na samej trasie profilu udawałoby gwarancję, której moduł nie umie dotrzymać. Zaproszenia do znajomych wysłane do profilu prywatnego nadal działają, spójnie z brakiem block listy w v1.

## Zdarzenia

| Kierunek | Zdarzenie | Handler i efekt |
|---|---|---|
| konsumowane | `UserRegisteredEvent` | `UserRegisteredEventHandler` tworzy profil ze snapshotem nazwy; `Username` null (stare payloady sprzed istnienia pola) dostaje fallback `Player`. Idempotentnie przez inbox, profil i wiersz inboxa zapisują się razem |
| konsumowane | `PlayerLevelledUpEvent` | `PlayerLevelledUpEventHandler` ładuje profil (brak profilu rzuca 404, więc zdarzenie retryuje i dead-letteruje, widoczna porażka zamiast cichego pominięcia) i nakłada absolutny poziom monotonicznie |

Moduł niczego nie publikuje. Konta społecznościowe, awatary, znajomi i zaproszenia to synchroniczne zapisy wewnątrz modułu, więc Profiles jest pierwszym modułem z inboxem bez outboxa.

## Decyzje

- Moduł wyłącznie konsumujący. Profiles nie posiada faktu potrzebnego innemu modułowi, więc nie niesie outboxa, `OutboxProcessor`a ani keepera, pierwsze odejście od reguły ośmiu kopii; przyszły publikator doda standardową kopię outboxa z powrotem.
- Poziomy żyją w Wallets, prezentacja w Profiles. Nagroda musi być atomowa z pieniędzmi, więc logika poziomów siedzi obok `LifetimeTurnover` za tym samym zapisem, a Profiles tylko odbija wynik.
- SeaweedFS za szwem. `IAvatarStorage` trzyma typy AWS z dala od Domain i Application; dialekt S3 czyni storage wymienialnym (MinIO, prawdziwe S3) przez zmianę jednego adaptera i jednej sekcji opcji.
- Object storage trzyma bajty, PostgreSQL trzyma fakty. Storage jest odpytywany wyłącznie po stabilnym kluczu `avatars/{userId:N}`; wszystko, po czym API filtruje albo wersjonuje (typ, hash, data), jest kolumną profilu, bo magazyn w stylu S3 nie umie filtrować po metadanych.
- Sniffing treści ponad deklarowane typy. `Content-Type` klienta kontroluje atakujący; decydują magic bytes, SVG jest zakazane jako XSS, a proxy dodaje `nosniff`, żeby przeglądarki nie zgadywały.
- Pieniądze znajomych zostają w Wallets. Prezenty używają otwartego endpointu przelewów, który już dziś omija opłaty i obrót, więc zero nowej ścieżki pieniędzy i nowej bramy do audytu.
- Zaproszenia są wskaźnikami. Bez rezerwacji miejsca i bez sagi z Warehouses; nieświeże zaproszenie kosztuje jeden klik w martwe lobby, rezerwacja kosztowałaby protokół między modułami.
- Nazwa użytkownika jest snapshotem. Nic dziś nie aktualizuje nazw (`UpdateCredentials` bez wywołań), nazwy nie są unikalne, a każda relacja używa id; przyszła zmiana nazwy to nowe zdarzenie, nie join do Identity.
- Prywatność to reguła odczytu, nie zmiana danych (decyzja właściciela, 2026-10-22). Zaakceptowani znajomi widzą pełny profil prywatny, bo znajomość wymaga zgody obu stron, a obcy zachowuje nazwę, bo listy znajomych i oczekujące zaproszenia i tak ją ujawniają; ukrycie jej w jednej trasie byłoby fałszywą obietnicą.

Zaakceptowane ryzyka, zapisane przez właściciela 2026-10-22:

- Obrót da się farmić (wash trading, pożyczki w kółko, obracanie lombardem, bot `POST /funds`), więc poziomy można kupić cierpliwością. Kwadratowe progi z limitem 100 poziomów ograniczają życiowy kran do 3 383 500 na gracza przy 10 000 000 obrotu, nagrody nie karmią obrotu z powrotem, a przelewy nikogo nie awansują.
- Gracze zarejestrowani przed modułem nie mają profilu: ich `GET /api/profiles/{id}` to 404, a ich zdarzenia poziomów dead-letterują. Stanowisko repozytorium to czyszczenie bazy dev, widoczna porażka bije ciche pominięcie.
- Zaproszenie może wskazywać wojnę, która się zapełniła albo skończyła, a wygasłe wiersze leżą w tabeli do następnego czyszczenia przy tworzeniu.
- Awatary zachowują metadane EXIF (bez re-enkodowania w v1), GET awatara wymaga JWT (przyszłe `<img src>` potrzebuje blob fetch), SeaweedFS to jeden kontener z lokalnym wolumenem, a zgubiony obiekt zamienia awatar profilu w 404.
- Brak rate limitu na zaproszenia znajomych i brak block listy w v1; odrzucenie kasuje wiersz, więc ten sam gracz może zapytać ponownie.

## Powiązane dokumenty

- [README.md](README.md) - przegląd backendu, uruchamianie, konfiguracja, testy.
- [messaging.md](messaging.md) - outbox, inbox, polityka retry, rejestr zdarzeń.
- [wallets.md](wallets.md) - `PlayerLevels`, `RewardedLevel` i drenaż awansów do outboxa.
- [identity.md](identity.md) - `UserRegisteredEvent` i snapshot nazwy użytkownika.
- [warehouses.md](warehouses.md) - wojny, na które wskazują zaproszenia.
- [../infrastructure.md](../infrastructure.md) - serwis SeaweedFS w Compose.
