import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { toApiError } from '../api/api-error';
import { Profile } from '../api/models';
import { Session } from '../auth/session';

export const MISS_RETRY_MS = 30_000;

export function shortId(userId: string): string {
  return userId.slice(0, 8);
}

@Injectable({ providedIn: 'root' })
export class ProfileDirectory {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);

  private readonly names = signal<ReadonlyMap<string, string>>(new Map());
  private readonly inFlight = new Set<string>();
  private readonly missedAt = new Map<string, number>();

  constructor() {
    effect(() => {
      if (!this.session.isLoggedIn()) {
        this.clear();
      }
    });
  }

  clear(): void {
    this.names.set(new Map());
    this.inFlight.clear();
    this.missedAt.clear();
  }

  label(userId: string): string {
    return this.names().get(userId) ?? shortId(userId);
  }

  labelWithId(userId: string): string {
    const name = this.names().get(userId);
    return name === undefined ? shortId(userId) : `${name} (${shortId(userId)})`;
  }

  remember(userId: string, username: string): void {
    const next = new Map(this.names());
    next.set(userId, username);
    this.names.set(next);
  }

  ensure(userIds: Iterable<string>): void {
    for (const userId of new Set(userIds)) {
      if (this.shouldFetch(userId, Date.now())) {
        this.fetch(userId);
      }
    }
  }

  private shouldFetch(userId: string, now: number): boolean {
    if (!this.session.isLoggedIn()) return false;
    if (this.names().has(userId)) return false;
    if (this.inFlight.has(userId)) return false;
    const missedAt = this.missedAt.get(userId);
    if (missedAt !== undefined && now - missedAt < MISS_RETRY_MS) return false;
    return true;
  }

  private fetch(userId: string): void {
    this.inFlight.add(userId);
    this.http.get<Profile>(`/api/profiles/${userId}`).subscribe({
      next: (profile) => {
        this.inFlight.delete(userId);
        if (!this.session.isLoggedIn()) {
          return;
        }
        this.missedAt.delete(userId);
        this.remember(userId, profile.username);
      },
      error: (err: unknown) => {
        this.inFlight.delete(userId);
        if (toApiError(err).status === 404) {
          this.missedAt.set(userId, Date.now());
        }
      },
    });
  }
}
