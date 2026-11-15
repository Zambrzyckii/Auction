import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { TokenStorage } from '../auth/token-storage';
import { PUSH_BASE_DELAY_MS, PUSH_MIN_STREAM_MS, PushClient, shouldReconnect } from './push-client';

const USER_ID = '26a451d4-dd74-4a58-859f-636aca258443';

interface FakeStream {
  readonly response: Response;
  push(text: string): void;
  close(): void;
}

function sseStream(status = 200, headers: Record<string, string> = {}): FakeStream {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const response = new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream', ...headers },
  });
  return {
    response,
    push: (text) => controller.enqueue(new TextEncoder().encode(text)),
    close: () => controller.close(),
  };
}

function plainResponse(status: number, headers: Record<string, string> = {}): FakeStream {
  return {
    response: new Response(null, { status, headers }),
    push: () => undefined,
    close: () => undefined,
  };
}

describe('shouldReconnect', () => {
  const now = 1_000_000;

  it('never reconnects after a 401', () => {
    expect(shouldReconnect(401, now + 60_000, now)).toBe(false);
  });

  it('never reconnects once the token has expired', () => {
    expect(shouldReconnect(200, now - 1, now)).toBe(false);
    expect(shouldReconnect(null, now - 1, now)).toBe(false);
  });

  it('reconnects after a clean end, a server error or a network failure while the token lives', () => {
    expect(shouldReconnect(200, now + 1, now)).toBe(true);
    expect(shouldReconnect(503, now + 1, now)).toBe(true);
    expect(shouldReconnect(null, null, now)).toBe(true);
  });
});

describe('PushClient', () => {
  let client: PushClient;
  let fetchCalls: { url: string; init: RequestInit | undefined }[];
  let responses: FakeStream[];
  let token: string;

  function setup(exp = Math.floor(Date.now() / 1000) + 600): void {
    installStorageStub();
    token = tokenWithClaims({ nameid: USER_ID, exp });
    new TokenStorage().set(token);
    fetchCalls = [];
    responses = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        fetchCalls.push({ url, init });
        const next = responses.shift() ?? plainResponse(503);
        return Promise.resolve(next.response);
      }),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'login', children: [] }])],
    });
    client = TestBed.inject(PushClient);
  }

  async function settle(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    client.disconnect();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('opens /api/push with the bearer token and reports connected after the first event', async () => {
    setup();
    const stream = sseStream();
    responses.push(stream);

    client.connect(token);
    await settle();

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe('/api/push');
    expect(new Headers(fetchCalls[0].init?.headers).get('Authorization')).toBe(`Bearer ${token}`);
    expect(client.connected()).toBe(false);
    stream.push('event: connected\ndata: {}\n\n');
    await settle();
    expect(client.connected()).toBe(true);
  });

  it('delivers topic data to its handlers, ignores pings and honours unsubscribe', async () => {
    setup();
    const stream = sseStream();
    responses.push(stream);
    const seen: string[] = [];
    const off = client.on('AuctionChanged', (data) => seen.push(data));
    client.connect(token);
    await settle();

    stream.push('event: connected\ndata: {}\n\nevent: ping\ndata: {}\n\n');
    stream.push(
      'event: AuctionChanged\ndata: {"auctionId":"a-1"}\n\nevent: WalletChanged\ndata: {}\n\n',
    );
    await settle();
    expect(seen).toEqual(['{"auctionId":"a-1"}']);

    off();
    stream.push('event: AuctionChanged\ndata: {"auctionId":"a-2"}\n\n');
    await settle();
    expect(seen).toEqual(['{"auctionId":"a-1"}']);
  });

  it('handles a 401 by clearing the token, navigating to login and not reconnecting', async () => {
    setup();
    responses.push(plainResponse(401));
    const router = TestBed.inject(Router);

    client.connect(token);
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCalls.length).toBe(1);
    expect(new TokenStorage().get()).toBeNull();
    expect(router.url).toContain('/login');
  });

  it('retries a 503 with the exponential delay', async () => {
    setup();
    responses.push(plainResponse(503), plainResponse(503), sseStream());

    client.connect(token);
    await settle();
    expect(fetchCalls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(PUSH_BASE_DELAY_MS - 1);
    expect(fetchCalls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchCalls.length).toBe(2);
    await vi.advanceTimersByTimeAsync(PUSH_BASE_DELAY_MS * 2 - 1);
    expect(fetchCalls.length).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchCalls.length).toBe(3);
  });

  it('waits for Retry-After on a 429', async () => {
    setup();
    responses.push(plainResponse(429, { 'Retry-After': '7' }), sseStream());

    client.connect(token);
    await settle();
    await vi.advanceTimersByTimeAsync(6_999);
    expect(fetchCalls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchCalls.length).toBe(2);
  });

  it('reconnects at once after a clean end while the token is alive', async () => {
    setup();
    const first = sseStream();
    responses.push(first, sseStream());

    client.connect(token);
    await settle();
    first.push('event: connected\ndata: {}\n\n');
    await vi.advanceTimersByTimeAsync(PUSH_MIN_STREAM_MS);
    first.close();
    await settle();

    expect(client.connected()).toBe(false);
    expect(fetchCalls.length).toBe(2);
  });

  it('backs off instead of reconnecting at once when the stream ended within five seconds', async () => {
    setup();
    const first = sseStream();
    responses.push(first, sseStream());

    client.connect(token);
    await settle();
    first.push('event: connected\ndata: {}\n\n');
    await settle();
    first.close();
    await settle();

    expect(fetchCalls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(PUSH_BASE_DELAY_MS);
    expect(fetchCalls.length).toBe(2);
  });

  it('stops after a clean end once the token has expired', async () => {
    setup(Math.floor(Date.now() / 1000) - 10);
    const first = sseStream();
    responses.push(first, sseStream());

    client.connect(token);
    await settle();
    first.close();
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchCalls.length).toBe(1);
  });

  it('disconnect aborts the stream, clears connected and schedules nothing', async () => {
    setup();
    const stream = sseStream();
    responses.push(stream, sseStream());
    client.connect(token);
    await settle();
    stream.push('event: connected\ndata: {}\n\n');
    await settle();

    client.disconnect();
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(client.connected()).toBe(false);
    expect(fetchCalls[0].init?.signal?.aborted).toBe(true);
    expect(fetchCalls.length).toBe(1);
  });

  it('replaces the stream when connect is called with a new token', async () => {
    setup();
    responses.push(sseStream(), sseStream());
    client.connect(token);
    await settle();

    const other = tokenWithClaims({ nameid: 'other', exp: Math.floor(Date.now() / 1000) + 600 });
    client.connect(other);
    await settle();

    expect(fetchCalls.length).toBe(2);
    expect(fetchCalls[0].init?.signal?.aborted).toBe(true);
    expect(new Headers(fetchCalls[1].init?.headers).get('Authorization')).toBe(`Bearer ${other}`);
  });
});
