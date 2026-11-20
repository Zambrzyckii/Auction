// The workshop press: one canvas, drawn at art resolution with the app's pix.ts and scaled by whole numbers.
// The host feeds it the belt (setBench), the green lamp (setReady) and the craft outcome (start, succeed, fail).
import { INK, R, Sprite, box, cylH, cylV, disc, text } from '../street/pix';
import type { SceneHandle } from '../street/street-boot';
import { iconFor } from '../items/item-icon';
import { rarityOf } from '../items/rarity';
import { nextRarity } from './craft-watch';

export interface BenchItem {
  readonly id: string;
  readonly name: string;
  readonly rarity: string;
}
export interface SceneOpts {
  readonly reduced?: boolean;
  readonly onImpact?: () => void;
  readonly onReveal?: () => void;
  readonly onFail?: () => void;
}
export interface SceneRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const G = 240;
const H = 112;
const SLOT_X = [22, 58, 94];
const PLATE_X = 152;
const CRATE_X = 213;
const REST_Y = 38;
const PLATE_Y = 40;
const CRATE_Y = 30;
const HEAD_UP = 24;
const HEAD_DOWN = 60;
const GLOW: Record<string, readonly [string, string, string]> = {
  Common: ['#5e5b68', '#a39aa3', '#f6f3f6'],
  Rare: ['#2b3a66', '#6f9ee8', '#d8e6ff'],
  Epic: ['#3e2a5c', '#b98ae8', '#f3e2ff'],
  Legendary: ['#a06a14', '#f5b52e', '#fff3b8'],
};
const ROD = [INK, R.steel[3], R.steel[2], R.steel[2], R.steel[1], INK];

type Mode = 'idle' | 'run' | 'press' | 'reveal' | 'shown' | 'jam';
interface Piece {
  id: string;
  img: HTMLCanvasElement;
  x: number;
  y: number;
  sx: number;
  sy: number;
  a: number;
}
interface Tween {
  t0: number;
  dur: number;
  fn: (k: number) => void;
  done?: () => void;
}
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  age: number;
  col: string;
  size: number;
  kind: 'spark' | 'dust' | 'smoke' | 'bit';
}

const easeIn = (k: number) => k * k;
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const art = new Map<string, HTMLCanvasElement>();
function spriteOf(name: string, rarity: string): HTMLCanvasElement {
  const key = name + '|' + rarity;
  let c = art.get(key);
  if (!c) {
    c = iconFor(name, rarityOf(rarity)).canvas();
    art.set(key, c);
  }
  return c;
}

function hazard(s: Sprite, x: number, y: number, w: number, h: number) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      s.set(x + i, y + j, (x + i + y + j) % 6 < 3 ? R.taxi[2] : R.black[1]);
}

function pressSprite(): Sprite {
  const s = new Sprite(G, H);
  cylV(s, 126, 12, 6, 68, R.steel);
  cylV(s, 172, 12, 6, 68, R.steel);
  box(s, 122, 3, 62, 10, R.steel);
  hazard(s, 124, 9, 58, 2);
  for (const bx of [125, 180]) s.set(bx, 5, R.steel[3]);
  cylV(s, 144, 13, 18, 10, R.red);
  s.hline(144, 13, 18, R.red[3]);
  s.hline(144, 22, 18, R.red[0]);
  box(s, 132, 72, 40, 8, R.steel);
  s.hline(133, 72, 38, R.steel[3]);
  for (let i = 0; i < 3; i++) s.rect(119, 27 + i * 6, 4, 4, R.black[1]);
  s.rect(178, 26, 4, 2, R.steel[1]);
  disc(s, 187, 30, 6.5, R.paper[3]);
  disc(s, 187, 30, 1.5, R.black[1]);
  for (const [tx, ty] of [
    [182, 30],
    [184, 26],
    [187, 25],
    [190, 26],
    [192, 30],
  ] as const)
    s.set(tx, ty, R.black[2]);
  s.set(191, 28, R.red[2]);
  s.set(192, 29, R.red[2]);
  return s.outline();
}

