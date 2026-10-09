# Przegląd backendu

> Wersja polska. Angielski odpowiednik 1:1: [../../en/backend/README.md](../../en/backend/README.md)

Backend to cały kod repozytorium: rozwiązanie [`Backend/AuctionServer.slnx`](../../../Backend/AuctionServer.slnx) zawiera sześć projektów źródłowych w `src/` i cztery projekty testowe w `tests/`, wszystkie celujące w `net10.0`. Ta strona wymienia projekty i ich pakiety, układ folderów wewnątrz modułu, sposób uruchomienia i konfiguracji hosta, drogę żądania przez pipeline, kontrakt błędów i organizację testów. Każda komenda poniżej jest uruchamiana z `Backend/`.

## Projekty

| Projekt | Rola | Kluczowe pakiety | Referencje |
|---|---|---|---|
| [`AuctionServer.Api`](../../../Backend/src/AuctionServer.Api/AuctionServer.Api.csproj) | host (`Microsoft.NET.Sdk.Web`), id user-secrets `577a6cdc-f271-456d-bdda-b8da6c8d3aa5` | FluentValidation 12.1.1 z rozszerzeniami DI, MediatR 14.2.0, Microsoft.AspNetCore.Diagnostics 2.3.11, Microsoft.AspNetCore.Http 2.3.11, Microsoft.AspNetCore.OpenApi 10.0.9 (referencowany, nigdy nie rejestrowany), Microsoft.EntityFrameworkCore.Design 10.0.9 | cztery moduły |
| [`AuctionServer.Modules.Auctions`](../../../Backend/src/AuctionServer.Modules.Auctions/AuctionServer.Modules.Auctions.csproj) | aukcje i licytacja | Dapper 2.1.79, MediatR 14.2.0, Microsoft.AspNetCore.Http 2.3.11, Microsoft.EntityFrameworkCore 10.0.9, Npgsql.EntityFrameworkCore.PostgreSQL 10.0.2, Microsoft.Extensions.Hosting 11.0.0-preview.5 | `Shared.Integration`, framework reference `Microsoft.AspNetCore.App` |
| [`AuctionServer.Modules.Identity`](../../../Backend/src/AuctionServer.Modules.Identity/AuctionServer.Modules.Identity.csproj) | konta, logowanie, JWT, provisioning botów | BCrypt.Net-Next 4.2.0, FluentValidation 12.1.1, Microsoft.AspNetCore.Authentication.JwtBearer 10.0.9, EF Core 10.0.9, Npgsql 10.0.2, Hosting 11.0.0-preview.5, MediatR 14.2.0 | `Shared.Integration` |
| [`AuctionServer.Modules.Inventory`](../../../Backend/src/AuctionServer.Modules.Inventory/AuctionServer.Modules.Inventory.csproj) | przedmioty, crafting, sklep, blokady | EF Core 10.0.9, Npgsql 10.0.2, Hosting 11.0.0-preview.5, MediatR 14.2.0 | `Shared.Integration`, framework reference `Microsoft.AspNetCore.App` |
| [`AuctionServer.Modules.Wallets`](../../../Backend/src/AuctionServer.Modules.Wallets/AuctionServer.Modules.Wallets.csproj) | wirtualne środki; ma nieużywany id user-secrets `3a6d8b79-…` | EF Core 10.0.9, Npgsql 10.0.2, Hosting 11.0.0-preview.5, MediatR 14.2.0 | `Shared.Integration`, framework reference `Microsoft.AspNetCore.App` |
| [`AuctionServer.Shared.Integration`](../../../Backend/src/AuctionServer.Shared.Integration/AuctionServer.Shared.Integration.csproj) | kontrakty zdarzeń, `AppException`, szew publishera, behavior walidacji | FluentValidation 12.1.1, MediatR 14.2.0 | brak |
| `AuctionServer.Modules.{Auctions,Identity,Inventory,Wallets}.Tests` | jeden projekt xUnit na moduł | xunit 2.9.3, xunit.runner.visualstudio 3.1.4, Microsoft.NET.Test.Sdk 17.14.1, coverlet.collector 6.0.4, Testcontainers.PostgreSql 4.12.0; Identity i Wallets dodają Microsoft.AspNetCore.Mvc.Testing 10.0.9 | testowany moduł; testy Identity i Wallets referencują też `AuctionServer.Api` |

`Microsoft.Extensions.Hosting` jest przypięty do buildu preview `11.0.0-preview.5.26302.115` we wszystkich czterech modułach; reszta stosu to wydania 10.0.x.

## Układ folderów

