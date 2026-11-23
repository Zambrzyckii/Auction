// The base of the three casino rooms: the shared canvas drawing, the ambient floor (neon
// flicker, marquee rings, slots, sparkles), chip fliers, plates and the loop that runs them.
// A room owns its loop. It starts on resume() or on the first call that needs motion and
// keeps stepping every frame until pause() or destroy(). Only the host decides when that is.
import type { FontKey } from '../street/pix';
import { Sprite, measure, text } from '../street/pix';
import { Slot, sparkle } from './floor';
import type { Painter } from './floor';
import type { NeonDef, RingDef, SlotDef } from './rooms';
import { bulbOn, chips, plate, stacksOf } from './sprites';
import type { PlateLine } from './sprites';

export const ART_W = 480;
export const ART_H = 200;
const MAX_SCALE = 4;
const PLATE_CLEAR_MS = 2800;

export interface RoomOpts {
  reduced?: boolean;
}
export interface RoomLayer {
  neon?: NeonDef[];
  rings?: RingDef[];
  sparkles?: [number, number][];
  slots?: SlotDef[];
}

type Img = CanvasImageSource & { width: number; height: number };
interface Face {
  open: HTMLCanvasElement;
  blink: HTMLCanvasElement;
  left: HTMLCanvasElement;
  right: HTMLCanvasElement;
}
interface PlateState {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  at: number;
  life: number;
}
interface Flier {
  key: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  dur: number;
  onEnd?: () => void;
}
interface Later {
  at: number;
  fn: () => void;
}
interface Burst {
  x: number;
  y: number;
  t0: number;
}
interface Spark {
  x: number;
  y: number;
  t0: number;
}

export const fmt = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
export const clamp = (v: number, a: number, z: number) => Math.max(a, Math.min(z, v));
export const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

export function faceOf(p: Face, t: number, period: number, reduced: boolean): HTMLCanvasElement {
  if (reduced) return p.open;
  const k = Math.floor(t * 2) % period;
  if (k === 0) return p.blink;
  if (k === 3) return p.left;
  if (k === period - 2) return p.right;
  return p.open;
}
export const flipX = (c: HTMLCanvasElement): HTMLCanvasElement => {
  const o = document.createElement('canvas');
  o.width = c.width;
  o.height = c.height;
  const g = o.getContext('2d')!;
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(c, 0, 0);
  return o;
};

// A walker crosses the room every `period` seconds, feet on `floorY`.
export function walkerAt(
  t: number,
  dir: number,
  floorY: number,
  period: number,
  offset: number,
): { x: number; y: number; frame: number } | null {
  const span = ART_W + 60,
    u = ((t + offset) % period) * 18;
  if (u > span) return null;
  const x = dir > 0 ? -30 + u : ART_W + 30 - u;
  return { x, y: floorY - 47, frame: Math.floor(t * 7) % 4 };
}

const texts = new Map<string, HTMLCanvasElement>();

export abstract class Room implements Painter {
  readonly ctx: CanvasRenderingContext2D;
  readonly reduced: boolean;
  t = 0;
  abstract readonly focusX: number;
  private scale = 1;
  private anims: Flier[] = [];
  private plateNow: PlateState | null = null;
  private plateTimer: ReturnType<typeof setTimeout> | undefined;
  private after: Later[] = [];
  private neon: (NeonDef & { off: number })[] = [];
  private rings: RingDef[] = [];
  private slots: Slot[] = [];
  private sparkPts: [number, number][] = [];
  private spark: Spark | null = null;
  private nextSpark = 0;
  private bursts: Burst[] = [];
  private raf = 0;
  private loopId = 0;
  private running = false;
  private isPaused = false;
  private live = true;