function beltSprite(): Sprite {
  const s = new Sprite(G, H);
  s.hline(2, 70, 119, R.black[3]);
  for (let y = 71; y <= 76; y++) s.hline(2, y, 119, R.black[1]);
  for (let y = 77; y <= 78; y++) s.hline(2, y, 119, R.black[0]);
  s.hline(2, 79, 119, R.steel[1]);
  for (const cx of [8, 114]) {
    disc(s, cx, 74, 4.5, R.steel[1]);
    disc(s, cx, 74, 2, R.steel[3]);
    s.set(cx, 74, R.steel[0]);
  }
  for (const sx of SLOT_X) {
    for (const ex of [sx - 15, sx - 14, sx + 13, sx + 14]) s.set(ex, 79, R.taxi[2]);
  }
  return s.outline();
}

function crateSprite(): Sprite {
  const s = new Sprite(G, H);
  box(s, 196, 62, 34, 18, R.wood);
  s.hline(197, 67, 32, R.wood[1]);
  s.hline(197, 73, 32, R.wood[1]);
  s.vline(198, 63, 16, R.wood[0]);
  s.vline(227, 63, 16, R.wood[0]);
  for (let i = 0; i < 12; i++) s.set(200 + i * 2, 64 + (i % 6), R.wood[1]);
  return s.outline();
}

function headCanvas(): HTMLCanvasElement {
  const s = new Sprite(38, 14);
  box(s, 1, 0, 36, 12, R.steel);
  hazard(s, 2, 7, 34, 3);
  s.hline(1, 11, 36, R.steel[0]);
  return s.outline().canvas();
}

function shadeColour(i: number): string {
  if (i === 0) return R.green[2];
  if (i === 3) return R.green[0];
  return R.green[1];
}

function wall(s: Sprite, w: number) {
  for (let y = 0; y < 80; y++)
    for (let x = 0; x < w; x++) {
      const off = (Math.floor(y / 8) % 2) * 8;
      const bx = (x + off) % 16;
      const by = y % 8;
      let c = R.asphalt[2];
      if (by === 7 || bx === 15) c = R.asphalt[1];
      else if (by === 0) c = R.asphalt[3];
      else if ((x * 7 + y * 13) % 31 === 0) c = R.asphalt[1];
      s.set(x, y, c);
    }
  for (let x = 0; x < w; x++)
    for (let y = 74; y < 80; y++) if ((x + y) % 2 === 0 || y > 77) s.set(x, y, R.asphalt[1]);
}

function bench(s: Sprite, w: number) {
  s.hline(0, 80, w, R.wood[3]);
  s.hline(0, 81, w, R.wood[2]);
  s.hline(0, 82, w, R.wood[2]);
  s.hline(0, 83, w, R.wood[0]);
  for (let y = 84; y < H; y++)
    for (let x = 0; x < w; x++) s.set(x, y, (x + y) % 2 === 0 && y > 100 ? R.wood[0] : R.wood[1]);
  for (let x = 20; x < w; x += 44) s.vline(x, 84, H - 84, R.wood[0]);
  for (let x = 9; x < w; x += 37) s.set(x, 92 + (x % 9), R.wood[0]);
}

function pegboard(s: Sprite, x: number, y: number) {
  const b = new Sprite(74, 48);
  box(b, 1, 1, 72, 46, R.tan);
  for (let j = 4; j < 46; j += 5) for (let i = 4; i < 72; i += 5) b.set(i, j, R.tan[0]);
  b.outline();
  s.stamp(b, x, y);
  s.stamp(iconFor('Rusty Hand Saw', 'Common'), x + 3, y + 6);
  s.stamp(iconFor('Bent Nail Puller', 'Common'), x + 38, y + 8);
}

function shelf(s: Sprite, x: number, y: number) {
  const b = new Sprite(76, 8);
  box(b, 1, 1, 74, 3, R.wood);
  b.vline(6, 4, 3, R.steel[1]);
  b.vline(68, 4, 3, R.steel[1]);
  b.outline();
  s.stamp(iconFor('Dented Oil Can', 'Common'), x + 2, y - 30);
  s.stamp(iconFor('Jar of Loose Screws', 'Common'), x + 38, y - 30);
  s.stamp(b, x, y);
}

