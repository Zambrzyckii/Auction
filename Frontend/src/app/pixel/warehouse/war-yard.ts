// The warehouse war forecourt: one canvas at art resolution, scaled by whole numbers.
// The host feeds it the phase (set), bids (raise) and the settlement (settle).
import { INK, R, Sprite, box, text } from '../street/pix';
import { iconFor } from '../items/item-icon';
import { rarityOf } from '../items/rarity';

export interface WarLot { name: string; rarity: string }
export interface WarYardState {
  phase: 'open' | 'bidding' | 'won' | 'lost';
  players: number;
  leader: 'you' | 'rival' | null;
  items?: readonly WarLot[];
}
export interface WarYardOpts { reduced?: boolean; onDoorOpen?: () => void }

const G = 240;
const H = 112;
const OX = 90;
const OW = 68;
const OY = 24;
const OB = 84;
const LX = 124;
const DOOR_CLOSED = OB;
const DOOR_PEEK = 58;
const DOOR_OPEN = OY + 4;
const JACKETS = [R.mauve, R.rust, R.olive, R.plum];
const GLINTS: readonly [number, number][] = [[101, 74], [116, 70], [131, 76], [147, 72], [122, 64], [139, 79]];

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

interface Tween { t0: number; dur: number; fn: (k: number) => void; done?: () => void }
interface Part { x: number; y: number; vx: number; vy: number; g: number; life: number; age: number; col: string; kind: 'dust' | 'confetti' }

const art = new Map<string, HTMLCanvasElement>();
function spriteOf(name: string, rarity: string): HTMLCanvasElement {
  const key = name + '|' + rarity;
  let c = art.get(key);
  if (!c) {
    c = (iconFor(name, rarityOf(rarity)) as Sprite).canvas();
    art.set(key, c);
  }
  return c;
}

function corrugate(s: Sprite, x: number, y: number, w: number, h: number) {
  for (let i = 0; i < w; i++) {
    const rib = i % 6;
    let col = R.concrete[1];
    if (rib === 0) col = R.concrete[0];
    else if (rib === 3) col = R.concrete[2];
    s.vline(x + i, y, h, col);
  }
}

function slatDoor(w: number, h: number): Sprite {
  const d = new Sprite(w, h);
  for (let j = 0; j < h; j++) {
    const band = j % 5;
    let col = R.steel[2];
    if (band === 0) col = R.steel[0];
    else if (band === 1) col = R.steel[3];
    else if (band === 4) col = R.steel[1];
    d.hline(0, j, w, col);
  }
  for (let j = 6; j < h; j += 17) for (let i = 2; i < w - 2; i += 9) d.set(i, j, R.rust[2]);
  d.vline(0, 0, h, INK);
  d.vline(w - 1, 0, h, INK);
  return d;
}

function stencil(s: Sprite, label: string, x: number, y: number) {
  text(s, label, x + 1, y + 1, R.black[0], 'tiny', { alignTop: true });
  text(s, label, x, y, R.paper[2], 'tiny', { alignTop: true });
}

function unitFrame(s: Sprite, x: number, w: number) {
  box(s, x, 16, w, 8, R.steel);
  s.hline(x, 23, w, R.steel[0]);
  s.vline(x - 1, 16, OB - 16, INK);
  s.vline(x + w, 16, OB - 16, INK);
}

function signSprite(lines: readonly string[]): Sprite {
  const w = 30;
  const h = 34;
  const p = new Sprite(w, h);
  for (let j = 2; j < h - 4; j++) {
    const off = j < (h - 4) / 2 ? 1 : 0;
    p.hline(2 + off, j, w - 6, j === 2 ? R.paper[3] : R.paper[2]);
  }
  p.vline(4, h - 6, 6, R.wood[1]);
  p.vline(w - 7, h - 8, 8, R.wood[0]);
  lines.forEach((line, i) => {
    text(p, line, 5 + (i === 0 ? 4 : 0), 5 + i * 8, i === 0 ? R.red[2] : R.black[1], 'tiny', { alignTop: true });
  });
  p.outline();
  return p;
}

function padlockSprite(): Sprite {
  const p = new Sprite(10, 12);
  box(p, 2, 5, 6, 6, R.taxi);
  p.set(4, 8, INK);
  p.hline(3, 3, 4, R.steel[2]);
  p.vline(3, 3, 3, R.steel[2]);
  p.vline(6, 3, 3, R.steel[2]);
  p.outline();
  return p;
}

