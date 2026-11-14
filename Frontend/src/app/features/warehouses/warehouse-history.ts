import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyWarehouse } from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { warOutcome } from './warehouse-rules';

const POLL_MS = 10_000;

@Component({
  selector: 'app-warehouse-history',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './warehouse-history.html',
})
export class WarehouseHistory {
  private readonly http = inject(HttpClient);

  readonly poller = startPolling(
    () => this.http.get<MyWarehouse[]>('/api/warehouses/mine'),
    POLL_MS,
  );

  readonly warOutcome = warOutcome;
}
