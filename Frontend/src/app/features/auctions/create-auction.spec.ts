import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { InventoryItem } from '../../core/api/models';
import { CreateAuction } from './create-auction';

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

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

describe('CreateAuction', () => {
  let fixture: ComponentFixture<CreateAuction>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateAuction],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CreateAuction);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('offers only the available items', async () => {
    http.expectOne('/api/inventory').flush([
      item({ publicItemId: 'a', name: 'Rusty Sword' }),
      item({ publicItemId: 'b', name: 'Old Shield', status: 'LockedForAuction' }),
    ]);
    await fixture.whenStable();
    const options = [...el().querySelectorAll('option')].map((o) => o.textContent);
    expect(options.some((t) => t?.includes('Rusty Sword'))).toBe(true);
    expect(options.some((t) => t?.includes('Old Shield'))).toBe(false);
  });

  it('does not post while the form is invalid', async () => {
    http.expectOne('/api/inventory').flush([item({})]);
    await fixture.whenStable();
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    http.expectNone('/api/auctions');
  });

  it('posts UTC and navigates to the new auction', async () => {
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    http.expectOne('/api/inventory').flush([item({ publicItemId: 'a' })]);
    await fixture.whenStable();

    const select = el().querySelector('select')!;
    select.value = 'a';
    select.dispatchEvent(new Event('change'));
    select.dispatchEvent(new Event('input'));
    const inputs = el().querySelectorAll('input');
    inputs[0].value = '250';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = toLocalInput(new Date(Date.now() + 3_600_000));
    inputs[1].dispatchEvent(new Event('input'));
    await fixture.whenStable();
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const req = http.expectOne('/api/auctions');
    expect(req.request.body.itemId).toBe('a');
    expect(req.request.body.startingPrice).toBe(250);
    expect(String(req.request.body.endsOn)).toMatch(/Z$/);
    req.flush({ publicAuctionId: 'new-id' }, { status: 201, statusText: 'Created' });
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(['/auctions', 'new-id']));
  });
});
