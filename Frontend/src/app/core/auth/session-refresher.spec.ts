import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { REAL_TOKEN, tokenWithClaims } from '../../../testing/token-fixture';
import { authGuard } from './auth.guard';
import { Session } from './session';
import { REFRESH_LEAD_MS, SessionRefresher, needsRefresh } from './session-refresher';
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
});
