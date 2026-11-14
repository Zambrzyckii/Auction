import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { WarehouseDetails, Wallet as WalletDto } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { clock } from '../../core/time/clock';
import {
  WAREHOUSE_TIERS,
  canLeave,
  entryRejected,
  joinBlockReason,
  raiseBlockReason,
  warehousePollMs,
} from './warehouse-rules';

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
  readonly canLeave = canLeave;

  readonly joinedAt = signal<number | null>(null);
  readonly actionPending = signal(false);
  readonly warNotice = signal<string | null>(null);

  readonly joinProblem = computed<string | null>(() => {
    const war = this.warPoller.value();
    const funds = this.walletPoller.value();
    if (war === null || funds === null) {
      return 'Loading…';
    }
    return joinBlockReason(war, funds, this.now());
  });

  readonly rejectedEntry = computed<boolean>(() => {
    const war = this.warPoller.value();
    return war !== null && entryRejected(this.joinedAt(), war);
  });

  knownTier(war: WarehouseDetails): boolean {
    return WAREHOUSE_TIERS.has(war.tier);
  }

  increments(war: WarehouseDetails): readonly number[] {
    return WAREHOUSE_TIERS.get(war.tier)?.increments ?? [];
  }

  raiseProblem(war: WarehouseDetails, increment: number): string | null {
    return raiseBlockReason(war, increment, this.now());
  }

  join(): void {
    if (this.actionPending() || this.joinProblem() !== null) {
      return;
    }
    this.act(`/api/warehouses/${this.id}/join`, null, () => this.joinedAt.set(Date.now()));
  }

  leave(): void {
    const war = this.warPoller.value();
    if (this.actionPending() || war === null || !canLeave(war, this.now())) {
      return;
    }
    this.act(`/api/warehouses/${this.id}/leave`, null, () => this.joinedAt.set(null));
  }

  raise(increment: number): void {
    const war = this.warPoller.value();
    if (this.actionPending() || war === null || raiseBlockReason(war, increment, this.now()) !== null) {
      return;
    }
    this.act(`/api/warehouses/${this.id}/bids`, { increment });
  }

  private act(url: string, body: unknown, onSuccess?: () => void): void {
    this.actionPending.set(true);
    this.warNotice.set(null);
    this.http.post(url, body).subscribe({
      next: () => {
        this.actionPending.set(false);
        onSuccess?.();
        this.warPoller.refresh();
        this.walletPoller.refresh();
      },
      error: (err: unknown) => {
        this.warNotice.set(toApiError(err).message);
        this.actionPending.set(false);
      },
    });
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
