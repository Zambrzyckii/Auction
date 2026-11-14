import { AuctionBid, AuctionStatus, MyAuction } from '../../core/api/models';

export interface AuctionGroups {
  readonly running: readonly MyAuction[];
  readonly finished: readonly MyAuction[];
}

const RUNNING_STATUSES: ReadonlySet<AuctionStatus> = new Set(['Pending', 'Active']);

export function auctionGroups(auctions: readonly MyAuction[]): AuctionGroups {
  return {
    running: auctions.filter((a) => RUNNING_STATUSES.has(a.status)),
    finished: auctions.filter((a) => !RUNNING_STATUSES.has(a.status)),
  };
}

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
