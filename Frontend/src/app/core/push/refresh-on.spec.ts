import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../api/api-error';
import { Poller } from '../polling/poll';
import { PushClient } from './push-client';
import { idMatches, refreshOn } from './refresh-on';

interface FakePush {
  readonly handlers: Map<string, (data: string) => void>;
  on(topic: string, handler: (data: string) => void): () => void;
}

function fakePush(): FakePush {
  const handlers = new Map<string, (data: string) => void>();
  return {
    handlers,
    on: (topic, handler) => {
      handlers.set(topic, handler);
      return () => handlers.delete(topic);
    },
  };
}

function fakePoller(error: ApiError | null = null): Poller<unknown> {
  return { value: signal(null), error: signal(error), refresh: vi.fn(), stop: vi.fn() };
}

describe('idMatches', () => {
  it('matches the id inside the json data and rejects others or malformed data', () => {
    const matches = idMatches('auctionId', 'a-1');
    expect(matches('{"auctionId":"a-1"}')).toBe(true);
    expect(matches('{"auctionId":"a-2"}')).toBe(false);
    expect(matches('not json')).toBe(false);
  });
});

describe('refreshOn', () => {
  let push: FakePush;

  beforeEach(() => {
    vi.useFakeTimers();
    push = fakePush();
    TestBed.configureTestingModule({ providers: [{ provide: PushClient, useValue: push }] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function register(
    poller: Poller<unknown>,
    predicate?: (data: string) => boolean,
    settleMs?: number,
  ): void {
    TestBed.runInInjectionContext(() => refreshOn(poller, 'WalletChanged', predicate, settleMs));
  }

  it('refreshes the poller when the topic arrives', () => {
    const poller = fakePoller();
    register(poller);
    push.handlers.get('WalletChanged')!('{}');
    expect(poller.refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes only when the predicate accepts the data', () => {
    const poller = fakePoller();
    register(poller, idMatches('auctionId', 'a-1'));
    push.handlers.get('WalletChanged')!('{"auctionId":"a-9"}');
    expect(poller.refresh).not.toHaveBeenCalled();
    push.handlers.get('WalletChanged')!('{"auctionId":"a-1"}');
    expect(poller.refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes a second time after settleMs', () => {
    const poller = fakePoller();
    register(poller, undefined, 2000);
    push.handlers.get('WalletChanged')!('{}');
    expect(poller.refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1999);
    expect(poller.refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(poller.refresh).toHaveBeenCalledTimes(2);
  });

  it.each([0, 429, 503])(
    'skips the refresh while the poller is backing off from a %i',
    (status) => {
      const poller = fakePoller({ status, message: 'down' });
      register(poller);
      push.handlers.get('WalletChanged')!('{}');
      expect(poller.refresh).not.toHaveBeenCalled();
    },
  );

  it('still refreshes after a 404', () => {
    const poller = fakePoller({ status: 404, message: 'gone' });
    register(poller);
    push.handlers.get('WalletChanged')!('{}');
    expect(poller.refresh).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes and drops a pending settle refresh on destroy', () => {
    const poller = fakePoller();
    register(poller, undefined, 2000);
    push.handlers.get('WalletChanged')!('{}');
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(5000);
    expect(push.handlers.has('WalletChanged')).toBe(false);
    expect(poller.refresh).toHaveBeenCalledTimes(1);
  });
});
