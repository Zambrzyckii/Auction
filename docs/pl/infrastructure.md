# Infrastruktura

> Wersja polska. Angielski odpowiednik 1:1: [../en/infrastructure.md](../en/infrastructure.md)

Katalog `Infrastructure/` istnieje od 2026-10-23 i trzyma konfigurację usług wokół backendu, czyli pipeline telemetrii w `Infrastructure/observability/`, testy obciążeniowe k6 w `Infrastructure/k6/` i gateway nginx w `Infrastructure/gateway/`. Pooler połączeń, cache, broker i usługa sekretów pozostają planowane. Właściciel przyjął 2026-10-22 siedmiofazowy plan infrastruktury serwerowej. Jako pierwsza weszła faza pierwsza (obserwowalność i baseline k6), a tego samego dnia, 2026-10-23, faza druga (gateway nginx). Pełny obraz docelowy to diagram w [VISION.md](VISION.md#4-docelowy-system).

## Status

Start 2026-10-14 plikiem Compose. 2026-10-23 stack Compose urósł z trzech usług do siedmiu plus opcjonalny generator obciążenia, podzielony na sieci `edge` i `data`, z limitami CPU i pamięci na `api` (2 CPU, 1 GB) i `postgres` (1 CPU, 512 MB), żeby wyniki k6 były porównywalne między przebiegami. Później tego dnia doszedł gateway nginx jako ósma usługa i jedyne wejście, z limitem 1 CPU i 128 MB, a sieć `edge` dostała stały zakres `172.16.80.0/24`. Broker dochodzi w kolejnej fazie.

## Co istnieje dziś

| Usługa | Obraz (przypięty) | Publikowane | Rola |
|---|---|---|---|
| gateway | nginx:1.28.3-alpine | 8080 | jedyne wejście, opisane w [Gateway](#gateway) |
| api | build `Backend/` | brak (127.0.0.1:8081 z `compose.debug.yaml`) | host, telemetria włączana sekcją `Observability`, nagłówki forwarded zaufane z sieci `edge` |
| postgres | postgres:16-alpine | 5436 | jedyna baza |
| seaweedfs | chrislusf/seaweedfs:4.48 | brak | object storage na awatary |
| otel-collector | otel/opentelemetry-collector-contrib:0.163.2 | brak | przyjmuje OTLP z api, rozdziela po backendach |
| prometheus | prom/prometheus:v3.15.1 | brak | zbiera z collectora co 10 s, trzyma metryki 7 dni |
| tempo | grafana/tempo:3.1.1 | brak | trzyma trace'y na wolumenie |
| grafana | grafana/grafana:13.2.4 | 127.0.0.1:3000 | czyta Prometheusa i Tempo, provisioning z plików |
| k6 | grafana/k6:2.3.0 | brak | generator obciążenia za profilem `loadtest`, uruchamiany na żądanie |

Pipeline telemetrii opisuje [`Infrastructure/README.md`](../../Infrastructure/README.md); stronę hosta (opcje, sampler sierocych spanów, dekorator publishera, metryki outboxa) [ADR-005](adr/005-observability-and-k6.md). Scenariusze k6 (`browse.js`, `bid-storm.js`, `mixed.js`) seedują własne dane przez publiczne API, klasyfikują oczekiwane domenowe 409 jako spodziewane i failują na progach zapisanych w [performance.md](performance.md) razem z baseline. `gateway-limits.js` obciąża sam gateway i sprawdza każdą strefę limitów pod obciążeniem.

## Gateway

`Infrastructure/gateway/nginx.conf` to cały gateway. Compose montuje go tylko do odczytu w usłudze `gateway`, publikuje port 8080 i uruchamia nginx dopiero, gdy api zgłosi stan healthy. Zapis decyzji to [ADR-006](adr/006-nginx-gateway.md).

| Ścieżka | Co się dzieje |
|---|---|
| `/api/` | przekazywane do api |
| `/health`, `/health/live`, `/health/ready` | przekazywane do api |
| `/openapi/` | przekazywane dla `127.0.0.1`, `172.16.0.0/12` i `192.168.0.0/16`, pozostali dostają 403 |
| `/gateway-health` | odpowiada sam nginx, korzysta z tego healthcheck jego kontenera |
| cała reszta | 404 z nginx |

- Limity per adres klienta. Żądania bez nagłówka `Authorization` dzielą strefę `anonymous` (20 żądań na sekundę, burst 40), żądania z nim używają strefy `authenticated` (60 na sekundę, burst 120). `/api/users/login` i `/api/users/register` używają zamiast tego strefy `login` (1 na sekundę, burst 5). Odrzucone żądanie dostaje 429 z `Retry-After: 1` i `{"error":"Too many requests"}`. nginx nie umie zweryfikować JWT, więc dowolny nagłówek `Authorization` daje większą pulę. Limity per użytkownik zostają w backendzie (faza 7).
- Rozmiar body. Domyślnie 64 KB, a 4 MB dla `PUT /api/profiles/me/avatar`. Api ogranicza żądanie z awatarem do `Profiles:Avatar:MaxBytes` (2 MiB) plus 8 KiB narzutu multipart, więc gateway nigdy nie odrzuca body, które api by przyjęło. Podniesienie `MaxBytes` w stronę maksymalnych 5 MiB wymaga podniesienia też limitu 4 MB. Odrzucone body dostaje 413 z `{"error":"Request body too large"}`.
- Nagłówki do api. `Host`, `X-Forwarded-Proto`, `X-Forwarded-For` z samym adresem łączącego się klienta i `X-Request-Id` ze świeżym 32-znakowym identyfikatorem. Wartości dwóch ostatnich wysłane przez klienta są odrzucane.
- Kompresja. gzip dla odpowiedzi `application/json` i `text/plain` od 1 KB w górę, z `Vary: Accept-Encoding`. Dokument OpenAPI maleje z 31 KB do niecałych 3 KB.
- Log dostępu. Jeden obiekt JSON na żądanie na stdout (`docker compose logs gateway`) z polami `time`, `remote_addr`, `method`, `uri`, `status`, `request_time`, `upstream_response_time` i `request_id`. Nagłówek `Authorization` nigdy nie trafia do logu, a `request_id` jest równy `X-Request-Id`, które dostaje api.
- Szukanie api. nginx co 5 sekund pyta DNS Dockera (`127.0.0.11`) o adres api, więc odtworzone api z nowym adresem zostaje znalezione bez restartu nginx. Przełączenie kosztuje najwyżej jedno 5-sekundowe okno odpowiedzi 502.
- Zaufanie po stronie hosta. Sekcja `Gateway` (`Gateway__Enabled`, `Gateway__TrustedNetworks__0`) sprawia, że host przyjmuje `X-Forwarded-For` i `X-Forwarded-Proto` tylko z sieci `edge`. Sekcja jest fail-fast. Włączony gateway wymaga co najmniej jednej sieci, a każdy wpis musi być kanonicznym CIDR, takim jak `172.16.80.0/24`, nigdy `172.16.80.1/24`. `UseForwardedHeaders` jest pierwszym middleware.
- Zdrowie. `/health/live` nie uruchamia żadnych checków, `/health/ready` uruchamia checki z tagiem `ready` (dziś baza), a `/health` wszystkie. Kontener api sonduje `/health/ready` przez bash `/dev/tcp`, bo obraz runtime nie ma klienta HTTP. Compose nigdy nie restartuje kontenera unhealthy, stan tylko wstrzymuje start gatewaya i widać go w `docker compose ps`.
- Debugowanie bez nginx. `docker compose -f compose.yaml -f compose.debug.yaml up -d` publikuje api na `127.0.0.1:8081`, osiągalnym tylko z tego komputera.

## Projekt docelowy

- **API gateway nginx** (faza 2): wszedł 2026-10-23, zob. [Gateway](#gateway). Nadal brakuje TLS.
- **PgBouncer** (faza 3): transaction pooling przed PostgreSQL; migracje zachowują bezpośrednie połączenie, bo `MigrateAsync` bierze sesyjny advisory lock.
- **Redis** (faza 4): rozproszony poziom cache gorących odczytów aukcji za szwem modułu, samo TTL.
- **RabbitMQ** (faza 5): transport zdarzeń integracyjnych za `IIntegrationEventPublisher`, z poziomami retry, martwą kolejką i sekwencyjnym konsumentem po stronie hosta; zob. [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).
- **OpenBao** (faza 6): usługa sekretów czytana na starcie przez własny provider konfiguracji.
- **Hardening** (faza 7): budowa obrazu w CI, backupy, limiter .NET per użytkownik i notatki migracyjne k8s/OIDC.

## Co daje backend

| Potrzeba | Dostępne dziś |
|---|---|
| szew transportu | `IIntegrationEventPublisher.PublishAsync(messageId, type, content)` to jedyne miejsce, którym zdarzenia opuszczają moduł; `IntegrationEventTypes` zamienia `type` i `content` z powrotem na typowane zdarzenie; od 2026-10-23 host owija go w `InstrumentedEventPublisher`, więc każdy przyszły transport jest mierzony za darmo |
| telemetria | sekcja konfiguracji `Observability` (domyślnie wyłączona, walidacja fail-fast po włączeniu) eksportuje trace'y, metryki i logi po OTLP; źródła i metery `AuctionServer.*` są zasubskrybowane, więc nowe metery modułów pojawiają się bez zmian w hoście |
| zaufany pośrednik | sekcja konfiguracji `Gateway` (domyślnie wyłączona, walidacja fail-fast po włączeniu) pozwala, by `UseForwardedHeaders`, pierwsze middleware, ufało `X-Forwarded-For` i `X-Forwarded-Proto` tylko z wymienionych sieci CIDR |
| zdrowie dla orkiestracji | `/health/live` (bez checków) i `/health/ready` (checki z tagiem `ready`, dziś baza) obok pełnego `/health` |
| konfiguracja ze środowiska | każde ustawienie czytane jest przez `IConfiguration`, więc `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey` i klucze `Observability__*` można wstrzyknąć zmiennymi środowiskowymi |
| odtwarzalna baza | schemat w pełni opisuje dziewięć zestawów migracji, aplikowanych `dotnet ef database update` per kontekst albo na starcie, gdy `Database:MigrateOnStartup` jest `true` (Compose to ustawia) |
| object storage na awatary | usługa `seaweedfs` w `compose.yaml`: przypięty obraz, bez publikowanych portów, osiągana za szwem `IAvatarStorage` ([backend/profiles.md](backend/profiles.md)) |
| baza CI | `.gitlab-ci.yml` i jego lustro na GitHub Actions `.github/workflows/ci.yml` budują i testują każdy push, łącznie z projektem testowym hosta `AuctionServer.Api.Tests`, którego testy gatewaya uruchamiają nginx i traefik/whoami przez Testcontainers, oraz sprawdzają `nginx.conf` komendą `nginx -t` w jobie `gateway-config` |

## Czego brakuje

- **TLS jeszcze nie ma, więc dopóki nie wejdzie, stack nie może być wystawiony do internetu.** Cel właściciela to wyłącznie HTTPS z własnym certyfikatem, odnawianym automatycznie albo serwowanym przez redundantną parę, żeby certyfikat nie stał się pojedynczym punktem awarii.
- nginx odpowiada na 502 (api nieosiągalne, na przykład w 5-sekundowym oknie odświeżania adresu) swoją domyślną stroną HTML, inaczej niż na 413 i 429, które mają JSON.
- nginx przekazuje `Host` bez portu, więc wpis `servers` w OpenAPI to `http://localhost/`. Api buduje tylko adresy względne, więc nic innego tego nie odczuwa.
- Brak publishera AMQP i konsumenta po stronie hosta; [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md) opisuje, z czym wiąże się podmiana.
- Pipeline CI nie ma etapu deploy, artefaktów ani budowy obrazu.
- Sekrety w `compose.yaml` są plaintextowymi zmiennymi środowiskowymi do fazy 6.

## API

Warstwa infrastruktury ma jeden własny endpoint, `/gateway-health`, na który nginx odpowiada bez api. Cała reszta na porcie 8080 to API backendu, a broker poniesie trzydzieści siedem zdarzeń integracyjnych wymienionych w [backend/messaging.md](backend/messaging.md#katalog-zdarzen).

## Decyzje

- Stack telemetrii to OTel Collector + Prometheus + Grafana + Tempo, wybór właściciela zamiast lżejszego Aspire Dashboard; zob. [ADR-005](adr/005-observability-and-k6.md).
- Gateway to nginx z limitami IP, limitami body, błędami w JSON i modelem zaufania CIDR dla nagłówków forwarded, zob. [ADR-006](adr/006-nginx-gateway.md).
- Testy obciążeniowe celują w `http://api:8080` bezpośrednio z sieci Compose, żeby baseline pozostał porównywalny teraz, gdy gateway stoi przed api. Przez gateway idzie tylko `gateway-limits.js`, uruchamiany z `BASE_URL=http://gateway`.
- Transport wchodzi za istniejący szew zamiast przez zmianę modułów, zob. [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).

## Powiązane dokumenty

- [performance.md](performance.md) - baseline k6 i każdy pomiar przed/po.
- [ARCHITECTURE.md](ARCHITECTURE.md) - kontekst systemu z częściami planowanymi i pipeline CI.
- [backend/messaging.md](backend/messaging.md) - outbox, szew publishera i katalog zdarzeń.
- [frontend.md](frontend.md), [bots.md](bots.md) - klienci zależni od tej warstwy.
