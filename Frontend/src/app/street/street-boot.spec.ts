import { SCENE_FONTS, fontsReady } from './fonts';
import { bootStreet, canRunScene, SceneFactory, SceneHandle, StreetBootDeps } from './street-boot';

function canvasWith(context: unknown): {
  canvas: HTMLCanvasElement;
  getContext: ReturnType<typeof vi.fn>;
} {
  const getContext = vi.fn().mockReturnValue(context);
  return { canvas: { getContext } as unknown as HTMLCanvasElement, getContext };
}

function windowWith(parts: { matchMedia?: boolean; intersectionObserver?: boolean }): Window {
  const win: Record<string, unknown> = {};
  if (parts.matchMedia) win['matchMedia'] = () => null;
  if (parts.intersectionObserver) win['IntersectionObserver'] = function () {};
  return win as unknown as Window;
}

describe('canRunScene', () => {
  it('refuses without matchMedia and never asks the canvas for a context', () => {
    const { canvas, getContext } = canvasWith({});
    expect(canRunScene(windowWith({ intersectionObserver: true }), canvas)).toBe(false);
    expect(getContext).not.toHaveBeenCalled();
  });

  it('refuses without IntersectionObserver and never asks the canvas for a context', () => {
    const { canvas, getContext } = canvasWith({});
    expect(canRunScene(windowWith({ matchMedia: true }), canvas)).toBe(false);
    expect(getContext).not.toHaveBeenCalled();
  });

  it('refuses when the canvas has no 2d context', () => {
    const { canvas, getContext } = canvasWith(null);
    expect(canRunScene(windowWith({ matchMedia: true, intersectionObserver: true }), canvas)).toBe(
      false,
    );
    expect(getContext).toHaveBeenCalledWith('2d');
  });

  it('accepts when the browser has all three', () => {
    const { canvas } = canvasWith({});
    expect(canRunScene(windowWith({ matchMedia: true, intersectionObserver: true }), canvas)).toBe(
      true,
    );
  });
});

describe('bootStreet', () => {
  const canvas = {} as HTMLCanvasElement;
  const opts = { interactive: true };
  const handle: SceneHandle = { resize: vi.fn(), destroy: vi.fn() };

  function depsWith(overrides: Partial<StreetBootDeps> = {}): StreetBootDeps {
    return {
      canRun: vi.fn().mockReturnValue(true),
      fontsReady: vi.fn().mockResolvedValue(undefined),
      loadScene: vi.fn().mockResolvedValue(vi.fn().mockReturnValue(handle)),
      ...overrides,
    };
  }

  it('stops before the fonts when the scene cannot run', async () => {
    const deps = depsWith({ canRun: vi.fn().mockReturnValue(false) });
    expect(await bootStreet(canvas, opts, deps, () => true)).toBeNull();
    expect(deps.fontsReady).not.toHaveBeenCalled();
  });

  it('stops before loading the scene when the page leaves during the font wait', async () => {
    let alive = true;
    const deps = depsWith({
      fontsReady: vi.fn().mockImplementation(async () => {
        alive = false;
      }),
    });
    expect(await bootStreet(canvas, opts, deps, () => alive)).toBeNull();
    expect(deps.loadScene).not.toHaveBeenCalled();
  });

  it('stops before creating the scene when the page leaves during the load', async () => {
    let alive = true;
    const factory = vi.fn<SceneFactory>();
    const deps = depsWith({
      loadScene: vi.fn().mockImplementation(async () => {
        alive = false;
        return factory;
      }),
    });
    expect(await bootStreet(canvas, opts, deps, () => alive)).toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });

  it('starts no scene when the scene chunk fails to load', async () => {
    const factory = vi.fn<SceneFactory>();
    const deps = depsWith({ loadScene: vi.fn().mockRejectedValue(new Error('chunk failed')) });
    expect(await bootStreet(canvas, opts, deps, () => true)).toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });

  it('creates the scene with the canvas and the options', async () => {
    const factory = vi.fn<SceneFactory>().mockReturnValue(handle);
    const deps = depsWith({ loadScene: vi.fn().mockResolvedValue(factory) });
    expect(await bootStreet(canvas, opts, deps, () => true)).toBe(handle);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith(canvas, opts);
  });
});

describe('fontsReady', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for every scene font', async () => {
    const load = vi.fn().mockResolvedValue([]);
    await fontsReady({ load } as unknown as FontFaceSet);
    expect(load.mock.calls.map((call) => call[0])).toEqual([...SCENE_FONTS]);
  });

  it('resolves when a font fails to load', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(new Error('font failed'));
    await expect(fontsReady({ load } as unknown as FontFaceSet)).resolves.toBeUndefined();
  });

  it('gives up after the time limit', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockReturnValue(new Promise(() => {}));
    let settled = false;
    const pending = fontsReady({ load } as unknown as FontFaceSet).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(3999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toBe(true);
  });
});
