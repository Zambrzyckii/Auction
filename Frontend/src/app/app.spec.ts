import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { installStorageStub } from '../testing/storage-stub';
import {
  REAL_TOKEN,
  REAL_TOKEN_EMAIL,
  REAL_TOKEN_USER_ID,
  tokenWithClaims,
} from '../testing/token-fixture';
import { App } from './app';
import { routes } from './app.routes';
import { TokenStorage } from './core/auth/token-storage';
import { PushClient } from './core/push/push-client';

describe('App', () => {
  let pushRequests: RequestInit[];

  beforeEach(async () => {
    installStorageStub();
    pushRequests = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        pushRequests.push(init ?? {});
        return new Promise<Response>(() => undefined);
      }),
    );
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(PushClient).disconnect();
    vi.unstubAllGlobals();
  });

  it('renders the navigation with login links for an anonymous user', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const texts = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map(
      (a) => a.textContent?.trim(),
    );
    expect(texts).toContain('Auctions');
    expect(texts).toContain('Wallet');
    expect(texts).toContain('Transfers');
    expect(texts).toContain('Bank');
    expect(texts).toContain('Casino');
    expect(texts).toContain('Pawnshop');
    expect(texts).toContain('Warehouses');
    expect(texts).toContain('Profile');
    expect(texts).toContain('Log in');
  });

  it('shows the email and a logout button for a signed-in user', async () => {
    new TokenStorage().set(REAL_TOKEN);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.session span')?.textContent).toContain(REAL_TOKEN_EMAIL);
    expect(el.querySelector('.session button')?.textContent).toContain('Log out');
  });

  it('opens no push stream for an anonymous user', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(pushRequests).toEqual([]);
  });

  it('opens one push stream with the bearer token for a signed-in user and closes it on logout', async () => {
    const token = tokenWithClaims({
      nameid: REAL_TOKEN_USER_ID,
      unique_name: REAL_TOKEN_EMAIL,
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    new TokenStorage().set(token);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(pushRequests.length).toBe(1);
    expect(new Headers(pushRequests[0].headers).get('Authorization')).toBe(`Bearer ${token}`);

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.session button')!
      .click();
    await fixture.whenStable();

    expect(pushRequests[0].signal?.aborted).toBe(true);
    expect(pushRequests.length).toBe(1);
  });
});
