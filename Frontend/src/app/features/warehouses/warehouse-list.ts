import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';
import { WarehouseInvite, WarehouseSummary } from '../../core/api/models';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { clock } from '../../core/time/clock';

const LIST_POLL_MS = 5000;
const INVITES_POLL_MS = 10_000;
export const INVITE_TTL_MS = 900_000;

@Component({
  selector: 'app-warehouse-list',
  imports: [DecimalPipe, RouterLink],
  templateUrl: './warehouse-list.html',
})
export class WarehouseList {
  private readonly http = inject(HttpClient);
  private readonly directory = inject(ProfileDirectory);

  readonly listPoller = startPolling(
    () => this.http.get<WarehouseSummary[]>('/api/warehouses?limit=20'),
    LIST_POLL_MS,
  );

  readonly invitesPoller = startPolling(
    () =>
      this.http.get<WarehouseInvite[]>('/api/profiles/warehouse-invites').pipe(
        tap((rows) => {
          for (const row of rows) {
            this.directory.remember(row.inviterUserId, row.inviterUsername);
          }
        }),
      ),
    INVITES_POLL_MS,
  );

  readonly now = clock();
  readonly timeLeft = timeLeft;

  readonly activeInvites = computed<readonly WarehouseInvite[]>(() => {
    const rows = this.invitesPoller.value() ?? [];
    return rows.filter((row) => Date.parse(row.createdOn) + INVITE_TTL_MS > this.now());
  });

  expiresIn(invite: WarehouseInvite): string {
    return timeLeft(new Date(Date.parse(invite.createdOn) + INVITE_TTL_MS).toISOString(), this.now());
  }
}
