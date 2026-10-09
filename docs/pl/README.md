# Dokumentacja AuctionServer

> Wersja polska. Angielski odpowiednik 1:1: [../en/README.md](../en/README.md)

AuctionServer to zgamifikowany dom aukcyjny zbudowany jako modular monolith w .NET 10 na PostgreSQL: cztery moduły w jednym procesie, rozmawiające przez transakcyjny outbox i inbox. Te strony opisują, jak system jest złożony, jak przechodzi przez niego aukcja i co jest planowane; są pisane dla dewelopera, który otwiera repozytorium po raz pierwszy. Każda strona istnieje po angielsku i po polsku w tej samej strukturze.

## Kolejność czytania

1. [ARCHITECTURE.md](ARCHITECTURE.md) - kontekst systemu, moduły, trzy przepływy aukcji, model danych i znane ograniczenia. Zacznij tutaj.
2. [backend/README.md](backend/README.md) - projekty, uruchomienie i konfiguracja hosta, pipeline żądania, kontrakt błędów i testy.
3. [backend/messaging.md](backend/messaging.md) - outbox, inbox, polityka ponowień i katalog zdarzeń integracyjnych.
4. [backend/auctions.md](backend/auctions.md), [backend/inventory.md](backend/inventory.md), [backend/wallets.md](backend/wallets.md), [backend/identity.md](backend/identity.md) - jeden rozdział na moduł.
5. [STATE.md](STATE.md) i [VISION.md](VISION.md) - gdzie projekt stoi i dokąd zmierza.
6. [CONVENTIONS.md](CONVENTIONS.md), [DECISIONS.md](DECISIONS.md) i [adr/](adr) - reguły i powody.
7. [frontend.md](frontend.md), [bots.md](bots.md), [infrastructure.md](infrastructure.md) - moduły, które jeszcze nie istnieją.

## Mapa

| Dokument | Odpowiada na pytanie |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Jakie są ruchome części, jak przechodzi przez nie aukcja, gdzie są granice? |
| [backend/README.md](backend/README.md) | Jakie projekty istnieją, jak uruchomić i skonfigurować backend, przez co przechodzi żądanie, jak zorganizowane są testy? |
| [backend/messaging.md](backend/messaging.md) | Jak rozmawiają moduły, co się dzieje, gdy handler zawiedzie, jakie zdarzenia istnieją? |
| [backend/auctions.md](backend/auctions.md) | Jak aukcje są tworzone, aktywowane, licytowane i zamykane oraz jak są czytane? |
| [backend/inventory.md](backend/inventory.md) | Czym jest przedmiot, jak przedmioty są tworzone, craftowane, sprzedawane, blokowane i przenoszone? |
| [backend/wallets.md](backend/wallets.md) | Jak pieniądze są blokowane, odblokowywane, wydawane i dopisywane oraz co nigdy nie może się stać z saldem? |
| [backend/identity.md](backend/identity.md) | Jak działają rejestracja, logowanie, JWT i provisioning botów? |
| [VISION.md](VISION.md) | Czym jest produkt, co znaczą pojęcia, co jest planowane dalej? |
| [CONVENTIONS.md](CONVENTIONS.md) | Jak utrzymywane są kod, testy i dokumentacja, czym jest definition of done? |
| [DECISIONS.md](DECISIONS.md) | Jakie decyzje podjęto kiedy i dlaczego? |
| [adr/](adr) | Cztery decyzje o trwałych konsekwencjach, w formie kontekst, decyzja i konsekwencje. |
| [STATE.md](STATE.md) | Co istnieje w tej chwili, jakie jest środowisko, jaki jest następny krok? |
| [CHANGELOG.md](CHANGELOG.md) | Jak projekt tu doszedł, kamień milowy po kamieniu milowym? |
| [frontend.md](frontend.md), [bots.md](bots.md), [infrastructure.md](infrastructure.md) | Co jest planowane dla każdego brakującego modułu i co backend już mu oferuje? |
| [../diagrams/README.md](../diagrams/README.md) | Jak diagramy są tworzone i przerenderowywane? |

## Konwencje

- Każda strona w `docs/en/` ma polskiego bliźniaka w `docs/pl/` o tej samej nazwie pliku, tej samej liczbie linii i tych samych nagłówkach; linia 3 każdej strony linkuje do drugiego języka.
- Diagramy są tworzone w [Mermaid](https://mermaid.js.org/) w [`../diagrams/src/`](../diagrams/src) i commitowane jako wyrenderowane SVG w wariancie jasnym i ciemnym, osadzane przez `<picture>`, dzięki czemu GitLab i GitHub pokazują wariant pasujący do motywu czytelnika w pełnym rozmiarze. Kolory są spójne na wszystkich stronach: pomarańczowy dla klientów, indygo dla hosta, bursztynowy dla Identity, zielony dla Wallets, niebieski dla Auctions, różowy dla Inventory, szaroniebieski dla części wspólnych, fioletowy dla PostgreSQL i przerywany szary dla części planowanych. Po edycji źródła uruchom `python3 docs/diagrams/render.py`.
- Kod jest przywoływany relatywnymi linkami do plików, a nie numerami linii, więc linki pozostają ważne, gdy pliki się zmieniają; identyfikatory są cytowane dokładnie tak, jak występują w kodzie.
- Wszystko w repozytorium jest pisane po angielsku; strona `docs/pl` to jedyny tekst po polsku.

Uruchomienie projektu jest opisane w [głównym README](../../README.pl.md#szybki-start).

## Powiązane dokumenty

- [../../README.pl.md](../../README.pl.md) - front door repozytorium.
- [../diagrams/README.md](../diagrams/README.md) - toolchain diagramów.
