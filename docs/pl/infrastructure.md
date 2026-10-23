# Infrastruktura

> Wersja polska. Angielski odpowiednik 1:1: [../en/infrastructure.md](../en/infrastructure.md)

Katalog `Infrastructure/` istnieje od 2026-10-23 i trzyma konfigurację usług wokół backendu: pipeline telemetrii w `Infrastructure/observability/` i testy obciążeniowe k6 w `Infrastructure/k6/`. API gateway, pooler połączeń, cache, broker i usługa sekretów pozostają planowane; właściciel przyjął 2026-10-22 siedmiofazowy plan infrastruktury serwerowej i jako pierwsza weszła faza pierwsza (obserwowalność i baseline k6). Pełny obraz docelowy to diagram w [VISION.md](VISION.md#4-docelowy-system).

## Status

Start 2026-10-14 plikiem Compose. 2026-10-23 stack Compose urósł z trzech usług do siedmiu plus opcjonalny generator obciążenia, podzielony na sieci `edge` i `data`, z limitami CPU i pamięci na `api` (2 CPU, 1 GB) i `postgres` (1 CPU, 512 MB), żeby wyniki k6 były porównywalne między przebiegami. Gateway i broker dochodzą w kolejnych fazach.

## Co istnieje dziś

| Usługa | Obraz (przypięty) | Publikowane | Rola |
|---|---|---|---|
| api | build `Backend/` | 8080 | host, telemetria włączana sekcją `Observability` |
| postgres | postgres:16-alpine | 5436 | jedyna baza |
| seaweedfs | chrislusf/seaweedfs:4.48 | brak | object storage na awatary |
| otel-collector | otel/opentelemetry-collector-contrib:0.163.2 | brak | przyjmuje OTLP z api, rozdziela po backendach |
| prometheus | prom/prometheus:v3.15.1 | brak | zbiera z collectora co 10 s, trzyma metryki 7 dni |
| tempo | grafana/tempo:3.1.1 | brak | trzyma trace'y na wolumenie |
| grafana | grafana/grafana:13.2.4 | 127.0.0.1:3000 | czyta Prometheusa i Tempo, provisioning z plików |
| k6 | grafana/k6:2.3.0 | brak | generator obciążenia za profilem `loadtest`, uruchamiany na żądanie |

Pipeline telemetrii opisuje [`Infrastructure/README.md`](../../Infrastructure/README.md); stronę hosta (opcje, sampler sierocych spanów, dekorator publishera, metryki outboxa) [ADR-005](adr/005-observability-and-k6.md). Scenariusze k6 (`browse.js`, `bid-storm.js`, `mixed.js`) seedują własne dane przez publiczne API, klasyfikują oczekiwane domenowe 409 jako spodziewane i failują na progach zapisanych w [performance.md](performance.md) razem z baseline.

## Projekt docelowy

- **API gateway nginx** (faza 2): jedyny publikowany adres, TLS, limity IP i limity rozmiaru body; limity per użytkownik i CORS zostają w backendzie.
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
| konfiguracja ze środowiska | każde ustawienie czytane jest przez `IConfiguration`, więc `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey` i klucze `Observability__*` można wstrzyknąć zmiennymi środowiskowymi |
| odtwarzalna baza | schemat w pełni opisuje dziewięć zestawów migracji, aplikowanych `dotnet ef database update` per kontekst albo na starcie, gdy `Database:MigrateOnStartup` jest `true` (Compose to ustawia) |
| object storage na awatary | usługa `seaweedfs` w `compose.yaml`: przypięty obraz, bez publikowanych portów, osiągana za szwem `IAvatarStorage` ([backend/profiles.md](backend/profiles.md)) |
| baza CI | `.gitlab-ci.yml` i jego lustro na GitHub Actions `.github/workflows/ci.yml` budują i testują każdy push, łącznie z projektem testowym hosta `AuctionServer.Api.Tests` |

## Czego brakuje

- Usługa `api` w `compose.yaml` nie ma jeszcze healthchecku kontenera: obraz runtime nie zawiera klienta HTTP do sondowania `/health`; faza 2 dodaje sondę bash przez `/dev/tcp`.
- Brak publishera AMQP i konsumenta po stronie hosta; [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md) opisuje, z czym wiąże się podmiana.
- Pipeline CI nie ma etapu deploy, artefaktów ani budowy obrazu.
- Sekrety w `compose.yaml` są plaintextowymi zmiennymi środowiskowymi do fazy 6.

## API

Warstwa infrastruktury nie ma własnego API; stałaby przed endpointami backendu i niosła trzydzieści siedem zdarzeń integracyjnych wymienionych w [backend/messaging.md](backend/messaging.md#katalog-zdarzen).

## Decyzje

- Stack telemetrii to OTel Collector + Prometheus + Grafana + Tempo, wybór właściciela zamiast lżejszego Aspire Dashboard; zob. [ADR-005](adr/005-observability-and-k6.md).
- Testy obciążeniowe celują w `http://api:8080` bezpośrednio z sieci Compose, żeby baseline pozostał porównywalny po wejściu gatewaya przed api.
- Transport wchodzi za istniejący szew zamiast przez zmianę modułów, zob. [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).

## Powiązane dokumenty

- [performance.md](performance.md) - baseline k6 i każdy pomiar przed/po.
- [ARCHITECTURE.md](ARCHITECTURE.md) - kontekst systemu z częściami planowanymi i pipeline CI.
- [backend/messaging.md](backend/messaging.md) - outbox, szew publishera i katalog zdarzeń.
- [frontend.md](frontend.md), [bots.md](bots.md) - klienci zależni od tej warstwy.
