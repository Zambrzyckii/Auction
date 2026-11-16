import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LoginResponse } from '../api/models';
import { ProfileDirectory } from '../profiles/profile-directory';
import { decodeJwtClaims } from './jwt';
import { withRefreshLock } from './refresh-lock';
import { Session } from './session';
import { TokenStorage } from './token-storage';

export const REFRESH_LEAD_MS = 60_000;
export const REFRESH_MIN_INTERVAL_MS = 30_000;

export function needsRefresh(token: string | null, now: number): boolean {
  const claims = token === null ? null : decodeJwtClaims(token);
  return claims === null || claims.exp * 1000 - now <= REFRESH_LEAD_MS;
}

@Injectable({ providedIn: 'root' })
export class SessionRefresher {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TokenStorage);
  private readonly session = inject(Session);
  private readonly directory = inject(ProfileDirectory);
  private readonly router = inject(Router);

  private inFlight: Promise<string | null> | null = null;
  private lastRotationAt = Number.NEGATIVE_INFINITY;

  shouldRefresh(): boolean {
    const now = Date.now();
    return (
      this.storage.getRefresh() !== null &&
      needsRefresh(this.storage.get(), now) &&
      now - this.lastRotationAt >= REFRESH_MIN_INTERVAL_MS
    );
  }

  ensureFresh(): Promise<string | null> {
    if (!this.shouldRefresh()) return Promise.resolve(this.storage.get());
    this.inFlight ??= withRefreshLock(() => this.rotate()).finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  private async rotate(): Promise<string | null> {
    if (this.storage.getRefresh() === null || !needsRefresh(this.storage.get(), Date.now())) {
      this.session.syncFromStorage();
      return this.storage.get();
    }
    const posted = this.storage.getRefresh();
    const response = await firstValueFrom(
      this.http.post<LoginResponse>('/api/users/refresh', { refreshToken: posted }),
    );
    if (this.storage.getRefresh() !== posted) {
      this.session.syncFromStorage();
      return this.storage.get();
    }
    this.session.applyTokens(response.token, response.refreshToken);
    this.lastRotationAt = Date.now();
    return response.token;
  }
}
