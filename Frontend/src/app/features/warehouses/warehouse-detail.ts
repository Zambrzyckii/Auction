import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { tap } from 'rxjs';
import { actionState } from '../../core/actions/action-state';
import {
  FriendSummary,
  OwnProfile,
  WarehouseDetails,
  Wallet as WalletDto,
} from '../../core/api/models';
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
  imports: [DecimalPipe, FormField, RouterLink],
  templateUrl: './warehouse-detail.html',
})
export class WarehouseDetail {
  private readonly http = inject(HttpClient);
  protected readonly session = inject(Session);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  private readonly warLoadedAt = signal(0);

  readonly warPoller = startPolling(
    () =>
      this.http
        .get<WarehouseDetails>(`/api/warehouses/${this.id}`)
        .pipe(tap(() => this.warLoadedAt.set(Date.now()))),
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
  readonly action = actionState();
  readonly friends = signal<readonly FriendSummary[]>([]);
  readonly inviteModel = signal({ friendUserId: '' });
  protected readonly inviteForm = form(this.inviteModel);

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
    const joined = this.joinedAt();
    return (
      war !== null && joined !== null && this.warLoadedAt() > joined && entryRejected(joined, war)
    );
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
    if (this.joinProblem() !== null) {
      return;
    }
    this.action.run(this.http.post(`/api/warehouses/${this.id}/join`, null), () => {
      this.joinedAt.set(Date.now());
      this.refreshBoth();
    });
  }

  leave(): void {
    const war = this.warPoller.value();
    if (war === null || !canLeave(war, this.now())) {
      return;
    }
    this.action.run(this.http.post(`/api/warehouses/${this.id}/leave`, null), () => {
      this.joinedAt.set(null);
      this.refreshBoth();
    });
  }

  invite(): void {
    const friendUserId = this.inviteModel().friendUserId;
    if (friendUserId === '') {
      return;
    }
    this.action.run(
      this.http.post('/api/profiles/warehouse-invites', {
        friendUserId,
        publicWarehouseId: this.id,
      }),
      () => {
        this.action.notice.set('Invite sent');
        this.refreshBoth();
      },
    );
  }

  raise(increment: number): void {
    const war = this.warPoller.value();
    if (war === null || raiseBlockReason(war, increment, this.now()) !== null) {
      return;
    }
    this.action.run(this.http.post(`/api/warehouses/${this.id}/bids`, { increment }), () =>
      this.refreshBoth(),
    );
  }

  private refreshBoth(): void {
    this.warPoller.refresh();
    this.walletPoller.refresh();
  }

  constructor() {
    this.http.get<OwnProfile>('/api/profiles/me').subscribe({
      next: (profile) => this.friends.set(profile.friends),
      error: () => this.friends.set([]),
    });
    effect(() => {
      const status = this.warPoller.value()?.status;
      if (status === 'Settled' || status === 'Cancelled') {
        this.warPoller.stop();
        this.walletPoller.stop();
      }
    });
  }
}
