import { Casino as CasinoDto, ChipPurchase, Wallet } from '../../core/api/models';
import { cashOutProblem, casinoPollMs, purchaseNotice, purchaseProblem } from './casino-rules';

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
    activeBlackjackHand: null,
    roulette: { minBet: 1, maxBet: 1000, maxBetsPerSpin: 20 },
    blackjack: { minBet: 5, maxBet: 2000 },
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

  it('rejects zero and fractions with the precheck texts', () => {
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

  it('rejects zero and a third decimal place with the precheck texts', () => {
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
