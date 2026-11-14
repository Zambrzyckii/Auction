import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { actionState } from '../../core/actions/action-state';
import { timeLeft } from '../../core/format/time-left';
import { clock } from '../../core/time/clock';
import { BlackjackHand, BlackjackHandHistory, Casino as CasinoDto } from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import {
  HAND_TIMEOUT_MS,
  canDouble,
  cardLabel,
  dealProblem,
  reconcileHand,
} from './blackjack-rules';
import { casinoPollMs } from './casino-rules';
import { HandView, fromHand, fromHistory } from './hand-view';

const HISTORY_POLL_MS = 10_000;

type BlackjackAction = 'Hit' | 'Stand' | 'Double';

@Component({
  selector: 'app-blackjack',
  imports: [DatePipe, DecimalPipe, FormField, RouterLink],
  templateUrl: './blackjack.html',
})
export class Blackjack {
  private readonly http = inject(HttpClient);

  readonly casinoPoller = startPolling(
    () => this.http.get<CasinoDto>('/api/casino'),
    (latest) => casinoPollMs(latest),
  );

  readonly historyPoller = startPolling(
    () => this.http.get<BlackjackHandHistory[]>('/api/casino/blackjack/hands'),
    HISTORY_POLL_MS,
  );

  readonly hand = signal<HandView | null>(null);
  readonly action = actionState();
  readonly actionBalance = signal<number | null>(null);
  private lostHandId: string | null = null;
  private staleCasino: CasinoDto | null = null;

  readonly balance = computed<number | null>(() => {
    const casino = this.casinoPoller.value();
    if (casino === null) {
      return null;
    }
    const seeded = this.actionBalance();
    return casino === this.staleCasino && seeded !== null ? seeded : casino.balance;
  });

  readonly cardLabel = cardLabel;
  readonly now = clock();

  private readonly dealModel = signal({ stake: 5 });
  protected readonly dealForm = form(this.dealModel);

  readonly dealFormProblem = computed<string | null>(() => {
    const casino = this.casinoPoller.value();
    const balance = this.balance();
    if (casino === null || balance === null) {
      return 'Loading…';
    }
    return dealProblem(this.dealModel().stake, casino.blackjack, balance);
  });

  readonly doubleAllowed = computed<boolean>(() => {
    const current = this.hand();
    const balance = this.balance();
    return current !== null && balance !== null && canDouble(current, balance);
  });

  deal(): void {
    if (this.dealFormProblem() !== null) {
      return;
    }
    const { stake } = this.dealModel();
    this.request(this.http.post<BlackjackHand>('/api/casino/blackjack/hands', { stake }));
  }

  act(action: BlackjackAction): void {
    const current = this.hand();
    if (current === null || current.status !== 'InProgress') {
      return;
    }
    this.request(
      this.http.post<BlackjackHand>(`/api/casino/blackjack/hands/${current.publicHandId}/actions`, {
        action,
      }),
    );
  }

  autoStandIn(hand: HandView): string {
    return timeLeft(new Date(hand.lastActionOn + HAND_TIMEOUT_MS).toISOString(), this.now());
  }

  newHand(): void {
    this.hand.set(null);
    this.action.notice.set(null);
  }

  constructor() {
    effect(() => {
      const casino = this.casinoPoller.value();
      if (casino === null || casino === this.staleCasino || this.action.pending()) {
        return;
      }
      const before = untracked(this.hand);
      const next = reconcileHand(before, casino.activeBlackjackHand);
      if (next !== before) {
        this.hand.set(next);
      }
      if (before !== null && before.status === 'InProgress' && next === null) {
        this.lostHandId = before.publicHandId;
        this.historyPoller.refresh();
      }
    });
    effect(() => {
      const rows = this.historyPoller.value();
      if (rows === null || this.lostHandId === null) {
        return;
      }
      const lost = rows.find((row) => row.publicHandId === this.lostHandId);
      if (lost !== undefined) {
        this.lostHandId = null;
        this.hand.set(fromHistory(lost));
      }
    });
  }

  private request(call: Observable<BlackjackHand>): void {
    this.action.run(
      call,
      (dto) => {
        this.staleCasino = this.casinoPoller.value();
        this.actionBalance.set(dto.balance);
        this.hand.set(fromHand(dto, Date.now()));
        this.casinoPoller.refresh();
        if (dto.status === 'Completed') {
          this.historyPoller.refresh();
        }
      },
      () => {
        this.staleCasino = this.casinoPoller.value();
        this.actionBalance.set(null);
        this.casinoPoller.refresh();
      },
    );
  }
}
