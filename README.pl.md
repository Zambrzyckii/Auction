# AuctionServer

> Wersja polska. Angielski odpowiednik: [README.md](README.md)

**AuctionServer** to zgamifikowany dom aukcyjny zbudowany jako **modular monolith w .NET 10 na PostgreSQL**: użytkownicy rejestrują się, dostają wirtualny portfel, zbierają i craftują przedmioty, handlują nimi przez aukcje czasowe z ochroną anty-snajperską, automatycznym zamykaniem i rozliczeniem dokładnie raz, licytują w szybkich wojnach magazynowych o ukrytą zawartość, biorą pożyczki bankowe bramkowane całkowitym obrotem rynkowym, zarabiają pasywnie w lombardzie obsadzonym przez boty, przegrywają pieniądze w kasynie z ruletką i blackjackiem oraz pokazują to wszystko na profilu z poziomami napędzanymi obrotem, awatarem i znajomymi. To projekt portfolio i nauki, w którym chodzi o architekturę: ścisłe granice modułów, integrację przez zdarzenia z transakcyjnym outboxem i inboxem oraz gwarancje poprawności (idempotencja, optymistyczna współbieżność, atomowe zapisy), które projekty demo zwykle pomijają.

## Status

Backend jest kompletny dla głównego przepływu: dziewięć modułów (Identity, Wallets, Auctions, Inventory, Warehouses, Banking, Pawnshop, Casino, Profiles), 51 endpointów, 37 zdarzeń integracyjnych, 741 metod testowych i pipeline'y CI dla GitLaba i GitHub Actions. Frontend Angular, boty AI, API gateway i RabbitMQ są planowane i nierozpoczęte. Bieżący stan: [docs/pl/STATE.md](docs/pl/STATE.md).

## Szybki start

```bash
docker compose up -d        # PostgreSQL + SeaweedFS + API na http://localhost:8080, migracje aplikowane na starcie
```

Potem `POST /api/users/register`, `POST /api/users/login` i reszta wywołań ze zwróconym tokenem; endpointy są wymienione w [docs/pl/backend/README.md](docs/pl/backend/README.md). Ręczna ścieżka pod IDE (lokalny PostgreSQL, user secrets, migracje per moduł, `dotnet run`) jest opisana w [docs/pl/backend/README.md#uruchomienie](docs/pl/backend/README.md#uruchomienie).

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
