import { ActiveBlackjackHand, BlackjackHand, BlackjackHandHistory } from '../../core/api/models';
import { fromActive, fromHand, fromHistory } from './hand-view';

function active(overrides: Partial<ActiveBlackjackHand>): ActiveBlackjackHand {
  return {
    publicHandId: 'hand-1',
    stake: 10,
    doubled: false,
    playerCards: [0, 14],
    playerTotal: 13,
    playerIsSoft: true,
    visibleDealerCards: [5],
    startedOn: '2026-11-14T10:00:00Z',
    lastActionOn: '2026-11-14T10:00:30Z',
    ...overrides,
  };
}

function hand(overrides: Partial<BlackjackHand>): BlackjackHand {
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

function history(overrides: Partial<BlackjackHandHistory>): BlackjackHandHistory {
  return {
    publicHandId: 'hand-1',
    stake: 10,
    doubled: false,
    outcome: 'Win',
    payout: 20,
    playerCards: [0, 14, 8],
    dealerCards: [5, 18, 31],
    playerTotal: 20,
    dealerTotal: 19,
    autoStood: false,
    startedOn: '2026-11-14T10:00:00Z',
    completedOn: '2026-11-14T10:01:00Z',
    ...overrides,
  };
}

describe('fromActive', () => {
  it('resumes an in-progress hand with a hidden dealer card and the server stamp', () => {
    const view = fromActive(active({}));
    expect(view.status).toBe('InProgress');
    expect(view.dealerHidden).toBe(true);
    expect(view.dealerTotal).toBeNull();
    expect(view.outcome).toBeNull();
    expect(view.lastActionOn).toBe(Date.parse('2026-11-14T10:00:30Z'));
  });
});

describe('fromHand', () => {
  it('stamps an in-progress response with the local receive time', () => {
    const view = fromHand(hand({}), 1_700_000_000_000);
    expect(view.dealerHidden).toBe(true);
    expect(view.lastActionOn).toBe(1_700_000_000_000);
  });

  it('reveals the dealer once the hand is completed', () => {
    const view = fromHand(
      hand({
        status: 'Completed',
        visibleDealerCards: [5, 18, 31],
        dealerTotal: 19,
        outcome: 'Win',
        payout: 20,
        completedOn: '2026-11-14T10:01:00Z',
      }),
      1_700_000_000_000,
    );
    expect(view.dealerHidden).toBe(false);
    expect(view.dealerCards).toEqual([5, 18, 31]);
    expect(view.dealerTotal).toBe(19);
    expect(view.outcome).toBe('Win');
  });
});

describe('fromHistory', () => {
  it('maps a finished hand with every dealer card visible', () => {
    const view = fromHistory(history({}));
    expect(view.status).toBe('Completed');
    expect(view.dealerHidden).toBe(false);
    expect(view.dealerCards).toEqual([5, 18, 31]);
    expect(view.payout).toBe(20);
    expect(view.lastActionOn).toBe(Date.parse('2026-11-14T10:01:00Z'));
  });
});
