import type * as PixModule from './pix';

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

const BANK_RAMPS = {
  sodium: ['#4a2a10', '#8a4a14', '#d9822a', '#ffc070'],
  teal: ['#142426', '#1f3a3a', '#315a54', '#4f8072'],
  bile: ['#26261a', '#3a3b24', '#545532', '#767446'],
  cream: ['#5e4e3a', '#9c8862', '#cfbd90', '#efe2bc'],
  leather: ['#110e14', '#201a24', '#332a38', '#4a3e50'],
  gum: ['#5a1a3a', '#a03a6a', '#e070a0', '#ffb0d0'],
  coat: ['#261a14', '#45301f', '#664730', '#8c6843'],
  hoodie: ['#3e1c12', '#7a3416', '#b8581e', '#e88a3e'],
  moss: ['#1a2418', '#2c3c26', '#46603a', '#6e8a52'],
};

const EARLIER_RAMPS = [
  'brick',
  'mauve',
  'tan',
  'concrete',
  'asphalt',
  'steel',
  'rust',
  'sign',
  'taxi',
  'skinA',
  'skinB',
  'skinC',
  'denim',
  'red',
  'wood',
  'gold',
  'paper',
  'green',
  'purple',
  'plum',
  'olive',
  'white',
  'black',
  'glass',
  'lit',
  'hair',
  'blond',
  'grey',
];

describe('pixel toolkit ramps', () => {
  let pix: typeof PixModule;

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    pix = await import('./pix');
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it.each(Object.entries(BANK_RAMPS))('holds the %s ramp', (name, ramp) => {
    expect((pix.R as Record<string, readonly string[]>)[name]).toEqual(ramp);
  });

  it.each(Object.entries(BANK_RAMPS))('resolves every %s colour to its own index', (name, ramp) => {
    const own = (pix.R as Record<string, readonly string[]>)[name];
    ramp.forEach((colour, i) => {
      expect(pix.rampOf.get(colour)?.ramp).toBe(own);
      expect(pix.rampOf.get(colour)?.i).toBe(i);
    });
  });

  it('keeps the first ramp that claims a colour', () => {
    expect(pix.rampOf.get(pix.R.brick[0])?.ramp).toBe(pix.R.brick);
  });

  it.each(EARLIER_RAMPS)(
    'keeps every %s colour resolving to the ramp that claimed it first',
    (name) => {
      const ramps = pix.R as Record<string, readonly string[]>;
      ramps[name].forEach((colour, i) => {
        const owner = EARLIER_RAMPS.find((n) => ramps[n].includes(colour))!;
        const info = pix.rampOf.get(colour);
        expect(info?.ramp).toBe(ramps[owner]);
        expect(info?.i).toBe(ramps[owner].indexOf(colour));
        if (owner === name) expect(info?.i).toBe(i);
      });
    },
  );
});
