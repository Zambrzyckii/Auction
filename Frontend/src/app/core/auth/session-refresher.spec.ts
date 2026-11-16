import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { REAL_TOKEN, tokenWithClaims } from '../../../testing/token-fixture';
import { ProfileDirectory } from '../profiles/profile-directory';
import { authGuard } from './auth.guard';
import { Session } from './session';
import {
  REFRESH_LEAD_MS,
  REFRESH_MIN_INTERVAL_MS,
  SessionRefresher,
  needsRefresh,
} from './session-refresher';
import { TokenStorage } from './token-storage';

describe('SessionRefresher', () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const fresh = tokenWithClaims({
    nameid: 'fresh-user',
    unique_name: 'fresh@test.local',
    role: 'User',
    exp: nowSeconds + 600,
  });

  beforeEach(() => {
    installStorageStub();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'wallet', canActivate: [authGuard], children: [] },
          { path: 'auctions', children: [] },
          { path: 'login', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks');
    TestBed.inject(HttpTestingController).verify();
  });

  function http(): HttpTestingController {
    return TestBed.inject(HttpTestingController);
  }

  it('needs a refresh within the lead, for an expired token and for a missing or garbage token', () => {
    const now = 1_800_000_000_000;
    const expiringIn = (ms: number): string => tokenWithClaims({ exp: (now + ms) / 1000 });

    expect(needsRefresh(expiringIn(REFRESH_LEAD_MS), now)).toBe(true);
    expect(needsRefresh(expiringIn(REFRESH_LEAD_MS + 1000), now)).toBe(false);
    expect(needsRefresh(expiringIn(-1000), now)).toBe(true);
    expect(needsRefresh(null, now)).toBe(true);
    expect(needsRefresh('x.y', now)).toBe(true);
  });

  it('returns the stored token without a request while it outlives the lead', async () => {
    const storage = new TokenStorage();
    storage.set(fresh);
    storage.setRefresh('r1');

    const result = await TestBed.inject(SessionRefresher).ensureFresh();

    expect(result).toBe(fresh);
    http().expectNone('/api/users/refresh');
  });

  it('returns the stored token without a request when no refresh token is stored', async () => {
    new TokenStorage().set(REAL_TOKEN);

    const result = await TestBed.inject(SessionRefresher).ensureFresh();

    expect(result).toBe(REAL_TOKEN);
    http().expectNone('/api/users/refresh');
  });

  it('posts the refresh token and applies the new pair', async () => {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const session = TestBed.inject(Session);

    const pending = TestBed.inject(SessionRefresher).ensureFresh();

    const req = await vi.waitFor(() => http().expectOne('/api/users/refresh'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'r1' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ token: fresh, refreshToken: 'r2' });

    expect(await pending).toBe(fresh);
    expect(storage.get()).toBe(fresh);
    expect(storage.getRefresh()).toBe('r2');
    expect(session.token()).toBe(fresh);
  });

  it('shares one request between concurrent callers', async () => {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const refresher = TestBed.inject(SessionRefresher);

    const first = refresher.ensureFresh();
    const second = refresher.ensureFresh();

    const req = await vi.waitFor(() => http().expectOne('/api/users/refresh'));
    req.flush({ token: fresh, refreshToken: 'r2' });
    expect(await first).toBe(fresh);
    expect(await second).toBe(fresh);
  });

  it('skips the post when another tab rotated while this one waited for the lock', async () => {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const session = TestBed.inject(Session);
    const request = vi.fn((name: string, callback: (lock: Lock) => Promise<unknown>) => {
      storage.set(fresh);
      storage.setRefresh('r9');
      return callback({ name, mode: 'exclusive' });
    });
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

    const result = await TestBed.inject(SessionRefresher).ensureFresh();

    http().expectNone('/api/users/refresh');
    expect(request).toHaveBeenCalledTimes(1);
    expect(result).toBe(fresh);
    expect(session.token()).toBe(fresh);
    expect(storage.getRefresh()).toBe('r9');
  });

  it('drops a refresh response that lands after logout', async () => {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const session = TestBed.inject(Session);

    const pending = TestBed.inject(SessionRefresher).ensureFresh();
    const req = await vi.waitFor(() => http().expectOne('/api/users/refresh'));
    session.logout();
    http().expectOne('/api/users/logout').flush(null);
    req.flush({ token: fresh, refreshToken: 'r2' });

    expect(await pending).toBeNull();
    expect(storage.get()).toBeNull();
    expect(storage.getRefresh()).toBeNull();
    expect(session.isLoggedIn()).toBe(false);
  });

  const USER_A = 'aaaaaaaa-1111-2222-3333-444444444444';

  async function startExpiredRefresh(route: string): Promise<{
    pending: Promise<string | null>;
    flushError: (status: number, statusText: string) => void;
    fail: () => void;
  }> {
    const storage = new TokenStorage();
    storage.set(fresh);
    await TestBed.inject(Router).navigateByUrl(route);
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const pending = TestBed.inject(SessionRefresher).ensureFresh();
    const req = await vi.waitFor(() => http().expectOne('/api/users/refresh'));
    return {
      pending,
      flushError: (status, statusText) => req.flush({ error: 'refresh failed' }, { status, statusText }),
      fail: () => req.error(new ProgressEvent('error')),
    };
  }

  it('a 400 clears both keys, the session and the directory and sends a guarded route to login', async () => {
    const directory = TestBed.inject(ProfileDirectory);
    directory.remember(USER_A, 'alice');
    const { pending, flushError } = await startExpiredRefresh('/wallet');

    flushError(400, 'Bad Request');

    expect(await pending).toBeNull();
    const storage = new TokenStorage();
    expect(storage.get()).toBeNull();
    expect(storage.getRefresh()).toBeNull();
    expect(TestBed.inject(Session).isLoggedIn()).toBe(false);
    expect(directory.label(USER_A)).toBe('aaaaaaaa');
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/login?returnUrl=%2Fwallet'));
  });

  it('a 400 on a public route clears the session but stays on the page', async () => {
    const { pending, flushError } = await startExpiredRefresh('/auctions');

    flushError(400, 'Bad Request');

    expect(await pending).toBeNull();
    expect(TestBed.inject(Session).isLoggedIn()).toBe(false);
    expect(new TokenStorage().getRefresh()).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(TestBed.inject(Router).url).toBe('/auctions');
  });

  it('a network failure keeps the stored pair and returns the current token', async () => {
    const { pending, fail } = await startExpiredRefresh('/auctions');

    fail();

    expect(await pending).toBe(REAL_TOKEN);
    const storage = new TokenStorage();
    expect(storage.get()).toBe(REAL_TOKEN);
    expect(storage.getRefresh()).toBe('r1');
  });

  it('a 409 keeps the stored pair', async () => {
    const { pending, flushError } = await startExpiredRefresh('/auctions');

    flushError(409, 'Conflict');

    expect(await pending).toBe(REAL_TOKEN);
    const storage = new TokenStorage();
    expect(storage.get()).toBe(REAL_TOKEN);
    expect(storage.getRefresh()).toBe('r1');
  });

  it('a failure after another tab rotated adopts the stored pair', async () => {
    const { pending, flushError } = await startExpiredRefresh('/auctions');
    const storage = new TokenStorage();
    storage.set(fresh);
    storage.setRefresh('r9');

    flushError(400, 'Bad Request');

    expect(await pending).toBe(fresh);
    expect(TestBed.inject(Session).token()).toBe(fresh);
    expect(storage.getRefresh()).toBe('r9');
  });

  describe('timer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(1_800_000_000_000);
    });

    afterEach(() => vi.useRealTimers());

    function tokenExpiringIn(seconds: number, nameid = 'timer-user'): string {
      return tokenWithClaims({
        nameid,
        unique_name: 'timer@test.local',
        role: 'User',
        exp: Math.floor(Date.now() / 1000) + seconds,
      });
    }

    function start(): SessionRefresher {
      const refresher = TestBed.inject(SessionRefresher);
      TestBed.tick();
      return refresher;
    }

    async function flushRefresh(token: string, refreshToken: string): Promise<void> {
      http().expectOne('/api/users/refresh').flush({ token, refreshToken });
      await vi.advanceTimersByTimeAsync(0);
      TestBed.tick();
    }

    it('refreshes REFRESH_LEAD_MS before the token expires', async () => {
      const storage = new TokenStorage();
      storage.set(tokenExpiringIn(600));
      storage.setRefresh('r1');
      start();

      await vi.advanceTimersByTimeAsync(600_000 - REFRESH_LEAD_MS - 1);
      http().expectNone('/api/users/refresh');
      await vi.advanceTimersByTimeAsync(1);

      await flushRefresh(tokenExpiringIn(900), 'r2');
      expect(storage.getRefresh()).toBe('r2');
    });

    it('refreshes at startup when the stored token is already expired', async () => {
      const storage = new TokenStorage();
      storage.set(REAL_TOKEN);
      storage.setRefresh('r1');

      start();

      const rotated = tokenExpiringIn(900);
      await flushRefresh(rotated, 'r2');
      expect(TestBed.inject(Session).token()).toBe(rotated);
    });

    it('refreshes at startup when only the refresh token is stored', async () => {
      new TokenStorage().setRefresh('r1');

      start();

      await flushRefresh(tokenExpiringIn(900), 'r2');
      expect(TestBed.inject(Session).isLoggedIn()).toBe(true);
    });

    it('schedules nothing without a refresh token', async () => {
      new TokenStorage().set(tokenExpiringIn(600));
      start();

      await vi.advanceTimersByTimeAsync(600_000);

      http().expectNone('/api/users/refresh');
    });

    it('reschedules after another tab rotated', async () => {
      const storage = new TokenStorage();
      storage.set(tokenExpiringIn(600));
      storage.setRefresh('r1');
      start();
      const rotated = tokenExpiringIn(1200, 'rotated-user');
      storage.set(rotated);
      storage.setRefresh('r2');
      window.dispatchEvent(new StorageEvent('storage', { key: 'auction.token', newValue: rotated }));
      TestBed.tick();

      await vi.advanceTimersByTimeAsync(600_000 - REFRESH_LEAD_MS);
      http().expectNone('/api/users/refresh');
      await vi.advanceTimersByTimeAsync(600_000);

      const req = http().expectOne('/api/users/refresh');
      expect(req.request.body).toEqual({ refreshToken: 'r2' });
      req.flush({ token: tokenExpiringIn(900), refreshToken: 'r3' });
    });

    it('rotates at most once per REFRESH_MIN_INTERVAL_MS when the clock runs ahead', async () => {
      const serverNow = Math.floor(Date.now() / 1000);
      const issued = (n: number): string =>
        tokenWithClaims({ nameid: 'ahead', role: 'User', iat: serverNow + n, exp: serverNow + 900 + n });
      vi.setSystemTime(Date.now() + 20 * 60_000);
      const storage = new TokenStorage();
      storage.set(issued(0));
      storage.setRefresh('r1');
      start();
      await flushRefresh(issued(1), 'r2');

      await vi.advanceTimersByTimeAsync(REFRESH_MIN_INTERVAL_MS - 1);
      http().expectNone('/api/users/refresh');
      await vi.advanceTimersByTimeAsync(1);
      await flushRefresh(issued(2), 'r3');
      await vi.advanceTimersByTimeAsync(REFRESH_MIN_INTERVAL_MS - 2);

      http().expectNone('/api/users/refresh');
      expect(storage.getRefresh()).toBe('r3');
    });
  });
});
