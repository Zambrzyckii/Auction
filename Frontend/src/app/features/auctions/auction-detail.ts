import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Auction, AuctionBid } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';

const POLL_MS = 2500;

@Component({
  selector: 'app-auction-detail',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './auction-detail.html',
})
export class AuctionDetail {
  private readonly http = inject(HttpClient);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly session = inject(Session);

  readonly poller = startPolling(
    () => this.http.get<Auction>(`/api/auctions/${this.id}`),
    POLL_MS,
  );

  readonly bidsPoller = startPolling(
    () => this.http.get<AuctionBid[]>(`/api/auctions/${this.id}/bids`),
    POLL_MS,
  );

  readonly timeLeft = timeLeft;

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
    return bid.bidderUserId === this.session.userId() ? 'You' : bid.bidderUserId.slice(0, 8);
  }
}
