import { DestroyRef, inject } from '@angular/core';
import { Poller } from '../polling/poll';
import { PushClient } from './push-client';

export function idMatches(key: string, id: string): (data: string) => boolean {
  return (data) => {
    try {
      const parsed: unknown = JSON.parse(data);
      return (
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as Record<string, unknown>)[key] === id
      );
    } catch {
      return false;
    }
  };
}

export function refreshOn(
  poller: Poller<unknown>,
  topic: string,
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
