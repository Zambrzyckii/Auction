import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { toApiError } from '../../core/api/api-error';
import { Casino as CasinoDto, ChipPurchase, Wallet as WalletDto } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { startPolling } from '../../core/polling/poll';

const WALLET_POLL_MS = 5000;

export function casinoPollMs(casino: CasinoDto | null): number {
  return casino?.latestPurchase?.status === 'Pending' ? 2000 : 5000;
}

export function purchaseProblem(
  amount: number,
  wallet: WalletDto,
  casino: CasinoDto,
): string | null {
  if (!(amount > 0)) return 'Amount must be above zero.';
  if (!Number.isInteger(amount)) return 'Amount must be a whole number of chips';
  if (casino.latestPurchase?.status === 'Pending') {
    return 'Another chip purchase is already in progress';
  }
  if (amount > wallet.availableFunds) return 'Not enough funds on account';
  return null;
}

export function purchaseNotice(latest: ChipPurchase | null): string | null {
  if (latest === null) {
    return null;
  }
  switch (latest.status) {
    case 'Pending':
      return `Purchase of ${latest.amount} chips is pending…`;
    case 'Completed':
      return `Bought ${latest.amount} chips`;
    case 'Rejected':
      return `Purchase of ${latest.amount} chips was rejected. ${latest.rejectionReason}`;
    case 'Expired':
      return `Purchase of ${latest.amount} chips expired, the chips still arrive if your wallet was charged`;
  }
}

@Component({
  selector: 'app-casino',
  imports: [DecimalPipe, FormField],
  templateUrl: './casino.html',
})
export class Casino {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);

  readonly casinoPoller = startPolling(
    () => this.http.get<CasinoDto>('/api/casino'),
    (latest) => casinoPollMs(latest),
  );

  readonly walletPoller = startPolling(
    () => this.http.get<WalletDto>(`/api/wallets/${this.session.userId()}`),
    WALLET_POLL_MS,
  );

  readonly notice = computed(() => purchaseNotice(this.casinoPoller.value()?.latestPurchase ?? null));

  private readonly buyModel = signal({ amount: 0 });
  protected readonly buyForm = form(this.buyModel);
  readonly buyPending = signal(false);
  readonly buyError = signal<string | null>(null);

  readonly buyProblem = computed<string | null>(() => {
    const casino = this.casinoPoller.value();
    const funds = this.walletPoller.value();
    if (casino === null || funds === null) {
      return 'Loading…';
    }
    return purchaseProblem(this.buyModel().amount, funds, casino);
  });

  buy(): void {
    if (this.buyProblem() !== null) {
      return;
    }
    const { amount } = this.buyModel();
    this.buyPending.set(true);
    this.buyError.set(null);
    this.http.post('/api/casino/chips/purchases', { amount }).subscribe({
      next: () => {
        this.buyPending.set(false);
        this.casinoPoller.refresh();
      },
      error: (err: unknown) => {
        this.buyError.set(toApiError(err).message);
        this.buyPending.set(false);
      },
    });
  }
}
