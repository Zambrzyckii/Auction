import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { REAL_TOKEN } from '../../../testing/token-fixture';
import { routes } from '../../app.routes';
import { TokenStorage } from '../../core/auth/token-storage';
import { Login, sanitizeReturnUrl } from './login';

describe('sanitizeReturnUrl', () => {
  it('accepts an internal path', () => {
    expect(sanitizeReturnUrl('/wallet')).toBe('/wallet');
  });

  it('falls back to the auction list for a missing value', () => {
    expect(sanitizeReturnUrl(null)).toBe('/auctions');
  });

  it('rejects an absolute url', () => {
    expect(sanitizeReturnUrl('https://evil.example/phish')).toBe('/auctions');
  });

  it('rejects a protocol-relative url', () => {
    expect(sanitizeReturnUrl('//evil.example')).toBe('/auctions');
  });

  it('rejects a backslash that browsers treat as a slash', () => {
    expect(sanitizeReturnUrl('/\\evil.example')).toBe('/auctions');
  });

  it('rejects control characters', () => {
    expect(sanitizeReturnUrl('/wal\tlet')).toBe('/auctions');
    expect(sanitizeReturnUrl('/wallet\u0000')).toBe('/auctions');
  });
});

describe('Login', () => {
  beforeEach(async () => {
    installStorageStub();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function fillAndSubmit(fixture: ComponentFixture<Login>): Promise<void> {
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const inputs = el.querySelectorAll('input');
    inputs[0].value = 'probe1@test.local';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = 'Zaq1@wsxCde3';
    inputs[1].dispatchEvent(new Event('input'));
    await fixture.whenStable();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  it('logs in, stores the token and navigates away', async () => {
    const fixture = TestBed.createComponent(Login);
    await fillAndSubmit(fixture);

    const req = TestBed.inject(HttpTestingController).expectOne('/api/users/login');
    expect(req.request.body).toEqual({ email: 'probe1@test.local', password: 'Zaq1@wsxCde3' });
    req.flush({ token: REAL_TOKEN });

    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/auctions'));
    expect(new TokenStorage().get()).toBe(REAL_TOKEN);
  });

  it('shows neutral invalid credentials on a 400', async () => {
    const fixture = TestBed.createComponent(Login);
    await fillAndSubmit(fixture);

    TestBed.inject(HttpTestingController)
      .expectOne('/api/users/login')
      .flush({ error: 'Invalid email or password.' }, { status: 400, statusText: 'Bad Request' });

    await vi.waitFor(() => {
      const text = (fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent;
      expect(text).toContain('Invalid credentials');
    });
    expect(new TokenStorage().get()).toBeNull();
  });

  it('does not call the API while the form is invalid', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectNone('/api/users/login');
  });
});
