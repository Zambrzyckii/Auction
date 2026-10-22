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

Pierwotny cel pochodzi z notatki projektowej (`AGENTS.md`, usuniętej 2026-08-15) i poprzedniego README; 2026-10-22 właściciel rozszerzył go o plan infrastruktury serwerowej. Diagram poniżej pokazuje pełny obraz, łącznie z częściami celowo odłożonymi z tyłu głowy. Ciągła obwódka działa dziś, przerywana jest celem.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../diagrams/vision-01-target-architecture.dark.svg">
  <img alt="Target architecture diagram" src="../diagrams/vision-01-target-architecture.svg">
</picture>

- **frontend Angular** jako interfejs użytkownika;
- **gateway nginx** jako jedyny publikowany adres i punkt wejścia dla frontendu i botów, niosący TLS, limity IP, limity rozmiaru body i kompresję, podczas gdy limity per użytkownik i CORS zostają w backendzie;
- **backend API**, czyli istniejący dziś modular monolith, utrzymany jako jeden artefakt wdrożeniowy i oprzyrządowany OpenTelemetry;
- **warstwa danych** osiągalna tylko wewnątrz sieci Compose: PostgreSQL za PgBouncerem (pooling transakcyjny, migracje omijają poolera, kopie `pg_dump` z crona), Redis jako rozproszony poziom cache gorących odczytów aukcji, SeaweedFS na awatary i OpenBao na sekrety;
- **RabbitMQ** jako transport zdarzeń integracyjnych opuszczających monolit, wpięty w szew `IIntegrationEventPublisher`, z kolejkami retry, kolejką dead i sekwencyjnym konsumentem po stronie hosta;
- **boty AI** napisane w Pythonie, które nasłuchują zdarzeń rynkowych na własnej kolejce RabbitMQ i działają przez gateway;
- **stack obserwowalności** (OTel Collector, Prometheus, Tempo, Grafana) zasilany po OTLP, z testami obciążeniowymi k6 jako narzędziem pomiaru każdej zmiany wydajnościowej;
- z tyłu głowy i celowo jeszcze nieplanowane: **Kubernetes** (Deploymenty z HPA, Ingress, operatory Postgresa i RabbitMQ) oraz opcjonalny **Keycloak/OIDC** zastępujący własnoręczne wydawanie JWT.

## 5. Co istnieje dziś

- Identity: rejestracja, logowanie, JWT z claimem roli, provisioning botów kluczem API, miękko usuwani użytkownicy, BCrypt.
- Wallets: automatyczny portfel ze skonfigurowanymi środkami startowymi, doładowanie tylko dla botów, blokowanie, odblokowywanie i wydawanie środków, przelewy między graczami z append-only historią, rozliczenie z inboxem i outboxem.
- Auctions: tworzenie jako `Pending` do czasu blokady przedmiotu przez Inventory, lista, szczegóły i historia ofert przez Dapper, licytacja z ochroną anty-snajperską, zamykanie w tle, outbox z ponowieniami i martwymi wiadomościami, inbox.
- Inventory: przedmioty z cenami zależnymi od rzadkości, crafting, sprzedaż do sklepu, konfigurowalny pakiet startowy przy rejestracji, blokowanie i przenoszenie przedmiotów dla aukcji, inbox i outbox.
- Warehouses: wojny magazynowe zasilane pulą w tle, ukryte manifesty wyceniane przez Inventory, celowo zwodnicze widełki, wpisowe blokowane przez Wallets będące zarazem budżetem podbić, okna podbić 5-10 s ze stałymi kwotami, rozliczenie mintujące manifest dla zwycięzcy i usuwające cenę końcową z obiegu, inbox i outbox.
- Banking: stałe oferty pożyczek bramkowane skumulowanym obrotem portfela, asynchroniczne sagi udzielenia i pobrania z Wallets, jedna spłata w terminie zapadalności ściągana przez keepera, częściowe pobranie z jednorazową karą i automatycznymi ponowieniami, wcześniejsza ręczna spłata, inbox i outbox.
- Pawnshop: lokal bramkowany skumulowanym obrotem portfela, skonfigurowana drabinka botów z jednym miejscem na bota, towar tworzony przez bota i wyceniany przez Inventory, okno wycofania, po którym następuje automatyczna sprzedaż za stały ułamek ceny, zdarzenia płatności i wypłat wymieniane z Wallets, inbox i outbox.
- Casino: żetony wymieniane 1:1 z portfelem przez sagę zakupu i zdarzenia wypłat, ruletka europejska i blackjack grane synchronicznie na saldzie żetonów z przewagą kasyna gwarantowaną stałymi domeny, keeper wygaszający przeterminowane zakupy i pasujący porzucone rozdania, wypłaty wyłączone ze skumulowanego obrotu, inbox i outbox.
- Przekrojowo: pipeline FluentValidation, globalny kontrakt błędów, optymistyczna współbieżność, GitLab CI z Testcontainers.

