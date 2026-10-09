# Infrastruktura (planowana)

> Wersja polska. Angielski odpowiednik 1:1: [../en/infrastructure.md](../en/infrastructure.md)

Ten moduł jeszcze nie istnieje: repozytorium nie zawiera folderu `Infrastructure/`, Dockerfile, pliku Compose ani konfiguracji brokera czy gatewaya. Jedyna istniejąca infrastruktura to pipeline GitLab CI, opisany w [ARCHITECTURE.md](ARCHITECTURE.md#build-i-ci).

## Status

Planowana. Poprzednie README rezerwowało `Infrastructure/` na „RabbitMQ / gateway / compose setup", a usunięta notatka projektowa (`AGENTS.md`) wskazuje API gateway jako jedyny punkt wejścia i RabbitMQ jako broker wiadomości.

## Projekt docelowy

- **API gateway**: jedyny adres, który znają frontend i boty; kieruje do hosta backendu i jest naturalnym miejscem na limitowanie żądań i CORS.
- **RabbitMQ**: transport zdarzeń integracyjnych opuszczających monolit, zasilany przez nową implementację `IIntegrationEventPublisher` i konsumowany przez boty oraz konsumenta po stronie hosta.
- **Docker Compose**: host, PostgreSQL, RabbitMQ i gateway uruchamiane jedną komendą, z migracjami aplikowanymi, zanim host zacznie obsługiwać ruch.

## Co backend już zapewnia

| Potrzeba | Dostępne dziś |
|---|---|
| szew transportu | `IIntegrationEventPublisher.PublishAsync(messageId, type, content)` to jedyne miejsce, w którym zdarzenia opuszczają moduł; `IntegrationEventTypes` zamienia `type` i `content` z powrotem na typowane zdarzenie |
| konfiguracja ze środowiska | każde ustawienie jest czytane przez `IConfiguration`, więc `ConnectionStrings__DefaultConnection`, `Jwt__Key`, `Bots__ApiKey` i `Wallets__StartingFunds` można wstrzyknąć jako zmienne środowiskowe |
| odtwarzalna baza | schemat jest w pełni opisany czterema zestawami migracji, aplikowanymi przez `dotnet ef database update` per kontekst |
| baza CI | `.gitlab-ci.yml` buduje i testuje przy każdym pushu w oficjalnym obrazie SDK z docker-in-docker |

## Czego brakuje

- Brak Dockerfile dla hosta i pliku Compose, więc uruchomienie systemu to wciąż ręczne kroki z [backend/README.md](backend/README.md#uruchomienie).
- Brak endpointu health check, który mógłby odpytywać orkiestrator kontenerów albo gateway.
- Brak migracji na starcie, więc kontener potrzebowałby osobnego kroku migracji.
- Brak publishera AMQP i konsumenta po stronie hosta; [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md) opisuje, czego wymaga wymiana.
- Pipeline CI nie ma stage'u deploy, artefaktów ani budowania obrazu.

## API

Warstwa infrastruktury nie ma własnego API; stałaby przed endpointami backendu i przenosiła dziewięć zdarzeń integracyjnych wymienionych w [backend/messaging.md](backend/messaging.md#katalog-zdarzeń).

## Decyzje

- RabbitMQ został wybrany jako broker, a API gateway jako punkt wejścia w pierwotnej notatce projektowej; produkt gatewaya i układ Compose są otwarte.
- Transport jest wprowadzany za istniejącym szwem, a nie przez zmianę modułów, zobacz [ADR-003](adr/003-in-process-event-bus-before-rabbitmq.md).

## Powiązane dokumenty

- [ARCHITECTURE.md](ARCHITECTURE.md) - kontekst systemu z częściami planowanymi i pipeline CI.
- [backend/messaging.md](backend/messaging.md) - outbox, szew publishera i katalog zdarzeń.
- [frontend.md](frontend.md), [bots.md](bots.md) - klienci zależni od tej warstwy.