function clipboardSprite(): Sprite {
  const p = new Sprite(12, 16);
  box(p, 1, 1, 10, 14, R.wood);
  for (let j = 4; j < 13; j += 3) p.hline(3, j, 6, R.paper[2]);
  p.hline(4, 1, 4, R.steel[2]);
  p.outline();
  return p;
}

function figure(jacket: readonly string[], you: boolean): Sprite {
  const f = new Sprite(9, 14);
  const hair = you ? R.taxi : R.hair;
  f.rect(2, 0, 5, 1, hair[you ? 2 : 1]);
  f.rect(2, 1, 5, 2, hair[you ? 2 : 2]);
  f.rect(3, 3, 3, 1, R.skinB[2]);
  f.rect(1, 4, 7, 4, jacket[1]);
  f.rect(1, 4, 7, 1, jacket[2]);
  f.rect(0, 5, 1, 3, jacket[0]);
  f.rect(8, 5, 1, 3, jacket[0]);
  f.rect(1, 8, 7, 2, jacket[0]);
  f.rect(2, 10, 2, 3, R.denim[0]);
  f.rect(5, 10, 2, 3, R.denim[0]);
  f.rect(2, 13, 2, 1, INK);
  f.rect(5, 13, 2, 1, INK);
  return f.outline();
}

function paddleSprite(): Sprite {
  const p = new Sprite(8, 11);
  box(p, 1, 1, 6, 6, R.taxi);
  p.set(3, 3, R.taxi[0]);
  p.set(4, 3, R.taxi[0]);
  p.vline(3, 7, 4, R.wood[1]);
  p.outline();
  return p;
}

function barkerSprite(armUp: boolean): Sprite {
  const f = new Sprite(16, 18);
  f.rect(4, 0, 7, 2, R.tan[1]);
  f.rect(2, 2, 11, 1, R.tan[0]);
  f.rect(5, 3, 5, 3, R.skinA[2]);
  f.set(6, 4, INK);
  f.set(8, 4, INK);
  f.rect(3, 6, 9, 6, R.rust[1]);
  f.rect(3, 6, 9, 1, R.rust[2]);
  f.rect(4, 12, 3, 4, R.black[2]);
  f.rect(8, 12, 3, 4, R.black[2]);
  f.rect(4, 16, 3, 1, INK);
  f.rect(8, 16, 3, 1, INK);
  if (armUp) {
    f.rect(11, 4, 2, 3, R.rust[1]);
    f.rect(12, 2, 3, 3, R.steel[2]);
    f.set(14, 2, R.steel[3]);
    f.set(15, 1, R.taxi[3]);
    f.set(15, 4, R.taxi[3]);
  } else {
    f.rect(11, 8, 2, 4, R.rust[1]);
    f.rect(12, 11, 3, 2, R.steel[2]);
  }
  return f.outline();
}

