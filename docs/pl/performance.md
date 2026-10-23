# AuctionServer — wydajność

> Wersja polska. Angielski odpowiednik 1:1: [../en/performance.md](../en/performance.md)

Każda zmiana obiecująca efekt wydajnościowy albo niezawodnościowy jest mierzona k6 przed i po, a przebiegi lądują tutaj, od najnowszych. Liczba bez commita, limitów i obciążenia, przy których ją zdjęto, to plotka, więc każdy wpis zapisuje wszystkie trzy.

## Metoda

- Cały stack działa na jednym hoście przez `docker compose` z zamrożonymi limitami zasobów: `api` 2 CPU i 1 GB, `postgres` 1 CPU i 512 MB, a od fazy drugiej `gateway` 1 CPU i 128 MB. Zmiana limitów unieważnia każdy wcześniejszy wpis, więc pozostają zamrożone na czas planu infrastruktury.
- k6 (`grafana/k6:2.3.0`, profil Compose `loadtest`) biegnie wewnątrz sieci Compose i celuje w `http://api:8080` bezpośrednio, żeby liczby pozostały porównywalne teraz, gdy gateway stoi przed api. Przez gateway idą tylko `gateway-limits.js` i wiersze gatewaya, uruchamiane z `-e BASE_URL=http://gateway`.
- Scenariusze żyją w [`Infrastructure/k6/`](../../Infrastructure/k6/) i seedują własne dane przez publiczne API (sprzedawca, aukcje ze starter packa, samofinansujący się licytanci-boty). Przebieg startuje na przykład tak:

  ```bash
  docker compose run --rm k6 run browse.js --summary-export=results/browse.json
  ```

- `browse.js` wysyła anonimowe odczyty (70% lista, 20% szczegół, 10% historia bidów) ze stałym tempem napływu, domyślnie 50/s przez 60 s. To trzy zapytania, które w fazie czwartej obsłuży cache.
- `bid-storm.js` każe 10 samofinansującym się botom tłuc w jedną aukcję. Projektową odpowiedzią na sztorm jest 409 (jeden oczekujący bid na aukcję), więc 409 są klasyfikowane jako oczekiwane; 400 (ponowny bid potwierdzonego lidera, kwota wyprzedzona w locie) zostają w odsetku błędów pod poluzowanym progiem.
- `mixed.js` to 85% odczytów i 15% bidów, a jego trend `visibility_lag` mierzy czas od przyjętego `POST /bid` do pojawienia się bida w `GET /bids`, pipeline outboxa tak, jak doświadcza go gracz.
- `gateway-limits.js` uruchamia cztery 20-sekundowe okna na gatewayu (anonimowo poniżej i powyżej limitu, z tokenem powyżej limitu, logowanie powyżej limitu), a jego progi sprawdzają, że każde okno dostaje takie 200 i 429, jakie powinno.
- Progi, dobrane z pierwszego baseline z zapasem: odsetek błędów < 1% (bid-storm < 6%), HTTP p95 < 67 ms, `visibility_lag` p95 < 6 s. Pęknięty próg failuje przebieg kodem wyjścia 99.

## Gateway — 2026-10-23, commit `32b9507`

Faza druga stawia nginx przed api. W Compose wszyscy wirtualni użytkownicy k6 mają jeden adres klienta, więc przez gateway anonimowy scenariusz ma sufit 20 żądań na sekundę. Dlatego narzut jest mierzony przy 15 iteracjach na sekundę, raz bezpośrednio i raz przez gateway, a `gateway-limits.js` przepycha każdą strefę limitów ponad jej limit. Gateway działa z 1 CPU i 128 MB.

| Scenariusz | Obciążenie | req/s | p50 | p95 | p99 | max | Błędy |
|---|---|---|---|---|---|---|---|
| browse, bezpośrednio, zimne api | 15 iteracji/s, 60 s | 13.9 | 0.82 ms | 1.24 ms | 4.92 ms | 343 ms | 0% |
| browse, bezpośrednio, rozgrzane api | 15 iteracji/s, 60 s | 13.8 | 0.87 ms | 1.45 ms | 2.56 ms | 140 ms | 0% |
| browse, przez gateway | 15 iteracji/s, 60 s | 14.0 | 0.92 ms | 1.24 ms | 1.69 ms | 143 ms | 0% |

