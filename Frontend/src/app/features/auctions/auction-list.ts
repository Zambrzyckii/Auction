import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auction } from '../../core/api/models';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';

const POLL_MS = 10_000;

@Component({
  selector: 'app-auction-list',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './auction-list.html',
})
export class AuctionList {
  private readonly http = inject(HttpClient);

  readonly poller = startPolling(() => this.http.get<Auction[]>('/api/auctions?limit=50'), POLL_MS);

  readonly timeLeft = timeLeft;
}
