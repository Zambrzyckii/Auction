import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { ApiError, toApiError } from '../api/api-error';

export interface Poller<T> {
  readonly value: Signal<T | null>;
  readonly error: Signal<ApiError | null>;
  stop(): void;
}

export function nextDelay(baseMs: number, attempt: number, error: ApiError | null): number {
  if (error === null) {
    return baseMs;
  }
  if (error.status === 429 && error.retryAfterSeconds !== undefined) {
    return error.retryAfterSeconds * 1000;
  }
  if (error.status === 0 || error.status >= 500 || error.status === 429) {
    return Math.min(baseMs * 2 ** attempt, 30_000);
  }
  return baseMs;
}

export function startPolling<T>(load: () => Observable<T>, baseMs: number): Poller<T> {
  const value = signal<T | null>(null);
  const error = signal<ApiError | null>(null);
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sub: Subscription | undefined;
  let stopped = false;

  const schedule = (apiError: ApiError | null): void => {
    if (!stopped) {
      timer = setTimeout(tick, nextDelay(baseMs, attempt, apiError));
    }
  };

  const tick = (): void => {
    sub = load().subscribe({
      next: (result) => {
        value.set(result);
        error.set(null);
        attempt = 0;
        schedule(null);
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        error.set(apiError);
        attempt += 1;
        schedule(apiError);
      },
    });
  };

  const stop = (): void => {
    stopped = true;
    clearTimeout(timer);
    sub?.unsubscribe();
  };

  inject(DestroyRef).onDestroy(stop);
  tick();
  return { value, error, stop };
}
