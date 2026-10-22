# Infrastruktura (planowana)

> Wersja polska. Angielski odpowiednik 1:1: [../en/infrastructure.md](../en/infrastructure.md)

Większość tej warstwy jeszcze nie istnieje: repozytorium nie zawiera folderu `Infrastructure/` ani konfiguracji brokera czy gatewaya. Istnieje pipeline GitLab CI, opisany w [ARCHITECTURE.md](ARCHITECTURE.md#build-i-ci), oraz [`Backend/Dockerfile`](../../Backend/Dockerfile) i [`compose.yaml`](../../compose.yaml) w korzeniu, które stawiają API, PostgreSQL i SeaweedFS jedną komendą.

## Status

Rozpoczęta 2026-10-14 plikiem Compose; broker i gateway pozostają planowane. Poprzednie README rezerwowało `Infrastructure/` na „RabbitMQ / gateway / compose setup", a usunięta notatka projektowa (`AGENTS.md`) wskazuje API gateway jako jedyny punkt wejścia i RabbitMQ jako broker wiadomości; gdy powstaną, ich usługi dołączą do `compose.yaml`.

## Projekt docelowy

- **API gateway**: jedyny adres, który znają frontend i boty; kieruje do hosta backendu i jest naturalnym miejscem na limitowanie żądań i CORS.
- **RabbitMQ**: transport zdarzeń integracyjnych opuszczających monolit, zasilany przez nową implementację `IIntegrationEventPublisher` i konsumowany przez boty oraz konsumenta po stronie hosta.
- **Docker Compose**: host, PostgreSQL, SeaweedFS, RabbitMQ i gateway uruchamiane jedną komendą, z migracjami aplikowanymi, zanim host zacznie obsługiwać ruch.

## Co backend już zapewnia

| Potrzeba | Dostępne dziś |
|---|---|
| szew transportu | `IIntegrationEventPublisher.PublishAsync(messageId, type, content)` to jedyne miejsce, w którym zdarzenia opuszczają moduł; `IntegrationEventTypes` zamienia `type` i `content` z powrotem na typowane zdarzenie |
| konfiguracja ze środowiska | każde ustawienie jest czytane przez `IConfiguration`, więc `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey` i `Wallets__StartingFunds` można wstrzyknąć jako zmienne środowiskowe |
| odtwarzalna baza | schemat jest w pełni opisany dziewięcioma zestawami migracji, aplikowanymi przez `dotnet ef database update` per kontekst albo na starcie, gdy `Database:MigrateOnStartup` jest `true` (Compose to ustawia) |
| object storage dla awatarów | serwis `seaweedfs` w `compose.yaml`: przypięty obraz `chrislusf/seaweedfs:4.48`, komenda `server -s3 -dir=/data`, nazwany wolumen, healthcheck i brak publikowanych portów, bo bramka S3 działa bez auth i sieć Compose jest jej jedyną strażą; API sięga do niej jako `http://seaweedfs:8333` za szwem `IAvatarStorage` ([backend/profiles.md](backend/profiles.md)) |
| baza CI | `.gitlab-ci.yml` buduje i testuje przy każdym pushu w oficjalnym obrazie SDK z docker-in-docker |

## Czego brakuje

- Usługa `api` w `compose.yaml` nie ma kontenerowego healthchecka: obraz runtime nie zawiera klienta HTTP, którym można by odpytać `/health`, więc orkiestrator musi odpytywać endpoint z zewnątrz.
- Brak publishera AMQP i konsumenta po stronie hosta; [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md) opisuje, czego wymaga wymiana.
- Pipeline CI nie ma stage'u deploy, artefaktów ani budowania obrazu.

## API

Warstwa infrastruktury nie ma własnego API; stałaby przed endpointami backendu i przenosiła trzydzieści siedem zdarzeń integracyjnych wymienionych w [backend/messaging.md](backend/messaging.md#katalog-zdarzeń).

## Decyzje

- RabbitMQ został wybrany jako broker, a API gateway jako punkt wejścia w pierwotnej notatce projektowej; produkt gatewaya i układ Compose są otwarte.
- Transport jest wprowadzany za istniejącym szwem, a nie przez zmianę modułów, zobacz [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).

## Powiązane dokumenty

- [ARCHITECTURE.md](ARCHITECTURE.md) - kontekst systemu z częściami planowanymi i pipeline CI.
- [backend/messaging.md](backend/messaging.md) - outbox, szew publishera i katalog zdarzeń.
- [frontend.md](frontend.md), [bots.md](bots.md) - klienci zależni od tej warstwy.
