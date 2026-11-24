import type { Sprite } from '../street/pix';
import { RARITIES } from './rarity';

const digest = (c: readonly (string | null | undefined)[]) => {
  let h = 0x811c9dc5;
  for (const ch of c.map((v) => v ?? '.').join(',')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
};

const PAWNED_DIGESTS = ['7e36560b', 'bdc7c300', 'b603f142', '279e62a5'];

const stubContext = () => ({
  measureText: () => ({ width: 0 }),
  fillText: () => undefined,
  clearRect: () => undefined,
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
  putImageData: () => undefined,
  drawImage: () => undefined,
});

describe('item catalog', () => {
  let pix: typeof import('../street/pix');
  let catalog: typeof import('./sprites/catalog');
  let icon: typeof import('./item-icon');
  let names: typeof import('./sprites/names');
  let PALETTE: Set<string>;

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => stubContext() as unknown as CanvasRenderingContext2D,
    );
    pix = await import('../street/pix');
    catalog = await import('./sprites/catalog');
    icon = await import('./item-icon');
    names = await import('./sprites/names');
    PALETTE = new Set([pix.INK, ...Object.values(pix.R).flat()]);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  const stats = (s: Sprite) => {
    const colours = new Set<string>();
    let opaque = 0;
    s.each((_x, _y, c) => {
      if (!c) return;
      opaque++;
      colours.add(c);
    });
    return { opaque, colours: [...colours].sort() };
  };
  const cells = (s: Sprite) => s.c;

  it('has 163 names, 160 from the bots and 3 starters', () => {
    expect(names.BOT_NAMES).toHaveLength(160);
    expect(names.STARTER_NAMES).toHaveLength(3);
    expect(names.NAMES).toHaveLength(163);
  });

  it('has no key shared between theme files', async () => {
    const records = await Promise.all([
      import('./sprites/audio').then((m) => m.AUDIO),
      import('./sprites/phones').then((m) => m.PHONES),
      import('./sprites/computers').then((m) => m.COMPUTERS),
      import('./sprites/wear').then((m) => m.WEAR),
      import('./sprites/collectibles').then((m) => m.COLLECTIBLES),
      import('./sprites/car').then((m) => m.CAR),
      import('./sprites/toys').then((m) => m.TOYS),
      import('./sprites/street').then((m) => m.STREET),
      import('./sprites/tools').then((m) => m.TOOLS),
      import('./sprites/music').then((m) => m.MUSIC),
      import('./sprites/kitchen').then((m) => m.KITCHEN),
      import('./sprites/sports').then((m) => m.SPORTS),
      import('./sprites/office').then((m) => m.OFFICE),
      import('./sprites/home').then((m) => m.HOME),
      import('./sprites/camping').then((m) => m.CAMPING),
      import('./sprites/workshop').then((m) => m.WORKSHOP),
      import('./sprites/photo').then((m) => m.PHOTO),
      import('./sprites/pets').then((m) => m.PETS),
      import('./sprites/bling').then((m) => m.BLING),
      import('./sprites/odd').then((m) => m.ODD),
      import('./sprites/families').then((m) => m.STARTERS),
    ]);
    const total = records.reduce((sum, record) => sum + Object.keys(record).length, 0);
    expect(total).toBe(Object.keys(catalog.EXACT).length);
  });

  it('registers only names from the list', () => {
    for (const key of Object.keys(catalog.EXACT)) expect(names.NAMES).toContain(key);
  });

  it('draws every name on the list', () => {
    for (const name of names.NAMES) expect(Object.keys(catalog.EXACT), name).toContain(name);
  });

  it('draws every registered sprite inside the rules', () => {
    const drawings = [
      ...Object.entries(catalog.EXACT).map(([n, fn]) => [n, fn] as const),
      ...Object.entries(catalog.FAMILY_ART).flatMap(([n, fn]) =>
        RARITIES.map((r) => [`${n} ${r}`, () => fn(r)] as const),
      ),
    ];
    for (const [name, draw] of drawings) {
      const s = draw();
      const { opaque, colours } = stats(s);
      expect([name, s.w, s.h]).toEqual([name, 32, 32]);
      expect(opaque, name).toBeGreaterThanOrEqual(200);
      expect(opaque, name).toBeLessThanOrEqual(900);
      expect(colours.length, name).toBeLessThanOrEqual(12);
      for (const c of colours) expect(PALETTE.has(c), `${name} uses ${c}`).toBe(true);
    }
  });

  it('routes the backend families by name and rarity', () => {
    expect(cells(icon.iconFor('Warehouse Epic Find', 'Epic'))).toEqual(
      cells(catalog.FAMILY_ART['Warehouse Find']('Epic')),
    );
    expect(cells(icon.iconFor('Pawned Rare Good', 'Rare'))).toEqual(
      cells(catalog.FAMILY_ART['Pawned Good']('Rare')),
    );
    expect(cells(icon.iconFor('Crafted Legendary Item', 'Legendary'))).toEqual(
      cells(catalog.FAMILY_ART['Crafted Item']('Legendary')),
    );
  });

  it('falls back to mystery for a null name and for an unknown name', () => {
    const m = cells(catalog.mystery('Rare'));
    expect(cells(icon.iconFor(null, 'Rare'))).toEqual(m);
    expect(cells(icon.iconFor('Something New', 'Rare'))).toEqual(m);
  });

  it('falls back to mystery when a sprite throws', () => {
    const broken = icon.makeIconFor({
      exact: {
        Boom: () => {
          throw new Error('bad port');
        },
      },
      families: [],
      mystery: catalog.mystery,
    });
    expect(cells(broken('Boom', 'Common'))).toEqual(cells(catalog.mystery('Common')));
  });

  it('caches one sprite per name and rarity', () => {
    expect(icon.iconFor('Something New', 'Epic')).toBe(icon.iconFor('Something New', 'Epic'));
    expect(icon.iconFor('Something New', 'Epic')).not.toBe(icon.iconFor('Something New', 'Rare'));
  });

  it('keeps the pawned good digests', () => {
    const got = RARITIES.map((r) => digest(cells(catalog.FAMILY_ART['Pawned Good'](r))));
    expect(got).toEqual(PAWNED_DIGESTS);
  });

  it('splits the pawned good into an unoutlined core and the outlined good', async () => {
    const families = await import('./sprites/families');
    for (const r of RARITIES) {
      expect(cells(families.pawnedCore(r).outline())).toEqual(cells(families.pawnedGood(r)));
      expect(digest(cells(families.pawnedGood(r)))).toBe(PAWNED_DIGESTS[RARITIES.indexOf(r)]);
    }
  });
});
