# AuctionServer

> Wersja polska. Angielski odpowiednik: [README.md](README.md)

**AuctionServer** to zgamifikowany dom aukcyjny zbudowany jako **modular monolith w .NET 10 na PostgreSQL**: użytkownicy rejestrują się, dostają wirtualny portfel, zbierają i craftują przedmioty oraz handlują nimi przez aukcje czasowe z ochroną anty-snajperską, automatycznym zamykaniem i rozliczeniem dokładnie raz. To projekt portfolio i nauki, w którym chodzi o architekturę: ścisłe granice modułów, integrację przez zdarzenia z transakcyjnym outboxem i inboxem oraz gwarancje poprawności (idempotencja, optymistyczna współbieżność, atomowe zapisy), które projekty demo zwykle pomijają.

## Status

Backend jest kompletny dla głównego przepływu: cztery moduły (Identity, Wallets, Auctions, Inventory), 13 endpointów, 9 zdarzeń integracyjnych, 214 metod testowych i pipeline GitLab CI. Frontend Angular, boty AI, API gateway i RabbitMQ są planowane i nierozpoczęte; saga rezerwacji środków dla ofert jest zaprojektowana i niezaimplementowana. Bieżący stan: [docs/pl/STATE.md](docs/pl/STATE.md).

## Szybki start

Uruchomienie systemu to dziś cztery kroki, bo nie ma jeszcze pliku Compose, a migracje nie są aplikowane na starcie. Wymagania są wymienione niżej; wszystkie komendy `dotnet` uruchamia się z `Backend/`.

```bash
# 1. PostgreSQL
docker run -d --name auction_db -p 6767:5432 -e POSTGRES_USER=<user> -e POSTGRES_PASSWORD=<pass> -e POSTGRES_DB=AuctionDb postgres:16-alpine

# 2. Sekrety
cd Backend
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=6767;Database=AuctionDb;Username=<user>;Password=<pass>" --project src/AuctionServer.Api
dotnet user-secrets set "Jwt:Key" "<losowy ciąg, co najmniej 32 znaki>" --project src/AuctionServer.Api
dotnet user-secrets set "Bots:ApiKey" "<losowy ciąg>" --project src/AuctionServer.Api

# 3. Schemat, jedna komenda na kontekst modułu
dotnet ef database update --project src/AuctionServer.Modules.Identity --startup-project src/AuctionServer.Api --context IdentityDbContext
dotnet ef database update --project src/AuctionServer.Modules.Wallets --startup-project src/AuctionServer.Api --context WalletDbContext
dotnet ef database update --project src/AuctionServer.Modules.Auctions --startup-project src/AuctionServer.Api --context AuctionDbContext
dotnet ef database update --project src/AuctionServer.Modules.Inventory --startup-project src/AuctionServer.Api --context InventoryDbContext

# 4. Uruchomienie
dotnet run --project src/AuctionServer.Api        # http://localhost:5244
```

Potem `POST /api/users/register`, `POST /api/users/login` i reszta wywołań ze zwróconym tokenem; endpointy są wymienione w [docs/pl/backend/README.md](docs/pl/backend/README.md).

<details>
<summary>Testy</summary>

```bash
dotnet test AuctionServer.slnx      # każdy projekt stawia PostgreSQL przez Testcontainers, więc Docker musi działać
```

</details>

## Wymagania

- .NET SDK 10.0 i narzędzie `dotnet-ef` (`dotnet tool install --global dotnet-ef`)
- Docker, dla PostgreSQL i dla testów opartych na Testcontainers
- Node.js 18+ i Python 3 tylko do przerenderowania diagramów dokumentacji

## Dokumentacja

Dwujęzyczna EN/PL, struktura 1:1: [docs/en](docs/en) / [docs/pl](docs/pl). Zacznij od indeksu.

- [Indeks](docs/pl/README.md) - kolejność czytania i mapa każdej strony
- [Architektura](docs/pl/ARCHITECTURE.md) - kontekst systemu, moduły, przepływy aukcji, model danych, CI i znane ograniczenia, z diagramami
- [Backend](docs/pl/backend/README.md) - projekty, uruchomienie, konfiguracja, pipeline żądania, testy i jeden rozdział na moduł
- [Wizja](docs/pl/VISION.md) - słowniczek, docelowy system, co jest planowane dalej
- [Konwencje](docs/pl/CONVENTIONS.md) - jak utrzymywane są kod, testy i dokumentacja
- [Decyzje](docs/pl/DECISIONS.md) i [ADR-y](docs/pl/adr) - dlaczego jest zbudowany w ten sposób
- [Stan](docs/pl/STATE.md) i [Historia zmian](docs/pl/CHANGELOG.md) - gdzie projekt stoi i jak tu doszedł
- [Frontend](docs/pl/frontend.md), [Boty](docs/pl/bots.md), [Infrastruktura](docs/pl/infrastructure.md) - moduły planowane
