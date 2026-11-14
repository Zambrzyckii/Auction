import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Pawnshop as PawnshopDto, PawnshopOffers, StockItem, Wallet } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { Pawnshop } from './pawnshop';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const OFFERS_URL = '/api/pawnshop/offers';
const SHOP_URL = '/api/pawnshop';
const WALLET_URL = `/api/wallets/${MY_ID}`;

function offers(overrides: Partial<PawnshopOffers>): PawnshopOffers {
  return {
    premisesPrice: 100_000,
    premisesRequiredTurnover: 1_000_000,
    stockSellDelay: '00:05:00',
    botTiers: [
      {
        name: 'Pawn Clerk',
        rarity: 'Common',
        price: 50_000,
        spawnInterval: '00:00:30',
        payoutRate: 0.5,
      },
      {
        name: 'Appraiser',
        rarity: 'Rare',
        price: 300_000,
        spawnInterval: '00:01:00',
        payoutRate: 0.5,
      },
    ],
    ...overrides,
  };
}

function shop(overrides: Partial<PawnshopDto>): PawnshopDto {
  return {
    publicPawnshopId: 'shop-1',
    status: 'Active',
    requestedOn: '2026-11-14T10:00:00Z',
    activatedOn: '2026-11-14T10:00:10Z',
    rejectionReason: null,
    botTierName: null,
    botRarity: null,
    botSpawnInterval: null,
    botPayoutRate: null,
    botPurchasedOn: null,
    nextSpawnOn: null,
    pendingBotTierName: null,
    stock: [],
    ...overrides,
  };
}

function wallet(overrides: Partial<Wallet>): Wallet {
  return { availableFunds: 200_000, lockedFunds: 0, lifetimeTurnover: 1_200_000, ...overrides };
}

function stockItem(overrides: Partial<StockItem>): StockItem {
  return {
    publicStockItemId: 'stock-1',
    name: 'Rusty Kettle',
    rarity: 'Common',
    price: 101,
    payoutRate: 0.5,
    status: 'InStock',
    spawnedOn: '2026-11-14T10:00:00Z',
    sellAfter: new Date(Date.now() + 120_000).toISOString(),
    resolvedOn: null,
    payoutAmount: null,
    ...overrides,
  };
}

