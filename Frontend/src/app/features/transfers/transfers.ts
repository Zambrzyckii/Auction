import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormField, form } from '@angular/forms/signals';
import { tap } from 'rxjs';
import { actionState } from '../../core/actions/action-state';
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
import { transferProblem } from './transfers-rules';

const WALLET_POLL_MS = 5000;
const HISTORY_POLL_MS = 10_000;
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-transfers',
  imports: [DatePipe, DecimalPipe, FormField],
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

  private readonly sendModel = signal({
    recipientUserId: inject(ActivatedRoute).snapshot.queryParamMap.get('to') ?? '',
    amount: 0,
  });
  protected readonly sendForm = form(this.sendModel);
  readonly transfer = actionState();

  readonly sendProblem = computed<string | null>(() => {
    const funds = this.walletPoller.value();
    if (funds === null) {
      return 'Loading…';
    }
    const { recipientUserId, amount } = this.sendModel();
    if (!GUID_RE.test(recipientUserId)) {
      return 'Enter a recipient id (a GUID).';
    }
    return transferProblem(amount, recipientUserId, this.session.userId(), funds);
  });

  readonly recipientPreview = computed<string | null>(() => {
    const id = this.sendModel().recipientUserId;
    return GUID_RE.test(id) ? this.directory.labelWithId(id) : null;
  });

  readonly recipientWarning = computed<string | null>(() => {
    const id = this.sendModel().recipientUserId;
    const friends = this.friends();
    if (!GUID_RE.test(id) || id === this.session.userId() || friends === null) {
      return null;
    }
    return friends.some((friend) => friend.userId === id)
      ? null
      : 'This player is not on your friends list, double-check the id';
  });

  send(): void {
    if (this.sendProblem() !== null) {
      return;
    }
    const { recipientUserId, amount } = this.sendModel();
    this.transfer.run(this.http.post('/api/wallets/transfers', { recipientUserId, amount }), () => {
      this.transfer.notice.set('Sent.');
      this.walletPoller.refresh();
      this.historyPoller.refresh();
    });
  }

  constructor() {
    effect(() => {
      const id = this.sendModel().recipientUserId;
      if (GUID_RE.test(id)) {
        this.directory.ensure([id]);
      }
    });
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
