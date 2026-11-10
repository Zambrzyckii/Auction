import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InventoryItem } from '../../core/api/models';
import { Inventory } from './inventory';

function item(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    publicItemId: 'id-1',
    name: 'Rusty Sword',
    rarity: 'Common',
    status: 'Available',
    officialPrice: 42,
    ...overrides,
  };
}

describe('Inventory', () => {
  let fixture: ComponentFixture<Inventory>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Inventory],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Inventory);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the items returned by the API', () => {
    http.expectOne('/api/inventory').flush([
      item({ publicItemId: 'a', name: 'Rusty Sword' }),
      item({ publicItemId: 'b', name: 'Old Shield', status: 'LockedForAuction' }),
    ]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Rusty Sword');
    expect(el().textContent).toContain('Old Shield');
    expect(el().textContent).toContain('LockedForAuction');
  });

  it('mentions the starter pack while the inventory is empty', () => {
    http.expectOne('/api/inventory').flush([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('starter pack');
  });

  it('sells an available item and shows the funds note', () => {
    http.expectOne('/api/inventory').flush([item({ publicItemId: 'a' })]);
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('button.sell')!.click();

    const sellReq = http.expectOne('/api/inventory/a/sell');
    sellReq.flush(null);
    fixture.detectChanges();
    expect(el().querySelector('.notice')?.textContent).toContain('a few seconds');
  });

  it('disables selling for an item locked for an auction', () => {
    http.expectOne('/api/inventory').flush([item({ status: 'LockedForAuction' })]);
    fixture.detectChanges();
    expect(el().querySelector<HTMLButtonElement>('button.sell')!.disabled).toBe(true);
  });

  it('shows the API message when selling fails', () => {
    http.expectOne('/api/inventory').flush([item({ publicItemId: 'a' })]);
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('button.sell')!.click();

    http
      .expectOne('/api/inventory/a/sell')
      .flush({ error: 'Item is not available (LockedForAuction)' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('.notice')?.textContent).toContain('not available');
  });

  describe('crafting', () => {
    const trio = [
      item({ publicItemId: 'a' }),
      item({ publicItemId: 'b' }),
      item({ publicItemId: 'c' }),
    ];

    function flushItems(items: InventoryItem[]): void {
      http.expectOne('/api/inventory').flush(items);
      fixture.detectChanges();
    }

    function selectAll(ids: readonly string[]): void {
      for (const id of ids) {
        fixture.componentInstance.toggle(id);
      }
    }

    it('allows crafting three distinct available items of one rarity', () => {
      flushItems(trio);
      selectAll(['a', 'b', 'c']);
      expect(fixture.componentInstance.canCraft()).toBe(true);
    });

    it('blocks crafting with fewer than three items', () => {
      flushItems(trio);
      selectAll(['a', 'b']);
      expect(fixture.componentInstance.canCraft()).toBe(false);
    });

    it('blocks mixed rarities', () => {
      flushItems([trio[0], trio[1], item({ publicItemId: 'c', rarity: 'Rare' })]);
      selectAll(['a', 'b', 'c']);
      expect(fixture.componentInstance.canCraft()).toBe(false);
    });

    it('blocks Legendary ingredients', () => {
      flushItems(trio.map((i) => ({ ...i, rarity: 'Legendary' as const })));
      selectAll(['a', 'b', 'c']);
      expect(fixture.componentInstance.canCraft()).toBe(false);
    });

    it('blocks ingredients that are not available', () => {
      flushItems([trio[0], trio[1], item({ publicItemId: 'c', status: 'LockedForAuction' })]);
      selectAll(['a', 'b', 'c']);
      expect(fixture.componentInstance.canCraft()).toBe(false);
    });

    it('posts the ingredient ids and clears the selection on a 201', () => {
      flushItems(trio);
      selectAll(['a', 'b', 'c']);
      fixture.componentInstance.craft();

      const req = http.expectOne('/api/inventory/craft');
      expect(req.request.body).toEqual({ ingredientsIds: ['a', 'b', 'c'] });
      req.flush({ publicItemId: 'new' }, { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      expect(fixture.componentInstance.selection()).toEqual([]);
      expect(el().querySelector('.notice')?.textContent).toContain('Crafted');
    });
  });
});
