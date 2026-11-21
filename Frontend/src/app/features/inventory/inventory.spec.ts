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
    http
      .expectOne('/api/inventory')
      .flush([
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
      .flush(
        { error: 'Item is not available (LockedForAuction)' },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();
    expect(el().querySelector('.notice')?.textContent).toContain('not available');
  });

  it('renders one card with a tile per item', () => {
    http
      .expectOne('/api/inventory')
      .flush([item({ publicItemId: 'a' }), item({ publicItemId: 'b' })]);
    fixture.detectChanges();
    expect(el().querySelectorAll('li.card app-item-tile').length).toBe(2);
  });

  it('keeps the craft button in the DOM while the workshop is closed (jsdom has no matchMedia or IntersectionObserver)', () => {
    http.expectOne('/api/inventory').flush([item({})]);
    fixture.detectChanges();
    expect(el().querySelector('button.door')?.getAttribute('aria-expanded')).toBe('false');
    expect(el().querySelector('button.craft')).not.toBeNull();
  });

  it('orders the cards by name when Name is pressed', () => {
    http
      .expectOne('/api/inventory')
      .flush([
        item({ publicItemId: 'b', name: 'Banjo', rarity: 'Common' }),
        item({ publicItemId: 'z', name: 'Zippo', rarity: 'Legendary' }),
      ]);
    fixture.detectChanges();
    const names = () =>
      [...el().querySelectorAll('li.card .name')].map((n) => n.textContent?.trim());
    expect(names()).toEqual(['Zippo', 'Banjo']);
    [...el().querySelectorAll<HTMLButtonElement>('app-shelf-sort button')]
      .find((b) => b.textContent?.trim() === 'Name')!
      .click();
    fixture.detectChanges();
    expect(names()).toEqual(['Banjo', 'Zippo']);
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

    it('posts only the ids of items still on the shelf', () => {
      flushItems(trio);
      selectAll(['ghost', 'a', 'b', 'c']);
      fixture.componentInstance.craft();

      const req = http.expectOne('/api/inventory/craft');
      expect(req.request.body).toEqual({ ingredientsIds: ['a', 'b', 'c'] });
      req.flush({ publicItemId: 'new' }, { status: 201, statusText: 'Created' });
    });

    it('marks picked and unfit cards with the classes the skin styles', () => {
      flushItems([trio[0], trio[1], item({ publicItemId: 'r', rarity: 'Rare', name: 'Odd One' })]);
      el().querySelector<HTMLButtonElement>('button.door')!.click();
      fixture.detectChanges();
      fixture.componentInstance.toggle('a');
      fixture.detectChanges();
      const card = (name: string) =>
        [...el().querySelectorAll<HTMLElement>('li.card')].find((c) =>
          c.textContent!.includes(name),
        )!;
      expect(card('Rusty Sword').classList.contains('picked')).toBe(true);
      expect(card('Odd One').classList.contains('unfit')).toBe(true);
      expect(card('Odd One').classList.contains('picked')).toBe(false);
    });

    it('disables the checkboxes of cards that do not fit the belt', () => {
      flushItems([
        trio[0],
        trio[1],
        item({ publicItemId: 'r', rarity: 'Rare', name: 'Odd One' }),
        item({ publicItemId: 'k', status: 'LockedForAuction', name: 'Locked One' }),
      ]);
      el().querySelector<HTMLButtonElement>('button.door')!.click();
      fixture.detectChanges();
      const box = (name: string) =>
        [...el().querySelectorAll<HTMLElement>('li.card')]
          .find((c) => c.textContent!.includes(name))!
          .querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(box('Locked One').disabled).toBe(true);
      expect(box('Odd One').disabled).toBe(false);

      fixture.componentInstance.toggle('a');
      fixture.detectChanges();
      expect(box('Odd One').disabled).toBe(true);
      expect(box('Rusty Sword').disabled).toBe(false);
    });

    it('drops a sold item from the selection', () => {
      flushItems(trio);
      selectAll(['a', 'b', 'c']);
      fixture.componentInstance.sell('b');
      http.expectOne('/api/inventory/b/sell').flush(null);
      expect(fixture.componentInstance.selection()).toEqual(['a', 'c']);
    });

    it('disables the craft button while the craft is pending', () => {
      flushItems(trio);
      selectAll(['a', 'b', 'c']);
      fixture.detectChanges();
      const button = el().querySelector('button.craft') as HTMLButtonElement;
      expect(button.disabled).toBe(false);

      button.click();
      fixture.detectChanges();
      expect(button.disabled).toBe(true);

      http
        .expectOne('/api/inventory/craft')
        .flush({ publicItemId: 'new' }, { status: 201, statusText: 'Created' });
    });

    it('locks the picks while the craft is pending', () => {
      flushItems(trio);
      selectAll(['a', 'b', 'c']);
      fixture.detectChanges();
      fixture.componentInstance.craft();
      fixture.detectChanges();
      const boxes = () => [
        ...el().querySelectorAll<HTMLInputElement>('li.card input[type="checkbox"]'),
      ];
      expect(boxes().length).toBe(3);
      expect(boxes().every((b) => b.disabled)).toBe(true);
      http
        .expectOne('/api/inventory/craft')
        .flush({ error: 'Item is not available' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(boxes().some((b) => b.disabled)).toBe(false);
    });

    it('shows the crafted card after the next poll', () => {
      flushItems(trio);
      selectAll(['a', 'b', 'c']);
      fixture.detectChanges();
      fixture.componentInstance.craft();
      fixture.detectChanges();
      http
        .expectOne('/api/inventory/craft')
        .flush({ publicItemId: 'new' }, { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      fixture.componentInstance.poller.refresh();
      http.expectOne('/api/inventory').flush([
        item({
          publicItemId: 'new',
          name: 'Crafted Rare Item',
          rarity: 'Rare',
          officialPrice: 1234,
        }),
      ]);
      fixture.detectChanges();
      const cards = el().querySelectorAll('li.card');
      expect(cards.length).toBe(1);
      expect(cards[0].classList.contains('fresh')).toBe(true);
      expect(cards[0].textContent).toContain('Crafted Rare Item');
    });
  });
});
