import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { tap } from 'rxjs';
import { actionState } from '../../core/actions/action-state';
import { Auction, AuctionBid } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { isBidConfirmed } from './auction-rules';

const POLL_MS = 2500;
const CONFIRM_WAIT_MS = 20_000;

@Component({
  selector: 'app-auction-detail',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './auction-detail.html',
})
export class AuctionDetail {
  private readonly http = inject(HttpClient);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  private readonly encodedId = encodeURIComponent(this.id ?? '');
  protected readonly session = inject(Session);
  private readonly directory = inject(ProfileDirectory);

  readonly poller = startPolling(
    () => this.http.get<Auction>(`/api/auctions/${this.encodedId}`),
    POLL_MS,
  );

  readonly bidsPoller = startPolling(
    () =>
      this.http
        .get<AuctionBid[]>(`/api/auctions/${this.encodedId}/bids`)
        .pipe(tap((bids) => this.directory.ensure(bids.map((b) => b.bidderUserId)))),
    POLL_MS,
  );

  readonly timeLeft = timeLeft;

  readonly bidAmount = signal(0);
  readonly bidding = actionState();
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
    const amount = this.bidAmount();
    this.bidding.run(this.http.post(`/api/auctions/${this.encodedId}/bid`, { amount }), () => {
      this.pendingBid.set({ amount, placedAt: Date.now() });
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
