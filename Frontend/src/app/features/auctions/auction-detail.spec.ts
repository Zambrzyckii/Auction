import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Auction, AuctionBid } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { ProfileDirectory, shortId } from '../../core/profiles/profile-directory';
import { AuctionDetail, isBidConfirmed } from './auction-detail';

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

describe('isBidConfirmed', () => {
  it('confirms when the history holds my id with my amount', () => {
    const history = [bid({ amount: 220 }), bid({ bidderUserId: MY_ID, amount: 200 })];
    expect(isBidConfirmed(history, MY_ID, 200)).toBe(true);
  });

  it('ignores someone else bidding the same amount', () => {
    expect(isBidConfirmed([bid({ amount: 200 })], MY_ID, 200)).toBe(false);
  });

  it('ignores my bids over other amounts', () => {
    expect(isBidConfirmed([bid({ bidderUserId: MY_ID, amount: 180 })], MY_ID, 200)).toBe(false);
  });

  it('never confirms while logged out', () => {
    expect(isBidConfirmed([bid({ bidderUserId: MY_ID, amount: 200 })], null, 200)).toBe(false);
  });
});

describe('AuctionDetail', () => {
  let fixture: ComponentFixture<AuctionDetail>;
  let http: HttpTestingController;
  let directoryNames: WritableSignal<ReadonlyMap<string, string>>;
  let directoryStub: { ensure: ReturnType<typeof vi.fn>; label(userId: string): string };

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    directoryNames = signal<ReadonlyMap<string, string>>(new Map());
    directoryStub = {
      ensure: vi.fn(),
      label: (userId: string) => directoryNames().get(userId) ?? shortId(userId),
    };
    await TestBed.configureTestingModule({
      imports: [AuctionDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ProfileDirectory, useValue: directoryStub },
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

  it('passes the bidder ids to the profile directory', () => {
    http.expectOne(URL).flush(auction({}));
    flushBids([bid({}), bid({ bidderUserId: MY_ID })]);
    expect(directoryStub.ensure).toHaveBeenCalledWith([
      'cafebabe-0000-0000-0000-000000000000',
      MY_ID,
    ]);
  });

  it('shows the username once the directory knows it', () => {
    directoryNames.set(new Map([['cafebabe-0000-0000-0000-000000000000', 'alice']]));
    http.expectOne(URL).flush(auction({}));
    flushBids([bid({})]);
    fixture.detectChanges();
    expect(el().textContent).toContain('alice');
  });

  it('links other bidders to their profiles but never myself', () => {
    http.expectOne(URL).flush(auction({}));
    flushBids([bid({}), bid({ bidderUserId: MY_ID, amount: 180 })]);
    fixture.detectChanges();
    const links = Array.from(el().querySelectorAll('td a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/profiles/cafebabe-0000-0000-0000-000000000000');
    expect(links).not.toContain(`/profiles/${MY_ID}`);
  });

  describe('bidding', () => {
    function load(overrides: Partial<Auction>): void {
      http.expectOne(URL).flush(auction(overrides));
      flushBids([]);
      fixture.detectChanges();
    }

    function blockReason(): string | null {
      return fixture.componentInstance.bidBlockReason();
    }

    it('allows a higher bid from a challenger', () => {
      load({ currentPrice: 150 });
      fixture.componentInstance.bidAmount.set(200);
      expect(blockReason()).toBeNull();
    });

    it('blocks a bid at or below the current price', () => {
      load({ currentPrice: 150 });
      fixture.componentInstance.bidAmount.set(150);
      expect(blockReason()).toBeTypeOf('string');
      expect(blockReason()!.length).toBeGreaterThan(0);
    });

    it('blocks the seller', () => {
      load({ sellerUserId: MY_ID });
      fixture.componentInstance.bidAmount.set(200);
      expect(blockReason()).toBeTypeOf('string');
    });

    it('blocks the current leader', () => {
      load({ currentWinningUserId: MY_ID });
      fixture.componentInstance.bidAmount.set(200);
      expect(blockReason()).toBeTypeOf('string');
    });

    it('posts the bid and shows the pending note', () => {
      load({});
      fixture.componentInstance.bidAmount.set(200);
      fixture.componentInstance.placeBid();
      const req = http.expectOne('/api/auctions/abc/bid');
      expect(req.request.body).toEqual({ amount: 200 });
      req.flush(null);
      fixture.detectChanges();
      expect(el().querySelector('.notice')?.textContent).toContain('confirmation');
    });

    it('reports confirmation once the history shows the bid', () => {
      load({});
      fixture.componentInstance.bidAmount.set(200);
      fixture.componentInstance.placeBid();
      http.expectOne('/api/auctions/abc/bid').flush(null);
      fixture.detectChanges();
      expect(el().textContent).toContain('waiting for confirmation');

      vi.advanceTimersByTime(2500);
      http.expectOne(URL).flush(auction({ currentPrice: 200 }));
      flushBids([bid({ bidderUserId: MY_ID, amount: 200 })]);
      fixture.detectChanges();
      expect(el().textContent).toContain('Bid confirmed.');
    });

    it('warns when the bid is still unconfirmed after twenty seconds', () => {
      load({});
      fixture.componentInstance.bidAmount.set(200);
      fixture.componentInstance.placeBid();
      http.expectOne('/api/auctions/abc/bid').flush(null);
      for (let i = 0; i < 9; i++) {
        vi.advanceTimersByTime(2500);
        http.expectOne(URL).flush(auction({}));
        flushBids([]);
      }
      fixture.detectChanges();
      expect(el().textContent).toContain('not confirmed yet');
    });

    it('surfaces the BidInProgress conflict', () => {
      load({});
      fixture.componentInstance.bidAmount.set(200);
      fixture.componentInstance.placeBid();
      http
        .expectOne('/api/auctions/abc/bid')
        .flush({ error: 'Bid already in progress.' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(el().querySelector('.notice')?.textContent).toContain('already in progress');
    });
  });
});
