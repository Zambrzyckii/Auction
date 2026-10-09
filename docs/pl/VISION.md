# AuctionServer — wizja

> Wersja polska. Angielski odpowiednik 1:1: [../en/VISION.md](../en/VISION.md)

Ten dokument mówi, czym AuctionServer ma się stać, definiuje słownictwo używane w całej dokumentacji i oddziela to, co istnieje dziś, od tego, co jest planowane. To punkt wejścia dla każdego, kto decyduje, co budować dalej.

## 1. Czym jest AuctionServer

AuctionServer to zgamifikowany dom aukcyjny: zarejestrowani użytkownicy dostają portfel z wirtualnymi pieniędzmi, zbierają przedmioty czterech poziomów rzadkości, craftują je i sprzedają oraz handlują nimi przez aukcje czasowe z ochroną anty-snajperską, automatycznym zamykaniem i rozliczeniem dokładnie raz. To projekt portfolio i nauki: celem nie jest liczba funkcji, lecz backend, którego granice modułów, integracja oparta na zdarzeniach i gwarancje poprawności (idempotencja, optymistyczna współbieżność, atomowe zapisy) wytrzymują dokładne oględziny.

## 2. Słowniczek

| Termin | Znaczenie |
|---|---|
| aukcja | czasowe ogłoszenie jednego przedmiotu przez jego właściciela; statusy `Pending`, `Active`, `Closed`, `Cancelled` |
| oferta | propozycja powyżej bieżącej ceny od użytkownika, który nie jest ani sprzedawcą, ani bieżącym liderem; dziś oferta jest przyjmowana przed sprawdzeniem środków licytującego |
| okno anty-snajperskie | ostatnie 30 s aukcji; oferta w jego trakcie wydłuża `EndsOn` o 30 s |
| środki dostępne, środki zablokowane | dwa salda portfela; prowadząca oferta przenosi pieniądze z dostępnych do zablokowanych, rozliczenie wydaje część zablokowaną |
| cena oficjalna | cena przedmiotu losowana z jego rzadkości przy tworzeniu; płacona przez sklep i pokazywana na aukcji |
| poziom rzadkości | `Common`, `Rare`, `Epic`, `Legendary`; każdy poziom ma własny zakres cen |
| crafting | zużycie trzech przedmiotów jednego poziomu, żeby stworzyć jeden przedmiot kolejnego poziomu |
| sklep oficjalny | wbudowany kupiec, który płaci cenę oficjalną za każdy dostępny przedmiot |
| bot | konto z `Role.Bot`: zakładane kluczem API, tokeny 24-godzinne, może tworzyć przedmioty i dodawać środki |
| zdarzenie integracyjne | rekord w `Shared.Integration/Events/`, który jeden moduł publikuje, a inne konsumują |
| outbox, inbox | tabele per moduł, które czynią publikację atomową ze zmianą stanu, a konsumpcję idempotentną |
| martwa wiadomość | wiersz outboxa, który zawiódł pięć razy i nie jest już ponawiany |
| saga | łańcuch zdarzeń między modułami bez centralnego koordynatora, każdy krok to lokalna transakcja |
| snapshot przedmiotu | nazwa, rzadkość i cena oficjalna kopiowane na aukcję przy jej aktywacji |

## 3. Aktorzy

- **Gracz** (`Role.User`): rejestruje się, loguje po 15-minutowy token, wystawia przedmioty, licytuje, craftuje i sprzedaje do sklepu.
- **Bot** (`Role.Bot`): konto zakładane przez provisioning, z 24-godzinnym tokenem, które dodatkowo może wołać `POST /api/wallets/funds` i `POST /api/inventory/items`; przeznaczone dla planowanych botów rynkowych AI.
- **Provisioner botów**: ktokolwiek, kto ma `Bots:ApiKey`; zakłada konta botów przez `POST /api/users/bots` i nie ma rekordu użytkownika.
- `Role.Admin` istnieje w enumie, ale nigdy nie jest przypisywane ani sprawdzane.

## 4. Docelowy system

