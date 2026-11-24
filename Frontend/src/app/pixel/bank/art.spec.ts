import type * as People from './people';
import type * as Rooms from './rooms';
import type * as Sprites from './sprites';

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

const YOU_DIGEST = '288a7678';
const HOODED_DIGEST = '1d029d2d';

const digest = (c: readonly (string | null | undefined)[]) => {
  let h = 0x811c9dc5;
  for (const ch of c.map((v) => v ?? '.').join(',')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
};

describe('bank art', () => {
  let sprites: typeof Sprites;
  let people: typeof People;
  let rooms: typeof Rooms;
  let R: (typeof import('../street/pix'))['R'];

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    sprites = await import('./sprites');
    people = await import('./people');
    rooms = await import('./rooms');
    R = (await import('../street/pix')).R;
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('sprites', () => {
    it('re-exports the shared casino builders by identity', async () => {
      const casino = await import('../casino/sprites');
      expect(sprites.NEON).toBe(casino.NEON);
      expect(sprites.AMBER).toBe(casino.AMBER);
      expect(sprites.LED).toBe(casino.LED);
      expect(sprites.rotate).toBe(casino.rotate);
      expect(sprites.squeeze).toBe(casino.squeeze);
      expect(sprites.scale2x).toBe(casino.scale2x);
      expect(sprites.plate).toBe(casino.plate);
      expect(sprites.neon).toBe(casino.neon);
      expect(sprites.bulbOn).toBe(casino.bulbOn);
      expect(sprites.bulbOff).toBe(casino.bulbOff);
    });

    it('keeps the three bank ramps', () => {
      expect(sprites.LIME).toEqual(['#16200e', '#2a3a1c', '#5aa83a', '#b8f07a']);
      expect(sprites.NGREEN).toEqual(['#16241a', '#2a3a2c', '#4fb83c', '#8af060']);
      expect(sprites.NRED).toEqual(['#2a0c0e', '#4a1e22', '#c8302a', '#ff4a3a']);
    });

    it('builds a 54 wide LED panel of three rows, 35 high', () => {
      expect(size(sprites.ledPanel(['A', 'B', 'C'], 54))).toEqual([54, 35]);
    });

    it('returns the cached canvas for the same stamp and the same panel', () => {
      const stamp = sprites.stamp('PAID', R.gold);
      expect(sprites.stamp('PAID', R.gold)).toBe(stamp);
      const panel = sprites.ledPanel(['A', 'B', 'C'], 54);
      expect(sprites.ledPanel(['A', 'B', 'C'], 54)).toBe(panel);
    });

    it('drops the stamp and panel caches once many distinct ones were built', () => {
      const stamp = sprites.stamp('FIRST', R.gold);
      const panel = sprites.ledPanel(['FIRST'], 54);
      for (let i = 0; i < 200; i++) {
        sprites.stamp('S' + i, R.gold);
        sprites.ledPanel(['N' + i], 54);
      }
      expect(sprites.stamp('FIRST', R.gold)).not.toBe(stamp);
      expect(sprites.ledPanel(['FIRST'], 54)).not.toBe(panel);
    });
  });

  describe('people', () => {
    const moods: People.SharkMood[] = ['smirk', 'blink', 'grin', 'laugh', 'sad', 'loupe'];
    it.each(moods)('draws the shark in the %s mood 64x62', (mood) => {
      expect(size(people.shark(mood))).toEqual([64, 62]);
    });

    it('describes the shark and the enforcer for the room', () => {
      expect(people.sharkInfo.mouth).toEqual([39, 25]);
      expect(people.sharkInfo.eyeL).toEqual([27, 16]);
      expect(people.sharkInfo.eyeR).toEqual([36, 16]);
      expect(people.bruteInfo.mouth).toEqual([35, 18]);
      expect(people.bruteInfo.elbows).toEqual([
        [8, 52],
        [56, 52],
      ]);
    });

    it('draws the enforcer 64x106 standing, chewing and walking', () => {
      expect(size(people.enforcer({}))).toEqual([64, 106]);
      expect(size(people.enforcer({ chew: true }))).toEqual([64, 106]);
      expect(size(people.enforcer({ walk: true, step: 1 }))).toEqual([64, 106]);
    });

    it('draws you from the front, walking and sitting', () => {
      expect(size(people.youFront(false, 1))).toEqual([40, 96]);
      expect(people.youWalk()).toHaveLength(4);
      expect(size(people.youSit(false))).toEqual([44, 66]);
    });

    it('builds the whole queue', () => {
      expect(Object.keys(people.queuePeople()).sort()).toEqual(
        ['man', 'granny', 'signGuy', 'mom', 'kid', 'cart', 'cardboard'].sort(),
      );
    });

    it('returns the same canvas for the same bundle, envelope and slip', () => {
      const bundle = people.bundle('$200');
      expect(people.bundle('$200')).toBe(bundle);
      const envelope = people.envelope('$150');
      expect(people.envelope('$150')).toBe(envelope);
      const slip = people.slip('+120', true);
      expect(people.slip('+120', true)).toBe(slip);
      expect(people.slip('+120', false)).not.toBe(slip);
    });

    it('drops the label caches once many distinct labels were built', () => {
      const bundle = people.bundle('FIRST');
      const envelope = people.envelope('FIRST');
      const slip = people.slip('FIRST', true);
      for (let i = 0; i < 200; i++) {
        people.bundle('B' + i);
        people.envelope('E' + i);
        people.slip('S' + i, true);
      }
      expect(people.bundle('FIRST')).not.toBe(bundle);
      expect(people.envelope('FIRST')).not.toBe(envelope);
      expect(people.slip('FIRST', true)).not.toBe(slip);
    });
  });

  describe('rooms', () => {
    it('bakes a back and a front layer of 480x200 and every prop', () => {
      const room = rooms.bank();
      expect([rooms.W, rooms.H]).toEqual([480, 200]);
      expect(size(room.back)).toEqual([480, 200]);
      expect(size(room.front)).toEqual([480, 200]);
      expect(size(room.lampCone)).toEqual([480, 200]);
      expect(size(room.boxOff)).toEqual([120, 24]);
      expect(room.boxAt).toEqual({ x: 12, y: 33 });
      for (const key of [
        'calc',
        'counter',
        'banker',
        'teletype',
        'basket',
        'tube',
        'tubeGlass',
        'tv',
        'beaconOff',
        'beaconOn',
        'flash',
        'lampOn',
        'desk',
      ] as const)
        expect(room[key], key).toBeInstanceOf(HTMLCanvasElement);
      expect(room.L).toBe(rooms.L);
      expect(room.anchors).toBe(rooms.anchors);
    });

    it('keeps the layout the actors and the labels stand on', () => {
      expect(rooms.L.led).toEqual({ x: 252, y: 127, w: 54 });
      expect(rooms.L.tube.bottom).toBe(106);
      expect(rooms.L.shame.slot).toEqual([193, 93]);
    });

    it('keeps the anchors of the people', () => {
      expect(rooms.anchors.youQueue).toBe(128);
      expect(rooms.anchors.youLoan).toBe(214);
      expect(rooms.anchors.youWires).toBe(352);
      expect(rooms.anchors.youCurb).toBe(70);
      expect(rooms.anchors.queue).toEqual([106, 84, 61, 38]);
      expect(rooms.anchors.shark).toEqual({ x: 208, y: 64 });
      expect(rooms.anchors.brute).toEqual({ x: 258, y: 60 });
    });
  });

  describe('stander characterization', () => {
    const youOpts = () => ({
      h: 96,
      w: 40,
      skin: people.YOU.skin,
      hair: 'short' as const,
      hairRamp: R.hair,
      top: people.YOU.tee,
      coat: people.YOU.jacket,
      coatLen: 58,
      pants: people.YOU.jeans,
      shoes: people.YOU.shoes,
      look: 1,
      blink: false,
    });
    const hoodedOpts = () => ({
      h: 96,
      w: 40,
      look: 1,
      arms: 'chest' as const,
      mood: 'worried' as const,
      skin: R.skinB,
      hair: 'hood' as const,
      hatRamp: R.hoodie,
      hairRamp: R.hair,
      top: R.hoodie,
      pants: R.denim,
      shoes: R.white,
    });

    it('keeps the digest of the player body', () => {
      expect(digest(people.stander(youOpts()).s.c)).toBe(YOU_DIGEST);
    });

    it('keeps the digest of the hooded customer', () => {
      expect(digest(people.stander(hoodedOpts()).s.c)).toBe(HOODED_DIGEST);
    });

    it('keeps both digests with turn 0', () => {
      expect(digest(people.stander({ ...youOpts(), turn: 0 }).s.c)).toBe(YOU_DIGEST);
      expect(digest(people.stander({ ...hoodedOpts(), turn: 0 }).s.c)).toBe(HOODED_DIGEST);
    });

    it('turns only the face, so the rows below the shoulder line stay the same', () => {
      const flat = people.stander(youOpts()).s.c;
      const turned = people.stander({ ...youOpts(), turn: 1 }).s.c;
      expect(digest(turned)).not.toBe(YOU_DIGEST);
      expect(turned.slice(24 * 40)).toEqual(flat.slice(24 * 40));
    });

    it('draws the turned player on a 40x96 canvas', () => {
      expect(size(people.youFront(false, 1, 1))).toEqual([40, 96]);
    });

    it('exposes prop for the crew props', () => {
      expect(size(people.prop(3, 4, (s) => s.set(0, 0, '#000000')))).toEqual([3, 4]);
    });
  });
});
