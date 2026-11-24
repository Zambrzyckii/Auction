import type * as Crew from './crew';
import type * as Dust from './dust';
import type * as Actions from './player-actions';
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

const size = (c: HTMLCanvasElement) => [c.width, c.height];

describe('pawnshop art', () => {
  let rooms: typeof Rooms;
  let crew: typeof Crew;
  let dust: typeof Dust;
  let actions: typeof Actions;

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    rooms = await import('./rooms');
    crew = await import('./crew');
    dust = await import('./dust');
    actions = await import('./player-actions');
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('rooms', () => {
    it('bakes the three full layers at 480x200', () => {
      const art = rooms.build();
      expect([rooms.W, rooms.H]).toEqual([480, 200]);
      expect(size(art.back)).toEqual([480, 200]);
      expect(size(art.front)).toEqual([480, 200]);
      expect(size(art.dim)).toEqual([480, 200]);
    });

    it('bakes the door, the boards and the heap', () => {
      const art = rooms.build();
      expect(art.door).toHaveLength(5);
      expect(art.planks).toHaveLength(6);
      for (const plank of art.planks) expect(plank.fall).toHaveLength(3);
      expect(art.planks.map((p) => p.crooked)).toEqual([false, false, false, true, false, false]);
      expect(art.heap).toHaveLength(3);
    });

    it('lays the chain from face and edge links', () => {
      const art = rooms.build();
      expect(art.chainPts).toHaveLength(16);
      expect(art.chainPts.map((p) => p[2])).toEqual(
        Array.from({ length: 16 }, (_, i) => (i % 2 ? 'edge' : 'face')),
      );
    });

    it('bakes four band masks per light and the light grids', () => {
      const art = rooms.build();
      expect(art.beams.imgs).toHaveLength(4);
      expect(art.cone.imgs).toHaveLength(4);
      expect(art.cone.pools).toHaveLength(4);
      expect(art.beams.grid).toHaveLength(96000);
      expect(art.cone.grid).toHaveLength(96000);
    });

    it('bakes the cloths of the counter and the shelf drape', () => {
      const art = rooms.build();
      expect(art.sheets.counter).toHaveLength(5);
      expect(art.sheets.drape).toHaveLength(3);
      expect(art.sheets.stay).toHaveLength(5);
    });

    it('bakes the neon letters and the small props', () => {
      const art = rooms.build();
      expect(art.neon.letters).toHaveLength(4);
      expect(size(art.neon.off)).toEqual([art.neon.w, art.neon.h]);
      for (const key of [
        'upperBoards',
        'upperSeams',
        'upperLit',
        'signLit',
        'ballsDull',
        'ballsLit',
        'help',
        'lock',
        'lockOpen',
        'key',
        'linkFace',
        'linkEdge',
        'bulbOn',
        'register',
        'drawer',
      ] as const)
        expect(art[key], key).toBeInstanceOf(HTMLCanvasElement);
      expect(size(art.glass.win)).toEqual([54, 90]);
      expect(size(art.glass.door)).toEqual([44, 118]);
      expect(art.L).toBe(rooms.L);
      expect(art.A).toBe(rooms.A);
      expect(art.SLANT).toBe(rooms.SLANT);
      expect(art.BEAMS).toBe(rooms.BEAMS);
    });

    it('keeps the layout the actors stand on', () => {
      expect(rooms.L.flap).toEqual({ x: 178, w: 10 });
      expect(rooms.L.floorY).toBe(194);
      expect(rooms.L.counterTop).toBe(120);
      expect(rooms.L.nextSign.w).toBe(74);
      expect(rooms.L.board).toEqual({ x: 408, y: 48, w: 70, h: 94 });
      expect(rooms.A.buddy).toEqual({ x: 182, y: 60 });
      expect(rooms.A.you).toBe(22);
      expect(rooms.A.youDoor).toBe(70);
      expect(rooms.A.youBulb).toBe(172);
      expect(rooms.A.youOwner).toBe(366);
      expect(rooms.A.doorX).toBe(88);
    });
  });

  describe('crew', () => {
    const keys: Crew.CrewKey[] = ['clerk', 'appraiser', 'dealer', 'magnate'];

    it.each(keys)('draws the %s buddy 56x104', (key) => {
      expect(size(crew.buddy(key))).toEqual([crew.BW, crew.BH]);
      expect([crew.BW, crew.BH, crew.CX, crew.EYE]).toEqual([56, 104, 28, 17]);
    });

    it('builds an in-between pose with a blink, a turn and a breath', () => {
      const img = crew.buddy('clerk', 'down>wave:2', 'blink', 0, 0, 1, 1);
      expect(size(img)).toEqual([56, 104]);
    });

    it('returns the same canvas for the same buddy frame', () => {
      expect(crew.buddy('dealer', 'guns', 'laugh')).toBe(crew.buddy('dealer', 'guns', 'laugh'));
    });

    it('drops the buddy cache past 320 distinct frames', () => {
      const first = crew.buddy('magnate', 'down', 'smile', 0, 0, 0, 0);
      for (let i = 0; i < 330; i++) crew.buddy('magnate', 'down', 'smile', 0, i + 1, 0, 0);
      expect(crew.buddy('magnate', 'down', 'smile', 0, 0, 0, 0)).not.toBe(first);
    });

    it('gives both hands of a pose', () => {
      const h = crew.hands('appraiser', 'loupe');
      expect(h.L).toHaveLength(2);
      expect(h.R).toHaveLength(2);
    });

    it('draws a customer 40x96 and caches it', () => {
      const c = crew.customer(1, 'worried');
      expect(size(c.img)).toEqual([40, 96]);
      expect(crew.customer(1, 'worried')).toBe(c);
    });

    it('halves the pawned good to an 18x18 shelf mini and caches it', () => {
      const m = crew.mini('Rare', 4);
      expect(size(m)).toEqual([18, 18]);
      expect(crew.mini('Rare', 4)).toBe(m);
    });

    it('bakes the held props', () => {
      for (const img of [
        crew.duster,
        crew.loupe,
        crew.cane,
        crew.box2,
        crew.keys,
        crew.envelope,
        crew.bundle,
        crew.parcel,
      ])
        expect(img).toBeInstanceOf(HTMLCanvasElement);
    });

    it('maps the rarities to the four crew keys', () => {
      expect(crew.crewKeyOf('Common')).toBe('clerk');
      expect(crew.crewKeyOf('Rare')).toBe('appraiser');
      expect(crew.crewKeyOf('Epic')).toBe('dealer');
      expect(crew.crewKeyOf('Legendary')).toBe('magnate');
      expect(crew.crewKeyOf(null)).toBe('clerk');
      expect(crew.crewKeyOf('Mythic')).toBe('clerk');
    });
  });

  describe('player actions', () => {
    it('draws every named pose', () => {
      expect(actions.POSE_NAMES).toHaveLength(20);
      for (const name of actions.POSE_NAMES) {
        expect(actions.poseImg(name), name).toBeInstanceOf(HTMLCanvasElement);
        expect(actions.poseImg(name, true), name).toBeInstanceOf(HTMLCanvasElement);
      }
    });

    it('places a side pose so the body stays on its centre line', () => {
      expect(actions.placePose('kick1', 100, 194).x).toBe(100 + 19 - 22);
      expect(actions.placePose('kick1', 100, 194, true).x).toBe(100 + 19 - (52 - 1 - 22));
    });

    it('places the front poses and the cloth poses', () => {
      const pat = actions.placePose('pat', 100, 194);
      expect({ x: pat.x, y: pat.y }).toEqual({ x: 98, y: 80 });
      const cloth = actions.placePose('clothYank0', 100, 194);
      expect({ x: cloth.x, y: cloth.y }).toEqual({ x: 97, y: 194 - 96 - 6 - 1 });
    });
  });

  describe('dust', () => {
    it('cuts a clump into five frames', () => {
      expect(dust.clumpFrames(5)).toHaveLength(5);
      expect(dust.CLUMP_ALPHA).toEqual([0.75, 0.66, 0.52, 0.36, 0.18]);
    });

    it('drops a part older than its life', () => {
      const parts: Dust.Part[] = [
        { k: 'mote', x: 0, y: 0, vx: 0, vy: 0, t0: 0, life: 1 },
        { k: 'spark', x: 0, y: 0, t0: 0, life: 5 },
      ];
      expect(dust.stepParts(parts, 0.1, 2).map((p) => p.k)).toEqual(['spark']);
    });

    it('moves a part only after its start', () => {
      const clump: Dust.Part = { k: 'clump', x: 0, y: 0, r: 3, vx: 10, vy: 0, t0: 1, life: 5 };
      dust.stepParts([clump], 0.5, 0.5);
      expect(clump.x).toBe(0);
      dust.stepParts([clump], 0.5, 1.5);
      expect(clump.x).toBeCloseTo(5);
      expect(clump.vx).toBeCloseTo(10 * (1 - 0.5 * 1.4));
    });

    it('keeps at most 220 parts and drops the oldest', () => {
      const parts: Dust.Part[] = Array.from({ length: 300 }, (_, i) => ({
        k: 'mote',
        x: i,
        y: 0,
        vx: 0,
        vy: 0,
        t0: 0,
        life: 10,
      }));
      const kept = dust.stepParts(parts, 0, 1);
      expect(kept).toHaveLength(220);
      expect(kept[0].x).toBe(80);
    });
  });
});
