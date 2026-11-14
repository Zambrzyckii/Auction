import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Casino as CasinoDto, ChipPurchase, Wallet } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { Casino, cashOutProblem, casinoPollMs, purchaseNotice, purchaseProblem } from './casino';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const CASINO_URL = '/api/casino';
const WALLET_URL = `/api/wallets/${MY_ID}`;
const PURCHASES_URL = '/api/casino/chips/purchases';

function purchase(overrides: Partial<ChipPurchase>): ChipPurchase {
  return {
    publicPurchaseId: 'purchase-1',
    amount: 100,
    status: 'Completed',
    requestedOn: '2026-11-13T10:00:00Z',
    resolvedOn: '2026-11-13T10:00:05Z',
    rejectionReason: null,
    ...overrides,
  };
}

function casino(overrides: Partial<CasinoDto>): CasinoDto {
  return {
    balance: 0,
    lifetimeBought: 0,
    lifetimeCashedOut: 0,
    latestPurchase: null,
    roulette: { minBet: 1, maxBet: 1000, maxBetsPerSpin: 20 },
    ...overrides,
  };
}

function wallet(overrides: Partial<Wallet>): Wallet {
  return { availableFunds: 300, lockedFunds: 0, lifetimeTurnover: 0, ...overrides };
}

const pending = (): ChipPurchase => purchase({ status: 'Pending', resolvedOn: null });

describe('casinoPollMs', () => {
  it('polls fast while a purchase waits for the wallet', () => {
    expect(casinoPollMs(casino({ latestPurchase: pending() }))).toBe(2000);
  });

  it('polls slow otherwise', () => {
    expect(casinoPollMs(null)).toBe(5000);
    expect(casinoPollMs(casino({}))).toBe(5000);
    expect(casinoPollMs(casino({ latestPurchase: purchase({}) }))).toBe(5000);
  });
});

describe('purchaseProblem', () => {
  const funds = wallet({ availableFunds: 300 });

  it('allows a whole amount within the available funds', () => {
    expect(purchaseProblem(300, funds, casino({}))).toBeNull();
  });

  it('rejects zero and fractions with the validator texts', () => {
    expect(purchaseProblem(0, funds, casino({}))).toBe('Amount must be above zero.');
    expect(purchaseProblem(2.5, funds, casino({}))).toBe('Amount must be a whole number of chips');
  });

  it('blocks a second purchase while one is pending with the server text', () => {
    expect(purchaseProblem(10, funds, casino({ latestPurchase: pending() }))).toBe(
      'Another chip purchase is already in progress',
    );
  });

  it('rejects more than the available funds with the wallet text', () => {
    expect(purchaseProblem(301, funds, casino({}))).toBe('Not enough funds on account');
  });
});

describe('cashOutProblem', () => {
  const chips = casino({ balance: 100 });

  it('allows up to two decimal places within the chip balance', () => {
    expect(cashOutProblem(10.25, chips)).toBeNull();
    expect(cashOutProblem(100, chips)).toBeNull();
  });

  it('rejects zero and a third decimal place with the validator texts', () => {
    expect(cashOutProblem(0, chips)).toBe('Amount must be above zero.');
    expect(cashOutProblem(10.255, chips)).toBe('Amount cannot have more than two decimal places');
  });

  it('rejects more than the chip balance with the domain text', () => {
    expect(cashOutProblem(100.01, chips)).toBe('Not enough chips on account');
  });
});

describe('purchaseNotice', () => {
  it('says nothing before the first purchase', () => {
    expect(purchaseNotice(null)).toBeNull();
  });

  it('describes a pending and a completed purchase', () => {
    expect(purchaseNotice(pending())).toBe('Purchase of 100 chips is pending…');
    expect(purchaseNotice(purchase({}))).toBe('Bought 100 chips');
  });

  it('names the reason of a rejected purchase', () => {
    const rejected = purchase({
      amount: 5000,
      status: 'Rejected',
      rejectionReason: 'Not enough funds on account',
    });
    expect(purchaseNotice(rejected)).toBe(
      'Purchase of 5000 chips was rejected. Not enough funds on account',
    );
  });

  it('explains that an expired purchase can still complete', () => {
    const expired = purchase({ status: 'Expired', rejectionReason: 'Purchase timed out' });
    expect(purchaseNotice(expired)).toBe(
      'Purchase of 100 chips expired, the chips still arrive if your wallet was charged',
    );
  });
});

