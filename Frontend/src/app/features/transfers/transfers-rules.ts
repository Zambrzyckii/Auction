import { Wallet } from '../../core/api/models';

export function transferProblem(
  amount: number,
  recipientId: string,
  myId: string | null,
  wallet: Wallet,
): string | null {
  if (!(amount > 0)) return 'Amount must be above zero.';
  if (Math.round(amount * 100) / 100 !== amount) return 'Use at most 2 decimal places.';
  if (recipientId === myId) return 'Cannot transfer funds to yourself';
  if (amount > wallet.availableFunds) return 'Not enough funds on account';
  return null;
}