Diagram kontekstu systemu w [ARCHITECTURE.md](ARCHITECTURE.md) pokazuje cel z przerywanymi obwódkami; pochodzi on z pierwotnej notatki projektowej (`AGENTS.md`, usuniętej 2026-08-15) i poprzedniego README:

- **frontend Angular** jako interfejs użytkownika;
- **API gateway** jako jedyny punkt wejścia dla frontendu i botów;
- **backend API**, czyli istniejący dziś modular monolith, utrzymany jako jeden artefakt wdrożeniowy;
- **RabbitMQ** jako transport zdarzeń integracyjnych opuszczających monolit, wpięty w szew `IIntegrationEventPublisher`;
- **boty AI** napisane w Pythonie, które nasłuchują zdarzeń rynkowych na RabbitMQ i działają przez gateway.

## 5. Co istnieje dziś

- Identity: rejestracja, logowanie, JWT z claimem roli, provisioning botów kluczem API, miękko usuwani użytkownicy, BCrypt.
- Wallets: automatyczny portfel ze skonfigurowanymi środkami startowymi, doładowanie tylko dla botów, blokowanie, odblokowywanie i wydawanie środków, rozliczenie z inboxem i outboxem.
- Auctions: tworzenie jako `Pending` do czasu blokady przedmiotu przez Inventory, lista i szczegóły przez Dapper, licytacja z ochroną anty-snajperską, zamykanie w tle, outbox z ponowieniami i martwymi wiadomościami, inbox.
- Inventory: przedmioty z cenami zależnymi od rzadkości, crafting, sprzedaż do sklepu, blokowanie i przenoszenie przedmiotów dla aukcji, inbox i outbox.
- Przekrojowo: pipeline FluentValidation, globalny kontrakt błędów, optymistyczna współbieżność, GitLab CI z Testcontainers.

## 6. Planowane dalej

Kolejność i uzasadnienia ustali właściciel w wersji angielskiej; ta lista zostanie wtedy przetłumaczona 1:1.

- Rezerwacja środków per oferta: oferta zapisywana jako `Pending`, która zostaje liderem dopiero po potwierdzeniu przez Wallets blokady per oferta, na wzór sagi blokady przedmiotu (zaprojektowana 2026-08-30, niezaimplementowana).
- Historia ofert: tabela ofert per aukcja i `GET /api/auctions/{id}/bids`.
- Pakiet startowy przedmiotów przyznawany przy rejestracji.
- RabbitMQ jako transport zdarzeń za `IIntegrationEventPublisher`.
- Frontend Angular, boty rynkowe AI i API gateway.
- Docker Compose dla hosta i PostgreSQL, żeby projekt startował jedną komendą.

## 7. Zasady projektu

- Jeden moduł to jeden projekt z `Presentation/`, `Application/`, `Domain/` i `Infrastructure/`; `Domain/` i `Application/` pozostają wolne od typów ASP.NET Core.
- Brak referencji projektowych między modułami i brak zapytań do bazy innego modułu; moduły komunikują się wyłącznie przez zdarzenia integracyjne w `Shared.Integration`.
- Każdy moduł posiada swój `DbContext`, swoje tabele i swoje migracje; wspólna baza nie oznacza wspólnych tabel.
- Każda zmiana stanu, o której musi się dowiedzieć inny moduł, idzie przez outbox w tej samej transakcji; każdy konsument jest idempotentny.
- Wyścigi o pieniądze i stan są rozstrzygane optymistyczną współbieżnością, nigdy cichym „ostatni zapis wygrywa".

## Powiązane dokumenty

- [ARCHITECTURE.md](ARCHITECTURE.md) - jak zbudowana jest istniejąca część.
- [STATE.md](STATE.md) - gdzie projekt stoi w tej chwili.
- [DECISIONS.md](DECISIONS.md) i [adr/](adr) - dlaczego jest zbudowany w ten sposób.
- [frontend.md](frontend.md), [bots.md](bots.md), [infrastructure.md](infrastructure.md) - moduły planowane.
