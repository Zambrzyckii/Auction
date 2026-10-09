# AuctionServer — konwencje pracy

> Wersja polska. Angielski odpowiednik 1:1: [../en/CONVENTIONS.md](../en/CONVENTIONS.md)

To reguły, których repozytorium przestrzega dziś, wzięte z kodu i historii gita, plus reguły dokumentacji wprowadzone razem z tym zestawem dokumentów. Tam, gdzie kod odbiega od reguły, odstępstwo jest zapisane w [ARCHITECTURE.md](ARCHITECTURE.md#znane-ograniczenia), a nie ukrywane tutaj.

## 1. Repozytorium i git

- Jedna długowieczna gałąź, `main`; praca nad funkcją została raz zmergowana przez merge request GitLaba (`Create-Identity-Endpoint`), poza tym commity idą bezpośrednio.
- Komunikaty commitów to krótkie angielskie zdania opisujące zmianę (`Add inbox to Inventory Module`), bez prefiksów typu.
- Sekrety nigdy nie trafiają do repozytorium: connection string, klucz JWT i klucz API botów żyją w user secrets albo zmiennych środowiskowych; `.env` jest ignorowany, a `.env.example` dokumentuje dwie zmienne, których nic jeszcze nie czyta.
- `bin/`, `obj/`, `.idea/` i `CLAUDE.md` są ignorowane; `AuctionServer.sln.DotSettings.user` jest śledzony.

## 2. Dokumentacja

- Dokumentacja jest dwujęzyczna: każdy plik w `docs/en/` ma bliźniaka o tej samej nazwie w `docs/pl/`, z tą samą liczbą linii, tymi samymi nagłówkami na tych samych liniach i tymi samymi wierszami tabel; główny `README.md` tworzy parę z `README.pl.md`.
- Linia 3 każdej strony to przełącznik języka (`> English version. Polish 1:1 counterpart: ...` / `> Wersja polska. Angielski odpowiednik 1:1: ...`); ADR-y niosą link w punkcie **Status**.
- Jeden akapit to jedna linia, żeby oba języki dało się porównać linia po linii; identyfikatory, ścieżki, porty i komendy zostają po angielsku w obu.
- Kod jest przywoływany relatywnymi linkami do plików, nigdy numerami linii; identyfikatory są cytowane dokładnie tak, jak występują w kodzie.
- Diagramy to źródła Mermaid w `docs/diagrams/src/`, nazwane `<page>-<nn>-<section>.mmd`, renderowane przez `python3 docs/diagrams/render.py` do jasnego i ciemnego SVG i osadzane przez `<picture>`; etykiety są wyłącznie angielskie i wspólne dla obu języków. Diagram wprowadza jedno zdanie, a po nim następują numerowane kroki albo akapit wyjaśniający.
- Każda strona kończy się `## Powiązane dokumenty`. Rozdziały modułów mają układ Przegląd, Uruchomienie, Konfiguracja, Model danych, API, Zdarzenia, Decyzje.
- Dokumenty stałe i kiedy się zmieniają: `VISION.md` przy zmianach zakresu, `CONVENTIONS.md` przy zmianach reguł, `DECISIONS.md` przy każdej decyzji, `STATE.md` po każdej sesji zmieniającej stan, `CHANGELOG.md` przy kamieniach milowych, `ARCHITECTURE.md` i jego diagramy przy każdej zmianie architektury, `adr/NNN-title.md` dla decyzji o trwałych konsekwencjach (Status, Kontekst, Decyzja, Konsekwencje).

## 3. Konwencje kodu

- Jeden moduł to jeden `.csproj` z `Presentation/`, `Application/`, `Domain/` i `Infrastructure/`; host podpina go przez `Add<Name>Module` i `Map<Name>Endpoints`.
- Moduły referencują wyłącznie `AuctionServer.Shared.Integration`; nigdy nie referencują się nawzajem i nigdy nie odpytują tabel innego modułu.
- Zdarzenia integracyjne to typy `record` z `Guid EventId` jako pierwszym parametrem, rejestrowane po nazwie w `IntegrationEventTypes`; `Id` wiersza outboxa to `EventId` zdarzenia.
- Wyjątki domenowe to klasy zagnieżdżone w jednym statycznym kontenerze na moduł (`AuctionExceptions`, `WalletExceptions`, `InventoryException`, `IdentityException`) dziedziczącym po `AppException(message, statusCode)`; endpointy nie zawierają try/catch.
- Walidatory leżą obok swojej komendy (`<Command>Validator : AbstractValidator<Command>`), używają przeciążeń z lambdą dla reguł zależnych od czasu i są wykonywane przez `ValidationBehaviour`.
- Każdy agregat (`Auction`, `Wallet`, `Item`) niesie token współbieżności `Guid Version` generowany na nowo w każdej metodzie mutującej; niezmienniki są sprawdzane w encji, nie w handlerach.
- Zapisy przenoszące pieniądze lub rozliczające stan przekazują `CancellationToken.None`; odczyty przekazują token żądania.
- Nazwy tabel niosą prefiks modułu (`WalletsOutboxMessages`, `InventoryItems`); tabela `OutboxMessages` w Auctions jest starsza niż ta reguła.
- Migracje są tworzone per kontekst modułu z `--startup-project src/AuctionServer.Api` i `--output-dir` danego modułu.
- Unikalność pod warunkiem używa filtrowanego indeksu unikalnego (`HasFilter`), nie samych sprawdzeń w aplikacji.
- Polityki autoryzacji są przywoływane przez nazwy tekstowe `"Bot"` i `"BotProvisioning"`.
- Nazwy, komentarze, commity i gałęzie są po angielsku; komentarze pojawiają się tylko tam, gdzie kod nie tłumaczy się sam.

## 4. Testy

- Każdy moduł ma jeden projekt xUnit z testami offline (`Application/`, `Domain/`, `Infrastructure/`) i namespace `IntegrationTests/`, który działa na PostgreSQL uruchamianym przez Testcontainers (`postgres:latest`), nigdy na zamockowanej bazie.
- Fixtury integracyjne to fixtury kolekcji o nazwie `<Module>PostgresFixture`; testy na poziomie API używają `WebApplicationFactory<Program>` (`CustomApi`).
- Metody testowe mają nazwy `Method_WhenCondition_ShouldResult` i układ arrange, act, assert.
- CI uruchamia testy offline Auctions w `unit-tests`, a całą resztę w `integration-tests`; oba joby muszą przejść.

## 5. Konfiguracja i sekrety

- Ustawienia są czytane przez `IConfiguration`; wartości lokalne pochodzą z `dotnet user-secrets` na `src/AuctionServer.Api`, CI i kontenery używają zmiennych środowiskowych z `__`.
- Klucze wymagane: `ConnectionStrings:DefaultConnection`, `Jwt:Key` (co najmniej 32 znaki), `Bots:ApiKey`, `Wallets:StartingFunds`; `Jwt:Issuer` i `Jwt:Audience` mają domyślne wartości w `appsettings.json`.
- Migracje są aplikowane przez `dotnet ef database update`, nigdy przy starcie aplikacji.

## 6. Definition of done

1. Kod się buduje, a odpowiednie testy przechodzą, w tym testy integracyjne dotkniętego modułu.
2. Nowe lub zmienione zachowanie jest opisane w rozdziale modułu oraz, gdy przekracza moduły, w `ARCHITECTURE.md`, po angielsku i po polsku.
3. Diagramy dotknięte zmianą są zaktualizowane w `docs/diagrams/src/` i przerenderowane.
4. `STATE.md` odzwierciedla nowy stan; decyzja o trwałych konsekwencjach dostaje wiersz w `DECISIONS.md` albo ADR.
5. Parzystość `docs/en` i `docs/pl` jest zachowana (te same pliki, te same liczby linii, te same nagłówki).

## Powiązane dokumenty

- [README.md](README.md) - indeks dokumentacji.
- [ARCHITECTURE.md](ARCHITECTURE.md) - gdzie konwencje są widoczne w strukturze.
- [backend/README.md](backend/README.md) - uruchomienie, konfiguracja i testy w szczegółach.
