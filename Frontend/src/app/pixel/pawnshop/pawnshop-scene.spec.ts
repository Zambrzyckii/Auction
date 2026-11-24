import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PawnshopScene } from './pawnshop-scene';
import type { PawnOffers, PawnShop, PawnState, PawnTier } from './pawnshop-watch';

@Component({
  imports: [PawnshopScene],
  template: `<app-pawnshop-scene
    [shop]="shop()"
    [offers]="offers()"
    [upgrades]="upgrades()"
    [canBuy]="canBuy()"
  />`,
})
class Host {
  readonly shop = signal<PawnState | null>(null);
  readonly offers = signal<PawnOffers | null>(null);
  readonly upgrades = signal<readonly PawnTier[]>([]);
  readonly canBuy = signal(false);
}

const shop = (over: Partial<PawnShop> = {}): PawnShop => ({
  publicPawnshopId: 'p1',
  status: 'Active',
  rejectionReason: null,
  botTierName: null,
  botRarity: null,
  nextSpawnOn: null,
  pendingBotTierName: null,
  stock: [],
  ...over,
});

const tier: PawnTier = { name: 'Pawn Clerk', rarity: 'Common', price: 50_000 };

describe('PawnshopScene', () => {
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

  it('never gets the staging class without a scene', async () => {
    await create();
    host.shop.set(shop({ status: 'PendingPayment' }));
    fixture.detectChanges();
    host.shop.set(shop());
    fixture.detectChanges();
    const scene = fixture.nativeElement.querySelector('app-pawnshop-scene');
    expect(scene.classList.contains('staging')).toBe(false);
  });

  it('never throws on input changes without a scene', async () => {
    await create();
    expect(() => {
      host.shop.set(null);
      host.shop.set('none');
      fixture.detectChanges();
      host.shop.set(shop({ status: 'PendingPayment' }));
      fixture.detectChanges();
      host.shop.set(
        shop({
          botTierName: 'Pawn Clerk',
          botRarity: 'Common',
          stock: [
            {
              publicStockItemId: 'i1',
              rarity: 'Common',
              price: 100,
              status: 'InStock',
              spawnedOn: '2026-11-24T10:00:00Z',
              sellAfter: '2026-11-24T10:05:00Z',
              payoutAmount: null,
            },
          ],
        }),
      );
      fixture.detectChanges();
      host.shop.set(shop({ status: 'Rejected', rejectionReason: 'Payment timed out' }));
      fixture.detectChanges();
      host.offers.set({ botTiers: [tier] });
      host.upgrades.set([tier]);
      fixture.detectChanges();
      host.canBuy.set(true);
      fixture.detectChanges();
      host.canBuy.set(false);
      host.offers.set(null);
      host.upgrades.set([]);
      fixture.detectChanges();
    }).not.toThrow();
  });
});