| Okno `gateway-limits.js`, po 20 s | Przeszło | 429 | Oczekiwane przejścia |
|---|---|---|---|
| anonimowo, 15/s | 301 | 0 | wszystkie, poniżej limitu |
| anonimowo, 40/s | 440 | 360 | 20/s × 20 s + burst 40 = 440 |
| z tokenem, 90/s | 1320 | 481 | 60/s × 20 s + burst 120 = 1320 |
| logowanie, 3/s | 25 | 35 | 1/s × 20 s + burst 5 = 25 |

- Gateway dokłada do mediany około 0.05 do 0.1 ms. Dwa przebiegi bezpośrednie różnią się w ogonach bardziej (p99 4.92 wobec 2.56 ms) niż rozgrzany przebieg bezpośredni od przebiegu przez gateway, więc przy tym obciążeniu dodatkowy skok kosztuje mniej niż szum.
- Zimny przebieg szedł pierwszy na świeżo odtworzonym api, stąd jego max 343 ms. Max około 140 ms w pozostałych przebiegach to setup, a nie obciążenie. Rejestracja i logowanie liczą BCrypt i trwają po 135 do 142 ms, a zapytanie o listę około 1 ms. To poprawia notkę baseline poniżej, która zrzucała winę na JIT.
- Każda liczba przejść równa się tempu razy czas plus burst, co do żądania, więc każda strefa działa dokładnie tak, jak ją skonfigurowano.
- Te wiersze izolują gateway przy obciążeniu, na które pozwala strefa anonimowa. Nie są porównywalne z 50 iteracjami na sekundę z baseline, który zostaje punktem odniesienia dla samego api.

## Baseline — 2026-10-23, commit `4eb831b`

Punkt odniesienia dla faz od drugiej do szóstej, zdjęty na świeżym stacku telemetrii, bez gatewaya, poolera i cache.

| Scenariusz | Obciążenie | req/s | p50 | p95 | p99 | max | Błędy |
|---|---|---|---|---|---|---|---|
| browse | 50 iteracji/s, 60 s | 45.5 | 0.76 ms | 1.12 ms | 1.45 ms | 138 ms | 0% |
| bid-storm | 10 botów, bez pauz, 60 s | 86.4 | 0.91 ms | 1.65 ms | 3.47 ms | 143 ms | 4.41% (domenowe 400) |
| mixed | 30 iteracji/s, 85/15, 60 s | 27.0 | 0.80 ms | 1.46 ms | 8.06 ms | 142 ms | 0% |

- `visibility_lag` (mixed): med 3.01 s, p90 4.36 s, p95 4.52 s, p99 5.02 s, max 5.02 s. To zmierzony koszt dwupollowego pipeline'u outboxa, wcześniej jedynie szacowany na 3-9 s; faza piąta (RabbitMQ) ma go ściąć, fazy od drugiej do czwartej nie mogą go ruszyć.
- Wyniki domenowe bid-storm: 20 bidów przyjętych, 3620 odbitych z 409 (blokada oczekującego bida działa zgodnie z projektem, potwierdzenie potrzebuje dwóch polli outboxa), 356 odrzuconych z 400. Przepustowość przyjęć ogranicza saga, nie pojemność HTTP.
- Każde `max` w okolicy 140 ms to rejestracja i logowanie w setupie, które liczą BCrypt (poprawione w fazie drugiej, pierwotna notka obwiniała JIT zimnego endpointu). Percentyle pokazują API pod obciążeniem.
- Czytanie tabeli: przy tych obciążeniach API nie zbliża się do granic, submilisekundowe mediany na 2 CPU. Baseline istnieje po to, żeby fazy poolera i cache mogły udowodnić swój efekt (albo uczciwie pokazać jego brak przy jednej instancji) zamiast go deklarować.