```text
Backend/
├── AuctionServer.slnx                      rozwiązanie (format XML)
├── .env.example                            DB_USER i DB_PASSWORD, nieczytane przez nic w kodzie
├── src/
│   ├── AuctionServer.Api/                  Program.cs, appsettings*.json, Infrastructure/{Authentication,Messaging,GlobalExceptionHandler.cs}
│   ├── AuctionServer.Shared.Integration/   Events/, Exceptions/, Messaging/, Validators/
│   └── AuctionServer.Modules.<Name>/
│       ├── <Name>ModuleExtensions.cs       Add<Name>Module(): DbContext, repozytorium, serwisy tła
│       ├── Presentation/                   <Name>Endpoints.cs (grupa minimal API) i rekordy Request/
│       ├── Application/                    Commands/ lub Command/, Queries/, Handlers/ (handlery zdarzeń), Interfaces/
│       ├── Domain/                         Entities/, Enums/, Exceptions/
│       └── Infrastructure/                 Persistence/ (DbContext, repozytorium, migracje), Configurations/ lub Configuration/,
│                                           Outbox/, Inbox/, Background/OutboxProcessor.cs (+ AuctionCloser.cs w Auctions)
└── tests/
    └── AuctionServer.Modules.<Name>.Tests/ Application/, Domain/, Infrastructure/ (offline) i IntegrationTests/ (Testcontainers)
```

Nazwy folderów nie są idealnie jednolite: Auctions i Identity używają `Application/Commands/`, Inventory i Wallets `Application/Command/`; Auctions używa `Infrastructure/Configurations/`, pozostałe `Infrastructure/Configuration/`; migracje Auctions są rozdzielone między `Migrations/` (migracja początkowa i snapshot) i `Infrastructure/Migrations/`, podczas gdy pozostałe moduły trzymają je w `Infrastructure/Persistence/Migrations/`.

## Uruchomienie

Host potrzebuje osiągalnego PostgreSQL, trzech sekretów i schematu wszystkich czterech modułów; nic nie aplikuje migracji na starcie. Do kroku z migracjami wymagane jest narzędzie `dotnet ef`.

```bash
# 1. PostgreSQL (zadziała dowolna instancja; ta nasłuchuje na 6767)
docker run -d --name auction_db -p 6767:5432 -e POSTGRES_USER=<user> -e POSTGRES_PASSWORD=<pass> -e POSTGRES_DB=AuctionDb postgres:16-alpine

# 2. Sekrety, zapisane w magazynie user-secrets projektu hosta
cd Backend
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=6767;Database=AuctionDb;Username=<user>;Password=<pass>" --project src/AuctionServer.Api
dotnet user-secrets set "Jwt:Key" "<losowy ciąg, co najmniej 32 znaki>" --project src/AuctionServer.Api
dotnet user-secrets set "Bots:ApiKey" "<losowy ciąg>" --project src/AuctionServer.Api

# 3. Schemat, jedna komenda na kontekst modułu
dotnet ef database update --project src/AuctionServer.Modules.Identity --startup-project src/AuctionServer.Api --context IdentityDbContext
dotnet ef database update --project src/AuctionServer.Modules.Wallets --startup-project src/AuctionServer.Api --context WalletDbContext
dotnet ef database update --project src/AuctionServer.Modules.Auctions --startup-project src/AuctionServer.Api --context AuctionDbContext
dotnet ef database update --project src/AuctionServer.Modules.Inventory --startup-project src/AuctionServer.Api --context InventoryDbContext

# 4. Uruchomienie (http://localhost:5244, profil "http" w launchSettings.json)
dotnet run --project src/AuctionServer.Api

# 5. Testy (każdy projekt stawia PostgreSQL przez Testcontainers, więc Docker musi działać)
dotnet test AuctionServer.slnx
```

Pierwsze użyteczne wywołanie to `POST /api/users/register`, a potem `POST /api/users/login`, żeby dostać token. [`AuctionServer.Api.http`](../../../Backend/src/AuctionServer.Api/AuctionServer.Api.http) wciąż zawiera szablonowe żądanie do `/weatherforecast/`, które nie istnieje.

## Konfiguracja

Ustawienia są czytane przez `IConfiguration`, więc każdy klucz może pochodzić z `appsettings.json`, user secrets albo zmiennej środowiskowej z separatorem `__` (`ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey`), i tak dostarczają je testy integracyjne oraz dostarczałby kontener.

