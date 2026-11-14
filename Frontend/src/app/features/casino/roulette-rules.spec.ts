import { Casino as CasinoDto, RouletteBet } from '../../core/api/models';
import { betProblem, spinProblem } from './roulette-rules';

const LIMITS = { minBet: 1, maxBet: 1000, maxBetsPerSpin: 20 };
const SELECTION = 'Bet selection does not match its type';
const STAKE = 'Each stake must be a whole number of chips within the table limits';

function casino(overrides: Partial<CasinoDto>): CasinoDto {
  return {
    balance: 100,
    lifetimeBought: 100,
    lifetimeCashedOut: 0,
    latestPurchase: null,
    activeBlackjackHand: null,
    roulette: LIMITS,
    blackjack: { minBet: 5, maxBet: 2000 },
    ...overrides,
  };
}

function bet(overrides: Partial<RouletteBet>): RouletteBet {
  return { type: 'Red', selection: null, stake: 10, ...overrides };
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
      bet({ type: 'Straight', selection: 17.5 }),
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
    expect(
      spinProblem(
        Array.from({ length: 21 }, () => bet({ stake: 1 })),
        casino({}),
      ),
    ).toBe(text);
  });

  it('rejects a total stake above the chip balance with the domain text', () => {
    const funds = casino({ balance: 100 });
    expect(spinProblem([bet({ stake: 60 }), bet({ stake: 41 })], funds)).toBe(
      'Not enough chips on account',
    );
    expect(spinProblem([bet({ stake: 60 }), bet({ stake: 40 })], funds)).toBeNull();
  });
});
