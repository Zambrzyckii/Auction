import type { HudState } from './hud';
import type { Scene as SceneType } from './scene';

const stubContext = () => ({
  measureText: (str: string) => ({ width: str.length * 5 }),
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

const looseContext = () =>
  new Proxy(stubContext() as Record<string | symbol, unknown>, {
    get: (t, prop) => (prop in t ? t[prop] : () => undefined),
    set: (t, prop, value) => {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

const STATE: HudState = { name: 'bob', cash: 500, level: 3, share: 0.4, nextAt: 16000 };

describe('street hud', () => {
  let hud: typeof import('./hud');
  let scene: typeof import('./scene');

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    hud = await import('./hud');
    scene = await import('./scene');
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('uppercases and trims the name to the paper width', () => {
    expect(hud.fitName('  bob ', 3, 200)).toBe('BOB');
    const fitted = hud.fitName('bartholomew the magnificent', 12, 120);
    expect(fitted).toMatch(/^BARTHOLOMEW/);
    expect(fitted.length).toBeLessThan('bartholomew the magnificent'.length);
    expect(`${fitted} - LV 12`.length * 5).toBeLessThanOrEqual(120);
  });

  it('builds the paper at the billboard size', () => {
    const paper = hud.hudPaper(STATE, 500, 0.4, 120);
    expect(paper.w).toBe(120);
    expect(paper.h).toBe(40);
  });

  describe('count-up', () => {
    let made: SceneType;
    let queued: FrameRequestCallback[];

    const makeScene = (reduced: boolean): SceneType => {
      vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          observe() {}
          disconnect() {}
        },
      );
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queued.push(cb));
      vi.stubGlobal('cancelAnimationFrame', () => {});
      const canvas = document.createElement('canvas');
      return new scene.Scene(canvas, { cssWidth: () => 640 });
    };

    beforeEach(() => {
      queued = [];
    });

    afterEach(() => {
      made?.destroy();
      vi.unstubAllGlobals();
    });

    it('snaps under reduced motion', () => {
      made = makeScene(true);
      made.setHud(STATE);
      made.setHud({ ...STATE, cash: 900, share: 0.7 });
      expect(made.hudState()).toEqual({ cash: 900, share: 0.7, animating: false });
    });

    it('counts up from the shown values and settles on the target', () => {
      let now = 1000;
      vi.stubGlobal('performance', { now: () => now });
      made = makeScene(false);
      made.setHud(STATE);
      expect(made.hudState().animating).toBe(false);
      made.setHud({ ...STATE, cash: 900, share: 0.7 });
      expect(made.hudState()).toMatchObject({ cash: 500, animating: true });
      now += 450;
      made.draw();
      const mid = made.hudState();
      expect(mid.cash).toBeGreaterThan(500);
      expect(mid.cash).toBeLessThan(900);
      now += 450;
      made.draw();
      expect(made.hudState()).toEqual({ cash: 900, share: 0.7, animating: false });
    });
  });
});
