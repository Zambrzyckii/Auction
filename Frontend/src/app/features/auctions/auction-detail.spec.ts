import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Auction } from '../../core/api/models';
import { AuctionDetail } from './auction-detail';

const URL = '/api/auctions/abc';

function auction(overrides: Partial<Auction>): Auction {
  return {
    publicAuctionId: 'abc',
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

describe('AuctionDetail', () => {
  let fixture: ComponentFixture<AuctionDetail>;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [AuctionDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'abc' }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuctionDetail);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.useRealTimers();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows an active auction with its countdown', () => {
    http.expectOne(URL).flush(auction({}));
    fixture.detectChanges();
    expect(el().textContent).toContain('Rusty Sword');
    expect(el().textContent).toContain('150');
    expect(el().textContent).toMatch(/min.*s/);
  });

  it('keeps polling an active auction every 2.5 seconds', () => {
    http.expectOne(URL).flush(auction({}));
    fixture.detectChanges();
    vi.advanceTimersByTime(2500);
    http.expectOne(URL).flush(auction({ currentPrice: 180 }));
    fixture.detectChanges();
    expect(el().textContent).toContain('180');
  });

  it('explains the Pending status', () => {
    http.expectOne(URL).flush(auction({ status: 'Pending' }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Waiting for the item lock');
  });

  it('shows the cancellation reason and stops polling', () => {
    http.expectOne(URL).flush(
      auction({ status: 'Cancelled', cancellationReason: 'Item could not be locked' }),
    );
    fixture.detectChanges();
    expect(el().textContent).toContain('Item could not be locked');
    vi.advanceTimersByTime(10_000);
    http.expectNone(URL);
  });

  it('stops polling once the auction closes', () => {
    http.expectOne(URL).flush(auction({ status: 'Closed' }));
    fixture.detectChanges();
    vi.advanceTimersByTime(10_000);
    http.expectNone(URL);
  });

  it('says not found on a 404', () => {
    http.expectOne(URL).flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().querySelector('.error')?.textContent).toContain('Auction not found');
  });
});
