import { Loan, LoanOffer, LoanStatus, Wallet as WalletDto } from '../../core/api/models';

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

export function repayHint(loan: Loan, wallet: WalletDto): string | null {
  if (loan.status !== 'Active' && loan.status !== 'Overdue') {
    return null;
  }
  const collect = Math.min(wallet.availableFunds, loan.outstanding);
  if (collect === 0) {
    return 'Nothing to collect now, your available funds are 0';
  }
  if (collect < loan.outstanding) {
    return `This collects ${collect} now, the rest stays outstanding`;
  }
  return `This collects ${collect} now and repays the loan`;
}
