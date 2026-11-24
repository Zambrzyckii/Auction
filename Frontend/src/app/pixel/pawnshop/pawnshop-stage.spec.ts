import type { Mock } from 'vitest';
import { PawnshopStage, STAGE_WATCHDOG_MS } from './pawnshop-stage';
import type { PawnshopStageRoom } from './pawnshop-stage';
import type { PawnItem, PawnShop, PawnState, PawnStep } from './pawnshop-watch';

const shop = (over: Partial<PawnShop> = {}): PawnShop => ({
  publicPawnshopId: 'p1',
  status: 'Active',
  rejectionReason: null,
  botTierName: null,
  botRarity: null,
  nextSpawnOn: null,
  pendingBotTierName: null,
  stock: [],
  ...over,
});

const item = (id: string): PawnItem => ({
  publicStockItemId: id,
  rarity: 'Common',
  price: 100,
  status: 'InStock',
  spawnedOn: '2026-11-24T10:00:00Z',
  sellAfter: '2026-11-24T10:05:00Z',
  payoutAmount: null,
});

const pending = (): PawnShop => shop({ status: 'PendingPayment' });
const kinds = (steps: readonly PawnStep[]) => steps.map((s) => s.kind);

describe('PawnshopStage', () => {
  let calls: string[];
  let room: {
    run: Mock<(steps: readonly PawnStep[]) => void>;
    place: Mock<(shop: PawnState | null) => void>;
  };
  let onStaging: Mock<(on: boolean) => void>;
  let stage: PawnshopStage;

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
    onStaging = vi.fn((on: boolean) => {
      calls.push(on ? 'staging-on' : 'staging-off');
    });
    stage = new PawnshopStage(onStaging);
  });

  afterEach(() => {
    stage.stop();
    vi.useRealTimers();
  });

  const attach = (reduced = false): void => stage.attach(room satisfies PawnshopStageRoom, reduced);
  const lastRun = (): readonly PawnStep[] => room.run.mock.calls.at(-1)![0];
  const stagingOn = (): number => onStaging.mock.calls.filter(([on]) => on).length;

  it('does nothing for a shop seen before attach', () => {
    stage.see(shop(), true);
    expect(room.run).not.toHaveBeenCalled();
    expect(room.place).not.toHaveBeenCalled();
    expect(onStaging).not.toHaveBeenCalled();
  });

  it('places the recorded shop at attach', () => {
    const recorded = shop({ publicPawnshopId: 'rec' });
    stage.see(recorded, true);
    attach();
    expect(room.place).toHaveBeenCalledWith(recorded);
  });

  it('places null at attach when nothing was recorded', () => {
    attach();
    expect(room.place).toHaveBeenCalledWith(null);
  });

  it('runs a snap for the first shop after attach and never stages it', () => {
    attach();
    stage.see(pending(), true);
    expect(kinds(lastRun())).toEqual(['snap']);
    expect(onStaging).not.toHaveBeenCalledWith(true);
  });

  it('ignores a null shop after attach', () => {
    attach();
    stage.see(null, true);
    expect(room.run).not.toHaveBeenCalled();
  });

  const openingRun = (): void => {
    attach();
    stage.see(pending(), true);
    stage.revealed();
    stage.see(shop(), true);
  };

  it('runs the opening when the payment pending shop turns active and stages first', () => {
    openingRun();
    expect(kinds(lastRun())).toEqual(['opened']);
    expect(calls.slice(-2)).toEqual(['staging-on', 'run']);
  });

  it('drops staging at the one reveal of a single staged run', () => {
    openingRun();
    onStaging.mockClear();
    stage.revealed();
    expect(onStaging).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('keeps staging after the first reveal of paying and opened and ends it after the second', () => {
    attach();
    stage.see('none', true);
    stage.revealed();
    stage.see(shop(), true);
    expect(kinds(lastRun())).toEqual(['paying', 'opened']);
    expect(stagingOn()).toBe(1);
    onStaging.mockClear();
    stage.revealed();
    expect(onStaging).not.toHaveBeenCalled();
    stage.revealed();
    expect(onStaging).toHaveBeenLastCalledWith(false);
  });

  it('never stages hiring or a delivery', () => {
    attach();
    stage.see(shop(), true);
    stage.see(shop({ pendingBotTierName: 'Appraiser' }), true);
    expect(kinds(lastRun())).toEqual(['hiring']);
    stage.see(shop({ pendingBotTierName: 'Appraiser', stock: [item('i1')] }), true);
    expect(kinds(lastRun())).toEqual(['itemDelivered']);
    expect(onStaging).not.toHaveBeenCalledWith(true);
  });

  it('stages a rejected premises and a hire', () => {
    attach();
    stage.see(pending(), true);
    stage.see(shop({ status: 'Rejected', rejectionReason: 'Payment timed out' }), true);
    expect(kinds(lastRun())).toEqual(['rejected']);
    expect(stagingOn()).toBe(1);
  });

  it('does not stage when the scene is not visible', () => {
    attach();
    stage.see(pending(), false);
    stage.see(shop(), false);
    expect(kinds(lastRun())).toEqual(['opened']);
    expect(onStaging).not.toHaveBeenCalledWith(true);
  });

  it('does not stage under reduced motion', () => {
    attach(true);
    stage.see(pending(), true);
    stage.see(shop(), true);
    expect(kinds(lastRun())).toEqual(['opened']);
    expect(onStaging).not.toHaveBeenCalledWith(true);
  });

  it('ends staging when the watchdog runs out', () => {
    attach();
    stage.see(pending(), true);
    stage.see(shop(), true);
    onStaging.mockClear();
    vi.advanceTimersByTime(STAGE_WATCHDOG_MS);
    expect(onStaging).toHaveBeenCalledWith(false);
  });

  it('restarts the watchdog with each staged run', () => {
    attach();
    stage.see(pending(), true);
    stage.see(shop(), true);
    vi.advanceTimersByTime(7000);
    stage.see(shop({ status: 'Rejected', publicPawnshopId: 'p2', rejectionReason: 'x' }), true);
    expect(kinds(lastRun())).toEqual(['paying', 'rejected']);
    onStaging.mockClear();
    vi.advanceTimersByTime(7000);
    expect(onStaging).not.toHaveBeenCalled();
    vi.advanceTimersByTime(7000);
    expect(onStaging).toHaveBeenCalledWith(false);
  });

  it('disarms the watchdog after the last staged reveal', () => {
    attach();
    stage.see(pending(), true);
    stage.revealed();
    stage.see(shop(), true);
    stage.revealed();
    onStaging.mockClear();
    vi.advanceTimersByTime(STAGE_WATCHDOG_MS);
    expect(onStaging).not.toHaveBeenCalled();
  });

  it('never turns staging on at a reveal after hidden and still ends a new run at its reveal', () => {
    attach();
    stage.see(pending(), true);
    stage.see(shop(), true);
    stage.hidden();
    onStaging.mockClear();
    stage.revealed();
    expect(onStaging).not.toHaveBeenCalledWith(true);
    stage.see(shop({ status: 'Rejected', publicPawnshopId: 'p2', rejectionReason: 'x' }), true);
    expect(onStaging).toHaveBeenLastCalledWith(true);
    stage.revealed();
    stage.revealed();
    expect(onStaging).toHaveBeenLastCalledWith(true);
    stage.revealed();
    expect(onStaging).toHaveBeenLastCalledWith(false);
  });

  it('ends staging at idle', () => {
    attach();
    stage.see(pending(), true);
    stage.see(shop(), true);
    onStaging.mockClear();
    stage.idle();
    expect(onStaging).toHaveBeenCalledWith(false);
  });

  it('runs the same shop once', () => {
    attach();
    stage.see(pending(), true);
    stage.see(shop(), true);
    stage.see(shop(), true);
    expect(room.run).toHaveBeenCalledTimes(2);
  });

  it('clears a pending watchdog on stop', () => {
    attach();
    stage.see(pending(), true);
    stage.see(shop(), true);
    stage.stop();
    onStaging.mockClear();
    vi.advanceTimersByTime(STAGE_WATCHDOG_MS * 2);
    expect(onStaging).not.toHaveBeenCalled();
  });
});
