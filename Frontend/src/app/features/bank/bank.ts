import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { toApiError } from '../../core/api/api-error';
import { Loan, LoanOffer, Wallet as WalletDto } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { clock } from '../../core/time/clock';

const WALLET_POLL_MS = 5000;

export function loansPollMs(loans: readonly Loan[] | null): number {
  const busy = (loans ?? []).some(
    (loan) => loan.status === 'PendingApproval' || loan.status === 'CollectionPending',
  );
  return busy ? 2000 : 5000;
}

@Component({
  selector: 'app-bank',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './bank.html',
})
export class Bank {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);

  readonly offers = signal<readonly LoanOffer[] | null>(null);
  readonly offersError = signal<string | null>(null);

  readonly loansPoller = startPolling(
    () => this.http.get<Loan[]>('/api/bank/loans'),
    (latest) => loansPollMs(latest),
  );

  readonly walletPoller = startPolling(
    () => this.http.get<WalletDto>(`/api/wallets/${this.session.userId()}`),
    WALLET_POLL_MS,
  );

  readonly now = clock();
  readonly timeLeft = timeLeft;

  constructor() {
    this.http.get<LoanOffer[]>('/api/bank/offers').subscribe({
      next: (offers) => this.offers.set(offers),
      error: (err: unknown) => this.offersError.set(toApiError(err).message),
    });
  }
}
