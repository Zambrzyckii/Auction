# ADR-003: Szyna zdarzeń in-process za szwem publishera, RabbitMQ później

- **Status:** przyjęta (2026-08-26) · EN: [../../en/adr/003-in-process-event-bus-before-rabbitmq.md](../../en/adr/003-in-process-event-bus-before-rabbitmq.md)
- **Kontekst:** RabbitMQ jest częścią docelowego systemu, ale uruchamianie brokera w fazie samego backendu dodałoby infrastrukturę bez zmiany sposobu pisania modułów.
- **Decyzja:** procesory outboxa publikują przez `IIntegrationEventPublisher`; jego jedyna implementacja, `InProcessEventPublisher` w hoście, deserializuje wiersz przez `IntegrationEventTypes` i publikuje go przez MediatR, więc zdarzenia dziś nigdy nie opuszczają procesu.
- **Konsekwencje:** moduły już zakładają dostarczanie co najmniej raz i sekwencyjne handlery; wymiana transportu to jeden publisher AMQP plus konsument po stronie hosta, bez dotykania modułów; do tego czasu zdarzenia są niewidoczne poza procesem, dlatego planowane boty nie mogą jeszcze niczego subskrybować.
