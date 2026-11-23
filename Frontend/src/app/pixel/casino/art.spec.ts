import type { Painter, Slot as SlotClass } from './floor';
import type * as Sprites from './sprites';

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

describe('casino art', () => {
  let sprites: typeof Sprites;
  let Slot: typeof SlotClass;
  let R: (typeof import('../street/pix'))['R'];

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    sprites = await import('./sprites');
    Slot = (await import('./floor')).Slot;
    R = (await import('../street/pix')).R;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('stacksOf', () => {
    it('splits a balance into stacks of at most eight, biggest chip first', () => {
      expect(sprites.stacksOf(1250)).toEqual([
        { key: 'p', n: 2 },
        { key: 'k', n: 2 },
        { key: 'g', n: 2 },
      ]);
      expect(sprites.stacksOf(4100)).toEqual([
        { key: 'p', n: 8 },
        { key: 'k', n: 1 },
      ]);
    });

    it('returns no stacks for a negative balance', () => {
      expect(sprites.stacksOf(-5)).toEqual([]);
    });
  });

  describe('chipKeyFor', () => {
    it.each([
      [500, 'p'],
      [499, 'k'],
      [100, 'k'],
      [25, 'g'],
      [24, 'r'],
      [5, 'r'],
      [4, 'w'],
    ])('maps a stake of %i to the %s chip', (stake, key) => {
      expect(sprites.chipKeyFor(stake)).toBe(key);
    });
  });

  describe('card', () => {
    it('is 24x34 and cached', () => {
      const c = sprites.card(0);
      expect([c.width, c.height]).toEqual([24, 34]);
      expect(sprites.card(0)).toBe(c);
    });

    it('draws the back as 24x34', () => {
      const c = sprites.card(-1);
      expect([c.width, c.height]).toEqual([24, 34]);
    });

    it('squeezes to the given flip width', () => {
      expect(sprites.card(0, 0, 8).width).toBe(8);
    });
  });

  describe('plate', () => {
    const line = (word: string): Sprites.PlateLine[] => [[word, 'tiny', '#f4ecdc']];

    it('returns the cached canvas for the same lines', () => {
      const first = sprites.plate(line('SAME'));
      expect(sprites.plate(line('SAME'))).toBe(first);
    });

    it('drops its cache once many distinct plates were built', () => {
      const first = sprites.plate(line('FIRST'));
      for (let i = 0; i < 200; i++) sprites.plate(line('N' + i));
      expect(sprites.plate(line('FIRST'))).not.toBe(first);
    });
  });

  describe('Slot', () => {
    it('runs ten seconds of steps and draws through the painter', () => {
      const slot = new Slot(2, 82, R.red, '777', 3, {});
      for (let i = 0; i < 600; i++) slot.step(1 / 60);
      const img = vi.fn();
      const painter: Painter = { ctx: looseContext(), s: 4, img, imgF: vi.fn() };
      slot.draw(painter);
      expect(img).toHaveBeenCalled();
    });
  });
});
