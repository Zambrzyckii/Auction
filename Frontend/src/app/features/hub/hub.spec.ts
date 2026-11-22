import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { pushStub, PushStub } from '../../../testing/push-stub';
import { routes } from '../../app.routes';
import { Wallet } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { TokenStorage } from '../../core/auth/token-storage';
import { PushClient } from '../../core/push/push-client';
import { HubPage } from '../../pixel/hub/hub-page';
import { StreetScene } from '../../pixel/street/street-scene';
import { Hub } from './hub';
import { HudData } from './hud-data';
import { METER_TOPICS } from './meter-rules';

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
  let push: PushStub;

  beforeEach(async () => {
    data = hudStub();
    session = sessionStub(true);
    push = pushStub();
    await TestBed.configureTestingModule({
      imports: [Hub],
      providers: [
        provideRouter([]),
        { provide: HudData, useValue: data },
        { provide: Session, useValue: session },
        { provide: PushClient, useValue: push },
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

  function setPlayer(cash: number, level: number): void {
    data.username.set('bob');
    data.level.set(level);
    data.wallet.set({ availableFunds: cash, lockedFunds: 0, lifetimeTurnover: 11200 });
    fixture.detectChanges();
  }

  it('plays nothing before the first wallet value', () => {
    push.emit('AuctionChanged');
    fixture.detectChanges();
    expect(fixture.componentInstance.fx()).toBeNull();

    setPlayer(2840, 3);

    expect(fixture.componentInstance.fx()).toBeNull();
  });

  it('plays a sold event when the wallet grows after an auction topic', () => {
    setPlayer(2840, 3);
    push.emit('AuctionChanged');

    setPlayer(7090, 3);

    expect(fixture.componentInstance.fx()).toMatchObject({
      kind: 'event',
      at: 'auction',
      word: 'SOLD',
      amount: 4250,
      spotlight: true,
    });
    expect(page().fx()).toBe(fixture.componentInstance.fx());
  });

  it('plays nothing when only the locked part moves', () => {
    setPlayer(2840, 3);
    push.emit('AuctionChanged');

    data.wallet.set({ availableFunds: 2530, lockedFunds: 310, lifetimeTurnover: 11200 });
    fixture.detectChanges();

    expect(fixture.componentInstance.fx()).toBeNull();
  });

  it('plays an event when the total moves through the locked part', () => {
    setPlayer(2840, 3);
    push.emit('AuctionChanged');

    data.wallet.set({ availableFunds: 2840, lockedFunds: 500, lifetimeTurnover: 11200 });
    fixture.detectChanges();

    expect(fixture.componentInstance.fx()).toMatchObject({ kind: 'event', amount: 500 });
  });

  it('plays a level up with the summed reward', () => {
    setPlayer(2840, 3);
    const before = page().hud();

    setPlayer(7090, 5);

    const fx = fixture.componentInstance.fx();
    expect(fx?.kind).toBe('levelup');
    expect(fx).toMatchObject({ reward: 410 });
    expect(fx).toMatchObject({ from: { level: 3 }, hud: { level: 5 } });
    expect((fx as { from: unknown }).from).toBe(before);
    expect((fx as { hud: unknown }).hud).toBe(page().hud());
  });

  it('stops listening on destroy', () => {
    const topics = METER_TOPICS;
    expect(topics.every((topic) => push.handlerCount(topic) === 1)).toBe(true);

    fixture.destroy();

    expect(topics.every((topic) => push.handlerCount(topic) === 0)).toBe(true);
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
