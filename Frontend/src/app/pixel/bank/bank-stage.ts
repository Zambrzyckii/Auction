import { loanSteps, newestLoan, slipsOf, STAGED_KINDS, wireSteps } from './bank-watch';
import type { BankLoan, BankShown, BankStep, WireRow } from './bank-watch';

export const STAGE_WATCHDOG_MS = 12000;
export const ASK_WINDOW_MS = 10000;

export interface BankStageRoom {
  place(shown: BankShown): void;
  run(steps: readonly BankStep[]): void;
}

interface Entry {
  staged: boolean;
}

export class BankStage {
  private room: BankStageRoom | null = null;
  private reduced = false;
  private loansSeen = false;
  private loan: BankLoan | null = null;
  private rows: readonly WireRow[] | null = null;
  private me = '';
  private askedAt: number | null = null;
  private queue: Entry[] = [];
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onStaging: (on: boolean) => void) {}

  attach(room: BankStageRoom, reduced: boolean): void {
    this.room = room;
    this.reduced = reduced;
    const slips = this.rows ? slipsOf(this.rows, this.me) : [];
    room.place({ loan: this.loan, known: this.loansSeen, slips });
  }

  seeLoans(loans: readonly BankLoan[] | null, visible: boolean): void {
    if (!loans) return;
    const newest = newestLoan(loans);
    if (!this.room) {
      this.record(newest);
      return;
    }
    if (!this.loansSeen) {
      this.record(newest);
      this.send([{ kind: 'snapLoan', loan: newest }], false);
      return;
    }
    const steps = loanSteps(this.loan, newest, this.asked(), Date.now());
    this.record(newest);
    if (steps.length === 0) return;
    if (steps.some((s) => s.kind === 'collecting')) this.askedAt = null;
    this.send(steps, visible);
  }

  seeWires(rows: readonly WireRow[] | null, me: string | null, visible: boolean): void {
    if (!rows || me === null) return;
    if (!this.room) {
      this.rows = rows;
      this.me = me;
      return;
    }
    const before = this.rows;
    this.rows = rows;
    this.me = me;
    if (!before) {
      this.send([{ kind: 'snapSlips', slips: slipsOf(rows, me) }], false);
      return;
    }
    const steps = wireSteps(before, rows, me);
    if (steps.length === 0) return;
    this.send(steps, visible);
  }

  ask(on: boolean): void {
    if (on) this.askedAt = Date.now();
  }

  revealed(): void {
    this.queue.shift();
    if (!this.queue.some((e) => e.staged)) this.onStaging(false);
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

  private asked(): boolean {
    return this.askedAt !== null && Date.now() - this.askedAt < ASK_WINDOW_MS;
  }

  private record(newest: BankLoan | null): void {
    this.loan = newest;
    this.loansSeen = true;
  }

  private send(steps: readonly BankStep[], visible: boolean): void {
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
