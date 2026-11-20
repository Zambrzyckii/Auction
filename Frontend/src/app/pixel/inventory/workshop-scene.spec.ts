import type { BenchItem, WorkshopScene } from './workshop-scene';

const stubContext = () => ({
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
});

const looseContext = () => {
  const target: Record<string | symbol, unknown> = stubContext();
  return new Proxy(target, {
    get: (t, prop) => (prop in t ? t[prop] : () => undefined),
    set: (t, prop, value) => {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
};

describe('WorkshopScene', () => {
  let Scene: typeof WorkshopScene;
  let queued: FrameRequestCallback[];
  let clock: number;

  const bench: BenchItem[] = [1, 2, 3].map((n) => ({
    id: `b${n}`,
    name: 'Old Radio',
    rarity: 'Common',
  }));
  const made: BenchItem = { id: 'n', name: 'Crafted Rare Item', rarity: 'Rare' };

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    Scene = (await import('./workshop-scene')).WorkshopScene;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    queued = [];
    clock = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queued.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {
      queued = [];
    });
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

  const callbacks = () => ({ onImpact: vi.fn(), onReveal: vi.fn(), onFail: vi.fn() });

  it('scales by whole numbers under the width and height caps', () => {
    const scene = new Scene(document.createElement('canvas'));
    scene.resize(1906, 275);
    expect(scene.size).toEqual({ scale: 2, width: 1906, height: 224 });
    expect(scene.slot(0)).toEqual({ x: 722, y: 68, w: 68, h: 72 });
    expect(scene.anchor('press')).toEqual({ x: 1016, y: 92 });
    expect(scene.anchor('crate')).toEqual({ x: 1138, y: 44 });
    scene.resize(400, 900);
    expect(scene.size).toEqual({ scale: 1, width: 400, height: 112 });
    scene.resize(1906, 200);
    expect(scene.size.scale).toBe(1);
  });

  it('keeps the last size when resize gets no arguments', () => {
    const scene = new Scene(document.createElement('canvas'));
    scene.resize(1906, 275);
    scene.resize();
    expect(scene.size).toEqual({ scale: 2, width: 1906, height: 224 });
  });

  it('shows the end states at once under reduced motion', () => {
    const cb = callbacks();
    const scene = new Scene(document.createElement('canvas'), { reduced: true, ...cb });
    scene.setBench(bench);
    scene.start();
    expect(cb.onImpact).toHaveBeenCalledTimes(1);
    scene.succeed(made);
    expect(cb.onReveal).toHaveBeenCalledTimes(1);
    scene.setBench(bench);
    scene.start();
    scene.fail();
    expect(cb.onFail).toHaveBeenCalledTimes(1);
  });

  describe('with motion', () => {
    let cb: ReturnType<typeof callbacks>;
    let scene: WorkshopScene;

    beforeEach(() => {
      cb = callbacks();
      scene = new Scene(document.createElement('canvas'), cb);
      scene.resize(900, 300);
      scene.setBench(bench);
      scene.resume();
    });

    it('queues a fast answer until the slam', () => {
      scene.start();
      scene.succeed(made);
      step(608);
      expect(cb.onImpact).not.toHaveBeenCalled();
      expect(cb.onReveal).not.toHaveBeenCalled();
      step(304);
      expect(cb.onImpact).toHaveBeenCalledTimes(1);
      expect(cb.onReveal).not.toHaveBeenCalled();
      step(1504);
      expect(cb.onReveal).toHaveBeenCalledTimes(1);
    });

    it('waits for a slow answer', () => {
      scene.start();
      step(1008);
      expect(cb.onImpact).toHaveBeenCalledTimes(1);
      step(3008);
      expect(cb.onReveal).not.toHaveBeenCalled();
      scene.succeed(made);
      step(1504);
      expect(cb.onReveal).toHaveBeenCalledTimes(1);
    });

    it('jams and reports a failed answer', () => {
      scene.start();
      step(912);
      scene.fail();
      step(2000);
      expect(cb.onFail).toHaveBeenCalledTimes(1);
    });

    it('stops its clock while paused', () => {
      scene.start();
      scene.pause();
      step(2000);
      expect(cb.onImpact).not.toHaveBeenCalled();
    });
  });
});
