import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { Observable, retry, throwError, timer } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { Wallet as WalletDto } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { startPolling } from '../../core/polling/poll';

const POLL_MS = 5000;
const PROVISIONING_RETRY_MS = 1500;
const PROVISIONING_WINDOW_MS = 30_000;

@Component({
  selector: 'app-wallet',
  imports: [DecimalPipe],
  templateUrl: './wallet.html',
})
export class Wallet {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);
  private readonly provisioningDeadline = Date.now() + PROVISIONING_WINDOW_MS;

  readonly poller = startPolling(() => this.loadWallet(), POLL_MS);

  private loadWallet(): Observable<WalletDto> {
    return this.http.get<WalletDto>(`/api/wallets/${this.session.userId()}`).pipe(
      retry({
        delay: (err: unknown) =>
          toApiError(err).status === 404 && Date.now() < this.provisioningDeadline
            ? timer(PROVISIONING_RETRY_MS)
            : throwError(() => err),
      }),
    );
  }
}
