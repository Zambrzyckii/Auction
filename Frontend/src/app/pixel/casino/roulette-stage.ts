import type { SpinView } from './roulette-watch';

export const ROLL_WATCHDOG_MS = 8000;

export interface SpinStageRoom {
  roll(spin: SpinView): void;
  show(spin: SpinView | null): void;
}

export class SpinStage {
  private room: SpinStageRoom | null = null;
  private reduced = false;
  private seen: string | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onRolling: (on: boolean) => void) {}

  attach(room: SpinStageRoom, spin: SpinView | null, reduced: boolean): void {
    this.room = room;
    this.reduced = reduced;
    this.seen = spin?.publicSpinId ?? null;
    room.show(spin);
  }

  see(spin: SpinView | null, visible: boolean): void {
    if (!spin || spin.publicSpinId === this.seen) return;
    this.seen = spin.publicSpinId;
    if (!this.room) return;
    if (visible && !this.reduced) {
      this.onRolling(true);
      this.arm();
    }
    this.room.roll(spin);
  }

  settled(): void {
    this.end();
  }

  hidden(): void {
    this.end();
  }

  stop(): void {
    this.disarm();
  }

  private arm(): void {
    this.disarm();
    this.watchdog = setTimeout(() => this.end(), ROLL_WATCHDOG_MS);
  }

  private disarm(): void {
    if (this.watchdog === null) return;
    clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private end(): void {
    this.disarm();
    this.onRolling(false);
  }
}