describe('Casino', () => {
  let fixture: ComponentFixture<Casino>;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    await TestBed.configureTestingModule({
      imports: [Casino],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Casino);
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

  function flushAll(state: CasinoDto, funds: Wallet = wallet({})): void {
    http.expectOne(CASINO_URL).flush(state);
    http.expectOne(WALLET_URL).flush(funds);
    fixture.detectChanges();
  }

  function typeAmount(value: string, formClass = '.buy-form'): void {
    const input = el().querySelector(`${formClass} input`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function buyButton(): HTMLButtonElement {
    return el().querySelector('button.buy-chips') as HTMLButtonElement;
  }

  it('shows the chip balance and the lifetime totals', () => {
    flushAll(casino({ balance: 85, lifetimeBought: 100, lifetimeCashedOut: 15 }));
    const text = el().textContent ?? '';
    expect(text).toContain('Chip balance: 85');
    expect(text).toContain('Bought in total: 100');
    expect(text).toContain('cashed out in total:');
    expect(text).toContain('15');
  });

  it('links to the roulette table', () => {
    flushAll(casino({}));
    expect(el().querySelector('.games a[href="/casino/roulette"]')?.textContent).toContain(
      'Roulette',
    );
  });

  it('buys chips and shows the pending purchase after the refresh', () => {
    flushAll(casino({}));
    typeAmount('100');
    buyButton().click();

    const post = http.expectOne(PURCHASES_URL);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ amount: 100 });
    post.flush({ publicPurchaseId: 'purchase-9' }, { status: 201, statusText: 'Created' });

    http.expectOne(CASINO_URL).flush(casino({ latestPurchase: pending() }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Purchase of 100 chips is pending…');
  });

  it('shows the latest purchase after a reload, not only for this session', () => {
    flushAll(casino({ balance: 100, lifetimeBought: 100, latestPurchase: purchase({}) }));
    expect(el().querySelector('.purchase-notice')?.textContent).toContain('Bought 100 chips');
  });

  it('blocks a second purchase while one is pending', () => {
    flushAll(casino({ latestPurchase: pending() }));
    typeAmount('10');
    expect(buyButton().disabled).toBe(true);
    expect(el().textContent).toContain('Another chip purchase is already in progress');
  });

  it('blocks more than the available funds', () => {
    flushAll(casino({}), wallet({ availableFunds: 300 }));
    typeAmount('5000');
    expect(buyButton().disabled).toBe(true);
    expect(el().textContent).toContain('Not enough funds on account');
  });

  it('shows the server text when the purchase is refused', () => {
    flushAll(casino({}));
    typeAmount('100');
    buyButton().click();
    http
      .expectOne(PURCHASES_URL)
      .flush(
        { error: 'Another chip purchase is already in progress' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();
    expect(el().querySelector('.buy-error')?.textContent).toContain(
      'Another chip purchase is already in progress',
    );
    expect(buyButton().disabled).toBe(false);
  });

  describe('cash-out form', () => {
    function cashOutButton(): HTMLButtonElement {
      return el().querySelector('button.cash-out') as HTMLButtonElement;
    }

    it('cashes out, says when the funds arrive and refreshes the balance', () => {
      flushAll(casino({ balance: 100 }));
      typeAmount('10.25', '.cash-out-form');
      cashOutButton().click();

      const post = http.expectOne('/api/casino/chips/cashouts');
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({ amount: 10.25 });
      post.flush(null, { status: 202, statusText: 'Accepted' });
      fixture.detectChanges();
      expect(el().textContent).toContain('Funds reach your wallet in a few seconds');

      http.expectOne(CASINO_URL).flush(casino({ balance: 89.75, lifetimeCashedOut: 10.25 }));
      fixture.detectChanges();
      expect(el().textContent).toContain('Chip balance: 89.75');
    });

    it('blocks a cash-out above the chip balance', () => {
      flushAll(casino({ balance: 0 }));
      typeAmount('5', '.cash-out-form');
      expect(cashOutButton().disabled).toBe(true);
      expect(el().textContent).toContain('Not enough chips on account');
    });

    it('shows the server text when the cash-out is refused', () => {
      flushAll(casino({ balance: 100 }));
      typeAmount('10', '.cash-out-form');
      cashOutButton().click();
      http
        .expectOne('/api/casino/chips/cashouts')
        .flush({ error: 'Data corrupted, try again' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(el().querySelector('.cash-out-notice')?.textContent).toContain(
        'Data corrupted, try again',
      );
      expect(cashOutButton().disabled).toBe(false);
    });
  });

  it('polls every 2 seconds while a purchase is pending', () => {
    flushAll(casino({ latestPurchase: pending() }));
    vi.advanceTimersByTime(2000);
    http.expectOne(CASINO_URL).flush(casino({ balance: 100, latestPurchase: purchase({}) }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Chip balance: 100');
    vi.advanceTimersByTime(3000);
    http.expectOne(WALLET_URL).flush(wallet({ availableFunds: 200 }));
    vi.advanceTimersByTime(2000);
    http.expectOne(CASINO_URL).flush(casino({ balance: 100, latestPurchase: purchase({}) }));
  });
});
