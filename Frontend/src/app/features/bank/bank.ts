import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { toApiError } from '../../core/api/api-error';
import { Loan, LoanOffer, LoanStatus, Wallet as WalletDto } from '../../core/api/models';
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

const OPEN_LOAN_STATUSES: readonly LoanStatus[] = [
  'PendingApproval',
  'Active',
  'CollectionPending',
  'Overdue',
];

export function offerBlockReason(
  offer: LoanOffer,
  wallet: WalletDto,
  loans: readonly Loan[],
): string | null {
  if (loans.some((loan) => OPEN_LOAN_STATUSES.includes(loan.status))) {
    return 'User already has an open loan';
  }
  if (wallet.lifetimeTurnover < offer.requiredTurnover) {
    return `Needs lifetime turnover ${offer.requiredTurnover}, you have ${wallet.lifetimeTurnover}`;
  }
  return null;
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

  readonly requestPending = signal(false);
  readonly bankNotice = signal<string | null>(null);

  offerProblem(offer: LoanOffer): string | null {
    const funds = this.walletPoller.value();
    const loans = this.loansPoller.value();
    if (funds === null || loans === null) {
      return 'Loading…';
    }
    return offerBlockReason(offer, funds, loans);
  }

  requestLoan(offer: LoanOffer): void {
    if (this.offerProblem(offer) !== null) {
      return;
    }
    this.requestPending.set(true);
    this.bankNotice.set(null);
    this.http.post('/api/bank/loans', { offerName: offer.name }).subscribe({
      next: () => {
        this.requestPending.set(false);
        this.bankNotice.set('Loan requested, waiting for approval…');
        this.loansPoller.refresh();
      },
      error: (err: unknown) => {
        this.bankNotice.set(toApiError(err).message);
        this.requestPending.set(false);
      },
    });
  }

  constructor() {
    this.http.get<LoanOffer[]>('/api/bank/offers').subscribe({
      next: (offers) => this.offers.set(offers),
      error: (err: unknown) => this.offersError.set(toApiError(err).message),
    });
  }
}
