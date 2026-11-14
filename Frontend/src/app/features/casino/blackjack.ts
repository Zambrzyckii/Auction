import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import {
  BlackjackHand,
  BlackjackHandHistory,
  BlackjackLimits,
  Casino as CasinoDto,
} from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { casinoPollMs } from './casino';
import { HandView, fromHand } from './hand-view';

const HISTORY_POLL_MS = 10_000;

const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const CARD_SUITS = ['♣', '♦', '♥', '♠'] as const;

export function cardLabel(code: number): string {
  return CARD_RANKS[code % 13] + CARD_SUITS[Math.floor(code / 13)];
}

export function canDouble(hand: HandView, balance: number): boolean {
  return (
    hand.status === 'InProgress' &&
    hand.playerCards.length === 2 &&
    !hand.doubled &&
    balance >= hand.stake
  );
}

export function dealProblem(stake: number, limits: BlackjackLimits, balance: number): string | null {
  if (stake < limits.minBet || stake > limits.maxBet) {
    return `Stake must be between ${limits.minBet} and ${limits.maxBet}`;
  }
  if (!Number.isInteger(stake)) return 'Chip amount is not valid';
  if (stake > balance) return 'Not enough chips on account';
  return null;
}

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
  readonly actionPending = signal(false);
  readonly tableNotice = signal<string | null>(null);

  readonly cardLabel = cardLabel;

  private readonly dealModel = signal({ stake: 5 });
  protected readonly dealForm = form(this.dealModel);

  readonly dealFormProblem = computed<string | null>(() => {
    const casino = this.casinoPoller.value();
    if (casino === null) {
      return 'Loading…';
    }
    return dealProblem(this.dealModel().stake, casino.blackjack, casino.balance);
  });

  readonly doubleAllowed = computed<boolean>(() => {
    const current = this.hand();
    const casino = this.casinoPoller.value();
    return current !== null && casino !== null && canDouble(current, casino.balance);
  });

  deal(): void {
    if (this.actionPending() || this.dealFormProblem() !== null) {
      return;
    }
    const { stake } = this.dealModel();
    this.request(this.http.post<BlackjackHand>('/api/casino/blackjack/hands', { stake }));
  }

  act(action: BlackjackAction): void {
    const current = this.hand();
    if (this.actionPending() || current === null || current.status !== 'InProgress') {
      return;
    }
    this.request(
      this.http.post<BlackjackHand>(
        `/api/casino/blackjack/hands/${current.publicHandId}/actions`,
        { action },
      ),
    );
  }

  newHand(): void {
    this.hand.set(null);
    this.tableNotice.set(null);
  }

  private request(call: ReturnType<typeof this.http.post<BlackjackHand>>): void {
    this.actionPending.set(true);
    this.tableNotice.set(null);
    call.subscribe({
      next: (dto) => {
        this.actionPending.set(false);
        this.hand.set(fromHand(dto, Date.now()));
        this.casinoPoller.refresh();
        if (dto.status === 'Completed') {
          this.historyPoller.refresh();
        }
      },
      error: (err: unknown) => {
        this.tableNotice.set(toApiError(err).message);
        this.actionPending.set(false);
      },
    });
  }
}
