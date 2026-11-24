import type * as Crew from './crew';
import type * as Gait from './gait';
import type { Walker } from './gait';

const looseContext = (spies: Record<string, unknown> = {}) => {
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
    ...spies,
  };
  return new Proxy(target, {
    get: (t, prop) => (prop in t ? t[prop] : () => undefined),
    set: (t, prop, value) => {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
};

describe('pawnshop walkers in side view', () => {
  let crew: typeof Crew;
  let gait: typeof Gait;
  let fillRect: ReturnType<typeof vi.fn>;
  let drawImage: ReturnType<typeof vi.fn>;
  let t: Crew.DrawTarget;

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    crew = await import('./crew');
    gait = await import('./gait');
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  beforeEach(() => {
    fillRect = vi.fn();
    drawImage = vi.fn();
    t = { ctx: looseContext({ fillRect, drawImage }), s: 2 };
  });

  const walking = (id: Gait.WalkerId, x: number, to: number, secs: number): Walker => {
    const a: Walker = { x, face: 'front', walking: false, _face: 'front' };
    if (id === 'you' || id.startsWith('cust')) a.feet = 194;
    else a.top = 90;
    if (id.startsWith('cust')) a.i = Number(id.slice(4));
    if (id !== 'you' && !id.startsWith('cust')) a.key = id as Gait.CrewKey;
    gait.beginWalk(a, id, to, 40, null, () => undefined);
    for (let n = 0; n < Math.round(secs * 60); n++) gait.step(a, 1 / 60, n / 60);
    return a;
  };

  const standing = (id: Gait.WalkerId, face: Walker['face'] = 'right'): Walker => {
    const a: Walker = { x: 60, face, walking: false, _face: face };
    if (id === 'you' || id.startsWith('cust')) a.feet = 194;
    else a.top = 90;
    if (id.startsWith('cust')) a.i = Number(id.slice(4));
    if (id !== 'you' && !id.startsWith('cust')) a.key = id as Gait.CrewKey;
    return a;
  };

  const sizes = (calls: unknown[][]) => new Set(calls.map((c) => c[2]));

  describe('limbs on the device grid', () => {
    it('paints with odd device x and only the sizes a KB limb pass paints', () => {
      const a = walking('clerk', 100.25, 220, 0.3);
      crew.drawWalker(t, a, 0.3);
      const calls = fillRect.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.some((c) => (c[0] as number) % 2 !== 0)).toBe(true);
      const allowed = new Set<number>();
      for (const w of [gait.KB.legW, gait.KB.legW - 1, gait.KB.armW])
        for (const ww of [w + 2, w, w - 1, ...(w > 4 ? [w - 4] : [])])
          allowed.add(Math.round(ww * 2));
      expect([...sizes(calls)].every((v) => allowed.has(v as number))).toBe(true);
      expect(calls.every((c) => c[2] === c[3])).toBe(true);
    });

    it('paints ink first and then the three tones of the ramp', () => {
      const colours: unknown[] = [];
      const ctx = looseContext({ fillRect });
      Object.defineProperty(ctx, 'fillStyle', { set: (v) => colours.push(v), configurable: true });
      crew.drawWalker({ ctx, s: 2 }, standing('clerk'), 0.3);
      expect(colours[0]).toBe('#17121c');
    });
  });

  describe('drawWalker', () => {
    it('returns a hand inside the 56x104 box around the walker', () => {
      const a = walking('clerk', 100.25, 220, 0.3);
      const { hand, top } = crew.drawWalker(t, a, 0.3);
      expect(hand[0]).toBeGreaterThan(a.x);
      expect(hand[0]).toBeLessThan(a.x + 56);
      expect(hand[1]).toBeGreaterThan(top);
      expect(hand[1]).toBeLessThan(top + 104);
    });

    it('uses the carry arm angles with carry true', () => {
      const a = standing('clerk');
      const { hand, top } = crew.drawWalker(t, a, 5, { carry: true });
      const sh: Gait.Pt = [a.x + 28 + 0.5 + gait.GAIT.clerk.lean, top + gait.KB.sh];
      const want = gait.armPoints(sh, gait.ARM.carry, gait.KB, 1)[2];
      expect(hand[0]).toBeCloseTo(want[0], 6);
      expect(hand[1]).toBeCloseTo(want[1], 6);
      const plain = crew.drawWalker(t, a, 5).hand;
      expect(plain[1]).not.toBeCloseTo(want[1], 3);
    });

    it('draws the cane of the magnate as an 8x8 canvas and no other tier does', () => {
      crew.drawWalker(t, standing('magnate'), 5);
      const cane = drawImage.mock.calls.filter((c) => c[0].width === 8 && c[0].height === 8);
      expect(cane).toHaveLength(1);
      expect([cane[0][3], cane[0][4]]).toEqual([16, 16]);
      drawImage.mockClear();
      crew.drawWalker(t, standing('clerk'), 5);
      expect(drawImage.mock.calls.some((c) => c[0].width === 8 && c[0].height === 8)).toBe(false);
    });

    it('draws a 40x96 body for you and for cust0', () => {
      for (const id of ['you', 'cust0'] as const) {
        drawImage.mockClear();
        crew.drawWalker(t, standing(id), 5);
        const body = drawImage.mock.calls.find((c) => c[3] / 2 === 40 && c[4] / 2 === 96);
        expect(body, id).toBeTruthy();
      }
    });

    it('draws the 56x104 body for the crew', () => {
      crew.drawWalker(t, standing('dealer'), 5);
      expect(drawImage.mock.calls.some((c) => c[3] / 2 === 56 && c[4] / 2 === 104)).toBe(true);
    });

    it('draws the held image in the near hand', () => {
      const hold = document.createElement('canvas');
      hold.width = 10;
      hold.height = 6;
      crew.drawWalker(t, standing('clerk'), 5, { hold });
      expect(drawImage.mock.calls.some((c) => c[0] === hold)).toBe(true);
    });
  });

  describe('prewarm', () => {
    it('does not throw and leaves nothing to bake for a walking clerk', () => {
      expect(() => crew.prewarm()).not.toThrow();
      const a = walking('clerk', 100.25, 220, 0.3);
      crew.drawWalker(t, a, 0.3);
      const create = vi.spyOn(document, 'createElement');
      crew.drawWalker(t, a, 0.3);
      const dealer = walking('dealer', 100.25, 220, 0.5);
      crew.drawWalker(t, dealer, 0.5);
      crew.drawWalker(t, dealer, 0.5);
      const canvases = create.mock.calls.filter((c) => c[0] === 'canvas');
      create.mockRestore();
      expect(canvases).toHaveLength(0);
    });
  });

  describe('cache cap', () => {
    it('clears a body cache that grows past 160 entries', () => {
      const a = standing('clerk');
      const baked = () => {
        const create = vi.spyOn(document, 'createElement');
        crew.drawWalker(t, a, 5, { mood: 'cap0' });
        const n = create.mock.calls.filter((c) => c[0] === 'canvas').length;
        create.mockRestore();
        return n;
      };
      expect(baked()).toBe(1);
      expect(baked()).toBe(0);
      for (let i = 1; i < 170; i++) crew.drawWalker(t, a, 5, { mood: `cap${i}` });
      expect(baked()).toBe(1);
    });
  });

  describe('frontProps', () => {
    it('draws the duster in the clerk hand while dusting', () => {
      crew.frontProps(t, 'clerk', 'dustA', 0, 0, null);
      expect(drawImage.mock.calls.some((c) => c[0] === crew.duster)).toBe(true);
    });

    it('draws the cane for the magnate at rest', () => {
      crew.frontProps(t, 'magnate', 'down', 0, 0, null);
      expect(drawImage.mock.calls.some((c) => c[0] === crew.cane)).toBe(true);
    });

    it('draws the loupe for the appraiser and nothing for the dealer', () => {
      crew.frontProps(t, 'appraiser', 'loupe', 0, 0, null);
      expect(drawImage.mock.calls.some((c) => c[0] === crew.loupe)).toBe(true);
      drawImage.mockClear();
      crew.frontProps(t, 'dealer', 'guns', 0, 0, null);
      expect(drawImage).not.toHaveBeenCalled();
    });
  });
});
