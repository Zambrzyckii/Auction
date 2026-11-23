import { bjSteps, shownOf } from './blackjack-watch';
import type { BjStep, ShownHand, TableHand } from './blackjack-watch';

export const DEAL_WATCHDOG_MS = 6000;

export interface DealStageRoom {
  run(steps: readonly BjStep[]): void;
  place(hand: TableHand | null): void;
}

const MOVING_KINDS: ReadonlySet<BjStep['kind']> = new Set(['card', 'hole', 'reveal', 'settle']);

const hasMotion = (steps: readonly BjStep[]): boolean =>
  steps.some((s) => MOVING_KINDS.has(s.kind));

export class DealStage {
  private room: DealStageRoom | null = null;
  private reduced = false;
  private shown: ShownHand | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onDealing: (on: boolean) => void) {}

  get planned(): ShownHand | null {
    return this.shown;
  }

  attach(room: DealStageRoom, hand: TableHand | null, reduced: boolean): void {
    this.room = room;
    this.reduced = reduced;
    this.shown = hand ? shownOf(hand) : null;
    room.place(hand);
  }

  see(hand: TableHand | null, visible: boolean): void {
    if (!this.room) return;
    const steps = bjSteps(this.shown, hand);
    if (steps.length === 0) return;
    if (visible && !this.reduced && hasMotion(steps)) {
      this.onDealing(true);
      this.arm();
    }
    this.shown = hand ? shownOf(hand) : null;
    this.room.run(steps);
  }

  idle(): void {
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
    this.watchdog = setTimeout(() => this.end(), DEAL_WATCHDOG_MS);
  }

  private disarm(): void {
    if (this.watchdog === null) return;
    clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private end(): void {
    this.disarm();
    this.onDealing(false);
  }
}