function poster(s: Sprite, x: number, y: number) {
  const p = new Sprite(58, 42);
  box(p, 1, 1, 56, 40, R.paper);
  text(p, 'NO', 6, 14, R.red[2], 'tiny');
  text(p, 'REFUNDS', 6, 24, R.red[2], 'tiny');
  text(p, 'CASH ONLY', 6, 35, R.black[2], 'tiny');
  p.set(28, 2, R.red[1]);
  p.outline();
  s.stamp(p, x, y);
}

function windowPane(s: Sprite, x: number, y: number) {
  const p = new Sprite(66, 44);
  box(p, 1, 1, 64, 42, R.steel);
  for (let j = 4; j < 40; j++)
    for (let i = 4; i < 62; i++) p.set(i, j, j < 28 ? R.glass[1] : R.glass[0]);
  for (const [bx, bh] of [
    [6, 14],
    [16, 20],
    [28, 11],
    [38, 17],
    [50, 13],
  ] as const)
    for (let j = 40 - bh; j < 40; j++) for (let i = bx; i < bx + 8; i++) p.set(i, j, R.black[1]);
  for (const [lx, ly] of [
    [8, 30],
    [18, 24],
    [20, 30],
    [40, 28],
    [52, 32],
    [30, 34],
  ] as const)
    p.set(lx, ly, R.lit[2]);
  p.vline(33, 4, 36, R.steel[1]);
  p.hline(4, 21, 58, R.steel[1]);
  for (let i = 0; i < 10; i++) p.set(8 + i, 6 + i, R.glass[3]);
  p.outline();
  s.stamp(p, x, y);
}

export class WorkshopScene implements SceneHandle {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly buf = document.createElement('canvas');
  private readonly b: CanvasRenderingContext2D;
  private readonly head = headCanvas();
  private readonly layers = {
    press: pressSprite().canvas(),
    belt: beltSprite().canvas(),
    crate: crateSprite().canvas(),
  };
  private bg: HTMLCanvasElement | null = null;
  private scale = 1;
  private cw = G;
  private cssWidth = G;
  private maxHeight = Infinity;
  private gx = 0;
  private now = 0;
  private last = 0;
  private mode: Mode = 'idle';
  private pieces: Piece[] = [];
  private bench: BenchItem[] = [];
  private tweens: Tween[] = [];
  private parts: Part[] = [];
  private headY = HEAD_UP;
  private flash = 0;
  private shake = 0;
  private shakeUntil = 0;
  private belt = 0;
  private beltOn = false;
  private ready = false;
  private glow = 'Rare';
  private needle = -2.1;
  private lamp = 1;
  private result: {
    img: HTMLCanvasElement;
    x: number;
    y: number;
    s: number;
    a: number;
    rarity: string;
  } | null = null;
  private rays = 0;
  private raysA = 0;
  private pressedAt = 0;
  private queued: { kind: 'ok'; item: BenchItem } | { kind: 'fail' } | null = null;
  private raf = 0;
  private live = true;
  private running = false;

  constructor(
    private readonly cv: HTMLCanvasElement,
    private readonly opts: SceneOpts = {},
  ) {
    this.ctx = cv.getContext('2d')!;
    this.b = this.buf.getContext('2d')!;
  }

  resize(cssWidth = this.cssWidth, maxHeight = this.maxHeight): void {
    this.cssWidth = cssWidth;
    this.maxHeight = maxHeight;
    const scale = Math.max(1, Math.min(3, Math.floor(cssWidth / 300), Math.floor(maxHeight / H)));
    const cw = Math.max(G, Math.floor(cssWidth / scale));
    if (scale === this.scale && cw === this.cw && this.bg) return;
    this.scale = scale;
    this.cw = cw;
    this.gx = Math.floor((cw - G) / 2);
    this.buf.width = cw;
    this.buf.height = H;
    this.cv.width = cw * scale;
    this.cv.height = H * scale;
    this.cv.style.width = cw * scale + 'px';
    this.cv.style.height = H * scale + 'px';
    this.bg = this.paintBg();
    this.draw();
  }

  get size(): { scale: number; width: number; height: number } {
    return { scale: this.scale, width: this.cw * this.scale, height: H * this.scale };
  }
  slot(i: number): SceneRect {
    const s = this.scale;
    return { x: (this.gx + SLOT_X[i] - 17) * s, y: 34 * s, w: 34 * s, h: 36 * s };
  }
  anchor(what: 'press' | 'crate'): { x: number; y: number } {
    const s = this.scale;
    return what === 'press'
      ? { x: (this.gx + PLATE_X) * s, y: 46 * s }
      : { x: (this.gx + CRATE_X) * s, y: 22 * s };
  }

