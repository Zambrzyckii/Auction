import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { actionState } from '../../core/actions/action-state';
import { toApiError } from '../../core/api/api-error';
import { Loan, LoanOffer, Wallet as WalletDto } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { clock } from '../../core/time/clock';
import { loansPollMs, offerBlockReason, repayHint } from './bank-rules';

const WALLET_POLL_MS = 5000;

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

  readonly request = actionState();
  readonly collection = actionState();

  readonly requestedNotice = computed<string | null>(() =>
    (this.loansPoller.value() ?? []).some((loan) => loan.status === 'PendingApproval')
      ? 'Loan requested, waiting for approval…'
      : null,
  );

  readonly collectionNotice = computed<string | null>(() =>
    (this.loansPoller.value() ?? []).some((loan) => loan.status === 'CollectionPending')
      ? 'Collection requested…'
      : null,
  );

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
    this.request.run(this.http.post('/api/bank/loans', { offerName: offer.name }), () =>
      this.loansPoller.refresh(),
    );
  }

  showsRepay(loan: Loan): boolean {
    return (
      loan.status === 'Active' || loan.status === 'Overdue' || loan.status === 'CollectionPending'
    );
  }

  repayPreview(loan: Loan): string | null {
    const funds = this.walletPoller.value();
    return funds === null ? null : repayHint(loan, funds);
  }

  repay(loan: Loan): void {
    if (loan.status !== 'Active' && loan.status !== 'Overdue') {
      return;
    }
    this.collection.run(
      this.http.post(`/api/bank/loans/${loan.publicLoanId}/repayments`, null),
      () => this.loansPoller.refresh(),
    );
  }

  constructor() {
    this.http.get<LoanOffer[]>('/api/bank/offers').subscribe({
      next: (offers) => this.offers.set(offers),
      error: (err: unknown) => this.offersError.set(toApiError(err).message),
    });
  }
}
