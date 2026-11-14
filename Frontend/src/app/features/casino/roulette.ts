import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { actionState } from '../../core/actions/action-state';
import {
  Casino as CasinoDto,
  RouletteBet,
  RouletteBetType,
  RouletteSpin,
  RouletteSpinResult,
} from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { casinoPollMs } from './casino-rules';
import { ROULETTE_BET_TYPES, betProblem, spinProblem } from './roulette-rules';

const HISTORY_POLL_MS = 10_000;

const SELECTION_TYPES: readonly RouletteBetType[] = ['Straight', 'Dozen', 'Column'];

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
  readonly action = actionState();
  readonly actionBalance = signal<number | null>(null);
  private staleCasino: CasinoDto | null = null;

  readonly balance = computed<number | null>(() => {
    const casino = this.casinoPoller.value();
    if (casino === null) {
      return null;
    }
    const seeded = this.actionBalance();
    return casino === this.staleCasino && seeded !== null ? seeded : casino.balance;
  });

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
    const balance = this.balance();
    if (casino === null || balance === null) {
      return 'Loading…';
    }
    return spinProblem(this.bets(), { ...casino, balance });
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
    if (this.spinFormProblem() !== null) {
      return;
    }
    this.action.run(
      this.http.post<RouletteSpinResult>('/api/casino/roulette/spins', { bets: this.bets() }),
      (result) => {
        this.staleCasino = this.casinoPoller.value();
        this.actionBalance.set(result.balance);
        this.lastSpin.set(result);
        this.casinoPoller.refresh();
        this.historyPoller.refresh();
      },
    );
  }
}
