import { AuctionBid } from '../../core/api/models';

export function isBidConfirmed(
  bids: readonly AuctionBid[],
  userId: string | null,
  amount: number,
): boolean {
  if (!bids.some((b) => b.bidderUserId === userId && amount === b.amount)) return false;

  return true;
}

export const MIN_LEAD_MS = 60_000;
export const MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

export function endsOnUtc(local: string): string | null {
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const lead = date.getTime() - Date.now();
  if (lead < MIN_LEAD_MS || lead > MAX_LEAD_MS) {
    return null;
  }
  return date.toISOString();
}
