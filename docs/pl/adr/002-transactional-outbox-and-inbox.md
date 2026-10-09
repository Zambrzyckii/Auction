# ADR-002: Transakcyjny outbox i inbox w każdym module

- **Status:** przyjęta (outbox 2026-07-07, inbox 2026-08-15, martwe wiadomości 2026-08-16) · EN: [../../en/adr/002-transactional-outbox-and-inbox.md](../../en/adr/002-transactional-outbox-and-inbox.md)
- **Kontekst:** moduły muszą reagować na swoje zmiany bez wspólnej transakcji ani brokera, a awaria między zmianą stanu a jej publikacją nie może niczego zgubić.
- **Decyzja:** każdy moduł publikujący zapisuje wiersz `OutboxMessage` w tym samym `SaveChangesAsync` co zmianę stanu i odpytuje go własnym `OutboxProcessor`em; każdy moduł konsumujący zapisuje `EventId` w tabeli inboxa `ProcessedMessages` razem ze zmianą domenową i traktuje naruszenie klucza głównego jako „już przetworzone".
- **Konsekwencje:** dostarczanie jest co najmniej raz z opóźnieniem do 3 s na skok; konsumenci muszą być idempotentni; zawodzący wiersz jest ponawiany po 20, 40, 80 i 160 s i odkładany jako martwy po piątej porażce z historią błędów; klasy outboxa, inboxa i procesora są skopiowane do czterech modułów i utrzymywane w synchronizacji ręcznie; nie ma narzędzia do ponownego odtwarzania.
