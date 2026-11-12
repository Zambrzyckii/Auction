import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { Auction, AuctionBid } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { ProfileDirectory } from '../../core/profiles/profile-directory';

const POLL_MS = 2500;
const CONFIRM_WAIT_MS = 20_000;

export function isBidConfirmed(
  bids: readonly AuctionBid[],
  userId: string | null,
  amount: number,
): boolean {
  if (!bids.some((b) => b.bidderUserId === userId && amount === b.amount)) return false;

  return true;
}

@Component({
  selector: 'app-auction-detail',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './auction-detail.html',
})
export class AuctionDetail {
  private readonly http = inject(HttpClient);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly session = inject(Session);
  private readonly directory = inject(ProfileDirectory);

  readonly poller = startPolling(
    () => this.http.get<Auction>(`/api/auctions/${this.id}`),
    POLL_MS,
  );

  readonly bidsPoller = startPolling(
    () =>
      this.http
        .get<AuctionBid[]>(`/api/auctions/${this.id}/bids`)
        .pipe(tap((bids) => this.directory.ensure(bids.map((b) => b.bidderUserId)))),
    POLL_MS,
  );

  readonly timeLeft = timeLeft;

  readonly bidAmount = signal(0);
  readonly bidNotice = signal<string | null>(null);
  readonly bidPending = signal(false);
  private readonly pendingBid = signal<{ amount: number; placedAt: number } | null>(null);

  readonly bidConfirmation = computed<string | null>(() => {
    const pending = this.pendingBid();
    if (pending === null) {
      return null;
    }
    const bids = this.bidsPoller.value() ?? [];
    if (isBidConfirmed(bids, this.session.userId(), pending.amount)) {
      return 'Bid confirmed.';
    }
    if (Date.now() - pending.placedAt > CONFIRM_WAIT_MS) {
      return 'Bid not confirmed yet. It usually lands within ten seconds, so it may have been rejected.';
    }
    return 'Bid accepted, waiting for confirmation…';
  });

  readonly bidBlockReason = computed<string | null>(() => {
    const auction = this.poller.value();
    const userId = this.session.userId();
    const amount = this.bidAmount();
    if (auction === null || userId === null) {
      return 'Log in to bid.';
    }
    if (!(amount > auction.currentPrice)) {
      return 'Your bid must be higher than the current price.';
    }
    if (userId === auction.sellerUserId) {
      return 'You cannot bid on your own auction.';
    }
    if (userId === auction.currentWinningUserId) {
      return 'You are already the highest bidder.';
    }
    return null;
  });

  setBidAmount(event: Event): void {
    this.bidAmount.set((event.target as HTMLInputElement).valueAsNumber);
  }

  placeBid(): void {
    this.bidPending.set(true);
    this.bidNotice.set(null);
    const amount = this.bidAmount();
    this.http.post(`/api/auctions/${this.id}/bid`, { amount }).subscribe({
      next: () => {
        this.pendingBid.set({ amount, placedAt: Date.now() });
        this.bidPending.set(false);
      },
      error: (err: unknown) => {
        this.bidNotice.set(toApiError(err).message);
        this.bidPending.set(false);
      },
    });
  }

  constructor() {
    effect(() => {
      const status = this.poller.value()?.status;
      if (status === 'Closed' || status === 'Cancelled') {
        this.poller.stop();
        this.bidsPoller.stop();
      }
    });
  }

  bidderLabel(bid: AuctionBid): string {
    return bid.bidderUserId === this.session.userId() ? 'You' : this.directory.label(bid.bidderUserId);
  }
}
