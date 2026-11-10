import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Auction, AuctionBid } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { AuctionDetail } from './auction-detail';

const URL = '/api/auctions/abc';
const BIDS_URL = '/api/auctions/abc/bids';
const MY_ID = 'me-user';

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

function bid(overrides: Partial<AuctionBid>): AuctionBid {
  return {
    bidderUserId: 'cafebabe-0000-0000-0000-000000000000',
    amount: 200,
    placedOn: new Date().toISOString(),
    ...overrides,
  };
}

describe('AuctionDetail', () => {
  let fixture: ComponentFixture<AuctionDetail>;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
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

  function flushBids(bids: AuctionBid[]): void {
    http.expectOne(BIDS_URL).flush(bids);
  }

  it('shows an active auction with its countdown', () => {
    http.expectOne(URL).flush(auction({}));
    flushBids([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Rusty Sword');
    expect(el().textContent).toContain('150');
    expect(el().textContent).toMatch(/min.*s/);
    expect(el().textContent).toContain('No bids yet');
  });

  it('keeps polling an active auction every 2.5 seconds', () => {
    http.expectOne(URL).flush(auction({}));
    flushBids([]);
    fixture.detectChanges();
    vi.advanceTimersByTime(2500);
    http.expectOne(URL).flush(auction({ currentPrice: 180 }));
    flushBids([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('180');
  });

  it('explains the Pending status', () => {
    http.expectOne(URL).flush(auction({ status: 'Pending' }));
    flushBids([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Waiting for the item lock');
  });

  it('shows the cancellation reason and stops polling', () => {
    http.expectOne(URL).flush(
      auction({ status: 'Cancelled', cancellationReason: 'Item could not be locked' }),
    );
    flushBids([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Item could not be locked');
    vi.advanceTimersByTime(10_000);
    http.expectNone(URL);
    http.expectNone(BIDS_URL);
  });

  it('stops polling once the auction closes', () => {
    http.expectOne(URL).flush(auction({ status: 'Closed' }));
    flushBids([]);
    fixture.detectChanges();
    vi.advanceTimersByTime(10_000);
    http.expectNone(URL);
    http.expectNone(BIDS_URL);
  });

  it('says not found on a 404', () => {
    http.expectOne(URL).flush(null, { status: 404, statusText: 'Not Found' });
    http.expectOne(BIDS_URL).flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().querySelector('.error')?.textContent).toContain('Auction not found');
  });

  it('lists the bid history with shortened bidder ids', () => {
    http.expectOne(URL).flush(auction({}));
    flushBids([bid({ amount: 220 }), bid({ amount: 200, placedOn: '2026-11-10T11:00:00Z' })]);
    fixture.detectChanges();
    expect(el().textContent).toContain('cafebabe');
    expect(el().textContent).not.toContain('cafebabe-0000');
    expect(el().textContent).toContain('220');
  });

  it('marks own bids as You', () => {
    http.expectOne(URL).flush(auction({}));
    flushBids([bid({ bidderUserId: MY_ID })]);
    fixture.detectChanges();
    expect(el().textContent).toContain('You');
  });
});
