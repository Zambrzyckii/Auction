import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { ProfileSummary } from '../api/models';
import { Session } from '../auth/session';

export const MISS_RETRY_MS = 30_000;
export const BATCH_SIZE = 50;

export function shortId(userId: string): string {
  return userId.slice(0, 8);
}

@Injectable({ providedIn: 'root' })
export class ProfileDirectory {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);

  private readonly names = signal<ReadonlyMap<string, string>>(new Map());
  private readonly pending = new Set<string>();
  private readonly inFlight = new Set<string>();
  private readonly missedAt = new Map<string, number>();
  private flushScheduled = false;

  constructor() {
    effect(() => {
      if (!this.session.isLoggedIn()) {
        this.clear();
      }
    });
  }

  clear(): void {
    this.names.set(new Map());
    this.pending.clear();
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
    const now = Date.now();
    for (const userId of userIds) {
      if (this.shouldFetch(userId, now)) {
        this.pending.add(userId);
      }
    }
    if (this.pending.size > 0 && !this.flushScheduled) {
      this.flushScheduled = true;
      setTimeout(() => this.flush(), 0);
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

  private flush(): void {
    this.flushScheduled = false;
    const userIds = [...this.pending];
    this.pending.clear();
    if (!this.session.isLoggedIn()) {
      return;
    }
    for (let start = 0; start < userIds.length; start += BATCH_SIZE) {
      this.fetch(userIds.slice(start, start + BATCH_SIZE));
    }
  }

  private fetch(userIds: readonly string[]): void {
    for (const userId of userIds) this.inFlight.add(userId);
    const params = new HttpParams({ fromObject: { ids: userIds } });
    this.http.get<ProfileSummary[]>('/api/profiles', { params }).subscribe({
      next: (rows) => {
        for (const userId of userIds) this.inFlight.delete(userId);
        if (!this.session.isLoggedIn()) {
          return;
        }
        this.store(userIds, rows);
      },
      error: () => {
        for (const userId of userIds) this.inFlight.delete(userId);
      },
    });
  }

  private store(requested: readonly string[], rows: readonly ProfileSummary[]): void {
    const next = new Map(this.names());
    const found = new Set<string>();
    for (const row of rows) {
      next.set(row.userId, row.username);
      found.add(row.userId);
      this.missedAt.delete(row.userId);
    }
    this.names.set(next);
    const now = Date.now();
    for (const userId of requested) {
      if (!found.has(userId)) {
        this.missedAt.set(userId, now);
      }
    }
  }
}