| Klucz | Domyślnie | Wymagany | Gdy brak | Używany przez |
|---|---|---|---|---|
| `ConnectionStrings:DefaultConnection` | brak | tak | bez sprawdzenia na starcie; pierwszy dostęp do bazy zawodzi | cztery `DbContext`y i `SqlConnectionFactory` |
| `Jwt:Key` | brak | tak, co najmniej 32 znaki | każde żądanie, także anonimowe, dostaje 500 `Unhandled error occurred`, bo opcje bearera są budowane przy każdym żądaniu i bez klucza nie da się ich zbudować; klucz krótszy niż 32 znaki pozwala hostowi działać, ale logowanie z poprawnymi danymi dostaje 500 `Server configuration error` | walidacja bearera w [`Program.cs`](../../../Backend/src/AuctionServer.Api/Program.cs), wystawianie tokenu w `LoginCommandHandler` |
| `Jwt:Issuer` | `AuctionServer` | nie | — | walidacja bearera i wystawianie tokenu |
| `Jwt:Audience` | `AuctionServer.Client` | nie | — | walidacja bearera i wystawianie tokenu |
| `Bots:ApiKey` | brak | do provisioningu botów | `POST /api/users/bots` odpowiada 401 z pustym ciałem; powód z handlera, `API key authentication is not configured`, nie trafia do odpowiedzi | [`ApiKeyAuthenticationHandler`](../../../Backend/src/AuctionServer.Api/Infrastructure/Authentication/ApiKeyAuthenticationHandler.cs) |
| `Wallets:StartingFunds` | `300` | tak, większy od zera | start rzuca `InvalidOperationException`; wartość zero lub mniejsza rzuca `ArgumentOutOfRangeException` w `AddWalletsModule` | `WalletsOptions`, konsumowane przez `UserRegisteredEventHandler` |
| `Logging:LogLevel` | `Information`, `Microsoft.AspNetCore` na `Warning` | nie | — | domyślni dostawcy logowania |

`Backend/.env.example` wymienia `DB_USER` i `DB_PASSWORD`, ale żaden kod nie czyta pliku `.env`; powyższy connection string to jedyne ustawienie bazy, które zna host.

## Pipeline żądania

Diagram pokazuje drogę żądania od łańcucha middleware'ów do handlera modułu i bazy danych.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../../diagrams/backend-01-request-pipeline.dark.svg">
  <img alt="Diagram: pipeline żądania" src="../../diagrams/backend-01-request-pipeline.svg">
</picture>

1. `UseExceptionHandler` otacza wszystko, co następuje dalej; [`GlobalExceptionHandler`](../../../Backend/src/AuctionServer.Api/Infrastructure/GlobalExceptionHandler.cs) zamienia wyjątki na opisany niżej kontrakt błędów w JSON.
2. `UseAuthentication` uruchamia domyślny schemat `JwtBearer` (klucz HS256 z `Jwt:Key`, `ValidIssuer` i `ValidAudience` z konfiguracji) oraz, gdy żądanie niesie `X-Api-Key`, schemat `ApiKey`, który porównuje nagłówek z `Bots:ApiKey` w stałym czasie i daje principal o nazwie `bot-provisioner`.
3. `UseAuthorization` stosuje `RequireAuthorization()` (dowolny uwierzytelniony użytkownik), politykę `Bot` (`RequireRole("Bot")`) albo politykę `BotProvisioning` (schemat `ApiKey` plus uwierzytelniony użytkownik), zadeklarowane na każdym endpoincie; endpointy anonimowe nie mają wymagań.
4. Endpoint, mapowany metodą `Map<Name>Endpoints` modułu, odczytuje `PublicUserId` wołającego z `ClaimTypes.NameIdentifier`, buduje komendę lub zapytanie i woła `ISender.Send`.
5. [`ValidationBehaviour<,>`](../../../Backend/src/AuctionServer.Shared.Integration/Validators/ValidationBehaviour.cs) uruchamia każdy walidator FluentValidation zarejestrowany dla typu żądania (`AddValidatorsFromAssembly` per moduł, komunikaty wymuszone w kulturze `en`) i rzuca `RequestValidationException`, gdy jakakolwiek reguła zawiedzie.
6. Handler ładuje agregaty przez repozytorium modułu, wykonuje metody domenowe i zapisuje; odpowiedzi zachowują domyślne ustawienia webowe ASP.NET Core, więc nazwy właściwości są w camelCase (`PublicAuctionId` przychodzi jako `publicAuctionId`), ciała żądań są bindowane bez względu na wielkość liter, a `JsonStringEnumConverter` zamienia wartości enumów na nazwy.

## Kontrakt błędów

Większość porażek to obiekt JSON `{ "error": "<komunikat>" }` ze statusem z tabeli. Błędy uwierzytelniania i autoryzacji oraz, w Production, błędy bindowania żądania pochodzą z frameworka i mają puste ciało; w Development minimal API rzuca zamiast tego `BadHttpRequestException`, który globalny handler zamienia na 500.

