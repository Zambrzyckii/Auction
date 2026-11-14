import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import {
  Casino as CasinoDto,
  RouletteBet,
  RouletteSpin,
  RouletteSpinResult,
} from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { Roulette, betProblem, spinProblem } from './roulette';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const CASINO_URL = '/api/casino';
const SPINS_URL = '/api/casino/roulette/spins';
const LIMITS = { minBet: 1, maxBet: 1000, maxBetsPerSpin: 20 };
const SELECTION = 'Bet selection does not match its type';
const STAKE = 'Each stake must be a whole number of chips within the table limits';

function casino(overrides: Partial<CasinoDto>): CasinoDto {
  return {
    balance: 100,
    lifetimeBought: 100,
    lifetimeCashedOut: 0,
    latestPurchase: null,
    roulette: LIMITS,
    ...overrides,
  };
}

function bet(overrides: Partial<RouletteBet>): RouletteBet {
  return { type: 'Red', selection: null, stake: 10, ...overrides };
}

function spin(overrides: Partial<RouletteSpin>): RouletteSpin {
  return {
    publicSpinId: 'spin-1',
    pocket: 17,
    color: 'Black',
    totalStake: 15,
    totalPayout: 180,
    placedOn: '2026-11-13T10:00:00Z',
    bets: [
      { type: 'Red', selection: null, stake: 10, payout: 0 },
      { type: 'Straight', selection: 17, stake: 5, payout: 180 },
    ],
    ...overrides,
  };
}

describe('betProblem', () => {
  it('accepts every bet type within its selection range and the table limits', () => {
    for (const valid of [
      bet({ type: 'Straight', selection: 0, stake: 1 }),
      bet({ type: 'Straight', selection: 36, stake: 1000 }),
      bet({ type: 'Dozen', selection: 1 }),
      bet({ type: 'Column', selection: 3 }),
      bet({ type: 'Black' }),
      bet({ type: 'High' }),
    ]) {
      expect(betProblem(valid, LIMITS)).toBeNull();
    }
  });

  it('rejects a selection that does not match the type', () => {
    for (const invalid of [
      bet({ type: 'Straight', selection: 37 }),
      bet({ type: 'Straight', selection: null }),
      bet({ type: 'Dozen', selection: 4 }),
      bet({ type: 'Column', selection: 0 }),
      bet({ type: 'Red', selection: 5 }),
    ]) {
      expect(betProblem(invalid, LIMITS)).toBe(SELECTION);
    }
  });

  it('rejects a stake outside the table limits or with a fraction', () => {
    for (const stake of [0, 1001, 2.5]) {
      expect(betProblem(bet({ stake }), LIMITS)).toBe(STAKE);
    }
  });

  it('reports the selection before the stake, like the server', () => {
    expect(betProblem(bet({ type: 'Dozen', selection: 4, stake: 2.5 }), LIMITS)).toBe(SELECTION);
  });
});

describe('spinProblem', () => {
  it('needs between one bet and the table maximum', () => {
    const text = 'A spin takes between 1 and 20 bets';
    expect(spinProblem([], casino({}))).toBe(text);
    expect(spinProblem(Array.from({ length: 21 }, () => bet({ stake: 1 })), casino({}))).toBe(text);
  });

  it('rejects a total stake above the chip balance with the domain text', () => {
    const funds = casino({ balance: 100 });
    expect(spinProblem([bet({ stake: 60 }), bet({ stake: 41 })], funds)).toBe(
      'Not enough chips on account',
    );
    expect(spinProblem([bet({ stake: 60 }), bet({ stake: 40 })], funds)).toBeNull();
  });
});

