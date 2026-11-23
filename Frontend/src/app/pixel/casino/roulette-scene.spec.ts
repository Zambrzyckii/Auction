import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouletteScene } from './roulette-scene';
import type { FeltBet, SpinView, ToteSpin } from './roulette-watch';

@Component({
  imports: [RouletteScene],
  template: `<app-roulette-scene
    [bets]="bets()"
    [spin]="spin()"
    [history]="history()"
    [chips]="chips()"
  />`,
})
class Host {
  readonly bets = signal<readonly FeltBet[]>([]);
  readonly spin = signal<SpinView | null>(null);
  readonly history = signal<readonly ToteSpin[] | null>(null);
  readonly chips = signal<number | null>(null);
}

const result: SpinView = {
  publicSpinId: 'spin-1',
  pocket: 17,
  totalStake: 15,
  totalPayout: 180,
  bets: [
    { type: 'Red', selection: null, stake: 10, payout: 0 },
    { type: 'Straight', selection: 17, stake: 5, payout: 180 },
  ],
};

describe('RouletteScene', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const create = async (): Promise<void> => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  });

  it('renders the room frame and a hidden canvas without booting a scene', async () => {
    await create();
    const canvas = fixture.nativeElement.querySelector('div.room > canvas.scene');
    expect(canvas).not.toBeNull();
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
  });

  it('never gets the rolling class without a scene', async () => {
    await create();
    host.spin.set(result);
    fixture.detectChanges();
    const scene = fixture.nativeElement.querySelector('app-roulette-scene');
    expect(scene.classList.contains('rolling')).toBe(false);
  });

  it('never throws on input changes without a scene', async () => {
    await create();
    expect(() => {
      host.bets.set([{ type: 'Red', selection: null, stake: 10 }]);
      fixture.detectChanges();
      host.bets.set([]);
      fixture.detectChanges();
      host.spin.set(result);
      host.history.set([{ pocket: 17 }, { pocket: 0 }]);
      host.chips.set(120);
      fixture.detectChanges();
      host.history.set(null);
      host.chips.set(null);
      host.spin.set(null);
      fixture.detectChanges();
    }).not.toThrow();
  });
});
