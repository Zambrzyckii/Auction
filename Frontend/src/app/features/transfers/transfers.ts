import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import {
  FriendSummary,
  OwnProfile as OwnProfileDto,
  Transfer,
  Wallet as WalletDto,
} from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { startPolling } from '../../core/polling/poll';
import { ProfileDirectory } from '../../core/profiles/profile-directory';

const WALLET_POLL_MS = 5000;
const HISTORY_POLL_MS = 10_000;

@Component({
  selector: 'app-transfers',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './transfers.html',
})
export class Transfers {
  private readonly http = inject(HttpClient);
  protected readonly session = inject(Session);
  protected readonly directory = inject(ProfileDirectory);

  readonly walletPoller = startPolling(
    () => this.http.get<WalletDto>(`/api/wallets/${this.session.userId()}`),
    WALLET_POLL_MS,
  );

  readonly historyPoller = startPolling(
    () =>
      this.http
        .get<Transfer[]>(`/api/wallets/${this.session.userId()}/transfers`)
        .pipe(tap((rows) => this.directory.ensure(rows.map((row) => this.otherParty(row))))),
    HISTORY_POLL_MS,
  );

  readonly friends = signal<readonly FriendSummary[] | null>(null);
  readonly friendsError = signal<string | null>(null);

  constructor() {
    this.http.get<OwnProfileDto>('/api/profiles/me').subscribe({
      next: (me) => {
        for (const friend of me.friends) {
          this.directory.remember(friend.userId, friend.username);
        }
        this.friends.set(me.friends);
      },
      error: (err: unknown) => {
        this.friends.set([]);
        this.friendsError.set(toApiError(err).message);
      },
    });
  }

  otherParty(row: Transfer): string {
    return row.senderUserId === this.session.userId() ? row.recipientUserId : row.senderUserId;
  }
}