function tintCanvas(src: HTMLCanvasElement, col: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

const tints = new Map<string, HTMLCanvasElement>();
function tintOf(name: string, rarity: string, col: string): HTMLCanvasElement {
  const key = name + '|' + rarity + '|' + col;
  let c = tints.get(key);
  if (!c) {
    c = tintCanvas(spriteOf(name, rarity), col);
    tints.set(key, c);
  }
  return c;
}

function crateCanvas(): HTMLCanvasElement {
  const c = new Sprite(22, 14);
  box(c, 1, 1, 20, 12, R.wood);
  c.hline(2, 5, 18, R.wood[1]);
  c.hline(2, 9, 18, R.wood[1]);
  c.vline(3, 2, 10, R.wood[0]);
  c.vline(18, 2, 10, R.wood[0]);
  return c.outline().canvas();
}

export class WarYard {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly buf = document.createElement('canvas');
  private readonly b: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private readonly door = slatDoor(OW, OB - OY);
  private doorCv: HTMLCanvasElement;
  private readonly padlock = padlockSprite().canvas();
  private readonly crate = crateCanvas();
  private readonly crateShadow = tintCanvas(this.crate, R.black[1]);
  private readonly barkerUp = barkerSprite(true).canvas();
  private readonly barkerDown = barkerSprite(false).canvas();
  private readonly paddle = paddleSprite().canvas();
  private readonly easel = signSprite(['EST', '4200', '-9800']).canvas();
  private figures: HTMLCanvasElement[] = [];
  private youFigure = figure(R.denim, true).canvas();
  private scale = 1;
  private cw = G;
  private gx = 0;
  private now = 0;
  private raf = 0;
  private running = false;
  private live = true;
  private state: WarYardState = { phase: 'open', players: 1, leader: null };
  private doorBottom = DOOR_CLOSED;
  private tweens: Tween[] = [];
  private parts: Part[] = [];
  private shoutUntil = 0;
  private paddleAt: Record<'you' | 'rival', number> = { you: -1, rival: -1 };
  private raysA = 0;
  private settled = false;
  private revealing = false;
  private flickerT0 = 0;
  private litT0 = 0;
  private sway = 0;

  constructor(private readonly cv: HTMLCanvasElement, private readonly opts: WarYardOpts = {}) {
    this.ctx = cv.getContext('2d')!;
    this.b = this.buf.getContext('2d')!;
    this.doorCv = this.door.canvas();
    this.figures = JACKETS.map((j) => figure(j, false).canvas());
  }

  resize(cssWidth: number, maxHeight = Infinity): void {
    // Close framing: the camera needs only the easel-to-crowd span (182 art px),
    // so the scale climbs much earlier than the full 240 px composition would allow.
    let scale = Math.max(1, Math.min(5, Math.floor(cssWidth / 182), Math.floor(maxHeight / H)));
    if (scale === 1 && cssWidth >= 310 && maxHeight >= H * 2) scale = 2;
    const cw = Math.max(150, Math.floor(cssWidth / scale));
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
    this.ctx.imageSmoothingEnabled = false;
    this.bg = this.paintBg();
    this.draw();
  }

  get size() { return { scale: this.scale, width: this.cw * this.scale, height: H * this.scale }; }

  anchor(what: 'door' | 'barker' | 'crowd') {
    const s = this.scale;
    if (what === 'door') return { x: (this.gx + LX) * s, y: 50 * s };
    if (what === 'barker') return { x: (this.gx + 80) * s, y: 72 * s };
    return { x: (this.gx + 150) * s, y: 92 * s };
  }

  set(state: WarYardState): void {
    this.state = { ...state, items: state.items ?? [] };
    this.settled = state.phase === 'won' || state.phase === 'lost';
    this.revealing = false;
    this.flickerT0 = 0;
    this.litT0 = 0;
    this.parts = [];
    this.tweens = [];
    this.raysA = 0;
    const target = state.phase === 'open' ? DOOR_CLOSED : state.phase === 'bidding' ? DOOR_PEEK : DOOR_OPEN;
    if (!this.opts.reduced && this.bg && Math.abs(target - this.doorBottom) > 2) {
      const from = this.doorBottom;
      this.tweens.push({
        t0: this.now,
        dur: 320,
        fn: (k) => { this.doorBottom = Math.round(lerp(from, target, easeOut(k))); },
      });
      this.resume();
      return;
    }
    this.doorBottom = target;
    this.draw();
  }

  raise(who: 'you' | 'rival'): void {
    this.state.leader = who;
    this.shoutUntil = this.now + 700;
    if (this.opts.reduced) { this.draw(); return; }
    this.paddleAt[who] = this.now;
    this.resume();
  }

  settle(won: boolean, items: readonly WarLot[]): void {
    this.state = { ...this.state, phase: won ? 'won' : 'lost', items };
    if (this.opts.reduced) {
      this.doorBottom = DOOR_OPEN;
      this.settled = true;
      this.revealing = false;
      this.litT0 = 0;
      this.opts.onDoorOpen?.();
      this.draw();
      return;
    }
    // The reveal plays in three beats: the door rolls up over a still-dark
    // interior, the light flickers on, then the lots step out of the shadow.
    this.settled = false;
    this.revealing = true;
    this.flickerT0 = 0;
    const from = this.doorBottom;
    this.tweens.push({
      t0: this.now,
      dur: 1100,
      fn: (k) => { this.doorBottom = Math.round(lerp(from, DOOR_OPEN, easeInOut(k))); },
      done: () => {
        if (won) this.flickerT0 = this.now;
        this.tweens.push({
          t0: this.now,
          dur: won ? 430 : 240,
          fn: () => {},
          done: () => {
            this.revealing = false;
            this.flickerT0 = 0;
            this.settled = true;
            this.litT0 = this.now;
            this.spawnBurst(won);
            this.opts.onDoorOpen?.();
          },
        });
      },
    });
    this.resume();
  }

  private spawnBurst(won: boolean): void {
    for (let i = 0; i < 26; i++) {
      this.parts.push({
        x: OX + 4 + Math.random() * (OW - 8),
        y: won ? OY + 6 : DOOR_OPEN + 2,
        vx: (Math.random() - 0.5) * (won ? 26 : 10),
        vy: won ? -14 - Math.random() * 22 : -2 - Math.random() * 4,
        g: won ? 42 : 8,
        life: won ? 1.6 : 0.8,
        age: 0,
        col: won ? [R.taxi[2], R.taxi[3], R.red[3], R.white[3], R.gold[2]][i % 5] : R.concrete[2],
        kind: won ? 'confetti' : 'dust',
      });
    }
  }

  pause(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  resume(): void {
    if (!this.live || this.running || this.opts.reduced) { this.draw(); return; }
    this.running = true;
    let last = performance.now();
    const step = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.now = t;
      this.tick(dt);
      this.draw();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  destroy(): void {
    this.pause();
    this.live = false;
  }

  private tick(dt: number): void {
    // done() may chain a new tween, so finish the pass before firing callbacks.
    const alive: Tween[] = [];
    const finished: Tween[] = [];
    for (const tw of this.tweens) {
      const k = Math.min(1, (this.now - tw.t0) / tw.dur);
      tw.fn(k);
      (k >= 1 ? finished : alive).push(tw);
    }
    this.tweens = alive;
    for (const tw of finished) tw.done?.();
    for (const p of this.parts) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    this.sway = Math.sin(this.now / 1300) * 2;
    if (this.settled && this.state.phase === 'won') this.raysA += dt * 0.9;
  }

  private paintBg(): HTMLCanvasElement {
    const s = new Sprite(this.cw, H);
    for (let y = 0; y < 10; y++) s.hline(0, y, this.cw, R.black[0]);
    for (const [sx, sy] of [[18, 2], [55, 5], [205, 3], [231, 6], [148, 1]] as const)
      if (sx < this.cw) s.set(sx, sy, R.white[2]);
    s.hline(0, 10, this.cw, R.black[3]);
    s.hline(0, 11, this.cw, R.concrete[2]);
    s.hline(0, 12, this.cw, R.concrete[0]);
    corrugate(s, 0, 13, this.cw, OB - 13);
    for (let y = OB; y < H; y++)
      for (let x = 0; x < this.cw; x++) {
        let c = R.asphalt[2];
        if (y === OB) c = R.asphalt[3];
        else if ((x * 7 + y * 13) % 37 === 0) c = R.asphalt[1];
        else if (y > 104 && (x + y) % 2 === 0) c = R.asphalt[1];
        s.set(x, y, c);
      }
    const g = this.gx;
    const side = slatDoor(54, OB - OY);
    const unit = (x: number, n: number) => {
      if (x + 54 < 0 || x > this.cw) return;
      unitFrame(s, x, 54);
      s.stamp(side, x, OY);
      // A stencil sliced by the camera edge reads as a glitch, so clipped ones stay off.
      if (n >= 0 && x + 2 >= 0 && x + 22 <= this.cw) stencil(s, 'U-' + String(n).padStart(2, '0'), x + 2, 17);
    };
    for (let k = 0; g + 66 - k * 86 >= 0; k++) unit(g + 12 - k * 86, 6 - k);
    for (let k = 0; g + 182 + k * 86 <= this.cw; k++) unit(g + 182 + k * 86, 8 + k);
    for (const [rx, rh] of [[190, 8], [203, 5], [226, 11]] as const) s.vline(g + rx, OY + 1, rh, R.rust[1]);
    unitFrame(s, g + OX, OW);
    stencil(s, 'U-07', g + OX + 3, 17);
    box(s, g + OX + OW - 13, 17, 10, 6, R.taxi);
    text(s, 'M', g + OX + OW - 10, 18, R.black[0], 'tiny', { alignTop: true });
    for (let j = 0; j < OB - OY; j++) {
      s.set(g + OX - 1, OY + j, INK);
      s.set(g + OX + OW, OY + j, INK);
    }
    s.vline(g + LX, 12, 4, R.black[1]);
    s.stamp(clipboardSprite(), g + OX + OW + 4, 44);
    for (const dx of [20, 44, 196, 220]) s.hline(g + dx, 97, 7, R.taxi[0]);
    return s.canvas();
  }

  private px(x: number, y: number, w: number, h: number, col: string): void {
    this.b.fillStyle = col;
    this.b.fillRect(x, y, w, h);
  }

  private drawInterior(): void {
    const g = this.gx;
    const { phase } = this.state;
    if (this.doorBottom >= OB) return;
    // One dark interior for bidding and for the roll, so the reveal never
    // repaints what the gap already showed: the light flips it, nothing moves.
    const flickerOn = this.flickerT0 > 0 && Math.floor((this.now - this.flickerT0) / 70) % 2 === 1;
    const lit = phase === 'won' && (this.settled || flickerOn);
    this.px(g + OX, this.doorBottom, OW, OB - this.doorBottom, lit ? R.tan[0] : R.black[0]);
    if (lit)
      for (let j = this.doorBottom + (3 - (this.doorBottom % 3)); j < OB; j += 3)
        for (let i = (j % 2 === 0 ? 1 : 3); i < OW; i += 4)
          this.px(g + OX + i, j, 1, 1, R.tan[1]);
    this.px(g + OX + 6, OB - 3, OW - 12, 1, lit ? R.wood[1] : R.black[2]);
    const items = (this.state.items ?? []).slice(0, 3);
    const spots = [[3, OB - 14], [23, OB - 14], [43, OB - 14]] as const;
    spots.forEach(([cx, cy], i) => {
      this.b.drawImage(lit ? this.crate : this.crateShadow, g + OX + cx, cy);
      const it = items[i];
      if (it) this.drawLot(it, g + OX + cx - 5, cy - 32, i, lit);
    });
    if (!lit && !this.settled)
      GLINTS.forEach(([gx$, gy], i) => {
        if (gy < this.doorBottom + 2) return;
        const on = Math.floor(this.now / 520 + i * 1.7) % 3 === 0;
        if (on || this.opts.reduced) {
          this.px(g + gx$, gy, 2, 1, i % 2 ? R.lit[3] : R.white[3]);
          this.px(g + gx$ + (i % 2), gy + 1, 1, 1, R.lit[1]);
        }
      });
    if (phase === 'lost' && this.settled) {
      for (let i = 0; i < OW; i++) {
        const ty = OY + 18 + Math.floor(i / 5);
        this.px(g + OX + i, ty, 1, 6, R.red[1]);
        this.px(g + OX + i, ty, 1, 1, R.red[2]);
      }
      this.b.drawImage(textCv('SOLD', R.white[3]), g + OX + 22, OY + 24);
    }
  }

  private drawLot(it: WarLot, x: number, y: number, i: number, lit: boolean): void {
    if (!lit) {
      this.b.drawImage(tintOf(it.name, it.rarity, R.black[1]), x, y);
      return;
    }
    if (this.litT0 > 0 && !this.opts.reduced) {
      const dt = this.now - this.litT0 - i * 150;
      if (dt < 0) {
        this.b.drawImage(tintOf(it.name, it.rarity, R.black[1]), x, y);
        return;
      }
      if (dt < 90) {
        this.b.drawImage(tintOf(it.name, it.rarity, R.white[3]), x, y);
        return;
      }
    }
    this.b.drawImage(spriteOf(it.name, it.rarity), x, y);
  }

  private drawDoor(): void {
    const g = this.gx;
    const visible = this.doorBottom - OY;
    if (visible > 0)
      this.b.drawImage(this.doorCv, 0, this.door.h - visible, OW, visible, g + OX, OY, OW, visible);
    this.px(g + OX, this.doorBottom - 1, OW, 1, R.steel[0]);
    if (this.state.phase === 'open') {
      this.b.drawImage(this.padlock, g + LX - 5, OB - 16);
      this.px(g + LX - 1, OB - 18, 2, 3, R.steel[1]);
    }
  }

  private drawRays(): void {
    if (!(this.state.phase === 'won' && this.settled) || this.opts.reduced) return;
    const g = this.gx;
    const cx = g + LX;
    const cy = 52;
    for (let r = 0; r < 10; r++) {
      const a = this.raysA + (r * Math.PI) / 5;
      const len = 34 + (r % 2) * 8;
      for (let d = 12; d < len; d += 2) {
        const x = Math.round(cx + Math.cos(a) * d);
        const y = Math.round(cy + Math.sin(a) * d * 0.55);
        if (y > 8 && y < OB + 6 && (x + y + r) % 2 === 0) this.px(x, y, 1, 1, r % 2 ? R.lit[2] : R.taxi[3]);
      }
    }
  }

  private drawLamp(): void {
    const g = this.gx;
    const lx = g + LX + Math.round(this.opts.reduced ? 0 : this.sway);
    for (let j = 0; j < 78; j++) {
      const y = 24 + j;
      if (y > 100) break;
      const half = 2 + Math.floor(j * 0.4);
      for (let i = -half; i <= half; i++) {
        const x = lx + i;
        if ((x * 3 + y * 7) % 3 !== 0) continue;
        if (x < 0 || x >= this.cw) continue;
        const dark = this.state.phase === 'bidding' || this.revealing;
        if (dark && x >= g + OX && x < g + OX + OW && y > this.doorBottom && y < OB) continue;
        this.px(x, y, 1, 1, y > OB ? R.lit[1] : R.lit[0]);
      }
    }
    for (let j = 0; j < 8; j++) {
      const w = 26 - Math.abs(j - 4) * 4;
      for (let i = -w; i <= w; i += 2) this.px(lx + i + (j % 2), 88 + j, 1, 1, j < 6 ? R.lit[1] : R.lit[0]);
    }
    this.px(lx - 2, 14, 4, 3, R.black[1]);
    this.px(lx - 5, 17, 10, 2, R.steel[1]);
    this.px(lx - 4, 19, 8, 3, R.steel[2]);
    this.px(lx - 1, 22, 2, 2, R.lit[3]);
    this.px(lx - 3, 22, 1, 1, R.lit[2]);
    this.px(lx + 2, 22, 1, 1, R.lit[2]);
  }

  private drawPeople(): void {
    const g = this.gx;
    const shout = this.now < this.shoutUntil;
    this.b.drawImage(this.easel, g + 30, 72);
    this.b.drawImage(this.crate, g + 70, 92);
    this.b.drawImage(shout ? this.barkerUp : this.barkerDown, g + 72, 76);
    if (shout && !this.opts.reduced) {
      const k = Math.floor(this.now / 140) % 2;
      this.px(g + 92 + k, 76 - k, 1, 1, R.taxi[3]);
      this.px(g + 95, 79, 1, 1, R.taxi[2]);
    }
    const rivals = Math.max(0, Math.min(4, this.state.players - 1));
    const xs = [108, 170, 196, 218];
    for (let i = 0; i < rivals; i++) {
      const bob = this.opts.reduced ? 0 : Math.floor(this.now / 900 + i * 2.3) % 2 === 0 ? 0 : -1;
      this.b.drawImage(this.figures[i % this.figures.length], g + xs[i], 94 + bob);
      if (i === 0) this.drawPaddle(g + xs[i] + 8, 94 + bob, 'rival');
    }
    const youBob = this.opts.reduced ? 0 : Math.floor(this.now / 1100) % 2 === 0 ? 0 : -1;
    this.b.drawImage(this.youFigure, g + 148, 96 + youBob);
    this.px(g + 148, 110, 9, 1, R.black[0]);
    this.drawPaddle(g + 157, 96 + youBob, 'you');
  }

  private drawPaddle(x: number, figureY: number, who: 'you' | 'rival'): void {
    const isLeader = this.state.leader === who;
    const popAt = this.paddleAt[who];
    const pop = popAt >= 0 && this.now - popAt < 600 ? easeOut(Math.min(1, (this.now - popAt) / 600)) : isLeader ? 1 : 0;
    if (pop <= 0) return;
    const lift = Math.round(lerp(2, 12, pop));
    this.b.drawImage(this.paddle, x, figureY + 2 - lift);
  }

  private draw(): void {
    if (!this.bg) return;
    this.b.imageSmoothingEnabled = false;
    this.b.drawImage(this.bg, 0, 0);
    this.drawInterior();
    this.drawDoor();
    this.drawRays();
    this.drawLamp();
    this.drawPeople();
    this.drawPartsFixed();
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    this.ctx.drawImage(this.buf, 0, 0, this.cw, H, 0, 0, this.cw * this.scale, H * this.scale);
  }

  private drawPartsFixed(): void {
    for (const p of this.parts) {
      const x = Math.round(this.gx + p.x);
      const y = Math.round(p.y);
      if (y < 0 || y > H - 1 || x < 0 || x > this.cw - 1) continue;
      if (p.kind === 'dust' && p.age / p.life > 0.6 && Math.floor(p.age * 30) % 2) continue;
      this.px(x, y, 1, 1, p.col);
    }
  }
}

const textCache = new Map<string, HTMLCanvasElement>();
function textCv(str: string, col: string): HTMLCanvasElement {
  const key = str + '|' + col;
  let c = textCache.get(key);
  if (!c) {
    const s = new Sprite(26, 7);
    text(s, str, 0, 0, col, 'tiny', { alignTop: true });
    c = s.canvas();
    textCache.set(key, c);
  }
  return c;
}
