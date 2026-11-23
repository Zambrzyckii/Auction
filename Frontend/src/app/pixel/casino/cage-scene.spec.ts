import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CageScene } from './cage-scene';
import type { CageCasino } from './cage-watch';

@Component({
  imports: [CageScene],
  template: `<app-cage-scene [casino]="casino()" [cash]="cash()" />`,
})
class Host {
  readonly casino = signal<CageCasino | null>(null);
  readonly cash = signal<number | null>(null);
}

const account = (overrides: Partial<CageCasino> = {}): CageCasino => ({
  balance: 100,
  lifetimeCashedOut: 0,
  latestPurchase: null,
  ...overrides,
});

describe('CageScene', () => {
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

  it('never throws on input changes without a scene', async () => {
    await create();
    expect(() => {
      host.casino.set(account());
      host.cash.set(300);
      fixture.detectChanges();
      host.casino.set(null);
      host.cash.set(null);
      fixture.detectChanges();
      host.casino.set(
        account({
          latestPurchase: { publicPurchaseId: 'p-1', amount: 50, status: 'Pending' },
        }),
      );
      fixture.detectChanges();
      host.casino.set(
        account({
          balance: 150,
          lifetimeCashedOut: 20,
          latestPurchase: { publicPurchaseId: 'p-1', amount: 50, status: 'Completed' },
        }),
      );
      fixture.detectChanges();
    }).not.toThrow();
  });
});
