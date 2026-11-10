import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';
import { Poller, nextDelay, startPolling } from './poll';

function apiError(status: number, retryAfterSeconds?: number): ApiError {
  return { status, message: 'x', retryAfterSeconds };
}

describe('nextDelay', () => {
  it('uses the base delay after a success', () => {
    expect(nextDelay(2500, 0, null)).toBe(2500);
  });

  it('keeps the base delay on plain client errors like 404', () => {
    expect(nextDelay(2500, 2, apiError(404))).toBe(2500);
  });

  it('respects Retry-After on a 429', () => {
    expect(nextDelay(2500, 1, apiError(429, 10))).toBe(10_000);
  });

  it('backs off exponentially on 5xx and network failures', () => {
    expect(nextDelay(2500, 1, apiError(502))).toBe(5000);
    expect(nextDelay(2500, 2, apiError(502))).toBe(10_000);
    expect(nextDelay(2500, 1, apiError(0))).toBe(5000);
  });

  it('caps the backoff at 30 seconds', () => {
    expect(nextDelay(2500, 4, apiError(502))).toBe(30_000);
    expect(nextDelay(2500, 10, apiError(0))).toBe(30_000);
  });

  it('falls back to the backoff when a 429 has no Retry-After', () => {
    expect(nextDelay(2500, 1, apiError(429))).toBe(5000);
  });
});

describe('startPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
  });

  afterEach(() => vi.useRealTimers());

  function start<T>(load: () => Observable<T>, baseMs: number): Poller<T> {
    return TestBed.runInInjectionContext(() => startPolling(load, baseMs));
  }

  it('loads immediately and again after the base delay', () => {
    let calls = 0;
    const poller = start(() => of(++calls), 5000);
    expect(poller.value()).toBe(1);
    vi.advanceTimersByTime(4999);
    expect(poller.value()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(poller.value()).toBe(2);
    poller.stop();
  });

  it('exposes the error and keeps the last value', () => {
    let fail = false;
    const load = () =>
      fail
        ? throwError(() => new HttpErrorResponse({ status: 502, error: '<html>' }))
        : of('fresh');
    const poller = start(load, 5000);
    expect(poller.value()).toBe('fresh');

    fail = true;
    vi.advanceTimersByTime(5000);
    expect(poller.error()?.status).toBe(502);
    expect(poller.value()).toBe('fresh');
    poller.stop();
  });

  it('clears the error once a poll succeeds again', () => {
    let fail = true;
    const load = () =>
      fail ? throwError(() => new HttpErrorResponse({ status: 503, error: null })) : of('back');
    const poller = start(load, 5000);
    expect(poller.error()?.status).toBe(503);

    fail = false;
    vi.advanceTimersByTime(nextDelay(5000, 1, apiError(503)));
    expect(poller.value()).toBe('back');
    expect(poller.error()).toBeNull();
    poller.stop();
  });

  it('stops scheduling after stop()', () => {
    let calls = 0;
    const poller = start(() => of(++calls), 5000);
    poller.stop();
    vi.advanceTimersByTime(60_000);
    expect(calls).toBe(1);
  });
});