## 6. Planowane dalej

2026-10-14 właściciel ustalił priorytety i wszedł pierwszy pakiet: Docker Compose, endpoint historii ofert i wymagania wstępne frontendu (CORS, OpenAPI, `/health`, autoryzacja portfela).

Tego samego dnia właściciel zdecydował, że przed startem frontendu Angular backend rośnie dalej o funkcje rozgrywki, w kolejności poniżej. Kolejność stawia dwie małe funkcje na początku i trzyma trzy funkcje ruszające pieniądzem (4-6) razem, bo każda z nich tworzy lub niszczy pieniądz, więc źródła i zlewy ekonomii gry trzeba zaprojektować jako całość.

1. **Pakiet startowy** przyznawany przy rejestracji, zdefiniowany w konfiguracji (mały, wszedł 2026-10-14).
2. **Przelewy między graczami** z append-only historią przelewów (małe, weszły 2026-10-14).
3. **Aukcje magazynów-niespodzianek**: magazyn o losowej zawartości, pokazywany przed licytacją tylko jako celowo zwodnicze widełki wartości, żeby magazyny nie były gwarantowanym zarobkiem (duże, weszły 2026-10-15 jako moduł Warehouses).
4. **Bank** udzielający pożyczek z oprocentowaniem (średni, wszedł 2026-10-15 jako moduł Banking: oferty bramkowane obrotem, pobranie w terminie zapadalności przez `BankKeeper`, kary za przeterminowanie i ponowienia; wypłata tworzy pieniądz, pobranie niszczy kapitał, odsetki i karę).
5. **Lombard**, w którym gracz zatrudnia dobrze wyszkolone boty dla pasywnego dochodu (średni, wszedł 2026-10-15 jako moduł Pawnshop z lokalem bramkowanym skumulowanym obrotem, drabinką ulepszeń z jednym botem i towarem czasowym, który właściciel może wycofać albo który sprzedaje się automatycznie za stały ułamek ceny, a wypłaty tworzą pieniądz, podczas gdy jednorazowe zakupy go niszczą).
6. **Kasyno** z prostymi zabawowymi grami jak ruletka i blackjack (średnie, weszło 2026-10-17 jako moduł Casino: pieniądze z portfela wymieniane 1:1 na żetony, ruletka europejska i blackjack z przewagą kasyna zmierzoną symulacją, wypłaty wyłączone z obrotu, więc kasyno nie karmi bramek banku i lombardu; pierwszy ciągły zlew pieniędzy, bilansujący punkty 4 i 5).
7. **Profile użytkowników**: znajomi, avatar, podpięte prawdziwe konta społecznościowe i opcja profilu prywatnego, który ukrywa wszystko poza zdjęciem profilowym (średnie, dotyka danych osobowych, więc prywatność jest częścią projektu od początku; dostarczone 2026-10-22 jako moduł Profiles z poziomami graczy napędzanymi obrotem i nagrodami poza konfiguracją, awatarami w SeaweedFS, kontami społecznościowymi per platforma, znajomymi z zaproszeniami do wojen magazynowych i prezentami gotówkowymi przez otwarty endpoint przelewów; opcja profilu prywatnego weszła tego samego dnia, ukrywając przed obcymi wszystko poza nazwą i awatarem, podczas gdy właściciel i zaakceptowani znajomi zachowują pełny widok).

Planowane nadal po nich:

- RabbitMQ jako transport zdarzeń za `IIntegrationEventPublisher`.
- Frontend Angular, boty rynkowe AI i API gateway.

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
