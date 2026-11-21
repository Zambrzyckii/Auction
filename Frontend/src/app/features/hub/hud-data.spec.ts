import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { pushStub, PushStub } from '../../../testing/push-stub';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Session } from '../../core/auth/session';
import { PushClient } from '../../core/push/push-client';
import { HudData } from './hud-data';

const USER_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const WALLET_URL = `/api/wallets/${USER_ID}`;
const PROFILE_URL = '/api/profiles/me';
const WALLET = { availableFunds: 300, lockedFunds: 20, lifetimeTurnover: 5 };
const PROFILE = { username: 'probe', level: 4 };

describe('HudData', () => {
  let http: HttpTestingController;
  let push: PushStub;
  let session: Session;
  let hud: HudData;

  beforeEach(() => {
    vi.useFakeTimers();
    installStorageStub();
    push = pushStub();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PushClient, useValue: push },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    hud = TestBed.inject(HudData);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function settle(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();
  }

  async function logIn(): Promise<void> {
    session.applyTokens(
      tokenWithClaims({ nameid: USER_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
      null,
    );
    await settle();
  }

  it('issues no requests while logged out', async () => {
    await settle();
    await vi.advanceTimersByTimeAsync(15_000);
    TestBed.tick();
    http.expectNone(WALLET_URL);
    http.expectNone(PROFILE_URL);
    expect(hud.wallet()).toBeNull();
    expect(hud.username()).toBeNull();
    expect(hud.level()).toBeNull();
  });

  it('polls wallet and profile every 5 s while logged in', async () => {
    await logIn();
    http.expectOne(WALLET_URL).flush(WALLET);
    http.expectOne(PROFILE_URL).flush(PROFILE);
    expect(hud.wallet()).toEqual(WALLET);
    expect(hud.username()).toBe('probe');
    expect(hud.level()).toBe(4);

    await vi.advanceTimersByTimeAsync(4999);
    http.expectNone(WALLET_URL);
    http.expectNone(PROFILE_URL);

    await vi.advanceTimersByTimeAsync(1);
    http.expectOne(WALLET_URL).flush({ ...WALLET, availableFunds: 450 });
    http.expectOne(PROFILE_URL).flush({ ...PROFILE, level: 5 });
    expect(hud.wallet()?.availableFunds).toBe(450);
    expect(hud.level()).toBe(5);
  });

  it('refreshes the wallet on WalletChanged', async () => {
    await logIn();
    http.expectOne(WALLET_URL).flush(WALLET);
    http.expectOne(PROFILE_URL).flush(PROFILE);

    push.emit('WalletChanged');
    http.expectOne(WALLET_URL).flush({ ...WALLET, availableFunds: 10 });
    http.expectNone(PROFILE_URL);
    expect(hud.wallet()?.availableFunds).toBe(10);
  });

  it('keeps wallet null through a provisioning 404', async () => {
    await logIn();
    http.expectOne(WALLET_URL).flush(null, { status: 404, statusText: 'Not Found' });
    http.expectOne(PROFILE_URL).flush(null, { status: 404, statusText: 'Not Found' });
    expect(hud.wallet()).toBeNull();
    expect(hud.username()).toBeNull();

    await vi.advanceTimersByTimeAsync(5000);
    http.expectOne(WALLET_URL).flush(WALLET);
    http.expectOne(PROFILE_URL).flush(PROFILE);
    expect(hud.wallet()).toEqual(WALLET);
    expect(hud.username()).toBe('probe');
  });

  it('clears the signals on logout', async () => {
    await logIn();
    http.expectOne(WALLET_URL).flush(WALLET);
    http.expectOne(PROFILE_URL).flush(PROFILE);

    session.clear();
    await settle();
    expect(hud.wallet()).toBeNull();
    expect(hud.username()).toBeNull();
    expect(hud.level()).toBeNull();

    await vi.advanceTimersByTimeAsync(15_000);
    TestBed.tick();
    http.expectNone(WALLET_URL);
    http.expectNone(PROFILE_URL);
    push.emit('WalletChanged');
    http.expectNone(WALLET_URL);
  });
});
