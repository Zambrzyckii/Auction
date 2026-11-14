import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import {
  Casino as CasinoDto,
  RouletteBet,
  RouletteBetType,
  RouletteLimits,
  RouletteSpin,
  RouletteSpinResult,
} from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { casinoPollMs } from './casino';

const HISTORY_POLL_MS = 10_000;

export const ROULETTE_BET_TYPES: readonly RouletteBetType[] = [
  'Straight',
  'Red',
  'Black',
  'Odd',
  'Even',
  'Low',
  'High',
  'Dozen',
  'Column',
];

const SELECTION_TYPES: readonly RouletteBetType[] = ['Straight', 'Dozen', 'Column'];

function hasValidSelection({ type, selection }: RouletteBet): boolean {
  switch (type) {
    case 'Straight':
      return selection !== null && selection >= 0 && selection <= 36;
    case 'Dozen':
    case 'Column':
      return selection !== null && selection >= 1 && selection <= 3;
    default:
      return selection === null;
  }
}

export function betProblem(bet: RouletteBet, limits: RouletteLimits): string | null {
  if (!hasValidSelection(bet)) {
    return 'Bet selection does not match its type';
  }
  if (!Number.isInteger(bet.stake) || bet.stake < limits.minBet || bet.stake > limits.maxBet) {
    return 'Each stake must be a whole number of chips within the table limits';
  }
  return null;
}

export function spinProblem(bets: readonly RouletteBet[], casino: CasinoDto): string | null {
  const max = casino.roulette.maxBetsPerSpin;
  if (bets.length < 1 || bets.length > max) {
    return `A spin takes between 1 and ${max} bets`;
  }
  const total = bets.reduce((sum, bet) => sum + bet.stake, 0);
  if (total > casino.balance) return 'Not enough chips on account';
  return null;
}

@Component({
  selector: 'app-roulette',
  imports: [DatePipe, DecimalPipe, FormField, RouterLink],
  templateUrl: './roulette.html',
})
export class Roulette {
  private readonly http = inject(HttpClient);

  readonly casinoPoller = startPolling(
    () => this.http.get<CasinoDto>('/api/casino'),
    (latest) => casinoPollMs(latest),
  );

  readonly historyPoller = startPolling(
    () => this.http.get<RouletteSpin[]>('/api/casino/roulette/spins'),
    HISTORY_POLL_MS,
  );

  readonly betTypes = ROULETTE_BET_TYPES;
  readonly bets = signal<readonly RouletteBet[]>([]);
  readonly totalStake = computed(() => this.bets().reduce((sum, bet) => sum + bet.stake, 0));
  readonly lastSpin = signal<RouletteSpinResult | null>(null);
  readonly spinPending = signal(false);
  readonly spinError = signal<string | null>(null);

  private readonly betModel = signal({
    type: 'Red' as RouletteBetType,
    selection: null as number | null,
    stake: 1,
  });
  protected readonly betForm = form(this.betModel);

  readonly needsSelection = computed(() => SELECTION_TYPES.includes(this.betModel().type));

  readonly candidate = computed<RouletteBet>(() => {
    const { type, selection, stake } = this.betModel();
    return { type, selection: this.needsSelection() ? selection : null, stake };
  });

  readonly addBetProblem = computed<string | null>(() => {
    const casino = this.casinoPoller.value();
    return casino === null ? 'Loading…' : betProblem(this.candidate(), casino.roulette);
  });

  readonly spinFormProblem = computed<string | null>(() => {
    const casino = this.casinoPoller.value();
    return casino === null ? 'Loading…' : spinProblem(this.bets(), casino);
  });

  addBet(): void {
    if (this.addBetProblem() !== null) {
      return;
    }
    const next = this.candidate();
    this.bets.update((list) => [...list, next]);
  }

  removeBet(index: number): void {
    this.bets.update((list) => list.filter((_, i) => i !== index));
  }

  spin(): void {
    if (this.spinPending() || this.spinFormProblem() !== null) {
      return;
    }
    this.spinPending.set(true);
    this.spinError.set(null);
    this.http
      .post<RouletteSpinResult>('/api/casino/roulette/spins', { bets: this.bets() })
      .subscribe({
        next: (result) => {
          this.spinPending.set(false);
          this.lastSpin.set(result);
          this.casinoPoller.refresh();
          this.historyPoller.refresh();
        },
        error: (err: unknown) => {
          this.spinError.set(toApiError(err).message);
          this.spinPending.set(false);
        },
      });
  }
}
