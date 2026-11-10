import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { authInterceptor } from './auth.interceptor';
import { TokenStorage } from './token-storage';

describe('authInterceptor', () => {
  beforeEach(() => {
    installStorageStub();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'wallet', children: [] },
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
});