  constructor(
    protected readonly cv: HTMLCanvasElement,
    opts: RoomOpts = {},
  ) {
    this.reduced = opts.reduced ?? false;
    cv.width = ART_W;
    cv.height = ART_H;
    this.ctx = cv.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  get s(): number {
    return this.scale;
  }

  get size(): { scale: number; width: number; height: number } {
    return { scale: this.scale, width: ART_W * this.scale, height: ART_H * this.scale };
  }

  protected get paused(): boolean {
    return this.isPaused;
  }

  resize(cssWidth = ART_W * this.scale, maxHeight = Infinity): void {
    this.scale = clamp(
      Math.min(Math.floor(cssWidth / ART_W), Math.floor(maxHeight / ART_H)),
      1,
      MAX_SCALE,
    );
    this.cv.width = ART_W * this.scale;
    this.cv.height = ART_H * this.scale;
    this.cv.style.width = ART_W * this.scale + 'px';
    this.cv.style.height = ART_H * this.scale + 'px';
    this.ctx.imageSmoothingEnabled = false;
    this.draw();
  }

  // ----- loop -----
  protected kick(): void {
    if (this.reduced || this.running || this.isPaused || !this.live) return;
    this.running = true;
    const id = ++this.loopId;
    let last = performance.now();
    const frame = (ts: number) => {
      if (!this.running || id !== this.loopId) return;
      const dt = clamp((ts - last) / 1000, 0, 0.1);
      last = ts;
      this.step(dt);
      if (this.running && id === this.loopId) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  protected kickDraw(): void {
    if (this.reduced || this.isPaused) this.draw();
    else this.kick();
  }

  private stopLoop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  pause(): void {
    if (this.isPaused || !this.live) return;
    this.isPaused = true;
    this.stopLoop();
    const due = this.after.splice(0).sort((a, b) => a.at - b.at);
    for (const a of due) a.fn();
    const fliers = this.anims.splice(0);
    for (const a of fliers) if (a.onEnd) a.onEnd();
    this.bursts = [];
    this.finishAll();
    this.draw();
  }

  resume(): void {
    if (!this.live) return;
    this.isPaused = false;
    if (this.reduced || this.running) this.draw();
    else this.kick();
  }

  destroy(): void {
    this.live = false;
    this.stopLoop();
    clearTimeout(this.plateTimer);
    this.after = [];
    this.anims = [];
    this.bursts = [];
  }

  protected abstract draw(): void;
  protected stepRoom(_dt: number): void {}
  protected finishAll(): void {}

  private step(dt: number): void {
    this.stepShared(dt);
    this.stepAmbient(dt);
    this.stepRoom(dt);
    this.draw();
  }

  // ----- drawing -----
  img(c: Img, x: number, y: number): void {
    const S = this.scale;
    this.ctx.drawImage(c, Math.round(x) * S, Math.round(y) * S, c.width * S, c.height * S);
  }

  imgF(c: Img, x: number, y: number): void {
    const S = this.scale;
    this.ctx.drawImage(c, Math.round(x * S), Math.round(y * S), c.width * S, c.height * S);
  }

  text(str: string, x: number, y: number, col: string, font: FontKey = 'tiny'): void {
    const key = font + '|' + col + '|' + str;
    let cached = texts.get(key);
    if (!cached) {
      const w = measure(str, font) + 2,
        hpx = font === 'jersey' ? 26 : 12;
      const sp = new Sprite(w, hpx);
      text(sp, str, 1, 1, col, font, { alignTop: true });
      if (texts.size > 300) texts.clear();
      cached = sp.canvas();
      texts.set(key, cached);
    }
    this.img(cached, x, y);
  }

  setPlate(lines: readonly PlateLine[], x: number, y: number, life = 2.2): void {
    if (!this.live) return;
    this.plateNow = { img: plate(lines), x, y, at: this.t, life };
    if (this.reduced) {
      clearTimeout(this.plateTimer);
      this.plateTimer = setTimeout(() => {
        this.plateNow = null;
        this.draw();
      }, PLATE_CLEAR_MS);
    }
    this.kickDraw();
  }

  protected drawPlate(): void {
    if (!this.plateNow) return;
    const S = this.scale;
    const p = this.plateNow,
      age = this.t - p.at;
    if (!this.reduced && age > p.life) {
      this.plateNow = null;
      return;
    }
    const k = this.reduced ? 1 : clamp(age / 0.12, 0, 1);
    const w = p.img.width * (0.6 + 0.4 * k),
      h = p.img.height * (0.6 + 0.4 * k);
    const x = clamp(p.x - w / 2, 2, ART_W - w - 2),
      y = clamp(p.y - h, 2, ART_H - h - 2);
    this.ctx.drawImage(
      p.img,
      Math.round(x * S),
      Math.round(y * S),
      Math.round(w * S),
      Math.round(h * S),
    );
  }

  fly(
    key: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    dur: number,
    onEnd?: () => void,
    delay = 0,
  ): void {
    if (!this.live) return;
    if (this.reduced || this.isPaused) {
      if (onEnd) onEnd();
      this.kickDraw();
      return;
    }
    this.anims.push({ key, x0, y0, x1, y1, t0: this.t + delay, dur, onEnd });
    this.kick();
  }

  schedule(delay: number, fn: () => void): void {
    if (!this.live) return;
    if (this.reduced || this.isPaused) {
      fn();
      this.draw();
      return;
    }
    this.after.push({ at: this.t + delay, fn });
    this.kick();
  }

  burst(x: number, y: number, n = 10, spread = 26): void {
    if (this.reduced || this.isPaused || !this.live) return;
    for (let i = 0; i < n; i++)
      this.bursts.push({
        x: x + (Math.random() - 0.5) * spread * 2,
        y: y + (Math.random() - 0.5) * spread,
        t0: this.t + i * 0.07,
      });
  }

  private stepShared(dt: number): void {
    this.t += dt;
    for (const a of this.after.splice(0).filter((a) => {
      if (this.t >= a.at) {
        a.fn();
        return false;
      }
      return true;
    }))
      this.after.push(a);
    const alive: Flier[] = [],
      ended: Flier[] = [];
    for (const a of this.anims) (this.t - a.t0 < a.dur ? alive : ended).push(a);
    this.anims = alive;
    for (const a of ended) if (a.onEnd) a.onEnd();
    this.bursts = this.bursts.filter((b) => this.t - b.t0 < 0.5);
  }

  useRoom(layer: RoomLayer): void {
    this.neon = (layer.neon || []).map((n) => ({ ...n, off: 0 }));
    this.rings = layer.rings || [];
    this.sparkPts = layer.sparkles || [];
    this.slots = (layer.slots || []).map(
      (o) => new Slot(o.x, o.y, o.ramp, o.label, o.seed, { player: o.player }),
    );
  }

  private stepAmbient(dt: number): void {
    for (const n of this.neon) {
      if (n.off > 0) n.off -= dt;
      else if (Math.random() < n.flick * dt * 4) n.off = 0.05 + Math.random() * 0.12;
    }
    for (const sl of this.slots) sl.step(dt);
    if (this.t > this.nextSpark && this.sparkPts.length) {
      const p = this.sparkPts[Math.floor(Math.random() * this.sparkPts.length)];
      this.spark = { x: p[0], y: p[1], t0: this.t };
      this.nextSpark = this.t + 0.3 + Math.random() * 0.5;
    }
  }

  protected drawNeon(): void {
    for (const n of this.neon) if (this.reduced || n.off <= 0) this.img(n.sign.on, n.x, n.y);
  }

  protected drawRings(): void {
    for (const r of this.rings) {
      const phase = this.reduced ? 0 : Math.floor(this.t * r.speed);
      const mod = r.mode === 'chase2' ? 2 : 3;
      r.pts.forEach(([x, y], i) => {
        if ((i + phase) % mod === 0) this.img(bulbOn, x - 2, y - 2);
      });
    }
  }

  protected drawSlots(): void {
    for (const sl of this.slots) sl.draw(this);
  }

  protected drawSparkles(): void {
    if (this.reduced) return;
    if (
      this.spark &&
      this.t - this.spark.t0 < 0.4 &&
      Math.floor((this.t - this.spark.t0) * 10) % 2 === 0
    )
      this.img(sparkle, this.spark.x - 2, this.spark.y - 2);
    for (const b of this.bursts)
      if (this.t >= b.t0 && Math.floor((this.t - b.t0) * 12) % 2 === 0)
        this.imgF(sparkle, b.x - 2.5, b.y - 2.5);
  }

  protected drawFliers(): void {
    for (const a of this.anims) {
      if (this.t < a.t0) continue;
      const k = clamp((this.t - a.t0) / a.dur, 0, 1),
        e = easeOut(k);
      const x = a.x0 + (a.x1 - a.x0) * e,
        y = a.y0 + (a.y1 - a.y0) * e - Math.sin(k * Math.PI) * 14;
      this.imgF(chips.flat[a.key], x - 4.5, y - 4.5);
    }
  }

  stacks(balance: number, x: number, baseY: number, gap = 14): void {
    stacksOf(balance).forEach((st, i) => {
      for (let n = 0; n < st.n; n++) this.img(chips.side[st.key], x + i * gap, baseY - n * 2);
    });
  }
}
