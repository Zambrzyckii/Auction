import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { catchError, of, throwError } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import {
  Pawnshop as PawnshopDto,
  PawnshopOffers,
  Wallet as WalletDto,
} from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { startPolling } from '../../core/polling/poll';

const WALLET_POLL_MS = 5000;

export type PawnshopState = PawnshopDto | 'none';

export function pawnshopPollMs(state: PawnshopState | null): number {
  if (state !== null && state !== 'none') {
    if (state.status === 'PendingPayment' || state.pendingBotTierName !== null) {
      return 2000;
    }
  }
  return 5000;
}

export function premisesProblem(offers: PawnshopOffers, wallet: WalletDto): string | null {
  if (wallet.lifetimeTurnover < offers.premisesRequiredTurnover) {
    return `Needs lifetime turnover ${offers.premisesRequiredTurnover}, you have ${wallet.lifetimeTurnover}`;
  }
  if (offers.premisesPrice > wallet.availableFunds) {
    return 'Not enough funds on account';
  }
  return null;
}

@Component({
  selector: 'app-pawnshop',
  imports: [DecimalPipe],
  templateUrl: './pawnshop.html',
})
export class Pawnshop {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);

  readonly shopPoller = startPolling<PawnshopState>(
    () =>
      this.http.get<PawnshopDto>('/api/pawnshop').pipe(
        catchError((err: unknown) =>
          toApiError(err).status === 404 ? of('none' as const) : throwError(() => err),
        ),
      ),
    (latest) => pawnshopPollMs(latest),
  );

  readonly walletPoller = startPolling(
    () => this.http.get<WalletDto>(`/api/wallets/${this.session.userId()}`),
    WALLET_POLL_MS,
  );

  readonly offers = signal<PawnshopOffers | null>(null);
  readonly offersError = signal<string | null>(null);

  readonly buyPending = signal(false);
  readonly shopNotice = signal<string | null>(null);

  readonly buyProblem = computed<string | null>(() => {
    const catalog = this.offers();
    const funds = this.walletPoller.value();
    if (catalog === null || funds === null) {
      return 'Loading…';
    }
    return premisesProblem(catalog, funds);
  });

  showsBuy(shop: PawnshopState): boolean {
    return shop === 'none' || shop.status === 'Rejected';
  }

  buyPremises(): void {
    if (this.buyPending() || this.buyProblem() !== null) {
      return;
    }
    this.buyPending.set(true);
    this.shopNotice.set(null);
    this.http.post('/api/pawnshop', null).subscribe({
      next: () => {
        this.buyPending.set(false);
        this.shopNotice.set('Payment pending…');
        this.shopPoller.refresh();
      },
      error: (err: unknown) => {
        this.shopNotice.set(toApiError(err).message);
        this.buyPending.set(false);
      },
    });
  }

  constructor() {
    this.http.get<PawnshopOffers>('/api/pawnshop/offers').subscribe({
      next: (catalog) => this.offers.set(catalog),
      error: (err: unknown) => this.offersError.set(toApiError(err).message),
    });
  }
}
