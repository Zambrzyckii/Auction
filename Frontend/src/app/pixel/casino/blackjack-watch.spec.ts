import { bjSteps, shownOf } from './blackjack-watch';
import type { BjStep, TableHand } from './blackjack-watch';

const hand = (over: Partial<TableHand> = {}): TableHand => ({
  publicHandId: 'h1',
  status: 'InProgress',
  stake: 10,
  doubled: false,
  playerCards: [9, 20],
  playerTotal: 17,
  playerIsSoft: false,
  dealerCards: [5],
  dealerHidden: true,
  dealerTotal: null,
  outcome: null,
  payout: null,
  autoStood: false,
  autoStandOn: '2026-11-23T12:05:00Z',
  ...over,
});

const stood = (over: Partial<TableHand> = {}): TableHand =>
  hand({
    status: 'Completed',
    dealerHidden: false,
    dealerCards: [5, 30, 7],
    dealerTotal: 22,
    outcome: 'Win',
    payout: 20,
    ...over,
  });

const kinds = (steps: readonly BjStep[]) => steps.map((s) => s.kind);

describe('shownOf', () => {
  it('counts the hole in the dealer row while the hand runs', () => {
    expect(shownOf(hand())).toEqual({
      id: 'h1',
      player: 2,
      dealer: 2,
      hole: true,
      stake: 10,
      settled: false,
    });
  });

  it('counts every dealer card once the hole is up', () => {
    expect(shownOf(stood())).toEqual({
      id: 'h1',
      player: 2,
      dealer: 3,
      hole: false,
      stake: 10,
      settled: true,
    });
  });
});

describe('bjSteps', () => {
  it('deals player, dealer, player, hole from an empty felt', () => {
    expect(bjSteps(null, hand())).toEqual([
      { kind: 'stake', amount: 10 },
      { kind: 'card', row: 'player', code: 9 },
      { kind: 'card', row: 'dealer', code: 5 },
      { kind: 'card', row: 'player', code: 20 },
      { kind: 'hole' },
    ]);
  });

  it('plays a hit as one player card', () => {
    expect(bjSteps(shownOf(hand()), hand({ playerCards: [9, 20, 2] }))).toEqual([
      { kind: 'card', row: 'player', code: 2 },
    ]);
  });

  it('reveals, draws and settles on a stand', () => {
    expect(bjSteps(shownOf(hand()), stood())).toEqual([
      { kind: 'reveal', code: 30 },
      { kind: 'card', row: 'dealer', code: 7 },
      { kind: 'settle', outcome: 'Win', payout: 20, stake: 10, bust: false, autoStood: false },
    ]);
  });

  it('raises the stake first on a double and settles with the doubled stake', () => {
    const doubled = stood({ stake: 20, doubled: true, playerCards: [9, 20, 1] });
    const steps = bjSteps(shownOf(hand()), doubled);
    expect(steps[0]).toEqual({ kind: 'stake', amount: 20 });
    expect(steps[1]).toEqual({ kind: 'card', row: 'player', code: 1 });
    expect(steps.at(-1)).toMatchObject({ kind: 'settle', stake: 20 });
  });

  it('marks a bust on a hit that loses', () => {
    const bust = hand({
      playerCards: [9, 20, 11],
      playerTotal: 27,
      status: 'Completed',
      outcome: 'Lose',
      payout: 0,
      dealerHidden: false,
      dealerCards: [5, 30],
    });
    const steps = bjSteps(shownOf(hand()), bust);
    expect(kinds(steps)).toEqual(['card', 'reveal', 'settle']);
    expect(steps[0]).toEqual({ kind: 'card', row: 'player', code: 11 });
    expect(steps[1]).toEqual({ kind: 'reveal', code: 30 });
    expect(steps[2]).toMatchObject({ outcome: 'Lose', payout: 0, bust: true });
  });

  it('plays a natural on the deal through to settle', () => {
    const natural = stood({ dealerCards: [5, 30], outcome: 'Blackjack', payout: 25 });
    expect(kinds(bjSteps(null, natural))).toEqual([
      'stake',
      'card',
      'card',
      'card',
      'hole',
      'reveal',
      'settle',
    ]);
  });

  it('sweeps first when a new hand replaces a settled one', () => {
    const next = hand({ publicHandId: 'h2' });
    const steps = bjSteps(shownOf(stood()), next);
    expect(steps[0]).toEqual({ kind: 'sweep' });
    expect(steps[1]).toEqual({ kind: 'stake', amount: 10 });
  });

  it('sweeps a settled hand when the target is null and holds a running one', () => {
    expect(bjSteps(shownOf(stood()), null)).toEqual([{ kind: 'sweep' }]);
    expect(bjSteps(shownOf(hand()), null)).toEqual([]);
    expect(bjSteps(null, null)).toEqual([]);
  });

  it('plays the auto-stand path without a sweep or a player card', () => {
    const auto = stood({ autoStood: true });
    const steps = bjSteps(shownOf(hand()), auto);
    expect(kinds(steps)).toEqual(['reveal', 'card', 'settle']);
    expect(steps[2]).toMatchObject({ autoStood: true });
  });

  it('plays a stand right after the deal from the dealt state', () => {
    const dealt = hand();
    const target = stood();
    expect(bjSteps(shownOf(dealt), target)).toEqual(bjSteps(null, target).slice(5));
  });

  it('takes the outcome as Lose and the payout as 0 when the server sent none', () => {
    const open = stood({ outcome: null, payout: null, playerTotal: 18 });
    expect(bjSteps(shownOf(hand()), open).at(-1)).toMatchObject({
      outcome: 'Lose',
      payout: 0,
      bust: false,
    });
  });

  it.each([
    ['an in-progress hand', hand()],
    ['a doubled hand', hand({ stake: 20, doubled: true, playerCards: [9, 20, 1] })],
    ['a completed hand', stood()],
    ['a completed natural', stood({ dealerCards: [5, 30], outcome: 'Blackjack', payout: 25 })],
  ])('has nothing to play for %s already on the felt', (_name, h) => {
    expect(bjSteps(shownOf(h), h)).toEqual([]);
  });
});
