import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auction } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { AUCTION_SETTLE_MS } from '../../core/push/push-topics';
import { refreshOn } from '../../core/push/refresh-on';
import { Countdown } from '../../pixel/items/countdown';
import { ItemTile } from '../../pixel/items/item-tile';

const POLL_MS = 10_000;

@Component({
  selector: 'app-auction-list',
  imports: [DecimalPipe, RouterLink, ItemTile, Countdown],
  templateUrl: './auction-list.html',
})
export class AuctionList {
  private readonly http = inject(HttpClient);
  readonly session = inject(Session);

  readonly poller = startPolling(() => this.http.get<Auction[]>('/api/auctions?limit=50'), POLL_MS);

  readonly timeLeft = timeLeft;

  constructor() {
    refreshOn(this.poller, 'AuctionListChanged', undefined, AUCTION_SETTLE_MS);
  }
}
