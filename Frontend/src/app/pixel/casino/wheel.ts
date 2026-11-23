// The roulette wheel. A fixed bowl holds the rim, the ball track and eight deflectors.
// The head turns and carries the 37 single-zero pockets in casino order. The painter and
// the ball read the same pocket geometry, so a resting ball always sits in the pocket the
// painter drew for its number.
import { R, Sprite, mix, toRgb } from '../street/pix';
import {
  CONE_IN,
  HEAD,
  N,
  NUM_IN,
  ORDER,
  POCKET_IN,
  RIM,
  STEP,
  TAU,
  TRACK_IN,
  TRACK_OUT,
  colorOf,
  mod,
} from './wheel-math';

const LIGHT = [-0.64, -0.77];
const litOf = (a: number) => LIGHT[0] * Math.cos(a) + LIGHT[1] * Math.sin(a);

function pocketTone(n: number, level: 0 | 1 | 2): string {
  const c = colorOf(n);
  if (c === 'green') return ['#173d2a', '#24603f', '#3f9a5c'][level];
  if (c === 'red') return [R.red[1], R.red[2], '#d8454a'][level];
  return [R.black[0], R.black[1], R.black[2]][level];
}

function bodyLevel(q: number): 0 | 1 {
  if (q < POCKET_IN + 2) return 0;
  return 1;
}

// ----- the bowl: rim, track, slope and deflectors, drawn once -----
export function bowl(): { img: HTMLCanvasElement; size: number; c: number } {
  const D = RIM * 2 + 4,
    c = D / 2,
    s = new Sprite(D, D);
  for (let y = 0; y < D; y++)
    for (let x = 0; x < D; x++) {
      const dx = x + 0.5 - c,
        dy = y + 0.5 - c,
        q = Math.hypot(dx, dy);
      if (q > RIM) continue;
      const lit = litOf(Math.atan2(dy, dx));
      if (q > TRACK_OUT) {
        if (q > RIM - 1) s.set(x, y, R.wood[1]);
        else if (lit > 0.35) s.set(x, y, R.wood[3]);
        else if (lit > -0.35) s.set(x, y, R.wood[2]);
        else s.set(x, y, R.wood[1]);
        continue;
      }
      if (q > TRACK_IN) {
        const band = q > TRACK_IN + 3.2 && q < TRACK_IN + 4.2;
        if (band && lit < -0.2) s.set(x, y, '#7a5536');
        else if (q > TRACK_OUT - 1) s.set(x, y, '#21150f');
        else s.set(x, y, lit > 0.2 ? '#3a2618' : '#2e1e14');
        continue;
      }
      s.set(x, y, lit > 0 ? '#5a3a22' : '#45301e');
    }
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * (TAU / 8),
      px = c + Math.cos(a) * 31,
      py = c + Math.sin(a) * 31;
    const ix = Math.floor(px),
      iy = Math.floor(py);
    const flat = k % 2 === 0;
    s.set(ix, iy, R.white[3]);
    if (flat) {
      s.set(ix - 1, iy, R.white[2]);
      s.set(ix + 1, iy, R.white[1]);
    } else {
      s.set(ix, iy - 1, R.white[2]);
      s.set(ix, iy + 1, R.white[1]);
    }
  }
  s.outline({ selective: false });
  return { img: s.canvas(), size: D, c };
}

// ----- the head: repainted each frame at art resolution, so it turns on the pixel grid -----
const HD = HEAD * 2 + 4,
  hc = HD / 2;
export const headSize = HD;
const headPix: { k: number; q: number; a: number }[] = [];
for (let y = 0; y < HD; y++)
  for (let x = 0; x < HD; x++) {
    const dx = x + 0.5 - hc,
      dy = y + 0.5 - hc,
      q = Math.hypot(dx, dy);
    if (q <= HEAD) headPix.push({ k: y * HD + x, q, a: Math.atan2(dy, dx) });
  }
const u32 = new Map<string, number>();
const word = (hex: string): number => {
  let w = u32.get(hex);
  if (w === undefined) {
    const [r, g, b] = toRgb(hex);
    w = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    u32.set(hex, w);
  }
  return w;
};
interface HeadBuffers {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: ImageData;
  buf: Uint32Array;
}
let head: HeadBuffers | null = null;
function headCanvas(): HeadBuffers {
  if (head) return head;
  const cv = document.createElement('canvas');
  cv.width = HD;
  cv.height = HD;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(HD, HD);
  head = { cv, ctx, img, buf: new Uint32Array(img.data.buffer) };
  return head;
}
function coneTone(q: number, a: number): string {
  const lit = litOf(a);
  if (q > POCKET_IN - 1.3) return R.gold[2];
  if (q > 17) {
    if (lit > 0.3) return R.wood[3];
    if (lit > -0.4) return R.wood[2];
    return R.wood[1];
  }
  if (q > 13) return lit > 0.1 ? R.wood[2] : R.wood[1];
  if (q > CONE_IN) return lit > 0.5 ? R.wood[2] : R.wood[1];
  return R.wood[0];
}
function turret(q: number, a: number, wheelAngle: number): string | null {
  if (q < 2.2) return R.gold[3];
  if (q < 3.6) return litOf(a) > 0 ? R.gold[3] : R.gold[1];
  if (q > 12.5) return null;
  const rel = mod(a - wheelAngle + Math.PI / 4, Math.PI / 2) - Math.PI / 4;
  const arc = Math.abs(rel) * q;
  if (q > 9.5 && arc < 1.7) return arc < 0.8 ? R.white[3] : R.white[1];
  if (arc < 0.75) return R.gold[2];
  return null;
}
// highlight: pocket index to light up, or -1.
export function paintHead(wheelAngle: number, highlight: number): HTMLCanvasElement {
  const { cv, ctx, img, buf } = headCanvas();
  for (const p of headPix) {
    let col: string;
    if (p.q > POCKET_IN) {
      const rel = mod(p.a - wheelAngle, TAU) / STEP;
      const i = Math.floor(rel) % N,
        f = rel - Math.floor(rel),
        n = ORDER[i];
      const edge = Math.min(f, 1 - f) * STEP * p.q;
      if (p.q > NUM_IN) {
        col = edge < 0.55 ? R.gold[2] : pocketTone(n, 2);
        if (p.q > NUM_IN + 1.2 && p.q < NUM_IN + 2.2 && Math.abs(f - 0.5) * STEP * p.q < 0.55)
          col = mix(col, R.white[2], 0.45);
      } else {
        col = edge < 0.5 ? R.gold[1] : pocketTone(n, bodyLevel(p.q));
      }
      if (i === highlight && p.q > NUM_IN && edge >= 0.55) col = '#ffe9a8';
      if (i === highlight && p.q <= NUM_IN && edge < 0.5) col = R.gold[3];
    } else {
      col = turret(p.q, p.a, wheelAngle) || coneTone(p.q, p.a);
    }
    buf[p.k] = word(col);
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ----- the ball: 3x3, drawn off-grid so it glides -----
export const ballSprite = (() => {
  const s = new Sprite(3, 3);
  s.set(0, 0, R.white[1]);
  s.set(1, 0, R.white[3]);
  s.set(2, 0, R.white[1]);
  s.set(0, 1, R.white[3]);
  s.set(1, 1, '#ffffff');
  s.set(2, 1, R.white[2]);
  s.set(0, 2, R.white[1]);
  s.set(1, 2, R.white[2]);
  s.set(2, 2, R.white[0]);
  return s.canvas();
})();
