import type * as RoomModule from './roulette-room';
import type { SpinView } from './roulette-watch';

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

const spinOf = (pocket: number, payouts = [0, 360, 90]): SpinView => ({
  publicSpinId: 'spin-' + pocket,
  pocket,
  totalStake: 90,
  totalPayout: payouts.reduce((a, b) => a + b, 0),
  bets: [
    { type: 'Red', selection: null, stake: 50, payout: payouts[0] },
    { type: 'Straight', selection: 17, stake: 10, payout: payouts[1] },
    { type: 'Dozen', selection: 2, stake: 30, payout: payouts[2] },
  ],
});

describe('RouletteRoom', () => {
  let mod: typeof RoomModule;
  let Probe: new (
    cv: HTMLCanvasElement,
    opts?: RoomModule.RouletteRoomOpts,
  ) => RoomModule.RouletteRoom & { shownBoard: readonly number[]; rail: number };
  let queued: FrameRequestCallback[] = [];
  let clock = 0;
  let requests = 0;

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    mod = await import('./roulette-room');
    Probe = class extends mod.RouletteRoom {
      get shownBoard(): readonly number[] {
        return this.board;
      }
      get rail(): number {
        return this.railChips;
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
    const onSettled = vi.fn();
    const r = new Probe(document.createElement('canvas'), { ...opts, onSettled });
    return { r, onSettled };
  };

  it('builds and resizes without throwing', () => {
    const { r } = make();
    expect(() => r.resize(960, 400)).not.toThrow();
    expect(r.focusX).toBe(150);
    expect(r.rolling).toBe(false);
  });

  it('keeps rolling until 4.8 s and lands in the pocket on the next frame', () => {
    const { r, onSettled } = make();
    r.roll(spinOf(17));
    expect(r.rolling).toBe(true);
    step(4800);
    expect(r.rolling).toBe(true);
    expect(onSettled).not.toHaveBeenCalled();
    step(16);
    expect(r.ball).toEqual({ pocket: 17, r: 24 });
  });

  it('calls onSettled once, after 6.25 s and not before 6.2 s', () => {
    const { r, onSettled } = make();
    r.roll(spinOf(17));
    step(6200);
    expect(onSettled).not.toHaveBeenCalled();
    expect(r.rolling).toBe(true);
    step(100);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(r.rolling).toBe(false);
    step(4000);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('lands a running throw at once when a second roll arrives', () => {
    const { r, onSettled } = make();
    r.roll(spinOf(17));
    step(2000);
    r.roll(spinOf(0));
    expect(r.ball).toEqual({ pocket: 17, r: 24 });
    expect(r.rolling).toBe(true);
    step(6300);
    expect(r.ball.pocket).toBe(0);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('stops the guests cheering when the next throw starts', async () => {
    const { martini } = await import('./floor');
    const { r } = make();
    const img = vi.spyOn(r, 'img');
    const sipping = () => img.mock.calls.some(([c]) => c === martini);
    r.roll(spinOf(17));
    step(5800);
    img.mockClear();
    step(32);
    expect(sipping()).toBe(false);
    r.roll(spinOf(0));
    img.mockClear();
    step(32);
    expect(sipping()).toBe(true);
  });

  it('cancels the first settle when a roll arrives after the ball landed', () => {
    const { r, onSettled } = make();
    r.roll(spinOf(17));
    step(5000);
    expect(r.ball.pocket).toBe(17);
    r.roll(spinOf(0));
    const rolledAt = clock;
    step(6150);
    expect(clock).toBeLessThan(rolledAt + 6250);
    expect(onSettled).not.toHaveBeenCalled();
    expect(r.rolling).toBe(true);
    step(300);
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(r.ball.pocket).toBe(0);
    expect(r.rolling).toBe(false);
    step(4000);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('lands the ball and settles synchronously on pause', () => {
    const { r, onSettled } = make();
    r.roll(spinOf(17));
    step(2000);
    r.pause();
    expect(r.ball).toEqual({ pocket: 17, r: 24 });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(r.rolling).toBe(false);
  });

  it('settles synchronously under reduced motion and requests no frame', () => {
    const { r, onSettled } = make({ reduced: true });
    r.roll(spinOf(17));
    expect(r.ball).toEqual({ pocket: 17, r: 24 });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(r.rolling).toBe(false);
    expect(r.shownBoard[0]).toBe(17);
    expect(requests).toBe(0);
  });

  it('shows a pocket without settling', () => {
    const { r, onSettled } = make();
    r.show(spinOf(26));
    expect(r.ball.pocket).toBe(26);
    expect(onSettled).not.toHaveBeenCalled();
    expect(r.rolling).toBe(false);
  });

  it('ignores show(null)', () => {
    const { r } = make();
    r.setHistory([8, 23]);
    r.show(null);
    expect(r.ball.pocket).toBe(8);
  });

  describe('history', () => {
    it('rests the ball in the newest pocket until a roll or a show', () => {
      const { r } = make();
      expect(r.ball.pocket).toBe(0);
      r.setHistory([8, 23]);
      expect(r.ball.pocket).toBe(8);
      r.setHistory([]);
      expect(r.ball.pocket).toBe(0);
      r.setHistory([5, 8, 23]);
      expect(r.ball.pocket).toBe(5);
      r.show(spinOf(26));
      r.setHistory([8, 23]);
      expect(r.ball.pocket).toBe(26);
    });

    it('keeps at most 9 pockets', () => {
      const { r } = make();
      r.setHistory([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(r.shownBoard).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('holds the board during a throw and puts the result on top on landing', () => {
      const { r } = make();
      r.setHistory([5, 6]);
      r.roll(spinOf(17));
      r.setHistory([8, 23]);
      expect(r.shownBoard).toEqual([5, 6]);
      step(4700);
      expect(r.shownBoard).toEqual([5, 6]);
      step(200);
      expect(r.shownBoard).toEqual([17, 5, 6]);
    });
  });

  describe('rail chips', () => {
    it('shows the balance before the payout until the payout flights land', () => {
      const { r } = make();
      r.setChips(1000);
      expect(r.rail).toBe(1000);
      r.roll(spinOf(17));
      expect(r.rail).toBe(550);
      step(5800);
      expect(r.rail).toBe(550);
      step(1000);
      expect(r.rail).toBe(1000);
    });

    it('holds the same way when roll comes before setChips', () => {
      const { r } = make();
      r.roll(spinOf(17));
      r.setChips(1000);
      expect(r.rail).toBe(550);
      step(5800);
      expect(r.rail).toBe(550);
      step(1000);
      expect(r.rail).toBe(1000);
    });

    it('follows chips at once with no winner', () => {
      const { r } = make();
      r.setChips(1000);
      r.roll(spinOf(3, [0, 0, 0]));
      expect(r.rail).toBe(1000);
      step(7000);
      expect(r.rail).toBe(1000);
    });

    it('draws nothing for missing chips', () => {
      const { r } = make();
      r.setChips(null);
      expect(r.rail).toBe(0);
    });
  });

  describe('NET plate', () => {
    const netOf = (payouts: number[]) => {
      const { r } = make({ reduced: true });
      const plate = vi.spyOn(r, 'setPlate');
      r.roll(spinOf(17, payouts));
      return plate.mock.calls.at(-1)?.[0];
    };

    it('is green for a win', () => {
      expect(netOf([0, 360, 90])).toEqual([['NET +360', 'jersey', '#9be86a']]);
    });

    it('is red for a loss', () => {
      expect(netOf([0, 0, 0])).toEqual([['NET -90', 'jersey', '#ff8a6a']]);
    });

    it('is paper for a break-even', () => {
      expect(netOf([0, 90, 0])).toEqual([['NET 0', 'jersey', '#f4ecdc']]);
    });
  });

  it('plays the felt, the chips and the bets to their end without throwing', () => {
    const { r } = make();
    r.resize(960, 400);
    r.setChips(1000);
    r.setBets([{ type: 'Red', selection: null, stake: 50 }]);
    step(1000);
    r.setBets([]);
    step(1000);
    r.roll(spinOf(17));
    r.setBets([{ type: 'Odd', selection: null, stake: 5 }]);
    expect(() => step(9000)).not.toThrow();
    expect(r.rolling).toBe(false);
  });
});
