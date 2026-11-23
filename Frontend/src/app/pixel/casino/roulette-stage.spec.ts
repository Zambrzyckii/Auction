import type { Mock } from 'vitest';
import { ROLL_WATCHDOG_MS, SpinStage, SpinStageRoom } from './roulette-stage';
import type { SpinView } from './roulette-watch';

const spin = (id: string): SpinView => ({
  publicSpinId: id,
  pocket: 17,
  totalStake: 10,
  totalPayout: 0,
  bets: [],
});

describe('SpinStage', () => {
  let calls: string[];
  let room: { roll: Mock<(spin: SpinView) => void>; show: Mock<(spin: SpinView | null) => void> };
  let onRolling: Mock<(on: boolean) => void>;
  let stage: SpinStage;

  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    room = {
      roll: vi.fn(() => {
        calls.push('roll');
      }),
      show: vi.fn(() => {
        calls.push('show');
      }),
    };
    onRolling = vi.fn((on: boolean) => {
      calls.push(on ? 'rolling-on' : 'rolling-off');
    });
    stage = new SpinStage(onRolling);
  });

  afterEach(() => {
    stage.stop();
    vi.useRealTimers();
  });

  const attach = (first: SpinView | null = null, reduced = false): void =>
    stage.attach(room satisfies SpinStageRoom, first, reduced);

  it('only records a spin seen before attach, then shows it and ignores it afterwards', () => {
    const a = spin('a');
    stage.see(a, true);
    expect(room.roll).not.toHaveBeenCalled();
    attach(a);
    expect(room.show).toHaveBeenCalledWith(a);
    stage.see(a, true);
    expect(room.roll).not.toHaveBeenCalled();
    expect(onRolling).not.toHaveBeenCalled();
  });

  it('turns rolling on before the room rolls for a new id', () => {
    attach(spin('a'));
    calls.length = 0;
    stage.see(spin('b'), true);
    expect(calls).toEqual(['rolling-on', 'roll']);
  });

  it('turns rolling off when the room settles', () => {
    attach();
    stage.see(spin('b'), true);
    stage.settled();
    expect(onRolling).toHaveBeenLastCalledWith(false);
  });

  it('turns rolling off when the scene is hidden', () => {
    attach();
    stage.see(spin('b'), true);
    stage.hidden();
    expect(onRolling).toHaveBeenLastCalledWith(false);
  });

  it('turns rolling off when the watchdog fires', () => {
    attach();
    stage.see(spin('b'), true);
    vi.advanceTimersByTime(ROLL_WATCHDOG_MS);
    expect(onRolling).toHaveBeenLastCalledWith(false);
  });

  it('restarts the watchdog on every roll', () => {
    attach();
    stage.see(spin('b'), true);
    vi.advanceTimersByTime(5000);
    stage.see(spin('c'), true);
    vi.advanceTimersByTime(3000);
    expect(onRolling).not.toHaveBeenCalledWith(false);
    vi.advanceTimersByTime(5000);
    expect(onRolling).toHaveBeenLastCalledWith(false);
  });

  it('rolls without turning rolling on when the scene is not visible', () => {
    attach();
    stage.see(spin('b'), false);
    expect(room.roll).toHaveBeenCalledTimes(1);
    expect(onRolling).not.toHaveBeenCalledWith(true);
  });

  it('never turns rolling on under reduced motion', () => {
    attach(null, true);
    stage.see(spin('b'), true);
    stage.see(spin('c'), true);
    expect(room.roll).toHaveBeenCalledTimes(2);
    expect(onRolling).not.toHaveBeenCalledWith(true);
  });

  it('ends with rolling off when the room settles synchronously', () => {
    room.roll.mockImplementation(() => stage.settled());
    attach();
    stage.see(spin('b'), true);
    expect(onRolling).toHaveBeenLastCalledWith(false);
  });

  it('ignores the same id twice and a null spin', () => {
    attach();
    stage.see(spin('b'), true);
    room.roll.mockClear();
    onRolling.mockClear();
    stage.see(spin('b'), true);
    stage.see(null, true);
    expect(room.roll).not.toHaveBeenCalled();
    expect(onRolling).not.toHaveBeenCalled();
  });

  it('clears a pending watchdog on stop', () => {
    attach();
    stage.see(spin('b'), true);
    onRolling.mockClear();
    stage.stop();
    vi.advanceTimersByTime(ROLL_WATCHDOG_MS * 2);
    expect(onRolling).not.toHaveBeenCalled();
  });
});
