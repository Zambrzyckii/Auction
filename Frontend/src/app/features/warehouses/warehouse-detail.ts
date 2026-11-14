import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WarehouseDetails, Wallet as WalletDto } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { clock } from '../../core/time/clock';
import { WAREHOUSE_TIERS, warehousePollMs } from './warehouse-rules';

const WALLET_POLL_MS = 5000;

@Component({
  selector: 'app-warehouse-detail',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './warehouse-detail.html',
})
export class WarehouseDetail {
  private readonly http = inject(HttpClient);
  protected readonly session = inject(Session);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  readonly warPoller = startPolling(
    () => this.http.get<WarehouseDetails>(`/api/warehouses/${this.id}`),
    (latest) => warehousePollMs(latest),
  );

  readonly walletPoller = startPolling(
    () => this.http.get<WalletDto>(`/api/wallets/${this.session.userId()}`),
    WALLET_POLL_MS,
  );

  readonly now = clock();
  readonly timeLeft = timeLeft;

  knownTier(war: WarehouseDetails): boolean {
    return WAREHOUSE_TIERS.has(war.tier);
  }

  constructor() {
    effect(() => {
      const status = this.warPoller.value()?.status;
      if (status === 'Settled' || status === 'Cancelled') {
        this.warPoller.stop();
        this.walletPoller.stop();
      }
    });
  }
}
