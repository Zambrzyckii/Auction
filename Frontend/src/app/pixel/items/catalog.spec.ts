import type { Sprite } from '../street/pix';
import { RARITIES } from './rarity';

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

  it('has 115 names, 112 from the bots and 3 starters', () => {
    expect(names.BOT_NAMES).toHaveLength(112);
    expect(names.STARTER_NAMES).toHaveLength(3);
    expect(names.NAMES).toHaveLength(115);
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
});
