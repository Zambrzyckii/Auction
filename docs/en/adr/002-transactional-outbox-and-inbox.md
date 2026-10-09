# ADR-002: Transactional outbox and inbox in every module

- **Status:** accepted (outbox 2026-07-07, inbox 2026-08-15, dead letters 2026-08-16) · PL: [../../pl/adr/002-transactional-outbox-and-inbox.md](../../pl/adr/002-transactional-outbox-and-inbox.md)
- **Context:** modules must react to each other's changes without a shared transaction or a broker, and a crash between a state change and its publication must lose nothing.
- **Decision:** every publishing module writes an `OutboxMessage` row in the same `SaveChangesAsync` as the state change and polls it with its own `OutboxProcessor`; every consuming module records the `EventId` in a `ProcessedMessages` inbox table saved with the domain change and treats a primary-key violation as "already processed".
- **Consequences:** delivery is at-least-once with a latency of up to 3 s per hop; consumers must be idempotent; a failing row retries after 20, 40, 80 and 160 s and is parked as dead after the fifth failure with its error history; the outbox, inbox and processor classes are copied into four modules and kept in sync by hand; there is no replay tool.
