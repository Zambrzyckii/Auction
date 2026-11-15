import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MyWarehouse } from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { idIn, refreshOn } from '../../core/push/refresh-on';
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

  constructor() {
    refreshOn(
      this.poller,
      'WarehouseChanged',
      idIn('warehouseId', () => this.poller.value()?.map((w) => w.publicWarehouseId) ?? []),
    );
  }

  readonly warOutcome = warOutcome;
}
