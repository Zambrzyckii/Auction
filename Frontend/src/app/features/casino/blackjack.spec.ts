import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import {
  ActiveBlackjackHand,
  BlackjackHand,
  BlackjackHandHistory,
  Casino as CasinoDto,
} from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { Blackjack } from './blackjack';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const CASINO_URL = '/api/casino';
const HANDS_URL = '/api/casino/blackjack/hands';
const LIMITS = { minBet: 5, maxBet: 2000 };

function casino(overrides: Partial<CasinoDto>): CasinoDto {
  return {
    balance: 100,
    lifetimeBought: 100,
    lifetimeCashedOut: 0,
    latestPurchase: null,
    activeBlackjackHand: null,
    roulette: { minBet: 1, maxBet: 1000, maxBetsPerSpin: 20 },
    blackjack: LIMITS,
    ...overrides,
  };
}

function handDto(overrides: Partial<BlackjackHand>): BlackjackHand {
  return {
    publicHandId: 'hand-1',
    status: 'InProgress',
    stake: 10,
    doubled: false,
    playerCards: [0, 14],
    playerTotal: 13,
    playerIsSoft: true,
    visibleDealerCards: [5],
    dealerTotal: null,
    outcome: null,
    payout: null,
    autoStood: false,
    balance: 90,
    startedOn: '2026-11-14T10:00:00Z',
    completedOn: null,
    ...overrides,
  };
}

function activeDto(overrides: Partial<ActiveBlackjackHand>): ActiveBlackjackHand {
  return {
    publicHandId: 'hand-1',
    stake: 10,
    doubled: false,
    playerCards: [0, 14],
    playerTotal: 13,
    playerIsSoft: true,
    visibleDealerCards: [5],
    startedOn: '2026-11-14T10:00:00Z',
    lastActionOn: '2026-11-14T10:00:00Z',
    ...overrides,
  };
}

function historyDto(overrides: Partial<BlackjackHandHistory>): BlackjackHandHistory {
  return {
    publicHandId: 'hand-0',
    stake: 10,
    doubled: false,
    outcome: 'Win',
    payout: 20,
    playerCards: [0, 14, 8],
    dealerCards: [5, 18, 31],
    playerTotal: 20,
    dealerTotal: 19,
    autoStood: false,
    startedOn: '2026-11-14T09:00:00Z',
    completedOn: '2026-11-14T09:01:00Z',
    ...overrides,
  };
}

