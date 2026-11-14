import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Pawnshop as PawnshopDto, PawnshopOffers, Wallet } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { Pawnshop, pawnshopPollMs, premisesProblem } from './pawnshop';

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
      { name: 'Pawn Clerk', rarity: 'Common', price: 50_000, spawnInterval: '00:00:30', payoutRate: 0.5 },
      { name: 'Appraiser', rarity: 'Rare', price: 300_000, spawnInterval: '00:01:00', payoutRate: 0.5 },
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

describe('pawnshopPollMs', () => {
  it('polls fast while a payment or a bot purchase is pending', () => {
    expect(pawnshopPollMs(shop({ status: 'PendingPayment' }))).toBe(2000);
    expect(pawnshopPollMs(shop({ pendingBotTierName: 'Appraiser' }))).toBe(2000);
  });

  it('polls slow otherwise', () => {
    expect(pawnshopPollMs(null)).toBe(5000);
    expect(pawnshopPollMs('none')).toBe(5000);
    expect(pawnshopPollMs(shop({}))).toBe(5000);
    expect(pawnshopPollMs(shop({ status: 'Rejected' }))).toBe(5000);
  });
});

describe('premisesProblem', () => {
  it('allows the purchase with the turnover and the funds in place', () => {
    expect(premisesProblem(offers({}), wallet({}))).toBeNull();
  });

  it('blocks a turnover below the gate and names both numbers', () => {
    expect(premisesProblem(offers({}), wallet({ lifetimeTurnover: 0 }))).toBe(
      'Needs lifetime turnover 1000000, you have 0',
    );
  });

  it('blocks missing funds with the wallet text', () => {
    expect(premisesProblem(offers({}), wallet({ availableFunds: 99_999 }))).toBe(
      'Not enough funds on account',
    );
  });
});

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
      shopRequest.flush({ error: 'Pawnshop was not found' }, { status: 404, statusText: 'Not Found' });
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

    http.expectOne(SHOP_URL).flush(shop({ status: 'PendingPayment' }));
    fixture.detectChanges();
    expect(el().querySelector('.payment-pending')?.textContent).toContain('Payment pending…');
    expect(el().querySelector('button.buy-premises')).toBeNull();
  });

  it('shows the rejection reason and lets the player retry', () => {
    flushAll(
      shop({ status: 'Rejected', rejectionReason: 'Lifetime turnover 0.00 is below the required 1000000.00' }),
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
    expect(el().querySelector('.shop-notice')?.textContent).toContain('User already owns a pawnshop');
    expect((el().querySelector('button.buy-premises') as HTMLButtonElement).disabled).toBe(false);
  });

  it('marks an active pawnshop', () => {
    flushAll(shop({}));
    expect(el().querySelector('.shop-active')?.textContent).toContain('Your pawnshop is active');
    expect(el().querySelector('button.buy-premises')).toBeNull();
  });

  it('polls the shop every 2 seconds while the payment is pending', () => {
    flushAll(shop({ status: 'PendingPayment' }));
    vi.advanceTimersByTime(2000);
    http.expectOne(SHOP_URL).flush(shop({}));
    fixture.detectChanges();
    expect(el().querySelector('.shop-active')).not.toBeNull();
  });
});
