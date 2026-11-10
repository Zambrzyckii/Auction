import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Auction } from '../../core/api/models';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';

const POLL_MS = 2500;

@Component({
  selector: 'app-auction-detail',
  imports: [DecimalPipe],
  templateUrl: './auction-detail.html',
})
export class AuctionDetail {
  private readonly http = inject(HttpClient);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');

  readonly poller = startPolling(
    () => this.http.get<Auction>(`/api/auctions/${this.id}`),
    POLL_MS,
  );

  readonly timeLeft = timeLeft;

  constructor() {
    effect(() => {
      const status = this.poller.value()?.status;
      if (status === 'Closed' || status === 'Cancelled') {
        this.poller.stop();
      }
    });
  }
}
