import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { routes } from '../../app.routes';
import { Register, isBirthdayBeforeToday, isPasswordStrong } from './register';

function isoDaysFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('isPasswordStrong', () => {
  it('accepts a password with all four character classes and length 8+', () => {
    expect(isPasswordStrong('Zaq1@wsx')).toBe(true);
  });

  it('rejects a short password', () => {
    expect(isPasswordStrong('Za1@abc')).toBe(false);
  });

  it('rejects a password missing one character class', () => {
    expect(isPasswordStrong('zaq1@wsx')).toBe(false);
    expect(isPasswordStrong('ZAQ1@WSX')).toBe(false);
    expect(isPasswordStrong('Zaqw@wsx')).toBe(false);
    expect(isPasswordStrong('Zaq1wsx8')).toBe(false);
  });
});

describe('isBirthdayBeforeToday', () => {
  it('accepts yesterday', () => {
    expect(isBirthdayBeforeToday(isoDaysFromToday(-1))).toBe(true);
  });

  it('rejects today', () => {
    expect(isBirthdayBeforeToday(isoDaysFromToday(0))).toBe(false);
  });

  it('rejects tomorrow', () => {
    expect(isBirthdayBeforeToday(isoDaysFromToday(1))).toBe(false);
  });
});

describe('Register', () => {
  beforeEach(async () => {
    installStorageStub();
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function fillAndSubmit(fixture: ComponentFixture<Register>): Promise<void> {
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const values = [
      'probe2@test.local',
      'probe2',
      'Probe',
      'Two',
      'Zaq1@wsxCde3',
      isoDaysFromToday(-9000),
    ];
    el.querySelectorAll('input').forEach((input, i) => {
      input.value = values[i];
      input.dispatchEvent(new Event('input'));
    });
    await fixture.whenStable();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  it('registers, auto-logs-in and navigates to the wallet', async () => {
    const fixture = TestBed.createComponent(Register);
    await fillAndSubmit(fixture);

    const http = TestBed.inject(HttpTestingController);
    const registerReq = http.expectOne('/api/users/register');
    expect(registerReq.request.body).toEqual({
      email: 'probe2@test.local',
      username: 'probe2',
      name: 'Probe',
      surname: 'Two',
      password: 'Zaq1@wsxCde3',
      birthday: isoDaysFromToday(-9000),
    });
    registerReq.flush(null, { status: 201, statusText: 'Created' });

    await vi.waitFor(() => {
      // the token must be alive, or authGuard bounces the /wallet navigation back to login
      const liveToken = tokenWithClaims({ nameid: 'x', exp: Math.floor(Date.now() / 1000) + 600 });
      http.expectOne('/api/users/login').flush({ token: liveToken });
    });
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/wallet'));
  });

  it('shows the taken-email message on a 409', async () => {
    const fixture = TestBed.createComponent(Register);
    await fillAndSubmit(fixture);

    TestBed.inject(HttpTestingController)
      .expectOne('/api/users/register')
      .flush({ error: 'User already exists.' }, { status: 409, statusText: 'Conflict' });

    await vi.waitFor(() => {
      const text = (fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent;
      expect(text).toContain('already taken');
    });
  });

  it('does not call the API while the form is invalid', async () => {
    const fixture = TestBed.createComponent(Register);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectNone('/api/users/register');
  });
});
