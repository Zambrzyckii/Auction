import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyAuction } from '../../core/api/models';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { idIn, refreshOn } from '../../core/push/refresh-on';
import { auctionGroups } from './auction-rules';

const POLL_MS = 10_000;

@Component({
  selector: 'app-my-auctions',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './my-auctions.html',
})
export class MyAuctions {
  private readonly http = inject(HttpClient);

  readonly poller = startPolling(() => this.http.get<MyAuction[]>('/api/auctions/mine'), POLL_MS);
  readonly groups = computed(() => auctionGroups(this.poller.value() ?? []));

  readonly timeLeft = timeLeft;

  constructor() {
    refreshOn(
      this.poller,
      'AuctionChanged',
      idIn('auctionId', () => this.poller.value()?.map((a) => a.publicAuctionId) ?? []),
    );
  }
}
