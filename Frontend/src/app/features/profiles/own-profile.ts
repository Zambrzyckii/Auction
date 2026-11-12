import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { Observable, retry, tap, throwError, timer } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { OwnProfile as OwnProfileDto } from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { ProfileDirectory } from '../../core/profiles/profile-directory';

const POLL_MS = 5000;
const PROVISIONING_RETRY_MS = 1500;
const PROVISIONING_WINDOW_MS = 30_000;

@Component({
  selector: 'app-own-profile',
  imports: [DatePipe],
  templateUrl: './own-profile.html',
})
export class OwnProfile {
  private readonly http = inject(HttpClient);
  private readonly directory = inject(ProfileDirectory);
  private readonly provisioningDeadline = Date.now() + PROVISIONING_WINDOW_MS;

  readonly poller = startPolling(() => this.loadProfile(), POLL_MS);

  private loadProfile(): Observable<OwnProfileDto> {
    return this.http.get<OwnProfileDto>('/api/profiles/me').pipe(
      retry({
        delay: (err: unknown) =>
          toApiError(err).status === 404 && Date.now() < this.provisioningDeadline
            ? timer(PROVISIONING_RETRY_MS)
            : throwError(() => err),
      }),
      tap((profile) => {
        for (const friend of profile.friends) {
          this.directory.remember(friend.userId, friend.username);
        }
      }),
    );
  }
}
