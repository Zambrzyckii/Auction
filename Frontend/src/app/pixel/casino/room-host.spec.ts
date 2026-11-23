import type { Mock } from 'vitest';
import { prefersReducedMotion, RoomDeps, RoomHandle, RoomHost, roomDeps } from './room-host';

class FakeHandle implements RoomHandle {
  focusX = 240;
  size = { scale: 2, width: 960, height: 400 };
  resize = vi.fn();
  pause = vi.fn();
  resume = vi.fn();
  destroy = vi.fn();
}

class FakeResizeObserver {
  static last: FakeResizeObserver | undefined;
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: () => void) {
    FakeResizeObserver.last = this;
  }
}

class FakeIntersectionObserver {
  static last: FakeIntersectionObserver | undefined;
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: (entries: { isIntersecting: boolean }[]) => void) {
    FakeIntersectionObserver.last = this;
  }
}

describe('RoomHost', () => {
  let frame: HTMLElement;
  let canvas: HTMLCanvasElement;
  let handle: FakeHandle;
  let canRun: boolean;
  let onVisible: Mock<(visible: boolean) => void>;
  let host: RoomHost<{ reduced: boolean }, FakeHandle>;

  const deps = (): RoomDeps<{ reduced: boolean }, FakeHandle> => ({
    canRun: () => canRun,
    fontsReady: () => Promise.resolve(),
    loadScene: () => Promise.resolve(() => handle),
  });

  beforeEach(() => {
    FakeResizeObserver.last = undefined;
    FakeIntersectionObserver.last = undefined;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('innerHeight', 900);
    frame = document.createElement('div');
    canvas = document.createElement('canvas');
    Object.defineProperty(frame, 'clientWidth', { value: 600, configurable: true });
    handle = new FakeHandle();
    canRun = true;
    onVisible = vi.fn<(visible: boolean) => void>();
    host = new RoomHost({ frame: () => frame, canvas: () => canvas, deps: deps(), onVisible });
  });

  afterEach(() => {
    host.stop();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves null and wires nothing when the scene cannot run', async () => {
    canRun = false;
    const add = vi.spyOn(window, 'addEventListener');
    const room = await host.start({ reduced: false });
    expect(room).toBeNull();
    expect(FakeResizeObserver.last).toBeUndefined();
    expect(add).not.toHaveBeenCalled();
  });

  it('fits to the frame width and half the window height', async () => {
    const room = await host.start({ reduced: false });
    expect(room).toBe(handle);
    expect(handle.resize).toHaveBeenCalledWith(600, 450);
    expect(FakeResizeObserver.last!.observe).toHaveBeenCalledWith(frame);
    expect(FakeIntersectionObserver.last!.observe).toHaveBeenCalledWith(canvas);
  });

  it('refits on a frame resize and on a window resize', async () => {
    await host.start({ reduced: false });
    handle.resize.mockClear();
    FakeResizeObserver.last!.callback();
    window.dispatchEvent(new Event('resize'));
    expect(handle.resize).toHaveBeenCalledTimes(2);
  });

  it('pauses and resumes with the intersection and reports it', async () => {
    await host.start({ reduced: false });
    FakeIntersectionObserver.last!.callback([{ isIntersecting: false }]);
    expect(handle.pause).toHaveBeenCalledTimes(1);
    expect(onVisible).toHaveBeenLastCalledWith(false);
    expect(host.visible).toBe(false);
    FakeIntersectionObserver.last!.callback([{ isIntersecting: true }]);
    expect(handle.resume).toHaveBeenCalledTimes(1);
    expect(onVisible).toHaveBeenLastCalledWith(true);
    expect(host.visible).toBe(true);
  });

  it('treats a hidden document as not visible', async () => {
    await host.start({ reduced: false });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(host.visible).toBe(false);
    expect(handle.pause).toHaveBeenCalledTimes(1);
    expect(onVisible).toHaveBeenLastCalledWith(false);
  });

  it('stays hidden when the canvas scrolls back while the document is hidden', async () => {
    await host.start({ reduced: false });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    FakeIntersectionObserver.last!.callback([{ isIntersecting: true }]);
    expect(host.visible).toBe(false);
    expect(handle.resume).not.toHaveBeenCalled();
  });

  it('stop disconnects both observers, removes the listeners and destroys the room', async () => {
    await host.start({ reduced: false });
    handle.resize.mockClear();
    host.stop();
    expect(FakeResizeObserver.last!.disconnect).toHaveBeenCalled();
    expect(FakeIntersectionObserver.last!.disconnect).toHaveBeenCalled();
    expect(handle.destroy).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('resize'));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(handle.resize).not.toHaveBeenCalled();
    expect(handle.pause).not.toHaveBeenCalled();
  });

  it('destroys a room that boots after stop', async () => {
    const pending = host.start({ reduced: false });
    host.stop();
    expect(await pending).toBeNull();
    expect(FakeResizeObserver.last).toBeUndefined();
  });

  it('centres focusX in the frame when the canvas is wider than the frame', async () => {
    await host.start({ reduced: false });
    expect(frame.scrollLeft).toBe(240 * 2 - 600 / 2);
  });

  it('clamps the scroll at zero', async () => {
    handle.focusX = 50;
    await host.start({ reduced: false });
    expect(frame.scrollLeft).toBe(0);
  });

  it('leaves the scroll alone when the canvas fits', async () => {
    handle.size = { scale: 1, width: 480, height: 200 };
    frame.scrollLeft = 7;
    await host.start({ reduced: false });
    expect(frame.scrollLeft).toBe(7);
  });
});

describe('roomDeps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses to run without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const deps = roomDeps<unknown, FakeHandle>(() => Promise.reject(new Error('never loaded')));
    expect(deps.canRun(document.createElement('canvas'))).toBe(false);
  });

  it('refuses to run in jsdom, which has no canvas context', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const deps = roomDeps<unknown, FakeHandle>(() => Promise.reject(new Error('never loaded')));
    expect(deps.canRun(document.createElement('canvas'))).toBe(false);
  });

  it('passes the loader through', async () => {
    const factory = () => new FakeHandle();
    const deps = roomDeps(() => Promise.resolve(factory));
    expect(await deps.loadScene()).toBe(factory);
  });
});

describe('prefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('follows the media query', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(prefersReducedMotion()).toBe(true);
  });
});
