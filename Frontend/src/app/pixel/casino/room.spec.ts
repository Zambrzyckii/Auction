import type * as RoomModule from './room';

const looseContext = () => {
  const target: Record<string | symbol, unknown> = {
    measureText: () => ({ width: 0 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
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

describe('Room', () => {
  let mod: typeof RoomModule;
  let TestRoom: new (
    cv: HTMLCanvasElement,
    opts?: RoomModule.RoomOpts,
  ) => RoomModule.Room & { clear(): void };
  let queued: FrameRequestCallback[] = [];
  let clock = 0;
  let requests = 0;
  let cancel: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    mod = await import('./room');
    TestRoom = class extends mod.Room {
      readonly focusX = 240;
      protected draw(): void {}
      clear(): void {
        this.clearPlate();
      }
    };
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    queued = [];
    clock = 0;
    requests = 0;
    cancel = vi.fn(() => {
      queued = [];
    });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      requests++;
      return queued.push(cb);
    });
    vi.stubGlobal('cancelAnimationFrame', cancel);
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

  const room = (opts?: RoomModule.RoomOpts) => new TestRoom(document.createElement('canvas'), opts);

  describe('resize', () => {
    it.each([
      [1906, 458, 2],
      [400, 917, 1],
      [3000, 2000, 4],
      [2000, 300, 1],
    ])('fits %i x %i at scale %i', (width, height, scale) => {
      const r = room();
      r.resize(width, height);
      expect(r.s).toBe(scale);
      expect(r.size).toEqual({ scale, width: 480 * scale, height: 200 * scale });
    });

    it('keeps the current scale with no arguments', () => {
      const r = room();
      r.resize(1906, 458);
      r.resize();
      expect(r.size.scale).toBe(2);
    });
  });

  describe('fmt', () => {
    it.each([
      [1262.5, '1,262.5'],
      [1250, '1,250'],
      [0.125, '0.13'],
    ])('formats %s as %s', (value, text) => {
      expect(mod.fmt(value)).toBe(text);
    });
  });

  describe('loop', () => {
    it('does not request a frame on construction', () => {
      room();
      expect(requests).toBe(0);
    });

    it('fires a scheduled callback only after its delay', () => {
      const r = room();
      const spy = vi.fn();
      r.schedule(1, spy);
      step(900);
      expect(spy).not.toHaveBeenCalled();
      step(200);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('fires a flier end after its duration', () => {
      const r = room();
      const spy = vi.fn();
      r.fly('r', 0, 0, 10, 10, 0.5, spy);
      step(400);
      expect(spy).not.toHaveBeenCalled();
      step(200);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('keeps a flier started from a landing', () => {
      const r = room();
      const spy = vi.fn();
      r.fly('p', 0, 0, 10, 10, 0.5, () => r.fly('p', 10, 10, 20, 20, 0.5, spy));
      step(520);
      expect(spy).not.toHaveBeenCalled();
      expect(queued).toHaveLength(1);
      step(560);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('runs pending work on pause and lands later work at once', () => {
      const r = room();
      const pending = vi.fn();
      const later = vi.fn();
      const ended = vi.fn();
      r.schedule(5, pending);
      r.fly('r', 0, 0, 10, 10, 5, ended);
      r.pause();
      expect(pending).toHaveBeenCalledTimes(1);
      expect(ended).toHaveBeenCalledTimes(1);
      r.schedule(1, later);
      expect(later).toHaveBeenCalledTimes(1);
      expect(queued).toHaveLength(0);
    });

    it('restarts the loop on resume', () => {
      const r = room();
      const spy = vi.fn();
      r.pause();
      r.resume();
      r.schedule(0.5, spy);
      step(600);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('never requests a frame under reduced motion', () => {
      const r = room({ reduced: true });
      const scheduled = vi.fn();
      const ended = vi.fn();
      r.schedule(1, scheduled);
      r.fly('r', 0, 0, 10, 10, 0.5, ended);
      r.resume();
      expect(scheduled).toHaveBeenCalledTimes(1);
      expect(ended).toHaveBeenCalledTimes(1);
      expect(requests).toBe(0);
    });

    it('cancels the queued frame on destroy and drops queued work', () => {
      const r = room();
      const spy = vi.fn();
      r.schedule(1, spy);
      expect(queued).toHaveLength(1);
      r.destroy();
      expect(cancel).toHaveBeenCalled();
      expect(queued).toHaveLength(0);
      expect(spy).not.toHaveBeenCalled();
      const before = requests;
      r.schedule(1, spy);
      r.resume();
      expect(requests).toBe(before);
    });
  });

  describe('clearPlate', () => {
    const plateUp = (r: object) => (r as { plateNow: unknown }).plateNow !== null;
    const lines = [['HI', 'tiny', '#ffffff']] as const;

    it('drops the current plate', () => {
      const r = room();
      r.setPlate(lines, 100, 100);
      expect(plateUp(r)).toBe(true);
      r.clear();
      expect(plateUp(r)).toBe(false);
    });

    it('cancels the reduced-motion clear timer', () => {
      vi.useFakeTimers();
      try {
        const r = room({ reduced: true });
        r.setPlate(lines, 100, 100);
        expect(vi.getTimerCount()).toBe(1);
        r.clear();
        expect(plateUp(r)).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does nothing when no plate is up', () => {
      const r = room();
      r.clear();
      expect(requests).toBe(0);
    });
  });
});
