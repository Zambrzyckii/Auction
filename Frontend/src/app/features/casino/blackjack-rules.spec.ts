import { ActiveBlackjackHand, BlackjackHand } from '../../core/api/models';
import { canDouble, cardLabel, dealProblem, reconcileHand } from './blackjack-rules';
import { fromHand } from './hand-view';

const LIMITS = { minBet: 5, maxBet: 2000 };

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

describe('cardLabel', () => {
  it('maps the rank from code % 13', () => {
    expect(cardLabel(0).startsWith('A')).toBe(true);
    expect(cardLabel(1).startsWith('2')).toBe(true);
    expect(cardLabel(9).startsWith('10')).toBe(true);
    expect(cardLabel(10).startsWith('J')).toBe(true);
    expect(cardLabel(11).startsWith('Q')).toBe(true);
    expect(cardLabel(12).startsWith('K')).toBe(true);
  });

  it('gives the four suit groups four distinct one-character suits', () => {
    const suits = new Set([0, 13, 26, 39].map((code) => cardLabel(code).slice(1)));
    expect(suits.size).toBe(4);
    for (const suit of suits) {
      expect(suit.length).toBe(1);
    }
  });

  it('labels all 52 cards uniquely', () => {
    const labels = new Set(Array.from({ length: 52 }, (_, code) => cardLabel(code)));
    expect(labels.size).toBe(52);
  });
});

describe('canDouble', () => {
  function view(overrides: Partial<BlackjackHand>) {
    return fromHand(handDto(overrides), 0);
  }

  it('allows a double on the first two cards with the stake covered', () => {
    expect(canDouble(view({ stake: 10 }), 10)).toBe(true);
    expect(canDouble(view({ stake: 10 }), 100)).toBe(true);
  });

  it('refuses after a third card or once the hand is over', () => {
    expect(canDouble(view({ playerCards: [0, 14, 8] }), 100)).toBe(false);
    expect(canDouble(view({ status: 'Completed' }), 100)).toBe(false);
  });

  it('refuses a second double', () => {
    expect(canDouble(view({ doubled: true, playerCards: [0, 14] }), 100)).toBe(false);
  });

  it('needs the original stake in chips, not the doubled one', () => {
    expect(canDouble(view({ stake: 10 }), 9)).toBe(false);
  });
});

describe('dealProblem', () => {
  it('allows a whole stake within the limits and the balance', () => {
    expect(dealProblem(10, LIMITS, 100)).toBeNull();
    expect(dealProblem(5, LIMITS, 5)).toBeNull();
  });

  it('rejects a stake outside the limits with the handler text', () => {
    expect(dealProblem(4, LIMITS, 100)).toBe('Stake must be between 5 and 2000');
    expect(dealProblem(2001, LIMITS, 100_000)).toBe('Stake must be between 5 and 2000');
  });

  it('rejects a fraction with the validator text before the range', () => {
    expect(dealProblem(10.5, LIMITS, 100)).toBe('Stake must be a whole number of chips');
    expect(dealProblem(2.5, LIMITS, 100)).toBe('Stake must be a whole number of chips');
  });

  it('rejects more than the chip balance', () => {
    expect(dealProblem(101, LIMITS, 100)).toBe('Not enough chips on account');
  });
});

describe('reconcileHand', () => {
  it('resumes the server hand when nothing is shown locally', () => {
    const view = reconcileHand(null, activeDto({}));
    expect(view?.publicHandId).toBe('hand-1');
    expect(view?.status).toBe('InProgress');
    expect(view?.dealerHidden).toBe(true);
  });

  it('switches to a hand started elsewhere', () => {
    const local = fromHand(handDto({ publicHandId: 'hand-old' }), 0);
    expect(reconcileHand(local, activeDto({}))?.publicHandId).toBe('hand-1');
  });

  it('drops an in-progress hand the server no longer has', () => {
    const local = fromHand(handDto({}), 0);
    expect(reconcileHand(local, null)).toBeNull();
  });

  it('keeps a completed hand on screen until New hand', () => {
    const local = fromHand(handDto({ status: 'Completed', outcome: 'Win', payout: 20 }), 0);
    expect(reconcileHand(local, null)).toBe(local);
  });

  it('never regresses a completed hand to in progress for the same id', () => {
    const local = fromHand(handDto({ status: 'Completed', outcome: 'Win', payout: 20 }), 0);
    expect(reconcileHand(local, activeDto({}))).toBe(local);
  });

  it('keeps the local in-progress hand for the same id', () => {
    const local = fromHand(handDto({}), 0);
    expect(reconcileHand(local, activeDto({}))).toBe(local);
  });
});
