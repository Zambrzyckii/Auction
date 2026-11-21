import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WarScene, warYardDeps } from './war-scene';
import type { WarLot } from './war-yard';

@Component({
  imports: [WarScene],
  template: `<app-war-scene
    [status]="status()"
    [players]="players()"
    [isLeader]="isLeader()"
    [currentPrice]="currentPrice()"
    [estimateMin]="estimateMin()"
    [estimateMax]="estimateMax()"
    [manifest]="manifest()"
  />`,
})
class Host {
  readonly status = signal('Open');
  readonly players = signal(1);
  readonly isLeader = signal(false);
  readonly currentPrice = signal(0);
  readonly estimateMin = signal(150);
  readonly estimateMax = signal(220);
  readonly manifest = signal<readonly WarLot[] | null>(null);
}

describe('WarScene', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let el: HTMLElement;

  const create = async (): Promise<void> => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const scene = (): HTMLElement => el.querySelector('app-war-scene')!;
  const verdict = (): string => el.querySelector('.verdict')!.textContent!.trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the yard, canvas and overlays without booting a scene', async () => {
    await create();
    expect(el.querySelector('.yard canvas.scene')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.yard .call')).not.toBeNull();
    expect(el.querySelector('.yard .verdict')).not.toBeNull();
    expect(scene().classList.contains('lit')).toBe(false);
  });

  it('turns lit on when the war arrives already settled', async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    host.status.set('Settled');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(scene().classList.contains('lit')).toBe(true);
  });

  it('turns lit on when a poll settles the war and no scene runs', async () => {
    await create();
    host.status.set('Bidding');
    fixture.detectChanges();
    expect(scene().classList.contains('lit')).toBe(false);
    host.status.set('Settled');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(scene().classList.contains('lit')).toBe(true);
  });

  it('shows YOU WON for the leader and SOLD for everyone else once settled', async () => {
    await create();
    host.status.set('Bidding');
    fixture.detectChanges();
    expect(verdict()).toBe('');
    host.status.set('Settled');
    host.isLeader.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(verdict()).toBe('YOU WON');
    host.isLeader.set(false);
    fixture.detectChanges();
    expect(verdict()).toBe('SOLD');
  });

  it('shows no verdict while the war is open', async () => {
    await create();
    expect(verdict()).toBe('');
  });

  it('sets data-wide from the window width', async () => {
    vi.stubGlobal('innerWidth', 1440);
    await create();
    expect(scene().getAttribute('data-wide')).toBe('true');
    fixture.destroy();
    vi.stubGlobal('innerWidth', 800);
    await create();
    expect(scene().hasAttribute('data-wide')).toBe(false);
  });

  it('follows a window resize without a scene', async () => {
    vi.stubGlobal('innerWidth', 800);
    await create();
    vi.stubGlobal('innerWidth', 1440);
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(scene().getAttribute('data-wide')).toBe('true');
  });

  it('never throws on input changes without a scene', async () => {
    await create();
    expect(() => {
      host.players.set(3);
      fixture.detectChanges();
      host.status.set('Bidding');
      host.currentPrice.set(100);
      fixture.detectChanges();
      host.currentPrice.set(250);
      host.isLeader.set(true);
      host.manifest.set([{ name: 'Old Radio', rarity: 'Common' }]);
      fixture.detectChanges();
    }).not.toThrow();
  });

  it('warYardDeps refuses to run without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('IntersectionObserver', class {});
    expect(warYardDeps().canRun(document.createElement('canvas'))).toBe(false);
  });
});
