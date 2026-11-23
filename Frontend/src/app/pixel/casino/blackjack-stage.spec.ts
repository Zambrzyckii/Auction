import type { Mock } from 'vitest';
import { bjSteps, shownOf } from './blackjack-watch';
import type { BjStep, TableHand } from './blackjack-watch';
import { DEAL_WATCHDOG_MS, DealStage, DealStageRoom } from './blackjack-stage';

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

describe('DealStage', () => {
  let calls: string[];
  let room: {
    run: Mock<(steps: readonly BjStep[]) => void>;
    place: Mock<(hand: TableHand | null) => void>;
  };
  let onDealing: Mock<(on: boolean) => void>;
  let stage: DealStage;

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    room = {
      run: vi.fn(() => {
        calls.push('run');
      }),
      place: vi.fn(() => {
        calls.push('place');
      }),
    };
    onDealing = vi.fn((on: boolean) => {
      calls.push(on ? 'dealing-on' : 'dealing-off');
    });
    stage = new DealStage(onDealing);
  });

  afterEach(() => {
    stage.stop();
    vi.useRealTimers();
  });

  const attach = (first: TableHand | null = null, reduced = false): void =>
    stage.attach(room satisfies DealStageRoom, first, reduced);

  const lastRun = (): readonly BjStep[] => room.run.mock.calls.at(-1)![0];

  it('does nothing for a hand seen before attach', () => {
    stage.see(hand(), true);
    expect(room.run).not.toHaveBeenCalled();
    expect(room.place).not.toHaveBeenCalled();
    expect(onDealing).not.toHaveBeenCalled();
  });

  it('places an in-progress hand at attach and plans it', () => {
    const first = hand();
    attach(first);
    expect(room.place).toHaveBeenCalledWith(first);
    expect(stage.planned).toEqual(shownOf(first));
    expect(room.run).not.toHaveBeenCalled();
  });

  it('turns dealing on before the room runs the steps of a new hand', () => {
    attach();
    const next = hand();
    stage.see(next, true);
    expect(calls).toEqual(['place', 'dealing-on', 'run']);
    expect(room.run).toHaveBeenCalledWith(bjSteps(null, next));
    expect(stage.planned).toEqual(shownOf(next));
  });

  it('runs only the new card for a hit on the same hand', () => {
    attach(hand());
    stage.see(hand({ playerCards: [9, 20, 2] }), true);
    expect(lastRun()).toEqual([{ kind: 'card', row: 'player', code: 2 }]);
  });

  it('runs once when the same hand is seen twice', () => {
    attach();
    stage.see(hand(), true);
    stage.see(hand(), true);
    expect(room.run).toHaveBeenCalledTimes(1);
  });

  it('turns dealing off on idle', () => {
    attach();
    stage.see(hand(), true);
    stage.idle();
    expect(onDealing).toHaveBeenLastCalledWith(false);
  });

  it('turns dealing off when the scene is hidden', () => {
    attach();
    stage.see(hand(), true);
    stage.hidden();
    expect(onDealing).toHaveBeenLastCalledWith(false);
  });

  it('turns dealing off when the watchdog fires', () => {
    attach();
    stage.see(hand(), true);
    vi.advanceTimersByTime(DEAL_WATCHDOG_MS);
    expect(onDealing).toHaveBeenLastCalledWith(false);
  });

  it('restarts the watchdog on every run', () => {
    attach();
    stage.see(hand(), true);
    vi.advanceTimersByTime(4000);
    stage.see(hand({ playerCards: [9, 20, 2] }), true);
    vi.advanceTimersByTime(4000);
    expect(onDealing).not.toHaveBeenCalledWith(false);
    vi.advanceTimersByTime(2000);
    expect(onDealing).toHaveBeenLastCalledWith(false);
  });

  it('ends with dealing off when the room goes idle synchronously', () => {
    room.run.mockImplementation(() => stage.idle());
    attach();
    stage.see(hand(), true);
    expect(onDealing).toHaveBeenLastCalledWith(false);
  });

  it('runs a lone sweep without dealing and forgets the planned hand', () => {
    attach(stood());
    stage.see(null, true);
    expect(kinds(lastRun())).toEqual(['sweep']);
    expect(onDealing).not.toHaveBeenCalledWith(true);
    expect(stage.planned).toBeNull();
  });

  it('keeps the planned hand when a null hand follows an in-progress hand', () => {
    attach(hand());
    stage.see(null, true);
    expect(room.run).not.toHaveBeenCalled();
    expect(stage.planned).toEqual(shownOf(hand()));
    stage.see(stood(), true);
    expect(kinds(lastRun())).toEqual(['reveal', 'card', 'settle']);
  });

  it('runs the steps without dealing when the scene is not visible', () => {
    attach();
    stage.see(hand(), false);
    expect(room.run).toHaveBeenCalledTimes(1);
    expect(onDealing).not.toHaveBeenCalledWith(true);
  });

  it('never turns dealing on under reduced motion', () => {
    attach(null, true);
    stage.see(hand(), true);
    stage.see(hand({ playerCards: [9, 20, 2] }), true);
    expect(room.run).toHaveBeenCalledTimes(2);
    expect(onDealing).not.toHaveBeenCalledWith(true);
  });

  it('clears a pending watchdog on stop', () => {
    attach();
    stage.see(hand(), true);
    onDealing.mockClear();
    stage.stop();
    vi.advanceTimersByTime(DEAL_WATCHDOG_MS * 2);
    expect(onDealing).not.toHaveBeenCalled();
  });
});
