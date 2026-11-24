import { shopSteps, STAGED_KINDS } from './pawnshop-watch';
import type { PawnState, PawnStep } from './pawnshop-watch';

export const STAGE_WATCHDOG_MS = 14000;

export interface PawnshopStageRoom {
  place(shop: PawnState | null): void;
  run(steps: readonly PawnStep[]): void;
}

interface Entry {
  staged: boolean;
}

export class PawnshopStage {
  private room: PawnshopStageRoom | null = null;
  private reduced = false;
  private seen: PawnState | null = null;
  private queue: Entry[] = [];
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onStaging: (on: boolean) => void) {}

  attach(room: PawnshopStageRoom, reduced: boolean): void {
    this.room = room;
    this.reduced = reduced;
    room.place(this.seen);
  }

  see(shop: PawnState | null, visible: boolean): void {
    if (shop === null) return;
    if (!this.room) {
      this.seen = shop;
      return;
    }
    if (this.seen === null) {
      this.seen = shop;
      this.send([{ kind: 'snap', shop }], false);
      return;
    }
    const steps = shopSteps(this.seen, shop);
    this.seen = shop;
    if (steps.length === 0) return;
    this.send(steps, visible);
  }

  revealed(): void {
    this.queue.shift();
    if (!this.queue.some((e) => e.staged)) this.end();
  }

  idle(): void {
    this.queue = [];
    this.end();
  }

  hidden(): void {
    this.queue.forEach((e) => (e.staged = false));
    this.end();
  }

  stop(): void {
    this.disarm();
  }

  private send(steps: readonly PawnStep[], visible: boolean): void {
    const staging = visible && !this.reduced;
    const entries = steps.map((s): Entry => ({ staged: staging && STAGED_KINDS.has(s.kind) }));
    this.queue.push(...entries);
    if (entries.some((e) => e.staged)) {
      this.onStaging(true);
      this.arm();
    }
    this.room?.run(steps);
  }

  private arm(): void {
    this.disarm();
    this.watchdog = setTimeout(() => this.hidden(), STAGE_WATCHDOG_MS);
  }

  private disarm(): void {
    if (this.watchdog === null) return;
    clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private end(): void {
    this.disarm();
    this.onStaging(false);
  }
}
