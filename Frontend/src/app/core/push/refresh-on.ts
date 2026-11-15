import { DestroyRef, inject } from '@angular/core';
import { Poller } from '../polling/poll';
import { PushClient } from './push-client';
import { PushTopic } from './push-topics';

export function idMatches(key: string, id: string): (data: string) => boolean {
  return (data) => readId(key, data) === id;
}

export function idIn(key: string, ids: () => readonly string[]): (data: string) => boolean {
  return (data) => {
    const id = readId(key, data);
    return id !== null && ids().includes(id);
  };
}

function readId(key: string, data: string): string | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const value = (parsed as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function refreshOn(
  poller: Poller<unknown>,
  topic: PushTopic,
  predicate?: (data: string) => boolean,
  settleMs?: number,
): void {
  const push = inject(PushClient);
  let settle: ReturnType<typeof setTimeout> | undefined;

  const refresh = (): void => {
    if (!isBackingOff(poller.error()?.status)) {
      poller.refresh();
    }
  };

  const off = push.on(topic, (data) => {
    if (predicate !== undefined && !predicate(data)) {
      return;
    }
    refresh();
    if (settleMs !== undefined) {
      clearTimeout(settle);
      settle = setTimeout(refresh, settleMs);
    }
  });

  inject(DestroyRef).onDestroy(() => {
    off();
    clearTimeout(settle);
  });
}

function isBackingOff(status: number | undefined): boolean {
  return status !== undefined && (status === 0 || status === 429 || status >= 500);
}
