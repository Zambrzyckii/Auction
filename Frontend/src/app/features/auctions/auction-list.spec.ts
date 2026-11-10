import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auction } from '../../core/api/models';
import { AuctionList } from './auction-list';

function auction(overrides: Partial<Auction>): Auction {
  return {
    publicAuctionId: 'auction-1',
    sellerUserId: 'seller-1',
    currentWinningUserId: null,
    status: 'Active',
    currentPrice: 150,
    endsOn: new Date(Date.now() + 600_000).toISOString(),
    itemName: 'Rusty Sword',
    itemRarity: 'Common',
    itemOfficialPrice: 42,
    cancellationReason: null,
    ...overrides,
  };
}

describe('AuctionList', () => {
  let fixture: ComponentFixture<AuctionList>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuctionList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuctionList);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('always requests the list with an explicit limit', () => {
    http.expectOne('/api/auctions?limit=50').flush([]);
  });

  it('lists active auctions with a countdown and a detail link', () => {
    http.expectOne('/api/auctions?limit=50').flush([auction({ publicAuctionId: 'abc' })]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Rusty Sword');
    expect(el().textContent).toMatch(/min.*s/);
    expect(el().querySelector('a[href="/auctions/abc"]')).not.toBeNull();
  });

  it('shows an empty-state message', () => {
    http.expectOne('/api/auctions?limit=50').flush([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('No active auctions');
  });

  it('shows the normalized error on a gateway failure', () => {
    http
      .expectOne('/api/auctions?limit=50')
      .flush('<html>502</html>', { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();
    const error = el().querySelector('.error')?.textContent ?? '';
    expect(error.length).toBeGreaterThan(0);
    expect(error).not.toContain('<');
  });
});
