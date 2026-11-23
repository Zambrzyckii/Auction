import type * as RoomModule from './blackjack-room';
import { bjSteps, shownOf } from './blackjack-watch';
import type { BjStep, TableHand } from './blackjack-watch';

const looseContext = () => {
  const target: Record<string | symbol, unknown> = {
    measureText: () => ({ width: 0 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(255),
      width: w,
      height: h,
    }),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
  };
  return new Proxy(target, {
    get: (t, prop) => (prop in t ? t[prop] : () => undefined),
    set: (t, prop, value) => {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
};

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

const deal = (): readonly BjStep[] => bjSteps(null, hand());
const settleStep = (over: Partial<Extract<BjStep, { kind: 'settle' }>> = {}): BjStep => ({
  kind: 'settle',
  outcome: 'Win',
  payout: 20,
  stake: 10,
  bust: false,
  autoStood: false,
  ...over,
});

describe('BlackjackRoom', () => {
  let mod: typeof RoomModule;
  let Probe: new (
    cv: HTMLCanvasElement,
    opts?: RoomModule.BlackjackRoomOpts,
  ) => RoomModule.BlackjackRoom & {
    chipsLed: string;
    autoStandLed: string | null;
    totals: { player: string | null; dealer: string | null };
    hovered: number[];
  };
  let queued: FrameRequestCallback[] = [];
  let clock = 0;
  let requests = 0;
  let made: RoomModule.BlackjackRoom[] = [];

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    mod = await import('./blackjack-room');
    Probe = class extends mod.BlackjackRoom {
      override get chipsLed(): string {
        return super.chipsLed;
      }
      override get autoStandLed(): string | null {
        return super.autoStandLed;
      }
      override get totals(): { player: string | null; dealer: string | null } {
        return super.totals;
      }
      override get hovered(): number[] {
        return super.hovered;
      }
    };
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  beforeEach(() => {
    queued = [];
    clock = 0;
    requests = 0;
    made = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      requests++;
      return queued.push(cb);
    });
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn(() => {
        queued = [];
      }),
    );
    vi.stubGlobal('performance', { now: () => 0 });
  });

  afterEach(() => {
    for (const r of made) r.destroy();
    vi.unstubAllGlobals();
  });

  const step = (ms: number) => {
    for (let i = 0; i < ms / 16; i++) {
      const due = queued;
      queued = [];
      clock += 16;
      due.forEach((cb) => cb(clock));
    }
  };

  const make = (opts?: { reduced?: boolean }) => {
    const onIdle = vi.fn();
    const r = new Probe(document.createElement('canvas'), { ...opts, onIdle });
    made.push(r);
    return { r, onIdle };
  };

  it('builds and resizes without throwing and requests no frame', () => {
    const { r } = make();
    expect(requests).toBe(0);
    expect(() => r.resize(960, 400)).not.toThrow();
    expect(r.focusX).toBe(240);
    expect(r.idle).toBe(true);
    expect(r.felt).toEqual({ player: [], dealer: [], hole: false, circle: 0 });
  });

  it('keeps idle false until the fourth card rests, then fires onIdle once', () => {
    const { r, onIdle } = make();
    r.run(deal());
    expect(r.idle).toBe(false);
    step(1500);
    expect(r.idle).toBe(false);
    expect(onIdle).not.toHaveBeenCalled();
    step(1000);
    expect(r.idle).toBe(true);
    expect(onIdle).toHaveBeenCalledTimes(1);
    step(1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(r.felt).toEqual({ player: [9, 20], dealer: [5, -1], hole: true, circle: 10 });
  });

  it('plays a run appended while cards fly after them, in order', () => {
    const { r, onIdle } = make();
    r.run(deal());
    step(200);
    r.run([{ kind: 'card', row: 'player', code: 2 }]);
    step(5000);
    expect(r.felt.player).toEqual([9, 20, 2]);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('turns the hole into the revealed card', () => {
    const { r } = make();
    r.place(hand());
    r.run([{ kind: 'reveal', code: 30 }]);
    step(200);
    expect(r.felt.hole).toBe(true);
    step(1000);
    expect(r.felt.dealer).toEqual([5, 30]);
    expect(r.felt.hole).toBe(false);
  });

  it('sweeps every card off the felt', () => {
    const { r, onIdle } = make();
    r.place(stood());
    r.run([{ kind: 'sweep' }]);
    expect(r.idle).toBe(false);
    step(2000);
    expect(r.felt).toEqual({ player: [], dealer: [], hole: false, circle: 0 });
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('snaps the felt on place without onIdle, for a completed hand and for null', () => {
    const { r, onIdle } = make();
    r.place(stood());
    expect(r.felt).toEqual({ player: [9, 20], dealer: [5, 30, 7], hole: false, circle: 0 });
    expect(r.idle).toBe(true);
    r.place(hand());
    expect(r.felt).toEqual({ player: [9, 20], dealer: [5, -1], hole: true, circle: 10 });
    r.place(null);
    expect(r.felt).toEqual({ player: [], dealer: [], hole: false, circle: 0 });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('drops the queue and the scheduled steps on place', () => {
    const { r, onIdle } = make();
    r.run(deal());
    step(300);
    r.place(null);
    step(4000);
    expect(r.felt).toEqual({ player: [], dealer: [], hole: false, circle: 0 });
    expect(r.idle).toBe(true);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('finishes the queue and fires onIdle synchronously on pause', () => {
    const { r, onIdle } = make();
    r.run(deal());
    step(400);
    expect(onIdle).not.toHaveBeenCalled();
    r.pause();
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(r.idle).toBe(true);
    expect(r.felt).toEqual({ player: [9, 20], dealer: [5, -1], hole: true, circle: 10 });
  });

  it('lands a settled hand on pause with the circle emptied once', () => {
    const { r, onIdle } = make();
    r.place(hand());
    r.run(bjSteps(shownOf(hand()), stood()));
    step(1200);
    r.pause();
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(r.felt).toEqual({ player: [9, 20], dealer: [5, 30, 7], hole: false, circle: 0 });
  });

  it('lands everything at once and fires onIdle synchronously under reduced', () => {
    const { r, onIdle } = make({ reduced: true });
    r.run([...deal(), { kind: 'reveal', code: 30 }, settleStep()]);
    expect(requests).toBe(0);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(r.idle).toBe(true);
    expect(r.felt).toEqual({ player: [9, 20], dealer: [5, 30], hole: false, circle: 0 });
  });

  it('lands a run at once on a paused room', () => {
    const { r, onIdle } = make();
    r.pause();
    r.run(deal());
    expect(requests).toBe(0);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(r.felt).toEqual({ player: [9, 20], dealer: [5, -1], hole: true, circle: 10 });
  });

  it('holds idle through the settle visuals and empties the circle after 1.4 s', () => {
    const { r, onIdle } = make();
    r.place(hand());
    r.run(bjSteps(shownOf(hand()), stood()));
    step(1700);
    expect(r.felt.circle).toBe(20);
    step(500);
    expect(r.idle).toBe(false);
    expect(onIdle).not.toHaveBeenCalled();
    step(3000);
    expect(r.felt.circle).toBe(0);
    expect(r.idle).toBe(true);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('takes the lost chips from the circle at once and waits for the rest of settle', () => {
    const { r, onIdle } = make();
    r.place(hand());
    r.run([settleStep({ outcome: 'Lose', payout: 0, bust: true })]);
    expect(r.felt.circle).toBe(0);
    expect(r.idle).toBe(false);
    step(3000);
    expect(r.idle).toBe(true);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'Blackjack',
      25,
      false,
      false,
      [
        ['BLACKJACK', 'jersey', '#ffd75e'],
        ['+15', 'tiny', '#f4ecdc'],
      ],
    ],
    [
      'Win',
      20,
      false,
      false,
      [
        ['WIN', 'jersey', '#9be86a'],
        ['+10', 'tiny', '#f4ecdc'],
      ],
    ],
    [
      'Push',
      10,
      false,
      false,
      [
        ['PUSH', 'jersey', '#f4ecdc'],
        ['STAKE BACK', 'tiny', '#f4ecdc'],
      ],
    ],
    [
      'Lose',
      0,
      true,
      false,
      [
        ['BUST', 'jersey', '#ff8a6a'],
        ['-10', 'tiny', '#f4ecdc'],
      ],
    ],
    [
      'Lose',
      0,
      false,
      false,
      [
        ['DEALER WINS', 'jersey', '#ff8a6a'],
        ['-10', 'tiny', '#f4ecdc'],
      ],
    ],
    [
      'Win',
      20,
      false,
      true,
      [
        ['WIN', 'jersey', '#9be86a'],
        ['+10', 'tiny', '#f4ecdc'],
        ['AUTO-STOOD', 'tiny', '#f4ecdc'],
      ],
    ],
  ])('shows the %s plate for payout %i', (outcome, payout, bust, autoStood, lines) => {
    const { r } = make({ reduced: true });
    const plate = vi.spyOn(r, 'setPlate');
    r.run([settleStep({ outcome, payout, bust, autoStood })]);
    expect(plate).toHaveBeenCalledWith(lines, 392, 174, 2.6);
  });

  it('shows the totals only for a row that holds all its cards at rest', () => {
    const { r } = make();
    r.place(hand());
    r.setHand(hand());
    expect(r.totals).toEqual({ player: '17', dealer: null });
    r.setHand(hand({ playerIsSoft: true }));
    expect(r.totals.player).toBe('17 soft');
    r.setHand(hand({ playerCards: [9, 20, 2], playerTotal: 19 }));
    expect(r.totals.player).toBeNull();
    r.run([{ kind: 'card', row: 'player', code: 2 }]);
    step(100);
    expect(r.totals.player).toBeNull();
    step(1500);
    expect(r.totals.player).toBe('19');
  });

  it('shows the dealer total once the hole is up and drops soft after the hand ends', () => {
    const { r } = make();
    r.place(stood());
    r.setHand(stood({ playerIsSoft: true }));
    expect(r.totals).toEqual({ player: '17', dealer: '22' });
    r.place(hand());
    r.setHand(stood());
    expect(r.totals.dealer).toBeNull();
  });

  it('shows the AUTO-STAND clock only for a hand in progress on an idle queue', () => {
    const { r } = make();
    const until = Date.parse('2026-11-23T12:05:00Z');
    const now = vi.spyOn(Date, 'now').mockReturnValue(until - 90_000);
    r.place(hand());
    r.setHand(hand());
    expect(r.autoStandLed).toBe('AUTO-STAND 1:30');
    now.mockReturnValue(until + 5_000);
    expect(r.autoStandLed).toBe('AUTO-STAND 0:00');
    r.run([{ kind: 'card', row: 'player', code: 2 }]);
    expect(r.autoStandLed).toBeNull();
    step(3000);
    r.setHand(stood());
    expect(r.autoStandLed).toBeNull();
    now.mockRestore();
  });

  it('holds the CHIPS LED while the queue plays and follows the chips when idle', () => {
    const { r } = make();
    expect(r.chipsLed).toBe('CHIPS -');
    r.setChips(1234.5);
    expect(r.chipsLed).toBe('CHIPS 1,234.5');
    r.place(null);
    r.setChips(80);
    r.run(deal());
    expect(r.chipsLed).toBe('CHIPS 1,234.5');
    step(3000);
    expect(r.chipsLed).toBe('CHIPS 80');
  });

  it('lifts the resting player card under the pointer and drops it on leave', () => {
    const { r } = make();
    const cv = (r as unknown as { cv: HTMLCanvasElement }).cv;
    cv.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 200 }) as DOMRect;
    r.place(hand());
    cv.dispatchEvent(new MouseEvent('mousemove', { clientX: 272, clientY: 178 }));
    expect(r.hovered).toEqual([20]);
    cv.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
    expect(r.hovered).toEqual([]);
    cv.dispatchEvent(new MouseEvent('mousemove', { clientX: 272, clientY: 178 }));
    cv.dispatchEvent(new MouseEvent('mouseleave'));
    expect(r.hovered).toEqual([]);
  });

  it('adds no hover listeners under reduced', () => {
    const cv = document.createElement('canvas');
    const add = vi.spyOn(cv, 'addEventListener');
    made.push(new Probe(cv, { reduced: true }));
    expect(add).not.toHaveBeenCalled();
  });

  it('removes the canvas listeners and goes quiet on destroy', () => {
    const cv = document.createElement('canvas');
    const remove = vi.spyOn(cv, 'removeEventListener');
    const onIdle = vi.fn();
    const r = new Probe(cv, { onIdle });
    r.destroy();
    expect(remove).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    r.run(deal());
    r.place(hand());
    expect(requests).toBe(0);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