describe('Blackjack', () => {
  let fixture: ComponentFixture<Blackjack>;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    await TestBed.configureTestingModule({
      imports: [Blackjack],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Blackjack);
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

  function flushAll(state: CasinoDto, history: BlackjackHandHistory[] = []): void {
    http.expectOne(CASINO_URL).flush(state);
    http.expectOne({ method: 'GET', url: HANDS_URL }).flush(history);
    fixture.detectChanges();
  }

  function dealWith(dto: BlackjackHand): void {
    const input = el().querySelector('.deal-form input') as HTMLInputElement;
    input.value = '10';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el().querySelector('button.deal') as HTMLButtonElement).click();
    const post = http.expectOne({ method: 'POST', url: HANDS_URL });
    expect(post.request.body).toEqual({ stake: 10 });
    post.flush(dto, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
  }

  it('tells a player without chips to buy them first', () => {
    flushAll(casino({ balance: 0, lifetimeBought: 0 }));
    expect(el().textContent).toContain('Buy chips first');
    expect(el().querySelector('.deal-form')).toBeNull();
  });

  it('deals a hand and hides the dealer hole card', () => {
    flushAll(casino({}));
    dealWith(handDto({}));

    expect(el().querySelectorAll('.player .card').length).toBe(2);
    expect(el().querySelectorAll('.dealer .card').length).toBe(2);
    expect(el().querySelector('.hidden-card')?.textContent).toBe('??');
    expect(el().querySelector('.player-total')?.textContent).toContain('13 soft');
    expect(el().querySelector('button.hit')).not.toBeNull();
    expect(el().querySelector('button.stand')).not.toBeNull();
    expect(el().querySelector('button.double')).not.toBeNull();
    expect(el().textContent).toContain('Chip balance: 90');
    http.expectOne(CASINO_URL).flush(casino({ balance: 90, activeBlackjackHand: activeDto({}) }));
  });

  it('enables the double on the first two cards and disables it after a hit', () => {
    flushAll(casino({}));
    dealWith(handDto({ stake: 10 }));
    http.expectOne(CASINO_URL).flush(casino({ balance: 90, activeBlackjackHand: activeDto({}) }));
    fixture.detectChanges();
    expect((el().querySelector('button.double') as HTMLButtonElement).disabled).toBe(false);

    (el().querySelector('button.hit') as HTMLButtonElement).click();
    http
      .expectOne({ method: 'POST', url: `${HANDS_URL}/hand-1/actions` })
      .flush(handDto({ playerCards: [0, 14, 2], playerTotal: 16 }));
    fixture.detectChanges();
    expect((el().querySelector('button.double') as HTMLButtonElement).disabled).toBe(true);
    http
      .expectOne(CASINO_URL)
      .flush(casino({ balance: 90, activeBlackjackHand: activeDto({ playerCards: [0, 14, 2] }) }));
  });

  it('shows a natural as completed at once', () => {
    flushAll(casino({}));
    dealWith(
      handDto({
        status: 'Completed',
        playerCards: [0, 22],
        playerTotal: 21,
        visibleDealerCards: [5, 18],
        dealerTotal: 15,
        outcome: 'Blackjack',
        payout: 25,
        completedOn: '2026-11-14T10:00:01Z',
      }),
    );

    expect(el().querySelector('.outcome')?.textContent).toContain('Blackjack, payout 25');
    expect(el().querySelector('.hidden-card')).toBeNull();
    expect(el().querySelector('button.new-hand')).not.toBeNull();
    http.expectOne(CASINO_URL).flush(casino({ balance: 115 }));
    http.expectOne({ method: 'GET', url: HANDS_URL }).flush([historyDto({})]);
    fixture.detectChanges();
    (el().querySelector('button.new-hand') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('.deal-form')).not.toBeNull();
  });

  it('stands and reveals the dealer with the outcome', () => {
    flushAll(casino({}));
    dealWith(handDto({}));
    http.expectOne(CASINO_URL).flush(casino({ balance: 90, activeBlackjackHand: activeDto({}) }));

    (el().querySelector('button.stand') as HTMLButtonElement).click();
    const post = http.expectOne({ method: 'POST', url: `${HANDS_URL}/hand-1/actions` });
    expect(post.request.body).toEqual({ action: 'Stand' });
    post.flush(
      handDto({
        status: 'Completed',
        visibleDealerCards: [5, 18, 31],
        dealerTotal: 19,
        outcome: 'Lose',
        payout: 0,
        balance: 90,
        completedOn: '2026-11-14T10:01:00Z',
      }),
    );
    fixture.detectChanges();

    expect(el().querySelectorAll('.dealer .card').length).toBe(3);
    expect(el().querySelector('.hidden-card')).toBeNull();
    expect(el().querySelector('.dealer-total')?.textContent).toContain('19');
    expect(el().querySelector('.outcome')?.textContent).toContain('Lose');
    http.expectOne(CASINO_URL).flush(casino({ balance: 90 }));
    http.expectOne({ method: 'GET', url: HANDS_URL }).flush([historyDto({})]);
  });

  it('shows the server text when an action is refused', () => {
    flushAll(casino({ balance: 5 }));
    const input = el().querySelector('.deal-form input') as HTMLInputElement;
    input.value = '5';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el().querySelector('button.deal') as HTMLButtonElement).click();
    http
      .expectOne({ method: 'POST', url: HANDS_URL })
      .flush({ error: 'Not enough chips on account' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el().querySelector('.table-notice')?.textContent).toContain(
      'Not enough chips on account',
    );
    http.expectOne(CASINO_URL).flush(casino({ balance: 5 }));
    fixture.detectChanges();
    expect((el().querySelector('button.deal') as HTMLButtonElement).disabled).toBe(false);
  });

  it('resumes the active hand after a reload', () => {
    flushAll(casino({ activeBlackjackHand: activeDto({}) }));
    fixture.detectChanges();
    expect(el().querySelector('.deal-form')).toBeNull();
    expect(el().querySelectorAll('.player .card').length).toBe(2);
    expect(el().querySelector('.hidden-card')).not.toBeNull();
    expect(el().querySelector('button.stand')).not.toBeNull();
  });

  it('swaps a vanished hand for its auto-stood history entry', () => {
    flushAll(casino({}));
    dealWith(handDto({}));
    http.expectOne(CASINO_URL).flush(casino({ balance: 90, activeBlackjackHand: activeDto({}) }));
    fixture.detectChanges();

    vi.advanceTimersByTime(5000);
    http.expectOne(CASINO_URL).flush(casino({ balance: 110 }));
    fixture.detectChanges();
    http
      .expectOne({ method: 'GET', url: HANDS_URL })
      .flush([historyDto({ publicHandId: 'hand-1', outcome: 'Lose', payout: 0, autoStood: true })]);
    fixture.detectChanges();

    expect(el().querySelector('.auto-stood')).not.toBeNull();
    expect(el().querySelector('.outcome')?.textContent).toContain('Lose');
    expect(el().querySelector('button.new-hand')).not.toBeNull();
  });

  it('counts down to the auto-stand', () => {
    flushAll(casino({}));
    dealWith(handDto({}));
    http.expectOne(CASINO_URL).flush(casino({ balance: 90, activeBlackjackHand: activeDto({}) }));
    fixture.detectChanges();
    expect(el().querySelector('.auto-stand')?.textContent).toContain('Auto-stand in 5 min 0 s');

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(el().querySelector('.auto-stand')?.textContent).toContain('4 min 58 s');
  });

  it('lists the finished hands', () => {
    flushAll(casino({}), [
      historyDto({}),
      historyDto({ publicHandId: 'hand-9', outcome: 'Lose', payout: 0, autoStood: true }),
    ]);
    const rows = el().querySelectorAll('table.history tr');
    expect(rows.length).toBe(3);
    expect(rows[1].textContent).toContain('Win');
    expect(rows[2].textContent).toContain('Lose (auto-stood)');
  });
});
