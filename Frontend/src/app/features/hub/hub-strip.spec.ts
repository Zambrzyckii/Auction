import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Session } from '../../core/auth/session';
import { NavStrip } from '../../pixel/hub/nav-strip';
import { HubStrip } from './hub-strip';
import { HudData } from './hud-data';

function sessionStub(loggedIn: boolean) {
  return { isLoggedIn: () => loggedIn, logout: vi.fn() };
}

const hudStub = {
  wallet: signal({ availableFunds: 2840, lockedFunds: 0, lifetimeTurnover: 11200 }),
  username: signal<string | null>('bob'),
  level: signal<number | null>(3),
};

describe('HubStrip', () => {
  let fixture: ComponentFixture<HubStrip>;
  let router: Router;

  async function setup(loggedIn: boolean, url: string) {
    const session = sessionStub(loggedIn);
    await TestBed.configureTestingModule({
      imports: [HubStrip],
      providers: [
        provideRouter([
          { path: 'auctions', children: [] },
          { path: 'hub', children: [] },
        ]),
        { provide: HudData, useValue: hudStub },
        { provide: Session, useValue: session },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(HubStrip);
    fixture.detectChanges();
    return session;
  }

  function strip(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.strip');
  }

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('renders nothing while logged out', async () => {
    await setup(false, '/auctions');

    expect(strip()).toBeNull();
  });

  it('shows the strip on an inner page while logged in', async () => {
    await setup(true, '/auctions');

    expect(strip()?.querySelector('.where')?.textContent).toBe('Auction hall');
    expect(strip()?.querySelector('.cash')?.textContent).toBe('$2,840');
    expect(strip()?.querySelector('.lv')?.textContent).toBe('LV 3');
  });

  it('renders nothing on the hub', async () => {
    await setup(true, '/hub');

    expect(strip()).toBeNull();
  });

  it('follows navigation', async () => {
    await setup(true, '/hub');

    await router.navigateByUrl('/auctions');
    fixture.detectChanges();
    expect(strip()).not.toBeNull();

    await router.navigateByUrl('/hub');
    fixture.detectChanges();
    expect(strip()).toBeNull();
  });

  it('logs out to welcome', async () => {
    const session = await setup(true, '/auctions');
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const nav = fixture.debugElement.query((d) => d.componentInstance instanceof NavStrip);

    (nav.componentInstance as NavStrip).loggedOut.emit();

    expect(session.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/welcome');
  });
});
