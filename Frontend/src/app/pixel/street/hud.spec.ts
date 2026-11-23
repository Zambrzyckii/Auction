import type { HudState } from './hud';
import type { LevelUpFx, Scene as SceneType } from './scene';

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
  let pix: typeof import('./pix');
  let scene: typeof import('./scene');

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    hud = await import('./hud');
    pix = await import('./pix');
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

  it('turns the frame and the kick line gold in the gold state', () => {
    const { R } = pix;
    const paper = hud.hudPaper(STATE, 2840, 0.31, 120, true);
    expect(paper.get(0, 0)).toBe(R.gold[3]);
    expect(paper.get(119, 39)).toBe(R.gold[3]);
    expect(hud.hudPaper(STATE, 2840, 0.31, 120).get(0, 0)).toBe(R.paper[3]);
    expect(hud.hudKey(STATE, 2840, 0.31, true)).not.toBe(hud.hudKey(STATE, 2840, 0.31));
  });

  describe('count-up', () => {
    let made: SceneType;
    let queued: FrameRequestCallback[];
    let observed: IntersectionObserverCallback;

    const makeScene = (reduced: boolean): SceneType => {
      vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          constructor(cb: IntersectionObserverCallback) {
            observed = cb;
          }
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

    describe('level up', () => {
      const FROM: HudState = { name: 'bob', cash: 2000, level: 3, share: 0.4, nextAt: 16000 };
      const FX: LevelUpFx = {
        from: FROM,
        hud: { ...FROM, cash: 3000, level: 4, share: 0.1, nextAt: 30000 },
        reward: 160,
        pending: 100,
        rain: 24,
        crowdStop: 4,
      };
      const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
      const labels = (scene: SceneType) => (scene as unknown as { hud: HudState | null }).hud;
      const hide = () =>
        observed(
          [{ isIntersecting: false } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );

      it('ends phase one before the pending reward and counts only that part in', async () => {
        let now = 1000;
        vi.stubGlobal('performance', { now: () => now });
        made = makeScene(false);
        made.setHud(FROM);
        made.playLevelUp(FX);

        now += 420;
        made.draw();
        expect(made.hudState()).toMatchObject({ cash: 2900, share: 1 });
        await settle();

        now += 900;
        made.draw();
        expect(made.hudState()).toEqual({ cash: 3000, share: 0.1, animating: false });
      });

      it('keeps the cash flat when nothing is pending', async () => {
        let now = 1000;
        vi.stubGlobal('performance', { now: () => now });
        made = makeScene(false);
        made.setHud(FROM);
        made.playLevelUp({ ...FX, hud: { ...FX.hud, cash: 2000 }, pending: 0 });

        now += 420;
        made.draw();
        expect(made.hudState().cash).toBe(2000);
        await settle();

        now += 900;
        made.draw();
        expect(made.hudState()).toEqual({ cash: 2000, share: 0.1, animating: false });
      });

      it('plays phase one on the old labels even after setHud of the new state', async () => {
        let now = 1000;
        vi.stubGlobal('performance', { now: () => now });
        made = makeScene(false);
        made.setHud(FROM);
        made.setHud(FX.hud);
        made.playLevelUp(FX);

        expect(labels(made)).toBe(FX.from);
        made.draw();
        expect(made.hudState().share).toBeCloseTo(FROM.share, 5);
        now += 420;
        made.draw();
        expect(labels(made)).toBe(FX.from);
        expect(made.hudState()).toMatchObject({ cash: 2900, share: 1 });
        await settle();

        now += 900;
        made.draw();
        expect(labels(made)).toBe(FX.hud);
        expect(made.hudState()).toEqual({ cash: 3000, share: 0.1, animating: false });
      });

      it('absorbs setHud of the new state while the sequence is pending', async () => {
        let now = 1000;
        vi.stubGlobal('performance', { now: () => now });
        made = makeScene(false);
        made.setHud(FROM);
        made.playLevelUp(FX);

        made.setHud(FX.hud);

        expect(labels(made)).toBe(FX.from);
        expect(made.hudState().animating).toBe(true);
        now += 420;
        made.draw();
        await settle();
        expect(labels(made)).toBe(FX.hud);
        made.setHud(FX.hud);
        now += 900;
        made.draw();
        expect(labels(made)).toBe(FX.hud);
        expect(made.hudState()).toEqual({ cash: 3000, share: 0.1, animating: false });
      });

      describe('while the scene is paused', () => {
        const EVENT = {
          at: 'auction',
          word: 'SOLD',
          amount: 4250,
          part: 'coin',
          coins: 20,
          bills: 5,
          spotlight: true,
        } as const;

        it('ignores play', () => {
          made = makeScene(false);
          hide();
          made.play(EVENT);

          expect(made.popups).toHaveLength(0);
          expect(made.parts).toHaveLength(0);
          expect(made.bills).toHaveLength(0);
        });

        it('snaps playLevelUp to the end state', () => {
          made = makeScene(false);
          made.setHud(FROM);
          hide();
          made.playLevelUp(FX);

          expect(labels(made)).toBe(FX.hud);
          expect(made.hudState()).toEqual({ cash: 3000, share: 0.1, animating: false });
          expect(made.popups).toHaveLength(0);
          expect(made.parts).toHaveLength(0);
        });

        it('still shows the plate under reduced motion', () => {
          made = makeScene(true);
          made.play(EVENT);

          expect(made.popups).toHaveLength(1);
        });
      });
    });
  });
});