  setReady(on: boolean): void {
    this.ready = on;
  }

  setBench(list: readonly BenchItem[]): void {
    this.bench = list.slice(0, 3);
    if (
      this.mode === 'run' ||
      this.mode === 'press' ||
      this.mode === 'reveal' ||
      this.mode === 'jam'
    )
      return;
    if (this.mode === 'shown' && list.length > 0) this.clearResult();
    this.syncPieces();
  }

  start(): void {
    if (this.mode === 'run' || this.mode === 'press') return;
    this.clearResult();
    this.glow = nextRarity(this.bench[0]?.rarity ?? 'Common');
    spriteOf(`Crafted ${this.glow} Item`, this.glow);
    this.mode = 'run';
    this.queued = null;
    if (this.opts.reduced) {
      this.pieces = [];
      this.headY = HEAD_DOWN;
      this.mode = 'press';
      this.pressedAt = this.now - 1000;
      this.opts.onImpact?.();
      return;
    }
    this.beltOn = true;
    this.pieces.forEach((p, i) => {
      const x0 = p.x;
      this.tween(
        70,
        (k) => {
          p.y = REST_Y - Math.sin(k * Math.PI) * 3;
        },
        undefined,
        0,
      );
      this.tween(
        380,
        (k) => {
          const e = easeInOut(k);
          p.x = lerp(x0, PLATE_X + (i - 1) * 6, e);
          p.y = lerp(REST_Y, PLATE_Y, e);
        },
        undefined,
        90 + i * 70,
      );
    });
    this.tween(
      90,
      (k) => {
        this.headY = lerp(HEAD_UP, HEAD_UP - 3, easeOut(k));
      },
      undefined,
      520,
    );
    this.tween(
      80,
      (k) => {
        this.headY = lerp(HEAD_UP - 3, HEAD_DOWN, easeIn(k));
      },
      () => this.impact(),
      620,
    );
  }

  succeed(item: BenchItem): void {
    if (this.mode === 'press') this.reveal(item);
    else this.queued = { kind: 'ok', item };
  }

  fail(): void {
    if (this.mode === 'press') this.jam();
    else this.queued = { kind: 'fail' };
  }

