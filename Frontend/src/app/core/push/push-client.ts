import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../api/api-error';
import { Session } from '../auth/session';
import { handleUnauthorized } from '../auth/unauthorized';
import { nextDelay } from '../polling/poll';
import { ProfileDirectory } from '../profiles/profile-directory';
import { SseEvent, parseSseChunk } from './sse';

export const PUSH_BASE_DELAY_MS = 1000;
export const PUSH_MIN_STREAM_MS = 5000;
export const PUSH_CLOCK_SKEW_MS = 5 * 60_000;

export type PushHandler = (data: string) => void;

export function shouldReconnect(
  status: number | null,
  expiresAt: number | null,
  now: number,
): boolean {
  if (status === 401) return false;
  if (expiresAt !== null && expiresAt <= now) return false;
  return true;
}

@Injectable({ providedIn: 'root' })
export class PushClient {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly directory = inject(ProfileDirectory);

  readonly connected = signal(false);

  private readonly handlers = new Map<string, Set<PushHandler>>();
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private activeUserId: string | null = null;
  private attempt = 0;

  on(topic: string, handler: PushHandler): () => void {
    const set = this.handlers.get(topic) ?? new Set<PushHandler>();
    set.add(handler);
    this.handlers.set(topic, set);
    return () => {
      set.delete(handler);
    };
  }

  connect(): void {
    if (this.active && this.activeUserId === this.session.userId()) return;
    this.disconnect();
    if (!shouldReconnect(null, this.expiresAt(), Date.now())) {
      return;
    }
    this.active = true;
    this.activeUserId = this.session.userId();
    this.attempt = 0;
    void this.open();
  }

  disconnect(): void {
    this.active = false;
    this.activeUserId = null;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.controller?.abort();
    this.controller = null;
    this.connected.set(false);
  }

  private async open(): Promise<void> {
    const token = this.session.token();
    if (!this.active || token === null) {
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    const openedAt = Date.now();
    let status: number | null = null;
    let retryAfterSeconds: number | undefined;
    try {
      const response = await fetch('/api/push', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      status = response.status;
      retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
      if (response.ok && response.body !== null) {
        await this.read(response.body);
      }
    } catch {
      // an aborted or failed fetch ends the stream like a closed one
    }
    if (controller.signal.aborted || this.controller !== controller) {
      return;
    }
    this.connected.set(false);
    this.scheduleReconnect(status, retryAfterSeconds, Date.now() - openedAt);
  }

  private async read(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let rest = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        return;
      }
      const parsed = parseSseChunk(rest + decoder.decode(value, { stream: true }));
      rest = parsed.rest;
      for (const event of parsed.events) {
        this.dispatch(event);
      }
    }
  }

  private dispatch(event: SseEvent): void {
    if (event.event === 'connected') {
      this.connected.set(true);
      return;
    }
    if (event.event === 'ping') {
      return;
    }
    for (const handler of this.handlers.get(event.event) ?? []) {
      handler(event.data);
    }
  }

  private scheduleReconnect(
    status: number | null,
    retryAfterSeconds: number | undefined,
    livedMs: number,
  ): void {
    const expiresAt = this.expiresAt();
    const now = Date.now();
    if (status === 401) {
      this.active = false;
      if (expiresAt === null || expiresAt - now > PUSH_CLOCK_SKEW_MS) {
        handleUnauthorized(this.router, this.session, this.directory);
      }
      return;
    }
    if (!shouldReconnect(status, expiresAt, now)) {
      this.active = false;
      return;
    }
    if (livedMs >= PUSH_MIN_STREAM_MS) {
      this.attempt = 0;
    }
    const failure = failureOf(status, retryAfterSeconds, livedMs);
    const delay = failure === null ? 0 : nextDelay(PUSH_BASE_DELAY_MS, this.attempt, failure);
    if (failure !== null) {
      this.attempt += 1;
    }
    this.timer = setTimeout(() => void this.open(), delay);
  }

  private expiresAt(): number | null {
    const exp = this.session.claims()?.exp;
    return exp === undefined ? null : exp * 1000;
  }
}

function failureOf(
  status: number | null,
  retryAfterSeconds: number | undefined,
  livedMs: number,
): ApiError | null {
  if (status === null) {
    return { status: 0, message: 'push stream unreachable' };
  }
  if (status >= 400) {
    return { status, message: 'push stream refused', retryAfterSeconds };
  }
  if (livedMs < PUSH_MIN_STREAM_MS) {
    return { status: 0, message: 'push stream ended early' };
  }
  return null;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}
