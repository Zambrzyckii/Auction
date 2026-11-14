import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { TokenStorage } from '../../core/auth/token-storage';
import { Wallet } from './wallet';

const USER_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const WALLET_URL = `/api/wallets/${USER_ID}`;

describe('Wallet', () => {
  let fixture: ComponentFixture<Wallet>;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: USER_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    await TestBed.configureTestingModule({
      imports: [Wallet],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Wallet);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.useRealTimers();
  });

  it('requests the wallet of the logged-in user by GUID and shows the funds', () => {
    http.expectOne(WALLET_URL).flush({ availableFunds: 300, lockedFunds: 0, lifetimeTurnover: 0 });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('300');
    expect(text).toContain('Locked funds');
  });

  it('shows a provisioning note and retries after an early 404', () => {
    http.expectOne(WALLET_URL).flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Setting up');

    vi.advanceTimersByTime(1500);
    http.expectOne(WALLET_URL).flush({ availableFunds: 300, lockedFunds: 0, lifetimeTurnover: 0 });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('300');
  });

  it('gives up on the 404 retry after the provisioning window', () => {
    http.expectOne(WALLET_URL).flush(null, { status: 404, statusText: 'Not Found' });
    const el = fixture.nativeElement as HTMLElement;
    for (let i = 0; i < 25 && el.querySelector('.error') === null; i++) {
      vi.advanceTimersByTime(1500);
      for (const req of http.match(WALLET_URL)) {
        req.flush(null, { status: 404, statusText: 'Not Found' });
      }
      fixture.detectChanges();
    }
    expect(el.querySelector('.error')?.textContent?.length).toBeGreaterThan(0);
  });

  it('keeps polling after a success', () => {
    http.expectOne(WALLET_URL).flush({ availableFunds: 300, lockedFunds: 0, lifetimeTurnover: 0 });
    vi.advanceTimersByTime(5000);
    http.expectOne(WALLET_URL).flush({ availableFunds: 280, lockedFunds: 20, lifetimeTurnover: 0 });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('280');
    expect(text).toContain('20');
  });
});
