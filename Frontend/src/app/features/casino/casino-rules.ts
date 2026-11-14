import { Casino as CasinoDto, ChipPurchase, Wallet as WalletDto } from '../../core/api/models';

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

export function cashOutProblem(amount: number, casino: CasinoDto): string | null {
  if (!(amount > 0)) return 'Amount must be above zero.';
  if (Math.round(amount * 100) / 100 !== amount) {
    return 'Amount cannot have more than two decimal places';
  }
  if (amount > casino.balance) return 'Not enough chips on account';
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