  pause(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  resume(): void {
    if (this.running || !this.live) return;
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(64, t - this.last);
      this.last = t;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  destroy(): void {
    this.live = false;
    this.pause();
  }

  private tween(dur: number, fn: (k: number) => void, done?: () => void, delay = 0): void {
    this.tweens.push({ t0: this.now + delay, dur, fn, done });
  }

  private syncPieces(): void {
    const keep: Piece[] = [];
    for (const p of this.pieces) {
      if (this.bench.some((b) => b.id === p.id)) {
        keep.push(p);
        continue;
      }
      if (this.opts.reduced) continue;
      const y0 = p.y;
      const gone = p;
      keep.push(gone);
      this.tween(
        170,
        (k) => {
          gone.y = y0 - 14 * easeOut(k);
          gone.a = 1 - k;
        },
        () => {
          this.pieces = this.pieces.filter((q) => q !== gone);
        },
      );
      gone.id = '~' + gone.id;
    }
    this.pieces = keep;
    this.bench.forEach((b, i) => {
      let p = this.pieces.find((q) => q.id === b.id);
      if (!p) {
        p = {
          id: b.id,
          img: spriteOf(b.name, b.rarity),
          x: SLOT_X[i],
          y: this.opts.reduced ? REST_Y : -34,
          sx: 1,
          sy: 1,
          a: 1,
        };
        this.pieces.push(p);
        if (!this.opts.reduced) this.drop(p);
      } else if (p.x !== SLOT_X[i]) {
        const piece = p;
        const x0 = piece.x;
        if (this.opts.reduced) piece.x = SLOT_X[i];
        else
          this.tween(160, (k) => {
            piece.x = lerp(x0, SLOT_X[i], easeOut(k));
          });
      }
    });
  }

  private drop(p: Piece): void {
    this.tween(
      260,
      (k) => {
        p.y = lerp(-34, REST_Y, easeIn(k));
      },
      () => {
        this.dust(p.x, 70, 4, R.asphalt[3]);
        this.tween(
          70,
          (k) => {
            p.sy = 1 - 0.22 * Math.sin(k * Math.PI);
            p.sx = 1 + 0.18 * Math.sin(k * Math.PI);
          },
          () => {
            p.sx = 1;
            p.sy = 1;
          },
        );
        this.tween(
          150,
          (k) => {
            p.y = REST_Y - Math.sin(k * Math.PI) * 4;
          },
          undefined,
          70,
        );
      },
    );
  }

  private impact(): void {
    this.mode = 'press';
    this.pressedAt = this.now;
    this.beltOn = false;
    this.pieces = [];
    this.flash = 0.85;
    this.shake = 3;
    this.shakeUntil = this.now + 280;
    for (let i = 0; i < 28; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      this.parts.push({
        x: PLATE_X + dir * (14 + Math.random() * 6),
        y: 70,
        vx: dir * (40 + Math.random() * 90),
        vy: -60 - Math.random() * 110,
        g: 260,
        life: 380 + Math.random() * 300,
        age: 0,
        col: [R.lit[3], R.taxi[3], '#ffffff', R.lit[2]][i % 4],
        size: 1,
        kind: 'spark',
      });
    }
    this.dust(PLATE_X - 22, 72, 5, R.asphalt[3]);
    this.dust(PLATE_X + 22, 72, 5, R.asphalt[3]);
    this.opts.onImpact?.();
    const q = this.queued;
    this.queued = null;
    if (q?.kind === 'ok') this.reveal(q.item);
    if (q?.kind === 'fail') this.jam();
  }

  private reveal(item: BenchItem): void {
    const wait = Math.max(0, 420 - (this.now - this.pressedAt));
    this.mode = 'reveal';
    const img = spriteOf(item.name, item.rarity);
    this.glow = rarityOf(item.rarity);
    if (this.opts.reduced) {
      this.headY = HEAD_UP;
      this.result = { img, x: CRATE_X, y: CRATE_Y, s: 1, a: 1, rarity: this.glow };
      this.raysA = 1;
      this.mode = 'shown';
      this.opts.onReveal?.();
      return;
    }
    this.tween(
      320,
      (k) => {
        this.headY = lerp(HEAD_DOWN, HEAD_UP, easeOut(k));
      },
      undefined,
      wait,
    );
    this.tween(
      1,
      () => {
        this.flash = 0.55;
        this.result = { img, x: PLATE_X, y: PLATE_Y, s: 0.5, a: 1, rarity: this.glow };
      },
      undefined,
      wait + 60,
    );
    const pops = [0.5, 0.75, 1, 1.25, 1];
    this.tween(
      150,
      (k) => {
        if (this.result) this.result.s = pops[Math.min(4, Math.floor(k * 5))];
      },
      undefined,
      wait + 61,
    );
    this.tween(
      420,
      (k) => {
        if (!this.result) return;
        this.result.x = lerp(PLATE_X, CRATE_X, k);
        this.result.y = lerp(PLATE_Y, CRATE_Y, k) - Math.sin(k * Math.PI) * 30;
      },
      () => this.land(),
      wait + 230,
    );
  }

  private land(): void {
    this.mode = 'shown';
    this.shake = 1;
    this.shakeUntil = this.now + 120;
    this.dust(CRATE_X - 12, 62, 3, R.wood[2]);
    this.dust(CRATE_X + 12, 62, 3, R.wood[2]);
    const [d, m, l] = GLOW[this.glow];
    for (let i = 0; i < 40; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 60 + Math.random() * 110;
      this.parts.push({
        x: CRATE_X,
        y: 40,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        g: 150,
        life: 900 + Math.random() * 700,
        age: 0,
        col: [d, m, l, '#ffffff', R.taxi[3]][i % 5],
        size: i % 3 === 0 ? 2 : 1,
        kind: 'bit',
      });
    }
    this.tween(220, (k) => {
      this.raysA = k;
    });
    this.opts.onReveal?.();
  }

  private jam(): void {
    this.mode = 'jam';
    if (this.opts.reduced) {
      this.headY = HEAD_UP;
      this.mode = 'idle';
      this.pieces = [];
      this.syncPieces();
      this.opts.onFail?.();
      return;
    }
    const wait = Math.max(0, 300 - (this.now - this.pressedAt));
    this.tween(
      110,
      (k) => {
        this.headY = lerp(HEAD_DOWN, HEAD_DOWN - 14, easeOut(k));
      },
      undefined,
      wait,
    );
    this.tween(
      70,
      (k) => {
        this.headY = lerp(HEAD_DOWN - 14, HEAD_DOWN, easeIn(k));
      },
      () => {
        this.shake = 1;
        this.shakeUntil = this.now + 90;
      },
      wait + 110,
    );
    this.tween(
      110,
      (k) => {
        this.headY = lerp(HEAD_DOWN, HEAD_DOWN - 9, easeOut(k));
      },
      undefined,
      wait + 200,
    );
    this.tween(
      70,
      (k) => {
        this.headY = lerp(HEAD_DOWN - 9, HEAD_DOWN, easeIn(k));
      },
      undefined,
      wait + 310,
    );
    for (let i = 0; i < 14; i++) {
      this.tween(
        1,
        () =>
          this.parts.push({
            x: PLATE_X + (Math.random() - 0.5) * 30,
            y: 68,
            vx: (Math.random() - 0.5) * 14,
            vy: -18 - Math.random() * 20,
            g: -4,
            life: 1400 + Math.random() * 600,
            age: 0,
            col: [R.grey[1], R.grey[2], R.concrete[1]][i % 3],
            size: 3 + (i % 3),
            kind: 'smoke',
          }),
        undefined,
        wait + i * 60,
      );
    }
    this.tween(
      320,
      (k) => {
        this.headY = lerp(HEAD_DOWN, HEAD_UP, easeOut(k));
      },
      () => {
        this.mode = 'idle';
        this.pieces = [];
        this.syncPieces();
        this.opts.onFail?.();
      },
      wait + 900,
    );
  }

  private clearResult(): void {
    if (!this.result) {
      this.mode = this.mode === 'shown' ? 'idle' : this.mode;
      return;
    }
    const r = this.result;
    if (this.opts.reduced) {
      this.result = null;
      this.raysA = 0;
      this.mode = 'idle';
      return;
    }
    this.tween(
      180,
      (k) => {
        r.a = 1 - k;
        this.raysA = 1 - k;
      },
      () => {
        if (this.result === r) this.result = null;
      },
    );
    this.mode = 'idle';
  }

  private dust(x: number, y: number, n: number, col: string): void {
    if (this.opts.reduced) return;
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.parts.push({
        x,
        y,
        vx: dir * (10 + Math.random() * 30),
        vy: -6 - Math.random() * 14,
        g: 0,
        life: 420 + Math.random() * 260,
        age: 0,
        col,
        size: 2 + (i % 2),
        kind: 'dust',
      });
    }
  }

  private update(dt: number): void {
    this.now += dt;
    for (const tw of [...this.tweens]) {
      if (this.now < tw.t0) continue;
      const k = Math.min(1, (this.now - tw.t0) / tw.dur);
      tw.fn(k);
      if (k >= 1) {
        this.tweens.splice(this.tweens.indexOf(tw), 1);
        tw.done?.();
      }
    }
    const s = dt / 1000;
    for (const p of this.parts) {
      p.age += dt;
      p.vy += p.g * s;
      p.x += p.vx * s;
      p.y += p.vy * s;
      if (p.kind === 'bit' && p.y > 79) {
        p.y = 79;
        p.vy *= -0.3;
        p.vx *= 0.6;
      }
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    this.flash = Math.max(0, this.flash - dt / 260);
    if (this.beltOn) this.belt = (this.belt + dt * 0.06) % 6;
    const working = this.mode === 'press' || this.mode === 'jam' || this.mode === 'run';
    const goal = this.needleGoal(working);
    this.needle += (goal - this.needle) * Math.min(1, dt / 120);
    if (this.mode === 'shown') this.rays = (this.rays + dt * 0.0006) % (Math.PI * 2);
    if (Math.random() < dt / 2600) this.lamp = 0.35;
    else this.lamp = Math.min(1, this.lamp + dt / 140);
  }

  private needleGoal(working: boolean): number {
    if (working) return 0.9 + Math.sin(this.now / 45) * 0.25;
    if (this.mode === 'shown') return 0.4;
    return -2.1;
  }

  private paintBg(): HTMLCanvasElement {
    const s = new Sprite(this.cw, H);
    wall(s, this.cw);
    const gx = this.gx;
    const right = this.cw - (gx + G);
    if (gx >= 84) pegboard(s, gx - 82, 14);
    if (right >= 84) shelf(s, gx + G + 6, 50);
    if (gx >= 154) poster(s, gx - 148, 18);
    if (right >= 160) windowPane(s, gx + G + 88, 12);
    bench(s, this.cw);
    return s.canvas();
  }

  private draw(): void {
    if (!this.bg) return;
    const b = this.b;
    const gx = this.gx;
    b.clearRect(0, 0, this.cw, H);
    b.drawImage(this.bg, 0, 0);
    this.drawLamp(gx + 60);
    b.drawImage(this.layers.belt, gx, 0);
    for (let x = 4; x < 119; x += 6) {
      const tx = gx + x + Math.floor(this.belt);
      if (tx < gx + 120) {
        b.fillStyle = R.black[2];
        b.fillRect(tx, 73, 2, 1);
      }
    }
    b.drawImage(this.layers.crate, gx, 0);
    if (this.result && this.raysA > 0)
      this.drawRays(gx + Math.round(this.result.x), Math.round(this.result.y) + 16);
    b.drawImage(this.layers.press, gx, 0);
    this.drawLamps(gx);
    this.drawNeedle(gx + 187, 30);
    for (const p of this.pieces) this.drawPiece(p, gx);
    const rodTop = 23;
    for (let i = 0; i < ROD.length; i++) {
      b.fillStyle = ROD[i];
      b.fillRect(gx + 149 + i, rodTop, 1, Math.max(0, Math.round(this.headY) - rodTop + 1));
    }
    if ((this.mode === 'press' || this.mode === 'jam') && this.headY > HEAD_DOWN - 2)
      this.drawSeam(gx);
    b.drawImage(this.head, gx + 133, Math.round(this.headY));
    if (this.result) this.drawResult(gx);
    for (const p of this.parts) this.drawPart(p, gx);
    if (this.flash > 0) {
      b.fillStyle = `rgba(255,250,235,${this.flash.toFixed(3)})`;
      b.fillRect(0, 0, this.cw, H);
    }
    const sc = this.scale;
    const live = this.now < this.shakeUntil;
    const dx = live ? Math.round((Math.random() - 0.5) * 2 * this.shake) : 0;
    const dy = live ? Math.round((Math.random() - 0.5) * 2 * this.shake) : 0;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = R.asphalt[1];
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.drawImage(this.buf, dx * sc, dy * sc, this.cw * sc, H * sc);
  }

  private drawLamp(x: number): void {
    const b = this.b;
    b.fillStyle = R.black[2];
    b.fillRect(x, 0, 1, 7);
    const shade = [
      [x - 2, 7, 5],
      [x - 4, 8, 9],
      [x - 6, 9, 13],
      [x - 7, 10, 15],
    ] as const;
    shade.forEach(([sx, sy, w], i) => {
      b.fillStyle = shadeColour(i);
      b.fillRect(sx, sy, w, 1);
    });
    b.fillStyle = INK;
    b.fillRect(x - 7, 11, 15, 1);
    b.fillStyle = this.lamp > 0.6 ? R.lit[3] : R.lit[1];
    b.fillRect(x - 2, 11, 5, 1);
    const a = 0.09 * this.lamp;
    if (a <= 0.01) return;
    b.fillStyle = `rgba(255,214,140,${a.toFixed(3)})`;
    for (let y = 12; y < 80; y++) {
      const half = Math.round(4 + (y - 12) * 0.62);
      b.fillRect(x - half, y, half * 2 + 1, 1);
    }
  }

  private drawLamps(gx: number): void {
    const b = this.b;
    const working = this.mode === 'run' || this.mode === 'press' || this.mode === 'jam';
    const blink = Math.floor(this.now / 160) % 2 === 0;
    const cols = [
      this.ready && !working ? R.sign[3] : R.sign[0],
      working && blink ? R.red[3] : R.red[0],
      this.mode === 'shown' ? GLOW[this.glow][1] : R.black[2],
    ];
    cols.forEach((c, i) => {
      b.fillStyle = c;
      b.fillRect(gx + 120, 28 + i * 6, 2, 2);
    });
  }

  private drawNeedle(cx: number, cy: number): void {
    const b = this.b;
    b.fillStyle = R.red[1];
    for (let r = 1; r <= 4; r++)
      b.fillRect(
        Math.round(cx + Math.cos(this.needle - Math.PI / 2) * r),
        Math.round(cy + Math.sin(this.needle - Math.PI / 2) * r),
        1,
        1,
      );
  }

  private drawPiece(p: Piece, gx: number): void {
    if (p.a <= 0) return;
    const w = Math.round(32 * p.sx);
    const h = Math.round(32 * p.sy);
    const b = this.b;
    b.globalAlpha = Math.max(0, Math.min(1, p.a));
    b.imageSmoothingEnabled = false;
    b.drawImage(p.img, Math.round(gx + p.x - w / 2), Math.round(p.y + 32 - h), w, h);
    b.globalAlpha = 1;
  }

  private drawSeam(gx: number): void {
    const [d, m, l] = GLOW[this.glow];
    const pulse = 0.55 + Math.sin(this.now / 70) * 0.35;
    const b = this.b;
    b.fillStyle = l;
    b.fillRect(gx + 134, 71, 36, 1);
    b.globalAlpha = pulse;
    b.fillStyle = m;
    b.fillRect(gx + 128, 70, 48, 1);
    b.fillRect(gx + 120, 71, 6, 1);
    b.fillRect(gx + 178, 71, 6, 1);
    b.globalAlpha = pulse * 0.5;
    b.fillStyle = d;
    b.fillRect(gx + 110, 71, 10, 1);
    b.fillRect(gx + 184, 71, 10, 1);
    b.globalAlpha = 1;
  }

  private drawRays(cx: number, cy: number): void {
    const [, m, l] = GLOW[this.glow];
    const b = this.b;
    const R2 = 30;
    for (let y = -R2; y <= R2; y++)
      for (let x = -R2; x <= R2; x++) {
        const d = Math.hypot(x, y);
        if (d > R2 || d < 6) continue;
        const ang = Math.atan2(y, x) + this.rays;
        const band = Math.floor(((ang / (Math.PI * 2)) * 14 + 100) % 2);
        if (band !== 0) continue;
        const fade = (1 - d / R2) * this.raysA;
        if (fade < 0.08) continue;
        b.fillStyle = d < 14 ? l : m;
        b.globalAlpha = Math.min(0.75, fade);
        b.fillRect(cx + x, cy + y, 1, 1);
      }
    b.globalAlpha = 1;
  }

  private drawResult(gx: number): void {
    const r = this.result!;
    const w = Math.round(32 * r.s);
    const bob = this.mode === 'shown' && Math.floor(this.now / 520) % 2 === 0 ? 1 : 0;
    const b = this.b;
    b.globalAlpha = r.a;
    b.drawImage(r.img, Math.round(gx + r.x - w / 2), Math.round(r.y + 32 - w) - bob, w, w);
    b.globalAlpha = 1;
  }

  private drawPart(p: Part, gx: number): void {
    const b = this.b;
    const k = p.age / p.life;
    b.fillStyle = p.col;
    if (p.kind === 'dust' || p.kind === 'smoke') {
      b.globalAlpha = (1 - k) * (p.kind === 'smoke' ? 0.7 : 0.55);
      const r = p.size + k * (p.kind === 'smoke' ? 5 : 2);
      const x = Math.round(gx + p.x - r);
      const y = Math.round(p.y - r);
      const d = Math.round(r * 2);
      b.fillRect(x + 1, y, d - 2, d);
      b.fillRect(x, y + 1, d, d - 2);
      b.globalAlpha = 1;
      return;
    }
    b.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
    b.fillRect(Math.round(gx + p.x), Math.round(p.y), p.size, p.size);
    if (p.kind === 'spark')
      b.fillRect(Math.round(gx + p.x - p.vx * 0.012), Math.round(p.y - p.vy * 0.012), 1, 1);
    b.globalAlpha = 1;
  }
}
