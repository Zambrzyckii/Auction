import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { REAL_TOKEN, tokenWithClaims } from '../../../testing/token-fixture';
import { ProfileDirectory } from '../profiles/profile-directory';
import { authGuard } from './auth.guard';
import { authInterceptor } from './auth.interceptor';
import { Session } from './session';
import { TokenStorage } from './token-storage';

describe('authInterceptor', () => {
  beforeEach(() => {
    installStorageStub();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'wallet', children: [] },
          { path: 'inventory', canActivate: [authGuard], children: [] },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function request(url: string): { status: number } {
    const seen = { status: -1 };
    TestBed.inject(HttpClient)
      .get(url)
      .subscribe({ error: (e: { status: number }) => (seen.status = e.status) });
    return seen;
  }

  it('adds the bearer header to /api/ requests when a token exists', () => {
    new TokenStorage().set('tok');
    request('/api/wallets/x');
    const req = TestBed.inject(HttpTestingController).expectOne('/api/wallets/x');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    req.flush({});
  });

  it('sends /api/ requests anonymously without a token', () => {
    request('/api/auctions?limit=5');
    const req = TestBed.inject(HttpTestingController).expectOne('/api/auctions?limit=5');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('leaves non-api requests untouched', () => {
    new TokenStorage().set('tok');
    request('/assets/data.json');
    const req = TestBed.inject(HttpTestingController).expectOne('/assets/data.json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('clears the token and redirects to login with a returnUrl on a 401', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/wallet');
    new TokenStorage().set('tok');

    request('/api/wallets/x');
    TestBed.inject(HttpTestingController)
      .expectOne('/api/wallets/x')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await vi.waitFor(() => expect(router.url).toContain('/login'));
    expect(router.url).toContain('returnUrl=%2Fwallet');
    expect(new TokenStorage().get()).toBeNull();
  });

  it('clears the profile directory on a 401', async () => {
    const userId = 'aaaaaaaa-1111-2222-3333-444444444444';
    new TokenStorage().set('tok');
    const directory = TestBed.inject(ProfileDirectory);
    directory.remember(userId, 'alice');
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/wallet');

    request('/api/wallets/x');
    TestBed.inject(HttpTestingController)
      .expectOne('/api/wallets/x')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(directory.label(userId)).toBe('aaaaaaaa');
    await vi.waitFor(() => expect(router.url).toContain('/login'));
  });

  it('does not redirect again when already on the login page', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login');

    request('/api/wallets/x');
    TestBed.inject(HttpTestingController)
      .expectOne('/api/wallets/x')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(router.url).toBe('/login');
  });

  it('keeps every error flowing to the caller', () => {
    const seen = request('/api/auctions/nope');
    TestBed.inject(HttpTestingController)
      .expectOne('/api/auctions/nope')
      .flush({ error: 'Auction not found.' }, { status: 404, statusText: 'Not Found' });
    expect(seen.status).toBe(404);
  });

  const fresh = tokenWithClaims({
    nameid: 'fresh-user',
    unique_name: 'fresh@test.local',
    role: 'User',
    exp: Math.floor(Date.now() / 1000) + 600,
  });

  function http(): HttpTestingController {
    return TestBed.inject(HttpTestingController);
  }

  function storeExpiredPair(): void {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
  }

  it('refreshes an expiring token before sending and attaches the new one', async () => {
    storeExpiredPair();

    request('/api/wallets/x');

    const refresh = await vi.waitFor(() => http().expectOne('/api/users/refresh'));
    expect(refresh.request.body).toEqual({ refreshToken: 'r1' });
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush({ token: fresh, refreshToken: 'r2' });
    const req = await vi.waitFor(() => http().expectOne('/api/wallets/x'));
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${fresh}`);
    req.flush({});
    expect(new TokenStorage().getRefresh()).toBe('r2');
  });

  it('sends the auth routes without a bearer and without refreshing', () => {
    storeExpiredPair();
    const routes = [
      '/api/users/login',
      '/api/users/register',
      '/api/users/refresh',
      '/api/users/logout',
    ];

    for (const url of routes) {
      TestBed.inject(HttpClient)
        .post(url, {})
        .subscribe({ error: () => undefined });
    }

    for (const url of routes) {
      const req = http().expectOne(url);
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({});
    }
    http().expectNone('/api/users/refresh');
  });

  it('resets the session signal on a 401', async () => {
    new TokenStorage().set(REAL_TOKEN);
    const session = TestBed.inject(Session);
    expect(session.token()).toBe(REAL_TOKEN);
    await TestBed.inject(Router).navigateByUrl('/wallet');

    request('/api/wallets/x');
    http().expectOne('/api/wallets/x').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(session.token()).toBeNull();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toContain('/login'));
  });

  it('sends the request anonymously after a rejected refresh', async () => {
    storeExpiredPair();
    await TestBed.inject(Router).navigateByUrl('/wallet');

    request('/api/auctions?limit=5');

    const refresh = await vi.waitFor(() => http().expectOne('/api/users/refresh'));
    refresh.flush({ error: 'Invalid refresh token' }, { status: 400, statusText: 'Bad Request' });
    const req = await vi.waitFor(() => http().expectOne('/api/auctions?limit=5'));
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
    expect(new TokenStorage().get()).toBeNull();
    expect(TestBed.inject(Session).isLoggedIn()).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/wallet');
  });

  it('unsubscribing a waiting request does not cancel the shared refresh', async () => {
    storeExpiredPair();
    const client = TestBed.inject(HttpClient);

    client.get('/api/a').subscribe().unsubscribe();
    client.get('/api/b').subscribe();

    const refresh = await vi.waitFor(() => http().expectOne('/api/users/refresh'));
    expect(refresh.cancelled).toBe(false);
    refresh.flush({ token: fresh, refreshToken: 'r2' });
    const b = await vi.waitFor(() => http().expectOne('/api/b'));
    expect(b.request.headers.get('Authorization')).toBe(`Bearer ${fresh}`);
    b.flush({});
    http().expectNone('/api/a');
    expect(new TokenStorage().getRefresh()).toBe('r2');
  });

  it('a dead refresh token on a guarded route lands on login once with both keys cleared', async () => {
    new TokenStorage().set(fresh);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/inventory');
    storeExpiredPair();

    request('/api/wallets/x');
    request('/api/wallets/y');

    const refresh = await vi.waitFor(() => http().expectOne('/api/users/refresh'));
    refresh.flush({ error: 'Invalid refresh token' }, { status: 400, statusText: 'Bad Request' });
    for (const url of ['/api/wallets/x', '/api/wallets/y']) {
      const req = await vi.waitFor(() => http().expectOne(url));
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush(null, { status: 401, statusText: 'Unauthorized' });
    }

    await vi.waitFor(() => expect(router.url).toBe('/login?returnUrl=%2Finventory'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(router.url).toBe('/login?returnUrl=%2Finventory');
    expect(new TokenStorage().get()).toBeNull();
    expect(new TokenStorage().getRefresh()).toBeNull();
  });
});
