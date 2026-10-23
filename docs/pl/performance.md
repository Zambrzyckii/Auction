# AuctionServer — wydajność

> Wersja polska. Angielski odpowiednik 1:1: [../en/performance.md](../en/performance.md)

Każda zmiana obiecująca efekt wydajnościowy albo niezawodnościowy jest mierzona k6 przed i po, a przebiegi lądują tutaj, od najnowszych. Liczba bez commita, limitów i obciążenia, przy których ją zdjęto, to plotka, więc każdy wpis zapisuje wszystkie trzy.

## Metoda

- Cały stack działa na jednym hoście przez `docker compose` z zamrożonymi limitami zasobów: `api` 2 CPU i 1 GB, `postgres` 1 CPU i 512 MB. Zmiana limitów unieważnia każdy wcześniejszy wpis, więc pozostają zamrożone na czas planu infrastruktury.
- k6 (`grafana/k6:2.3.0`, profil Compose `loadtest`) biegnie wewnątrz sieci Compose i celuje w `http://api:8080` bezpośrednio, żeby liczby pozostały porównywalne po wejściu gatewaya przed api.
- Scenariusze żyją w [`Infrastructure/k6/`](../../Infrastructure/k6/) i seedują własne dane przez publiczne API (sprzedawca, aukcje ze starter packa, samofinansujący się licytanci-boty). Przebieg startuje na przykład tak:

  ```bash
  docker compose run --rm k6 run browse.js --summary-export=results/browse.json
  ```

- `browse.js` wysyła anonimowe odczyty (70% lista, 20% szczegół, 10% historia bidów) ze stałym tempem napływu, domyślnie 50/s przez 60 s. To trzy zapytania, które w fazie czwartej obsłuży cache.
- `bid-storm.js` każe 10 samofinansującym się botom tłuc w jedną aukcję. Projektową odpowiedzią na sztorm jest 409 (jeden oczekujący bid na aukcję), więc 409 są klasyfikowane jako oczekiwane; 400 (ponowny bid potwierdzonego lidera, kwota wyprzedzona w locie) zostają w odsetku błędów pod poluzowanym progiem.
- `mixed.js` to 85% odczytów i 15% bidów, a jego trend `visibility_lag` mierzy czas od przyjętego `POST /bid` do pojawienia się bida w `GET /bids`, pipeline outboxa tak, jak doświadcza go gracz.
- Progi, dobrane z pierwszego baseline z zapasem: odsetek błędów < 1% (bid-storm < 6%), HTTP p95 < 67 ms, `visibility_lag` p95 < 6 s. Pęknięty próg failuje przebieg kodem wyjścia 99.

## Baseline — 2026-10-23, commit `4eb831b`

Punkt odniesienia dla faz od drugiej do szóstej, zdjęty na świeżym stacku telemetrii, bez gatewaya, poolera i cache.

| Scenariusz | Obciążenie | req/s | p50 | p95 | p99 | max | Błędy |
|---|---|---|---|---|---|---|---|
| browse | 50 iteracji/s, 60 s | 45.5 | 0.76 ms | 1.12 ms | 1.45 ms | 138 ms | 0% |
| bid-storm | 10 botów, bez pauz, 60 s | 86.4 | 0.91 ms | 1.65 ms | 3.47 ms | 143 ms | 4.41% (domenowe 400) |
| mixed | 30 iteracji/s, 85/15, 60 s | 27.0 | 0.80 ms | 1.46 ms | 8.06 ms | 142 ms | 0% |

- `visibility_lag` (mixed): med 3.01 s, p90 4.36 s, p95 4.52 s, p99 5.02 s, max 5.02 s. To zmierzony koszt dwupollowego pipeline'u outboxa, wcześniej jedynie szacowany na 3-9 s; faza piąta (RabbitMQ) ma go ściąć, fazy od drugiej do czwartej nie mogą go ruszyć.
- Wyniki domenowe bid-storm: 20 bidów przyjętych, 3620 odbitych z 409 (blokada oczekującego bida działa zgodnie z projektem, potwierdzenie potrzebuje dwóch polli outboxa), 356 odrzuconych z 400. Przepustowość przyjęć ogranicza saga, nie pojemność HTTP.
- Każde `max` w okolicy 140 ms to koszt JIT pierwszego trafienia w zimny endpoint; percentyle pokazują rozgrzany system.
- Czytanie tabeli: przy tych obciążeniach API nie zbliża się do granic, submilisekundowe mediany na 2 CPU. Baseline istnieje po to, żeby fazy poolera i cache mogły udowodnić swój efekt (albo uczciwie pokazać jego brak przy jednej instancji) zamiast go deklarować.
