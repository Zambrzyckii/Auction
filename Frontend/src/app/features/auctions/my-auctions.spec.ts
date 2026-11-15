import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { pushStub, PushStub } from '../../../testing/push-stub';
import { MyAuction } from '../../core/api/models';
import { PushClient } from '../../core/push/push-client';
import { MyAuctions } from './my-auctions';

const URL = '/api/auctions/mine';

function auction(overrides: Partial<MyAuction>): MyAuction {
  return {
    publicAuctionId: 'auction-1',
    sellerUserId: 'me-user',
    currentWinningUserId: null,
    status: 'Active',
    currentPrice: 150,
    endsOn: new Date(Date.now() + 600_000).toISOString(),
    itemName: 'Rusty Sword',
    itemRarity: 'Common',
    itemOfficialPrice: 42,
    cancellationReason: null,
    createdOn: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

describe('MyAuctions', () => {
  let fixture: ComponentFixture<MyAuctions>;
  let http: HttpTestingController;
  let push: PushStub;

  beforeEach(async () => {
    vi.useFakeTimers();
    push = pushStub();
    await TestBed.configureTestingModule({
      imports: [MyAuctions],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PushClient, useValue: push },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyAuctions);
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

  function rows(table: string): string[] {
    return Array.from(el().querySelectorAll(`table.${table} tr`))
      .slice(1)
      .map((row) => row.textContent ?? '');
  }

  it('requests the own list without a limit parameter', () => {
    http.expectOne(URL).flush([]);
  });

  it('refreshes the own list on AuctionListChanged', () => {
    http.expectOne(URL).flush([]);
    push.emit('AuctionListChanged');
    http.expectOne(URL).flush([auction({})]);
    fixture.detectChanges();
    expect(el().textContent).not.toContain('No auctions');
  });

  it('splits running and finished auctions into two tables', () => {
    http.expectOne(URL).flush([
      auction({ publicAuctionId: 'p', status: 'Pending', itemName: null }),
      auction({ publicAuctionId: 'a', status: 'Active' }),
      auction({ publicAuctionId: 'c', status: 'Closed', itemName: 'Old Helmet' }),
      auction({
        publicAuctionId: 'x',
        status: 'Cancelled',
        itemName: null,
        cancellationReason: 'Activation timed out',
      }),
    ]);
    fixture.detectChanges();
    expect(rows('running')).toHaveLength(2);
    expect(rows('running').join(' ')).toContain('Rusty Sword');
    expect(rows('finished')).toHaveLength(2);
    expect(rows('finished').join(' ')).toContain('Old Helmet');
    expect(rows('finished').join(' ')).toContain('Activation timed out');
  });

  it('links every row to the auction detail', () => {
    http
      .expectOne(URL)
      .flush([
        auction({ publicAuctionId: 'abc' }),
        auction({ publicAuctionId: 'def', status: 'Closed' }),
      ]);
    fixture.detectChanges();
    expect(el().querySelector('a[href="/auctions/abc"]')).not.toBeNull();
    expect(el().querySelector('a[href="/auctions/def"]')).not.toBeNull();
  });

  it('polls again after ten seconds', () => {
    http.expectOne(URL).flush([]);
    fixture.detectChanges();
    vi.advanceTimersByTime(10_000);
    http.expectOne(URL).flush([auction({})]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Rusty Sword');
  });

  it('shows an empty-state message', () => {
    http.expectOne(URL).flush([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('You have not listed anything yet');
  });

  it('shows the normalized error and leaves a 401 to the interceptor', () => {
    http
      .expectOne(URL)
      .flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(el().querySelector('.error')).not.toBeNull();
  });
});