| Status | Źródło | Przykładowy komunikat |
|---|---|---|
| 400 | `RequestValidationException` (komunikaty walidatorów połączone przez `; `) i reguły domenowe, np. `InvalidBidException`, `InsufficientFundsException`, `ItemNotAvailableException` | `Price must be higher than current price` |
| 400 | `GET /api/auctions` z `limit` poza zakresem 1–100, zwracane bezpośrednio przez endpoint | `Limit must be between 1 and 100` |
| 400 | bindowanie żądania w Production: brakujący lub nienumeryczny `limit`, ciało, które nie jest poprawnym JSON-em | puste ciało |
| 401 / 403 | brakujący lub nieprawidłowy token albo klucz API; token `User` na endpoincie `Bot` | puste ciało |
| 404 | `AuctionNotFoundException`, `UserWithThisIdDontHaveWallet`, `UserOrItemDoesntExistException` | `Auction <id> not found` |
| 409 | `AuctionAlreadyExistException`, `InvalidAuctionStateTransitionException`, `ItemAlreadyExistInInventoryException`, `WalletAlreadyExistException` | `Auction already exist` |
| 409 | `DbUpdateConcurrencyException` z konfliktu tokenu `Version` | `Data corrupted, try again` |
| 500 | `MissingConfigurationException`: logowanie z poprawnymi danymi, gdy `Jwt:Key` jest krótszy niż 32 znaki | `Server configuration error` |
| 500 | każdy inny wyjątek, logowany z metodą i ścieżką; obejmuje to każde żądanie przy braku `Jwt:Key` oraz błędy bindowania w Development | `Unhandled error occurred` |

## Testy

Każdy projekt testowy ma część offline (`Application/`, `Domain/`, `Infrastructure/`: walidatory, encje, `OutboxMessage`) oraz namespace `IntegrationTests/`, który uruchamia `postgres:latest` przez Testcontainers w fixturze kolekcji o nazwie `<Module>PostgresFixture`, migruje własny kontekst modułu i uruchamia na nim handlery oraz repozytoria. Identity i Wallets dodatkowo podnoszą cały host przez `WebApplicationFactory<Program>` ([`CustomApi`](../../../Backend/tests/AuctionServer.Modules.Identity.Tests/IntegrationTests/CustomApi.cs), [`CustomAPI`](../../../Backend/tests/AuctionServer.Modules.Wallets.Tests/IntegrationTests/CustomAPI.cs)); te fabryki ustawiają `ConnectionStrings__DefaultConnection`, `Jwt__Key` oraz, w Identity, `Bots__ApiKey` jako zmienne środowiskowe procesu i migrują tylko własny kontekst, więc `OutboxProcessor`y pozostałych modułów i `AuctionCloser` logują błąd co 3 s w czasie tych testów. Metody testowe mają nazwy według `Method_WhenCondition_ShouldResult`, na przykład `ApplyNewBid_WhenSellerBidsOwnAuction_ShouldThrow`.

| Projekt | Metody testowe | Offline | Integracyjne |
|---|---|---|---|
| `AuctionServer.Modules.Auctions.Tests` | 50 | 33 | 17 |
| `AuctionServer.Modules.Identity.Tests` | 33 | 20 | 13 |
| `AuctionServer.Modules.Inventory.Tests` | 77 | 45 | 32 |
| `AuctionServer.Modules.Wallets.Tests` | 54 | 17 | 37 |

```bash
dotnet test AuctionServer.slnx                                                                       # wszystko, wymaga Dockera
dotnet test tests/AuctionServer.Modules.Auctions.Tests --filter "FullyQualifiedName!~IntegrationTests"   # testy offline jednego modułu
dotnet test tests/AuctionServer.Modules.Wallets.Tests                                                    # jeden moduł, offline + integracyjne
```

Pipeline GitLaba uruchamia pierwszy filtr dla Auctions w `unit-tests`, a pełne projekty Wallets, Identity i Inventory plus testy integracyjne Auctions w `integration-tests`; zobacz [Build i CI](../ARCHITECTURE.md#build-i-ci). Żaden test nie przekracza granicy modułu: handlery zdarzeń są wołane bezpośrednio z ręcznie zbudowanymi zdarzeniami.

## Rozdziały

1. [Komunikaty](messaging.md) - `Shared.Integration`, outbox, inbox, polityka ponowień, katalog zdarzeń.
2. [Auctions](auctions.md) - aukcje, licytacja, saga blokady przedmiotu, closer, ścieżka odczytu Dapperem.
3. [Inventory](inventory.md) - przedmioty, rzadkość, crafting, sklep, blokady i transfery.
4. [Wallets](wallets.md) - środki dostępne i zablokowane, rozliczenie.
5. [Identity](identity.md) - rejestracja, logowanie, JWT, provisioning botów.

## Powiązane dokumenty

- [../ARCHITECTURE.md](../ARCHITECTURE.md) - kontekst systemu, warstwy modułów, przepływy aukcji, model danych, CI.
- [../README.md](../README.md) - indeks dokumentacji.
- [../CONVENTIONS.md](../CONVENTIONS.md) - konwencje kodu, testów i dokumentacji.
