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
    el().querySelector('button')!.click();

    const sellReq = http.expectOne('/api/inventory/a/sell');
    sellReq.flush(null);
    fixture.detectChanges();
    expect(el().querySelector('.notice')?.textContent).toContain('a few seconds');
  });

  it('disables selling for an item locked for an auction', () => {
    http.expectOne('/api/inventory').flush([item({ status: 'LockedForAuction' })]);
    fixture.detectChanges();
    expect(el().querySelector('button')!.disabled).toBe(true);
  });

  it('shows the API message when selling fails', () => {
    http.expectOne('/api/inventory').flush([item({ publicItemId: 'a' })]);
    fixture.detectChanges();
    el().querySelector('button')!.click();

    http
      .expectOne('/api/inventory/a/sell')
      .flush({ error: 'Item is not available (LockedForAuction)' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('.notice')?.textContent).toContain('not available');
  });
});