describe('Pawnshop', () => {
  let fixture: ComponentFixture<Pawnshop>;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    await TestBed.configureTestingModule({
      imports: [Pawnshop],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Pawnshop);
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

  function flushAll(state: PawnshopDto | 'none', funds: Wallet = wallet({})): void {
    http.expectOne(OFFERS_URL).flush(offers({}));
    const shopRequest = http.expectOne(SHOP_URL);
    if (state === 'none') {
      shopRequest.flush(
        { error: 'Pawnshop was not found' },
        { status: 404, statusText: 'Not Found' },
      );
    } else {
      shopRequest.flush(state);
    }
    http.expectOne(WALLET_URL).flush(funds);
    fixture.detectChanges();
  }

  it('shows the offers catalog with the bot tiers', () => {
    flushAll(shop({}));
    const text = el().textContent ?? '';
    expect(text).toContain('Premises price: 100,000');
    expect(text).toContain('Pawn Clerk');
    expect(text).toContain('Appraiser');
  });

  it('maps the 404 onto the none state and offers the purchase', () => {
    flushAll('none');
    expect(el().querySelector('button.buy-premises')).not.toBeNull();
    expect((el().querySelector('button.buy-premises') as HTMLButtonElement).disabled).toBe(false);
  });

  it('blocks the purchase for a fresh player with the turnover reason', () => {
    flushAll('none', wallet({ lifetimeTurnover: 0, availableFunds: 300 }));
    expect((el().querySelector('button.buy-premises') as HTMLButtonElement).disabled).toBe(true);
    expect(el().textContent).toContain('Needs lifetime turnover 1000000, you have 0');
  });

  it('buys the premises and shows the pending payment after the refresh', () => {
    flushAll('none');
    (el().querySelector('button.buy-premises') as HTMLButtonElement).click();

    const post = http.expectOne(SHOP_URL);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toBeNull();
    post.flush({ publicPawnshopId: 'shop-9' }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(el().querySelector('.shop-notice')).toBeNull();

    http.expectOne(SHOP_URL).flush(shop({ status: 'PendingPayment' }));
    fixture.detectChanges();
    expect(el().querySelector('.payment-pending')?.textContent).toContain('Payment pending…');
    expect(el().querySelector('button.buy-premises')).toBeNull();

    vi.advanceTimersByTime(2000);
    http.expectOne(SHOP_URL).flush(shop({}));
    fixture.detectChanges();
    expect(el().querySelector('.payment-pending')).toBeNull();
    expect(el().querySelector('.shop-notice')).toBeNull();
    expect(el().querySelector('.shop-active')).not.toBeNull();
  });

  it('shows the rejection reason and lets the player retry', () => {
    flushAll(
      shop({
        status: 'Rejected',
        rejectionReason: 'Lifetime turnover 0.00 is below the required 1000000.00',
      }),
    );
    expect(el().querySelector('.shop-rejection')?.textContent).toContain('below the required');
    expect(el().querySelector('button.buy-premises')).not.toBeNull();
  });

  it('shows the server text when the purchase is refused', () => {
    flushAll('none');
    (el().querySelector('button.buy-premises') as HTMLButtonElement).click();
    http
      .expectOne(SHOP_URL)
      .flush({ error: 'User already owns a pawnshop' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(el().querySelector('.shop-notice')?.textContent).toContain(
      'User already owns a pawnshop',
    );
    expect((el().querySelector('button.buy-premises') as HTMLButtonElement).disabled).toBe(false);
  });

  it('marks an active pawnshop', () => {
    flushAll(shop({}));
    expect(el().querySelector('.shop-active')?.textContent).toContain('Your pawnshop is active');
    expect(el().querySelector('button.buy-premises')).toBeNull();
  });

  it('shows the current bot with a spawn countdown and the pending purchase', () => {
    flushAll(
      shop({
        botTierName: 'Pawn Clerk',
        botRarity: 'Common',
        botSpawnInterval: '00:00:30',
        botPayoutRate: 0.5,
        nextSpawnOn: new Date(Date.now() + 25_000).toISOString(),
        pendingBotTierName: 'Appraiser',
      }),
    );
    expect(el().querySelector('.bot-current')?.textContent).toContain('Pawn Clerk (Common)');
    expect(el().querySelector('.next-spawn')?.textContent).toContain('0 min 25 s');
    expect(el().querySelector('.bot-pending')?.textContent).toContain('Buying Appraiser…');
  });

  it('buys an upgrade with the exact tier name and refreshes', () => {
    flushAll(shop({}), wallet({ availableFunds: 400_000 }));
    const buttons = el().querySelectorAll('button.buy-bot');
    expect(buttons.length).toBe(2);
    (buttons[1] as HTMLButtonElement).click();

    const post = http.expectOne('/api/pawnshop/bot');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ tierName: 'Appraiser' });
    post.flush(null, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();
    expect(el().querySelector('.bot-notice')).toBeNull();

    http.expectOne(SHOP_URL).flush(shop({ pendingBotTierName: 'Appraiser' }));
    fixture.detectChanges();
    expect(el().querySelector('.bot-pending')).not.toBeNull();

    vi.advanceTimersByTime(2000);
    http.expectOne(SHOP_URL).flush(shop({ botTierName: 'Appraiser', botRarity: 'Rare' }));
    fixture.detectChanges();
    expect(el().querySelector('.bot-pending')).toBeNull();
    expect(el().querySelector('.bot-notice')).toBeNull();
  });

  it('shows the server text when the upgrade is refused', () => {
    flushAll(
      shop({ botTierName: 'Pawn Clerk', botRarity: 'Common' }),
      wallet({ availableFunds: 2_000_000 }),
    );
    const button = el().querySelector('button.buy-bot') as HTMLButtonElement;
    button.click();
    http
      .expectOne('/api/pawnshop/bot')
      .flush(
        { error: 'A new bot must be of a higher tier than the current one' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();
    expect(el().querySelector('.bot-notice')?.textContent).toContain(
      'A new bot must be of a higher tier than the current one',
    );
  });

  it('lists the stock with the payout and a sale countdown', () => {
    flushAll(
      shop({
        stock: [
          stockItem({}),
          stockItem({
            publicStockItemId: 'stock-2',
            status: 'Sold',
            resolvedOn: '2026-11-14T10:06:00Z',
            payoutAmount: 50.5,
          }),
        ],
      }),
    );
    const rows = el().querySelectorAll('table.stock tr');
    expect(rows.length).toBe(3);
    expect(rows[1].textContent).toContain('Rusty Kettle');
    expect(rows[1].textContent).toContain('50.5');
    expect(rows[1].textContent).toContain('in 2 min 0 s');
    expect(rows[2].textContent).toContain('Sold');
    expect(rows[2].querySelector('button.withdraw')).toBeNull();
  });

  it('withdraws an item and says when it arrives', () => {
    flushAll(shop({ stock: [stockItem({})] }));
    (el().querySelector('button.withdraw') as HTMLButtonElement).click();

    const post = http.expectOne('/api/pawnshop/stock/stock-1/withdraw');
    expect(post.request.method).toBe('POST');
    post.flush(null, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();
    expect(el().querySelector('.stock-notice')?.textContent).toContain(
      'The item reaches your inventory in a few seconds',
    );

    http.expectOne(SHOP_URL).flush(shop({ stock: [stockItem({ status: 'Withdrawn' })] }));
    fixture.detectChanges();
    expect(el().querySelector('button.withdraw')).toBeNull();
  });

  it('disables the withdrawal once the window is closing', () => {
    flushAll(
      shop({ stock: [stockItem({ sellAfter: new Date(Date.now() + 1000).toISOString() })] }),
    );
    expect((el().querySelector('button.withdraw') as HTMLButtonElement).disabled).toBe(true);
    expect(el().querySelector('.withdraw-problem')?.textContent).toContain(
      'The withdrawal window for this stock item has closed',
    );
  });

  it('polls the shop every 2 seconds while the payment is pending', () => {
    flushAll(shop({ status: 'PendingPayment' }));
    vi.advanceTimersByTime(2000);
    http.expectOne(SHOP_URL).flush(shop({}));
    fixture.detectChanges();
    expect(el().querySelector('.shop-active')).not.toBeNull();
  });
});
