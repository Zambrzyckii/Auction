import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../api/api-error';
import { Session } from '../auth/session';
import { TokenStorage } from '../auth/token-storage';
import { handleUnauthorized } from '../auth/unauthorized';
import { nextDelay } from '../polling/poll';
import { ProfileDirectory } from '../profiles/profile-directory';
import { SseEvent, parseSseChunk } from './sse';

export const PUSH_BASE_DELAY_MS = 1000;
export const PUSH_MIN_STREAM_MS = 5000;

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
  private readonly storage = inject(TokenStorage);
  private readonly router = inject(Router);
  private readonly directory = inject(ProfileDirectory);

  readonly connected = signal(false);

  private readonly handlers = new Map<string, Set<PushHandler>>();
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private token: string | null = null;
  private attempt = 0;

  on(topic: string, handler: PushHandler): () => void {
    const set = this.handlers.get(topic) ?? new Set<PushHandler>();
    set.add(handler);
    this.handlers.set(topic, set);
    return () => {
      set.delete(handler);
    };
  }

  connect(token: string): void {
    this.disconnect();
    this.token = token;
    this.attempt = 0;
    void this.open();
  }

  disconnect(): void {
    this.token = null;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.controller?.abort();
    this.controller = null;
    this.connected.set(false);
  }

  private async open(): Promise<void> {
    const token = this.token;
    if (token === null) {
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
      this.attempt = 0;
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
    if (status === 401) {
      this.token = null;
      handleUnauthorized(this.router, this.storage, this.directory);
      return;
    }
    const exp = this.session.claims()?.exp;
    if (!shouldReconnect(status, exp === undefined ? null : exp * 1000, Date.now())) {
      this.token = null;
      return;
    }
    const failure = failureOf(status, retryAfterSeconds, livedMs);
    const delay = failure === null ? 0 : nextDelay(PUSH_BASE_DELAY_MS, this.attempt, failure);
    if (failure !== null) {
      this.attempt += 1;
    }
    this.timer = setTimeout(() => void this.open(), delay);
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