describe('Roulette', () => {
  let fixture: ComponentFixture<Roulette>;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    await TestBed.configureTestingModule({
      imports: [Roulette],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Roulette);
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

  function flushAll(state: CasinoDto, history: RouletteSpin[] = []): void {
    http.expectOne(CASINO_URL).flush(state);
    http.expectOne({ method: 'GET', url: SPINS_URL }).flush(history);
    fixture.detectChanges();
  }

  function fill(selector: string, value: string): void {
    const control = el().querySelector(selector) as HTMLInputElement | HTMLSelectElement;
    control.value = value;
    control.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function addBet(type: string, stake: string, selection?: string): void {
    fill('.bet-form select', type);
    if (selection !== undefined) {
      fill('.bet-form input.selection', selection);
    }
    fill('.bet-form input.stake', stake);
    (el().querySelector('button.add-bet') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function spinButton(): HTMLButtonElement {
    return el().querySelector('button.spin') as HTMLButtonElement;
  }

  it('tells a player without chips to buy them first', () => {
    flushAll(casino({ balance: 0, lifetimeBought: 0 }));
    expect(el().textContent).toContain('Buy chips first');
    expect(el().querySelector('.buy-first a[href="/casino"]')).not.toBeNull();
    expect(spinButton()).toBeNull();
  });

  it('spins the listed bets and shows the pocket, the payouts and the net', () => {
    flushAll(casino({}));
    addBet('Red', '10');
    addBet('Straight', '5', '17');
    expect(el().querySelectorAll('table.bets tr').length).toBe(3);
    spinButton().click();

    const post = http.expectOne({ method: 'POST', url: SPINS_URL });
    expect(post.request.body).toEqual({
      bets: [
        { type: 'Red', selection: null, stake: 10 },
        { type: 'Straight', selection: 17, stake: 5 },
      ],
    });
    const result: RouletteSpinResult = { ...spin({}), balance: 265 };
    post.flush(result);
    fixture.detectChanges();
    const lastSpin = el().querySelector('.last-spin')?.textContent ?? '';
    expect(el().querySelector('.last-spin .pocket')?.textContent).toContain('17');
    expect(lastSpin).toContain('Black');
    expect(lastSpin).toContain('180');
    expect(el().querySelector('.last-spin .net')?.textContent).toContain('165');

    http.expectOne(CASINO_URL).flush(casino({ balance: 265 }));
    http.expectOne({ method: 'GET', url: SPINS_URL }).flush([spin({})]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Chip balance: 265');
  });

  it('blocks an invalid bet with the precheck text', () => {
    flushAll(casino({}));
    fill('.bet-form select', 'Dozen');
    fill('.bet-form input.selection', '4');
    expect((el().querySelector('button.add-bet') as HTMLButtonElement).disabled).toBe(true);
    expect(el().querySelector('.bet-problem')?.textContent).toContain(SELECTION);
  });

  it('removes a bet and blocks a spin above the chip balance', () => {
    flushAll(casino({ balance: 15 }));
    addBet('Red', '10');
    addBet('Black', '10');
    expect(spinButton().disabled).toBe(true);
    expect(el().querySelector('.spin-problem')?.textContent).toContain('Not enough chips on account');
    (el().querySelectorAll('button.remove-bet')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelectorAll('table.bets tr').length).toBe(2);
    expect(spinButton().disabled).toBe(false);
  });

  it('shows the server text when the spin is refused', () => {
    flushAll(casino({}));
    addBet('Red', '10');
    spinButton().click();
    http
      .expectOne({ method: 'POST', url: SPINS_URL })
      .flush({ error: 'Not enough chips on account' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('.spin-error')?.textContent).toContain('Not enough chips on account');
    expect(spinButton().disabled).toBe(false);
  });

  it('lists the spin history in the server order', () => {
    flushAll(casino({}), [
      spin({ publicSpinId: 'spin-2', pocket: 0, color: 'Green', totalPayout: 0 }),
      spin({}),
    ]);
    const rows = el().querySelectorAll('table.history tr');
    expect(rows[1].textContent).toContain('Green');
    expect(rows[2].textContent).toContain('Black');
  });
});
