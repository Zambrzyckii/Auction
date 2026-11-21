import type { WarLot, WarYard, WarYardState } from './war-yard';
import type { Mock } from 'vitest';

const DOOR_WIDTH = 68;

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

describe('WarYard', () => {
  let Yard: typeof WarYard;
  let queued: FrameRequestCallback[];
  let clock: number;
  let doorRows: number[];

  const looseContext = () => {
    const target: Record<string | symbol, unknown> = stubContext();
    target['drawImage'] = (...args: unknown[]) => {
      if (args.length === 9 && args[3] === DOOR_WIDTH) doorRows.push(args[4] as number);
    };
    return new Proxy(target, {
      get: (t, prop) => (prop in t ? t[prop] : () => undefined),
      set: (t, prop, value) => {
        t[prop] = value;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
  };

  const lots: WarLot[] = [
    { name: 'Old Radio', rarity: 'Common' },
    { name: 'Crafted Rare Item', rarity: 'Rare' },
    { name: 'Unknown Thing', rarity: 'Mythic' },
  ];
  const base: WarYardState = { phase: 'open', players: 3, leader: null };

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    Yard = (await import('./war-yard')).WarYard;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    queued = [];
    clock = 0;
    doorRows = [];
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

  const doorRow = () => doorRows[doorRows.length - 1];

  it('scales by whole numbers under the width and height caps', () => {
    const yard = new Yard(document.createElement('canvas'));
    yard.resize(728, 620);
    expect(yard.size).toEqual({ scale: 4, width: 728, height: 448 });
    yard.resize(400, 900);
    expect(yard.size.scale).toBe(2);
    yard.resize(280, 900);
    expect(yard.size).toEqual({ scale: 1, width: 280, height: 112 });
  });

  it('anchors the door, barker and crowd in canvas pixels', () => {
    const yard = new Yard(document.createElement('canvas'));
    yard.resize(728, 620);
    const { scale } = yard.size;
    expect(yard.anchor('door').y).toBe(50 * scale);
    expect(yard.anchor('barker').y).toBe(72 * scale);
    expect(yard.anchor('crowd').y).toBe(92 * scale);
  });

  describe('with motion', () => {
    let yard: WarYard;
    let onDoorOpen: Mock<() => void>;

    beforeEach(() => {
      onDoorOpen = vi.fn<() => void>();
      yard = new Yard(document.createElement('canvas'), { onDoorOpen });
      yard.resize(728, 620);
    });

    it('keeps the door closed while open and tweens to the peek when bidding starts', () => {
      yard.resume();
      yard.set(base);
      step(400);
      expect(doorRow()).toBe(60);
      yard.set({ ...base, phase: 'bidding', leader: 'rival' });
      step(48);
      expect(doorRow()).toBeLessThan(60);
      expect(doorRow()).toBeGreaterThan(34);
      step(320);
      expect(doorRow()).toBe(34);
    });

    it('fires onDoorOpen only after the roll and the flicker', () => {
      yard.set({ ...base, phase: 'bidding', leader: 'you' });
      step(400);
      yard.settle(true, lots);
      step(1504);
      expect(onDoorOpen).not.toHaveBeenCalled();
      step(48);
      expect(onDoorOpen).toHaveBeenCalledTimes(1);
      expect(doorRow()).toBe(4);
    });

    it('fires onDoorOpen after the shorter beat for a loss', () => {
      yard.set({ ...base, phase: 'bidding', leader: 'rival' });
      step(400);
      yard.settle(false, lots);
      step(1312);
      expect(onDoorOpen).not.toHaveBeenCalled();
      step(48);
      expect(onDoorOpen).toHaveBeenCalledTimes(1);
    });

    it('draws a set with items after a settle without throwing', () => {
      yard.set({ ...base, phase: 'bidding', leader: 'you' });
      step(400);
      yard.settle(true, lots);
      step(2000);
      expect(() => {
        yard.set({ phase: 'won', players: 3, leader: 'you', items: lots });
        step(200);
        yard.raise('rival');
        yard.pause();
        yard.resume();
        step(200);
      }).not.toThrow();
      expect(doorRow()).toBe(4);
    });

    it('stops drawing after destroy', () => {
      yard.destroy();
      yard.resume();
      expect(queued).toHaveLength(0);
    });
  });

  it('opens at once and calls onDoorOpen synchronously under reduced motion', () => {
    const onDoorOpen = vi.fn<() => void>();
    const yard = new Yard(document.createElement('canvas'), { reduced: true, onDoorOpen });
    yard.resize(728, 620);
    yard.set({ ...base, phase: 'bidding', leader: 'you' });
    expect(doorRow()).toBe(34);
    yard.settle(true, lots);
    expect(onDoorOpen).toHaveBeenCalledTimes(1);
    expect(doorRow()).toBe(4);
    expect(queued).toHaveLength(0);
  });

  it('builds the easel lines from the real estimates', async () => {
    const { easelLines } = await import('./war-yard');
    expect(easelLines(150, 220)).toEqual(['EST', '150', '-220']);
    expect(easelLines()).toEqual(['EST', '4200', '-9800']);
  });
});
