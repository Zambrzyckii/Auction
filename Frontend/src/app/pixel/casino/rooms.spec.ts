import type * as Rooms from './rooms';

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

describe('casino rooms', () => {
  let rooms: typeof Rooms;

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    rooms = await import('./rooms');
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('exports the 480x200 art size', () => {
    expect(rooms.W).toBe(480);
    expect(rooms.H).toBe(200);
  });

  it.each(['cage', 'roulette', 'blackjack'] as const)('builds %s layers of 480x200', (name) => {
    const room = rooms[name]();
    expect([room.back.width, room.back.height]).toEqual([480, 200]);
    expect([room.front.width, room.front.height]).toEqual([480, 200]);
  });

  describe('feltBoard', () => {
    it('holds every betting zone', () => {
      const names = Object.keys(rooms.feltBoard().zones);
      const expected = [
        ...Array.from({ length: 37 }, (_, n) => `n${n}`),
        'col1',
        'col2',
        'col3',
        'dozen1',
        'dozen2',
        'dozen3',
        'low',
        'even',
        'red',
        'black',
        'odd',
        'high',
      ];
      expect(names.sort()).toEqual(expected.sort());
    });

    it('lines each number up with its column and dozen', () => {
      const { zones } = rooms.feltBoard();
      for (let p = 1; p <= 36; p++) {
        const n = zones['n' + p];
        const col = zones['col' + (((p - 1) % 3) + 1)];
        const dozen = zones['dozen' + (Math.floor((p - 1) / 12) + 1)];
        const centre = n.x + n.w / 2;
        expect(n.y).toBe(col.y);
        expect(centre).toBeGreaterThanOrEqual(dozen.x);
        expect(centre).toBeLessThanOrEqual(dozen.x + dozen.w);
      }
    });
  });
});
