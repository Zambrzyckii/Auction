# Infrastruktura

> Wersja polska. Angielski odpowiednik 1:1: [../en/infrastructure.md](../en/infrastructure.md)

Katalog `Infrastructure/` istnieje od 2026-10-23 i trzyma konfigurację usług wokół backendu, czyli pipeline telemetrii w `Infrastructure/observability/`, testy obciążeniowe k6 w `Infrastructure/k6/`, gateway nginx w `Infrastructure/gateway/`, konfigurację PgBouncera w `Infrastructure/pgbouncer/`, bootstrap OpenBao i konfigurację trwałą w `Infrastructure/vault/` oraz gitignorowane pliki sekretów z ich generatorem w `Infrastructure/secrets/`. Broker działa w stacku Compose od 2026-11-04 (jego konfiguracja to definicja usługi plus `RabbitTopology` w hoście), a usługa sekretów działa tam od tego samego dnia. Właściciel przyjął 2026-10-22 siedmiofazowy plan infrastruktury serwerowej. Jako pierwsza weszła faza pierwsza (obserwowalność i baseline k6), tego samego dnia, 2026-10-23, faza druga (gateway nginx), 2026-10-24 faza trzecia (PgBouncer), 2026-11-01 faza czwarta (cache odczytów na Redisie), a 2026-11-04 faza piąta (RabbitMQ) i faza szósta (OpenBao). Faza siódma (hardening) domknęła plan 2026-11-07: nierootowy obraz api tylko do odczytu, usługa `pgbackup`, budowa obrazu w CI, limiter per użytkownik, poprawka awarii brokera z alertami, warunkowy GET awatarów, opcjonalny overlay Loki i Dependabot. Pełny obraz docelowy to diagram w [VISION.md](VISION.md#4-docelowy-system).

## Status

Start 2026-10-14 plikiem Compose. 2026-10-23 stack Compose urósł z trzech usług do siedmiu plus opcjonalny generator obciążenia, podzielony na sieci `edge` i `data`, z limitami CPU i pamięci na `api` (2 CPU, 1 GB) i `postgres` (1 CPU, 512 MB), żeby wyniki k6 były porównywalne między przebiegami. Później tego dnia doszedł gateway nginx jako ósma usługa i jedyne wejście, z limitem 1 CPU i 128 MB, a sieć `edge` dostała stały zakres `172.16.80.0/24`. 2026-10-24 doszedł PgBouncer jako dziewiąta usługa, z limitem 1 CPU i 64 MB, między api a postgresem w sieci `data`. 2026-11-01 doszedł Redis jako dziesiąta usługa (`redis:7.2-alpine`, 1 CPU i 128 MB, `--maxmemory 64mb` z `allkeys-lru`, bez persystencji i bez wolumenu) w sieci `data`; api celowo nie ma na niego `depends_on`, bo brak Redisa degraduje tylko opóźnienie odczytów. 2026-11-04 doszedł RabbitMQ jako jedenasta usługa (`rabbitmq:4.1-management-alpine`, 1 CPU i 384 MB, UI zarządzania na `127.0.0.1:15672`, użytkownik `auction` z hasłem z `Infrastructure/secrets/`) w sieci `data`, a api przełączyło się na transport Rabbit. Później tego samego dnia faza szósta dodała OpenBao jako dwunastą usługę (`openbao/openbao:2.7.2`, 1 CPU i 256 MB, tryb dev) z jednorazowym `vault-init` seedującym go przy każdym starcie stacku, a każdy jawny sekret opuścił plik compose na rzecz gitignorowanego katalogu `Infrastructure/secrets/`. 2026-11-07 faza siódma utwardziła runtime: obraz api działa jako nierootowy użytkownik `app` na systemie plików tylko do odczytu z tmpfs `/tmp` i 30 s okresem łagodnego zatrzymania, doszedł `pgbackup` jako trzynasta usługa (1 CPU, 128 MB) zrzucająca bazę codziennie do wolumenu `pgbackups`, a opcjonalny overlay `compose.loki.yaml` dodaje Loki (1 CPU, 256 MB) z collectorem przekierowanym na niego.

## Co istnieje dziś

| Usługa | Obraz (przypięty) | Publikowane | Rola |
|---|---|---|---|
| gateway | nginx:1.28.3-alpine | 8080 | jedyne wejście, opisane w [Gateway](#gateway) |
| api | build `Backend/` | brak (127.0.0.1:8081 z `compose.debug.yaml`) | host, telemetria włączana sekcją `Observability`, nagłówki forwarded zaufane z sieci `edge`, nieroot na systemie plików tylko do odczytu |
| postgres | postgres:16-alpine | 5436 | jedyna baza |
| pgbouncer | edoburu/pgbouncer:v1.26.1-p0 | brak | transaction pooling między api a postgresem, opisany w [Pooling połączeń](#pooling-połączeń) |
| pgbackup | prodrigestivill/postgres-backup-local:16-alpine | brak | codzienny `pg_dump` prosto do postgresa z trzykoszykową rotacją, zob. [Backupy](#backupy) |
| seaweedfs | chrislusf/seaweedfs:4.48 | brak | object storage na awatary |
| otel-collector | otel/opentelemetry-collector-contrib:0.163.2 | brak | przyjmuje OTLP z api, rozdziela po backendach |
| prometheus | prom/prometheus:v3.15.1 | brak | zbiera z collectora co 10 s, trzyma metryki 7 dni |
| tempo | grafana/tempo:3.1.1 | brak | trzyma trace'y na wolumenie |
| grafana | grafana/grafana:13.2.4 | 127.0.0.1:3000 | czyta Prometheusa i Tempo, provisioning z plików |
| vault | openbao/openbao:2.7.2 | brak (127.0.0.1:8200 z `compose.debug.yaml`) | usługa sekretów, domyślnie tryb dev, raft przez `compose.vault-persistent.yaml` |
| vault-init | openbao/openbao:2.7.2 | brak | jednorazowy seeder, kończy się po zapisaniu polityki, AppRole, sekretów i poświadczeń api |
| k6 | grafana/k6:2.3.0 | brak | generator obciążenia za profilem `loadtest`, uruchamiany na żądanie |
| loki | grafana/loki:3.5.7 | brak | magazyn logów, tylko z overlayem `compose.loki.yaml`, który przekierowuje też collectora i dokłada datasource Grafany |

Pipeline telemetrii opisuje [`Infrastructure/README.md`](../../Infrastructure/README.md); stronę hosta (opcje, sampler sierocych spanów, dekorator publishera, metryki outboxa) [ADR-005](adr/005-observability-and-k6.md). Scenariusze k6 (`browse.js`, `bid-storm.js`, `mixed.js`) seedują własne dane przez publiczne API, klasyfikują oczekiwane domenowe 409 jako spodziewane i failują na progach zapisanych w [performance.md](performance.md) razem z baseline. `gateway-limits.js` obciąża sam gateway i sprawdza każdą strefę limitów pod obciążeniem. Prometheus dodatkowo ewaluuje `Infrastructure/observability/prometheus-rules.yml`: `OutboxDeadMessages` odpala się na zaparkowanym wierszu outboxa, a `OutboxPublishFailing` na utrzymujących się błędach publikacji; Alertmanagera nie ma, więc stan alertów żyje w Grafana Explore i w API Prometheusa.

## Gateway

`Infrastructure/gateway/nginx.conf` to cały gateway. Compose montuje go tylko do odczytu w usłudze `gateway`, publikuje port 8080 i uruchamia nginx dopiero, gdy api zgłosi stan healthy. Zapis decyzji to [ADR-006](adr/006-nginx-gateway.md).

| Ścieżka | Co się dzieje |
|---|---|
| `/api/` | przekazywane do api |
| `/health`, `/health/live`, `/health/ready` | przekazywane do api |
| `/openapi/` | przekazywane dla `127.0.0.1`, `172.16.0.0/12` i `192.168.0.0/16`, pozostali dostają 403 |
| `/gateway-health` | odpowiada sam nginx, korzysta z tego healthcheck jego kontenera |
| cała reszta | 404 z nginx |

- Limity per adres klienta. Żądania bez nagłówka `Authorization` dzielą strefę `anonymous` (20 żądań na sekundę, burst 40), żądania z nim używają strefy `authenticated` (60 na sekundę, burst 120). `/api/users/login` i `/api/users/register` używają zamiast tego strefy `login` (1 na sekundę, burst 5). Odrzucone żądanie dostaje 429 z `Retry-After: 1` i `{"error":"Too many requests"}`. nginx nie umie zweryfikować JWT, więc dowolny nagłówek `Authorization` daje większą pulę. Limity per użytkownik żyją w hoście od fazy siódmej, zob. [Limity per użytkownik](#limity-per-użytkownik).
- Rozmiar body. Domyślnie 64 KB, a 4 MB dla `PUT /api/profiles/me/avatar`. Api ogranicza żądanie z awatarem do `Profiles:Avatar:MaxBytes` (2 MiB) plus 8 KiB narzutu multipart, więc gateway nigdy nie odrzuca body, które api by przyjęło. Podniesienie `MaxBytes` w stronę maksymalnych 5 MiB wymaga podniesienia też limitu 4 MB. Odrzucone body dostaje 413 z `{"error":"Request body too large"}`.
- Nagłówki do api. `Host`, `X-Forwarded-Proto`, `X-Forwarded-For` z samym adresem łączącego się klienta i `X-Request-Id` ze świeżym 32-znakowym identyfikatorem. Wartości dwóch ostatnich wysłane przez klienta są odrzucane.
- Kompresja. gzip dla odpowiedzi `application/json` i `text/plain` od 1 KB w górę, z `Vary: Accept-Encoding`. Dokument OpenAPI maleje z 31 KB do niecałych 3 KB.
- Log dostępu. Jeden obiekt JSON na żądanie na stdout (`docker compose logs gateway`) z polami `time`, `remote_addr`, `method`, `uri`, `status`, `request_time`, `upstream_response_time` i `request_id`. Nagłówek `Authorization` nigdy nie trafia do logu, a `request_id` jest równy `X-Request-Id`, które dostaje api.
- Szukanie api. nginx co 5 sekund pyta DNS Dockera (`127.0.0.11`) o adres api, więc odtworzone api z nowym adresem zostaje znalezione bez restartu nginx. Przełączenie kosztuje najwyżej jedno 5-sekundowe okno odpowiedzi 502. Takie 502 niesie `{"error":"Api unavailable"}`, jak pozostałe błędy gateway.
- Zaufanie po stronie hosta. Sekcja `Gateway` (`Gateway__Enabled`, `Gateway__TrustedNetworks__0`) sprawia, że host przyjmuje `X-Forwarded-For` i `X-Forwarded-Proto` tylko z sieci `edge`. Sekcja jest fail-fast. Włączony gateway wymaga co najmniej jednej sieci, a każdy wpis musi być kanonicznym CIDR, takim jak `172.16.80.0/24`, nigdy `172.16.80.1/24`. `UseForwardedHeaders` jest pierwszym middleware.
- Zdrowie. `/health/live` nie uruchamia żadnych checków, `/health/ready` uruchamia checki z tagiem `ready` (dziś baza), a `/health` wszystkie. Kontener api sonduje `/health/ready` przez bash `/dev/tcp`, bo obraz runtime nie ma klienta HTTP. Compose nigdy nie restartuje kontenera unhealthy, stan tylko wstrzymuje start gatewaya i widać go w `docker compose ps`.
- Debugowanie bez nginx. `docker compose -f compose.yaml -f compose.debug.yaml up -d` publikuje api na `127.0.0.1:8081`, osiągalnym tylko z tego komputera.

## Limity per użytkownik

Od fazy siódmej host uruchamia limiter z frameworka (`Microsoft.AspNetCore.RateLimiting`, bez paczki) za sekcją `RateLimiting` z fail-fastem, domyślnie wyłączoną, włączaną w Compose. Siedzi za autentykacją i partycjonuje po claimie z id użytkownika, więc liczy per konto tam, gdzie nginx liczy per adres. Trzy wiadra tokenów pokrywają uwierzytelnione zapisy: `Writes` to parasol nad każdym POST, PUT i DELETE za JWT (20 tokenów na sekundę, zryw 40), `HotWrites` zaciska gorące trasy, bid aukcji, bidy magazynów z join i leave, całe casino i transfery portfela (5 na sekundę, zryw 10), a `Uploads` obejmuje PUT awatara (1 na 10 sekund, zryw 3). Mapa tras żyje w hoście (`RateLimitingExtensions.Classify`), lustrzanie do idiomu `IntegrationEventRecipients`, więc moduły pozostają nietknięte, a nowy endpoint zapisu ląduje pod parasolem automatycznie. Odrzucone żądanie dostaje 429 z `Retry-After` i globalnym body `{"error":...}`. Endpointy anonimowe zostają przy strefie `login` nginxa, bo przed autentykacją nie ma po czym kluczować per użytkownik. To domyka podział z ADR-006: limity adresowe na krawędzi, limity kont w hoście.

## Pooling połączeń

`Infrastructure/pgbouncer/pgbouncer.ini` to cała konfiguracja poolera. Compose montuje go tylko do odczytu w usłudze `pgbouncer` razem z wygenerowanym `Infrastructure/secrets/pgbouncer-userlist.txt` jako `auth_file` (do fazy szóstej userlistę generował entrypoint obrazu ze zmiennych `DB_USER` i `DB_PASSWORD`), a api, razem z migracjami startowymi, dociera do postgresa wyłącznie przez `pgbouncer:6432`. Zapis decyzji to [ADR-007](adr/007-pgbouncer-transaction-pooling.md).

- Transaction pooling. Połączenie serwerowe jest wypożyczane na czas jednej transakcji, więc do `max_client_conn` (500) połączeń klienckich dzieli `default_pool_size` (25) połączeń serwerowych plus `reserve_pool_size` (10) sięganych po 5 s czekania, z `max_db_connections` (40) jako sufitem dla wszystkich pul razem. Jedna instancja api kosztuje postgresa najwyżej 35 ze 100 miejsc.
- Api zostawia pulę Npgsql włączoną i dodaje `No Reset On Close=true`, więc oddane połączenie nie wysyła `DISCARD ALL`, które czyściłoby połączenie serwerowe współdzielone z innymi klientami.
- Nieznany parametr w `pgbouncer.ini` jest fatalny, więc literówka zatrzymuje kontener na starcie, zamiast zostać po cichu zignorowana.
- Stanu sesyjnego (advisory locki, tabele tymczasowe, LISTEN/NOTIFY, prepared statements) nie wolno wprowadzić bez zdjęcia tego wołającego z poolera. Dziś kod nie ma żadnego.
- `SHOW POOLS` pokazuje połączenia klienckie i serwerowe na żywo, przez `docker compose exec -e PGPASSWORD="$(cat Infrastructure/secrets/postgres-password.secret)" pgbouncer psql -h 127.0.0.1 -p 6432 -U auction -d pgbouncer -c "SHOW POOLS"`. Testy integracyjne robią asercje na jego liczbach.

## Broker komunikatów

RabbitMQ 4.1 niesie dwa trwałe exchange'e, deklarowane idempotentnie przez każdą łączącą się stronę poprzez `RabbitTopology` hosta. Exchange direct `auctionserver.events` karmi trwałą kolejkę `auctionserver.deliveries`, wewnętrzny odcinek między procesorami outboxa a magazynem doręczeń: `RabbitEventPublisher` publikuje trwałe wiadomości z metadanymi we właściwościach AMQP `MessageId` i `Type` oraz surowym JSON-em zdarzenia jako body i wraca dopiero na confirm publishera, a `RabbitDeliveryConsumer` karmi `DeliveryDispatcher.AcceptAsync` z ręcznymi ackami, prefetch 20 i 5 s chłodzenia przed oddaniem nieprzyjętej wiadomości do kolejki. Exchange topic `auctionserver.market` publikuje ponownie cztery publiczne zdarzenia aukcyjne z nazwą typu jako kluczem routingu, feed tylko do konsumpcji dla planowanych botów. Ponowienia i martwe listy zostają w bazie (ADR-011), więc broker nie ma żadnego DLX, a bezczynny stack pokazuje pustą kolejkę. Przełącznikiem transportu jest sekcja `Messaging` hosta z fail-fast, domyślnie `InProcess`, w Compose `Rabbit`. Rekord decyzji to [ADR-013](adr/013-rabbitmq-transport.md).

## Sekrety

Od fazy szóstej żadna wartość sekretu nie żyje w `compose.yaml`. `Infrastructure/secrets/gen-secrets.sh` generuje losowe hasła do gitignorowanego katalogu (śledzone są tylko generator i szablony `*.example`), kontenery infrastruktury czytają je jako sekrety plikowe compose albo jako montowane pliki wygenerowane, a api czyta swoje pięć sekretów z OpenBao. Deweloperski serwis `vault` plus jednorazowy `vault-init` seedują przy każdym starcie stacku politykę `auction-api`, AppRole, sekrety pod `secret/auction/api` i pliki `role-id`/`secret-id` w wolumenie `vaultcreds`, a api, którego sekcja `Vault` z fail-fastem jest domyślnie wyłączona, loguje się na starcie AppRole'em przez ręcznie napisany `IConfigurationProvider` (około 120 linii, bez paczki) dodany jako ostatnie źródło konfiguracji, więc wartości z vaulta wygrywają ze zmiennymi środowiskowymi. Rotację, overlay trwałego rafta i ćwiczenie ręcznego odpieczętowania opisuje krok po kroku [operations.md](operations.md). Rekord decyzji to [ADR-014](adr/014-openbao-secrets.md).

## Backupy

Usługa `pgbackup` zrzuca bazę w harmonogramie `@daily` prosto do postgresa, z pominięciem PgBouncera, bo pooling transakcyjny psuje długą pojedynczą sesję, której potrzebuje zrzut, i rotuje trzy koszyki retencji w wolumenie `pgbackups`: 7 kopii dziennych, 4 tygodniowe i 6 miesięcznych, z najnowszym zrzutem zawsze podlinkowanym jako `last/auctionserver-latest.sql.gz`. Zrzut na żądanie i ćwiczenie restore, wykonane na żywo, opisuje krok po kroku [operations.md](operations.md#backupy-bazy-danych).

## Projekt docelowy

- **API gateway nginx** (faza 2): wszedł 2026-10-23, zob. [Gateway](#gateway). Nadal brakuje TLS.
- **PgBouncer** (faza 3): wszedł 2026-10-24, zob. [Pooling połączeń](#pooling-połączeń). Migracje też idą przez poolera.
- **Redis** (faza 4, weszła 2026-11-01): rozproszony poziom cache gorących odczytów aukcji za szwem modułu, samo TTL; szczegóły w [backend/auctions.md](backend/auctions.md) i [ADR-009](adr/009-hybrid-read-cache-in-auctions.md).
- **RabbitMQ** (faza 5, weszła 2026-11-04): transport AMQP za `IIntegrationEventPublisher` plus rynkowy exchange tylko do konsumpcji dla botów. Ponowienia i martwe listy zostały w bazie, nie w brokerze (ADR-011); zob. [Broker komunikatów](#broker-komunikatow) i [ADR-013](adr/013-rabbitmq-transport.md).
- **OpenBao** (faza 6, weszła 2026-11-04): usługa sekretów czytana na starcie przez własny provider konfiguracji, z sekretami plikowymi compose dla kontenerów infrastruktury; zob. [Sekrety](#sekrety) i [ADR-014](adr/014-openbao-secrets.md).
- **Hardening** (faza 7, weszła 2026-11-07): nierootowy obraz api tylko do odczytu z warstwowym restore, usługa `pgbackup` ze zweryfikowanym ćwiczeniem restore, budowa obrazu do GHCR w CI, limiter per użytkownik, poprawka awarii brokera w outboxie (zaktualizowany [ADR-013](adr/013-rabbitmq-transport.md)) z alertami Prometheusa, warunkowy GET awatarów, opcjonalny overlay Loki, Dependabot oraz notatki o k8s i OIDC poniżej. Plan jest ukończony.

## Co daje backend

| Potrzeba | Dostępne dziś |
|---|---|
| szew transportu | `IIntegrationEventPublisher.PublishAsync(messageId, type, content)` to jedyne miejsce, którym zdarzenia opuszczają moduł; `IntegrationEventTypes` zamienia `type` i `content` z powrotem na typowane zdarzenie; od 2026-10-23 host owija go w `InstrumentedEventPublisher`, więc każdy przyszły transport jest mierzony za darmo |
| telemetria | sekcja konfiguracji `Observability` (domyślnie wyłączona, walidacja fail-fast po włączeniu) eksportuje trace'y, metryki i logi po OTLP; źródła i metery `AuctionServer.*` są zasubskrybowane, więc nowe metery modułów pojawiają się bez zmian w hoście |
| zaufany pośrednik | sekcja konfiguracji `Gateway` (domyślnie wyłączona, walidacja fail-fast po włączeniu) pozwala, by `UseForwardedHeaders`, pierwsze middleware, ufało `X-Forwarded-For` i `X-Forwarded-Proto` tylko z wymienionych sieci CIDR |
| zdrowie dla orkiestracji | `/health/live` (bez checków) i `/health/ready` (checki z tagiem `ready`, dziś baza) obok pełnego `/health` |
| konfiguracja ze środowiska | każde ustawienie czytane jest przez `IConfiguration`, więc `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey` i klucze `Observability__*` można wstrzyknąć zmiennymi środowiskowymi; od fazy szóstej sekcja `Vault` z fail-fastem może dodać OpenBao jako ostatnie źródło konfiguracji, którego wartości wygrywają ze środowiskiem |
| odtwarzalna baza | schemat w pełni opisuje dziewięć zestawów migracji, aplikowanych `dotnet ef database update` per kontekst albo na starcie, gdy `Database:MigrateOnStartup` jest `true` (Compose to ustawia) |
| object storage na awatary | usługa `seaweedfs` w `compose.yaml`: przypięty obraz, bez publikowanych portów, osiągana za szwem `IAvatarStorage` ([backend/profiles.md](backend/profiles.md)) |
| baza CI | workflow GitHub Actions `.github/workflows/ci.yml` buduje i testuje każdy push, łącznie z projektem testowym hosta `AuctionServer.Api.Tests`, którego testy gatewaya uruchamiają nginx i traefik/whoami przez Testcontainers, sprawdza `nginx.conf` komendą `nginx -t` w jobie `gateway-config`, waliduje `compose.yaml` w `compose-config` i buduje obraz aplikacji do GHCR w jobie `image` |

## Czego brakuje

- **TLS jeszcze nie ma, więc dopóki nie wejdzie, stack nie może być wystawiony do internetu.** Cel właściciela to wyłącznie HTTPS z własnym certyfikatem, odnawianym automatycznie albo serwowanym przez redundantną parę, żeby certyfikat nie stał się pojedynczym punktem awarii.- nginx przekazuje `Host` bez portu, więc wpis `servers` w OpenAPI to `http://localhost/`. Api buduje tylko adresy względne, więc nic innego tego nie odczuwa.
- Pipeline CI nie ma etapu deploy: job `image` publikuje do GHCR z `main`, ale nic nie konsumuje tego obrazu automatycznie.
- Secret zero zostaje: wygenerowane pliki sekretów i wolumen poświadczeń AppRole żyją na systemie plików hosta, więc łańcuch zaufania wciąż się tam kończy (nazwane uczciwie w [ADR-014](adr/014-openbao-secrets.md)).

## API

Warstwa infrastruktury ma jeden własny endpoint, `/gateway-health`, na który nginx odpowiada bez api. Cała reszta na porcie 8080 to API backendu. Wewnętrzna kolejka niesie wszystkie trzydzieści osiem zdarzeń integracyjnych wymienionych w [backend/messaging.md](backend/messaging.md#katalog-zdarzen), a exchange rynkowy publikuje ponownie cztery z nich dla botów ([bots.md](bots.md)).

## Decyzje

- Stack telemetrii to OTel Collector + Prometheus + Grafana + Tempo, wybór właściciela zamiast lżejszego Aspire Dashboard; zob. [ADR-005](adr/005-observability-and-k6.md).
- Gateway to nginx z limitami IP, limitami body, błędami w JSON i modelem zaufania CIDR dla nagłówków forwarded, zob. [ADR-006](adr/006-nginx-gateway.md).
- Pooler to PgBouncer w trybie transaction i migracje idą przez niego, bo blokada migracji w Npgsql EF 10 to blokada tabeli wewnątrz transakcji migracji, z włączoną pulą Npgsql plus `No Reset On Close=true`, zob. [ADR-007](adr/007-pgbouncer-transaction-pooling.md).
- Testy obciążeniowe celują w `http://api:8080` bezpośrednio z sieci Compose, żeby baseline pozostał porównywalny teraz, gdy gateway stoi przed api. Przez gateway idzie tylko `gateway-limits.js`, uruchamiany z `BASE_URL=http://gateway`.
- Transport wchodzi za istniejący szew zamiast przez zmianę modułów, zob. [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md); podmiana z 2026-11-04 to potwierdziła i dotknęła tylko hosta.
- Broker mówi przez surowy `RabbitMQ.Client`, nie framework komunikacyjny, z confirmami publishera zanim wiersz outboxa uzna się za przetworzony i całym stanem ponawiania w bazie, zob. [ADR-013](adr/013-rabbitmq-transport.md).
- Zapleczem sekretów jest OpenBao czytany raz na starcie przez ręcznie napisany provider konfiguracji (bez paczki), a kontenery infrastruktury dostają generowane sekrety plikowe compose, zob. [ADR-014](adr/014-openbao-secrets.md).
- PgBouncer zostaje na oryginalnym obrazie z montowaną wygenerowaną userlistą, wybór właściciela zamiast obrazu z wrapperem i obsługą `_FILE`, a Redis działa z `--requirepass` z pliku sekretu, również wybór właściciela, zob. [ADR-014](adr/014-openbao-secrets.md).
- Backupy jadą na gotowym obrazie `prodrigestivill/postgres-backup-local`, wybór właściciela zamiast własnego sidecara z cronem (2026-11-07).
- Limiter per użytkownik to limiter z frameworka, wiadra tokenów partycjonowane po claimie z id użytkownika z mapą tras w hoście; realizuje hostową połowę [ADR-006](adr/006-nginx-gateway.md), więc nowy ADR nie powstał.
- Loki jest opcjonalnym overlayem, nie usługą bazową, wybór właściciela dla lżejszego domyślnego stacku (2026-11-07).
- Obraz idzie do GHCR tylko z `main`, z tagami `latest` plus sha commita, a pull requesty budują bez publikacji; GitLab CI usunięto w całości (oba 2026-11-07).
- Postgres zostaje opublikowany na porcie hosta 5436 na wszystkich interfejsach, jawna decyzja właściciela (2026-11-07). To zaakceptowane ryzyko stacku deweloperskiego, nie wzorzec produkcyjny: jedyną osłoną jest generowane hasło, a dowiązanie do loopbacku nic by lokalnie nie kosztowało.

## Przyszły deployment na Kubernetes

Nic w repozytorium nie celuje dziś w Kubernetes; ta sekcja mapuje stack compose na niego na dzień, w którym będzie potrzebny.

- Api staje się Deploymentem z HPA, `/health/live` i `/health/ready` wpiętymi jako probe'y liveness i readiness oraz obrazem ciągniętym z GHCR.
- Rolę gatewaya przejmuje kontroler Ingress; strefy nginxa przekładają się na adnotacje kontrolera, a limity per konto już żyją w hoście.
- postgres przechodzi pod operatora CloudNativePG, którego Pooler zastępuje kontener pgbouncera.
- RabbitMQ działa pod swoim operatorem z kolejkami quorum w miejsce pojedynczej trwałej kolejki.
- Vault przychodzi z oficjalnego Helm charta z agent injectorem zastępującym plikowe przekazanie AppRole w wolumenie `vaultcreds`.
- Migracje startowe przechodzą z `Database:MigrateOnStartup` na Job kończący się przed rolloutem.

Zanim wolno będzie uruchomić więcej niż jedną replikę api, muszą paść założenia o jednej instancji: pollery outboxa i doręczeń już dziś claimują lease'ami `FOR UPDATE SKIP LOCKED`, więc są bezpieczne dla replik, ale `AuctionCloser` i czterej keeperzy działaliby w każdym podzie i wymagają leader election albo poda singletonowego, L1 HybridCache nie ma backplane'u, więc odczyty z cache mogą się rozjeżdżać per pod na czas TTL, limiter trzyma wiadra per pod, więc efektywne limity mnożą się przez liczbę replik, a klucz podpisu JWT już jest współdzielony przez vault.

## Przyszły dostawca OIDC

Dziś JWT wydaje Identity. Gdy pojawi się social login, MFA albo więcej typów klientów, wydawanie tokenów przejmie dedykowany dostawca OIDC (Keycloak).

- Host przełącza `AddJwtBearer` na `Authority` dostawcy i waliduje przez jego JWKS zamiast współdzielonego `Jwt:Key`.
- Klient Angular loguje się przez Authorization Code + PKCE, co dokłada też refresh flow, którego brakuje obecnym 15-minutowym tokenom.
- Boty przechodzą z provisioningu `X-Api-Key` na flow client credentials.
- Identity zostaje magazynem użytkowników, mapując `PublicUserId` na `sub` dostawcy, a hashe BCrypt migrują leniwie przy pierwszym logowaniu.
- Ceną jest jedna ciężka usługa więcej, około 500 MB RAM w tym stacku, dlatego czeka na realny powód.

## Powiązane dokumenty

- [performance.md](performance.md) - baseline k6 i każdy pomiar przed/po.
- [ARCHITECTURE.md](ARCHITECTURE.md) - kontekst systemu z częściami planowanymi i pipeline CI.
- [backend/messaging.md](backend/messaging.md) - outbox, szew publishera i katalog zdarzeń.
- [frontend.md](frontend.md), [bots.md](bots.md) - klienci zależni od tej warstwy.
