import { fontsReady } from '../street/fonts';
import { bootStreet, canRunScene, SceneHandle, StreetBootDeps } from '../street/street-boot';

const HEIGHT_SHARE = 0.5;

export interface RoomHandle {
  resize(cssWidth?: number, maxHeight?: number): void;
  readonly size: { scale: number; width: number; height: number };
  readonly focusX: number;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export type RoomDeps<O, H extends RoomHandle> = StreetBootDeps<O, H & SceneHandle>;

export function roomDeps<O, H extends RoomHandle>(
  load: () => Promise<(canvas: HTMLCanvasElement, opts: O) => H>,
): RoomDeps<O, H> {
  return {
    canRun: (canvas) => typeof ResizeObserver === 'function' && canRunScene(window, canvas),
    fontsReady: () => fontsReady(document.fonts),
    loadScene: load as RoomDeps<O, H>['loadScene'],
  };
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class RoomHost<O, H extends RoomHandle> {
  private room: H | null = null;
  private alive = true;
  private intersecting = true;
  private shown = true;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private readonly onWindowResize = () => this.fit();
  private readonly onVisibilityChange = () => this.sync();

  constructor(
    private readonly parts: {
      frame: () => HTMLElement;
      canvas: () => HTMLCanvasElement;
      deps: RoomDeps<O, H>;
      onVisible?: (visible: boolean) => void;
    },
  ) {}

  get visible(): boolean {
    return this.intersecting && !document.hidden;
  }

  async start(opts: O): Promise<H | null> {
    const canvas = this.parts.canvas();
    const room = await bootStreet(canvas, opts, this.parts.deps, () => this.alive);
    if (!room) return null;
    if (!this.alive) {
      room.destroy();
      return null;
    }
    this.room = room;
    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(this.parts.frame());
    window.addEventListener('resize', this.onWindowResize);
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      this.intersecting = entry.isIntersecting;
      this.sync();
    });
    this.intersectionObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.fit();
    this.sync();
    return room;
  }

  stop(): void {
    this.alive = false;
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.room?.destroy();
    this.room = null;
  }

  private fit(): void {
    const room = this.room;
    if (!room) return;
    const frame = this.parts.frame();
    room.resize(frame.clientWidth, Math.round(innerHeight * HEIGHT_SHARE));
    const { scale, width } = room.size;
    if (width > frame.clientWidth) {
      frame.scrollLeft = Math.max(0, room.focusX * scale - frame.clientWidth / 2);
    }
  }

  private sync(): void {
    const room = this.room;
    const now = this.visible;
    if (!room || now === this.shown) return;
    this.shown = now;
    if (now) room.resume();
    else room.pause();
    this.parts.onVisible?.(now);
  }
}
