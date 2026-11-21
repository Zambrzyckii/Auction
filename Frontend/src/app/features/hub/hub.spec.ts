import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { pushStub } from '../../../testing/push-stub';
import { routes } from '../../app.routes';
import { Wallet } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { TokenStorage } from '../../core/auth/token-storage';
import { PushClient } from '../../core/push/push-client';
import { HubPage } from '../../pixel/hub/hub-page';
import { StreetScene } from '../../pixel/street/street-scene';
import { Hub } from './hub';
import { HudData } from './hud-data';

interface HudStub {
  wallet: WritableSignal<Wallet | null>;
  username: WritableSignal<string | null>;
  level: WritableSignal<number | null>;
}

function hudStub(): HudStub {
  return { wallet: signal(null), username: signal(null), level: signal(null) };
}

function sessionStub(loggedIn: boolean) {
  return {
    isLoggedIn: () => loggedIn,
    email: signal(loggedIn ? 'bob@test.local' : null),
    logout: vi.fn(),
  };
}

function routingProviders(loggedIn: boolean) {
  return [
    provideRouter(routes),
    provideHttpClient(withInterceptors([])),
    provideHttpClientTesting(),
    { provide: PushClient, useValue: pushStub() },
    { provide: HudData, useValue: hudStub() },
    { provide: Session, useValue: sessionStub(loggedIn) },
    {
      provide: TokenStorage,
      useValue: { get: () => null, getRefresh: () => (loggedIn ? 'refresh' : null) },
    },
  ];
}

describe('Hub', () => {
  let fixture: ComponentFixture<Hub>;
  let data: HudStub;
  let session: ReturnType<typeof sessionStub>;

  beforeEach(async () => {
    data = hudStub();
    session = sessionStub(true);
    await TestBed.configureTestingModule({
      imports: [Hub],
      providers: [
        provideRouter([]),
        { provide: HudData, useValue: data },
        { provide: Session, useValue: session },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Hub);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  function page(): HubPage {
    return fixture.debugElement.query((d) => d.componentInstance instanceof HubPage)
      .componentInstance as HubPage;
  }

  it('renders without hud data', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('canvas')).not.toBeNull();
    expect(page().hud()).toBeNull();
  });

  it('shows the session email in the header', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('.who')?.textContent).toBe(
      'bob@test.local',
    );
  });

  it('builds the hud state from wallet and profile', () => {
    data.wallet.set({ availableFunds: 2840, lockedFunds: 0, lifetimeTurnover: 11200 });
    data.username.set('bob');
    data.level.set(3);
    fixture.detectChanges();

    expect(page().hud()).toEqual({
      name: 'bob',
      cash: 2840,
      level: 3,
      share: (11200 - 9000) / 7000,
      nextAt: 16000,
    });
  });

  it('keeps the hud null until wallet, name and level are all present', () => {
    data.wallet.set({ availableFunds: 10, lockedFunds: 0, lifetimeTurnover: 0 });
    data.level.set(1);
    fixture.detectChanges();

    expect(page().hud()).toBeNull();
  });

  it('keeps the same hud object when a poll returns equal values', () => {
    data.username.set('bob');
    data.level.set(3);
    data.wallet.set({ availableFunds: 2840, lockedFunds: 0, lifetimeTurnover: 11200 });
    fixture.detectChanges();
    const first = page().hud();

    data.wallet.set({ availableFunds: 2840, lockedFunds: 5, lifetimeTurnover: 11200 });
    fixture.detectChanges();

    expect(page().hud()).toBe(first);
  });

  it('navigates on picked', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const scene = fixture.debugElement.query((d) => d.componentInstance instanceof StreetScene);

    (scene.componentInstance as StreetScene).picked.emit('auction');

    expect(navigate).toHaveBeenCalledWith('/auctions');
  });

  it('logs out to welcome', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.out')!.click();

    expect(session.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/welcome');
  });
});

describe('Hub routes', () => {
  async function landOn(loggedIn: boolean): Promise<RouterTestingHarness> {
    TestBed.configureTestingModule({ providers: routingProviders(loggedIn) });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    return harness;
  }

  it("sends '' to the hub when logged in", async () => {
    const harness = await landOn(true);

    expect(TestBed.inject(Router).url).toBe('/hub');
    expect(harness.routeNativeElement?.querySelector('app-hub-page')).not.toBeNull();
  });

  it("sends '' to welcome when logged out", async () => {
    await landOn(false);

    expect(TestBed.inject(Router).url).toBe('/welcome');
  });
});
