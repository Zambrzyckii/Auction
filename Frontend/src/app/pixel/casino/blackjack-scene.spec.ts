import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlackjackScene } from './blackjack-scene';
import type { TableHand } from './blackjack-watch';

@Component({
  imports: [BlackjackScene],
  template: `<app-blackjack-scene [hand]="hand()" [chips]="chips()" />`,
})
class Host {
  readonly hand = signal<TableHand | null>(null);
  readonly chips = signal<number | null>(null);
}

const dealt: TableHand = {
  publicHandId: 'h1',
  status: 'InProgress',
  stake: 10,
  doubled: false,
  playerCards: [9, 20],
  playerTotal: 17,
  playerIsSoft: false,
  dealerCards: [5],
  dealerHidden: true,
  dealerTotal: null,
  outcome: null,
  payout: null,
  autoStood: false,
  autoStandOn: '2026-11-23T12:05:00Z',
};

describe('BlackjackScene', () => {
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

  it('never gets the dealing class without a scene', async () => {
    await create();
    host.hand.set(dealt);
    fixture.detectChanges();
    const scene = fixture.nativeElement.querySelector('app-blackjack-scene');
    expect(scene.classList.contains('dealing')).toBe(false);
  });

  it('never throws on input changes without a scene', async () => {
    await create();
    expect(() => {
      host.hand.set(dealt);
      fixture.detectChanges();
      host.hand.set({ ...dealt, playerCards: [9, 20, 2] });
      host.chips.set(120);
      fixture.detectChanges();
      host.hand.set({
        ...dealt,
        status: 'Completed',
        dealerHidden: false,
        dealerCards: [5, 30, 7],
        dealerTotal: 22,
        outcome: 'Win',
        payout: 20,
      });
      fixture.detectChanges();
      host.hand.set(null);
      host.chips.set(null);
      fixture.detectChanges();
    }).not.toThrow();
  });
});
