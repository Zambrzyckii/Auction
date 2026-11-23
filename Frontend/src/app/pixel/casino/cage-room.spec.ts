import type * as CageModule from './cage-room';

let drawn = 0;

const looseContext = () => {
  const target: Record<string | symbol, unknown> = {
    measureText: () => ({ width: 0 }),
    drawImage: () => {
      drawn++;
    },
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

describe('CageRoom', () => {
  let mod: typeof CageModule;
  let Probe: new (
    cv: HTMLCanvasElement,
    opts?: { reduced?: boolean },
  ) => CageModule.CageRoom & {
    chips: string;
    cash: string;
  };
  let queued: FrameRequestCallback[] = [];
  let clock = 0;
  let requests = 0;

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    mod = await import('./cage-room');
    Probe = class extends mod.CageRoom {
      get chips(): string {
        return this.chipsLed;
      }
      get cash(): string {
        return this.cashLed;
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
    drawn = 0;
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

  const room = (opts?: { reduced?: boolean }) => new Probe(document.createElement('canvas'), opts);

  it('builds and resizes without throwing', () => {
    const r = room();
    expect(() => r.resize(960, 400)).not.toThrow();
    expect(r.focusX).toBe(240);
  });

  it('shows the server numbers with their decimals', () => {
    const r = room();
    r.set({ chips: 1262.5, cash: 2340.25, pending: false });
    expect(r.chips).toBe('CHIPS 1,262.5');
    expect(r.cash).toBe('CASH $2,340.25');
  });

  it('shows a dash for a missing number', () => {
    const r = room();
    r.set({ chips: null, cash: null, pending: false });
    expect(r.chips).toBe('CHIPS -');
    expect(r.cash).toBe('CASH -');
  });

  it('eases to a new number and rests on its exact decimals', () => {
    const r = room();
    r.set({ chips: 1000, cash: 0, pending: false });
    r.set({ chips: 1262.5, cash: 0, pending: false });
    step(80);
    expect(r.chips).not.toBe('CHIPS 1,262.5');
    expect(r.chips).not.toBe('CHIPS 1,000');
    step(2000);
    expect(r.chips).toBe('CHIPS 1,262.5');
  });

  it('holds the CHIPS LED until the last chip lands', () => {
    const r = room();
    r.set({ chips: 1250, cash: 2840, pending: false });
    step(100);
    r.play({ kind: 'bought', amount: 500 });
    r.set({ chips: 1750, cash: 2340, pending: false });
    step(600);
    expect(r.chips).toBe('CHIPS 1,250');
    step(300);
    expect(r.chips).not.toBe('CHIPS 1,250');
    step(2000);
    expect(r.chips).toBe('CHIPS 1,750');
  });

  it('keeps the hold while a second purchase is still flying', () => {
    const r = room();
    r.set({ chips: 1250, cash: 2840, pending: false });
    r.play({ kind: 'bought', amount: 500 });
    r.set({ chips: 1750, cash: 2340, pending: false });
    step(300);
    r.play({ kind: 'bought', amount: 500 });
    r.set({ chips: 2250, cash: 1840, pending: false });
    step(600);
    expect(r.chips).toBe('CHIPS 1,250');
    step(500);
    expect(r.chips).not.toBe('CHIPS 1,250');
    step(2500);
    expect(r.chips).toBe('CHIPS 2,250');
  });

  it('lands the flights and the numbers on pause', () => {
    const r = room();
    r.set({ chips: 1250, cash: 2840, pending: false });
    r.play({ kind: 'bought', amount: 500 });
    r.set({ chips: 1750, cash: 2340, pending: false });
    expect(r.chips).toBe('CHIPS 1,250');
    r.pause();
    expect(r.chips).toBe('CHIPS 1,750');
    expect(r.cash).toBe('CASH $2,340');
  });

  it.each([
    { kind: 'pending', amount: 2000 },
    { kind: 'bought', amount: 500 },
    { kind: 'rejected', amount: 500 },
    { kind: 'expired', amount: 500 },
    { kind: 'cashout', amount: 350.5 },
  ] as const)('plays $kind to its end', (move) => {
    const r = room();
    r.resize(960, 400);
    r.set({ chips: 1250, cash: 2840, pending: move.kind === 'pending' });
    expect(() => {
      r.play(move);
      step(4000);
    }).not.toThrow();
  });

  it('draws at once and requests no frame under reduced motion', () => {
    const r = room({ reduced: true });
    const before = drawn;
    r.set({ chips: 1250, cash: 2840, pending: true });
    expect(drawn).toBeGreaterThan(before);
    const afterSet = drawn;
    r.play({ kind: 'bought', amount: 500 });
    r.set({ chips: 1750, cash: 2340, pending: false });
    expect(drawn).toBeGreaterThan(afterSet);
    expect(r.chips).toBe('CHIPS 1,750');
    expect(requests).toBe(0);
  });

  it('clears the reduced stamp timer on destroy', () => {
    vi.useFakeTimers();
    try {
      const r = room({ reduced: true });
      r.play({ kind: 'rejected', amount: 500 });
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      r.destroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
