// Sprite builders for the bank. The plates, neon, rotation and bulbs are the casino ones,
// re-exported. Added here are the rubber stamp, a fixed-width LED panel with rows, and the
// grimy walls, linoleum, brick and dithered light cones of the storefront.
import type { Ramp } from '../street/pix';
import { Sprite, bayer, measure, mix, ri, srand, text } from '../street/pix';
import { LED, rotate } from '../casino/sprites';

export {
  AMBER,
  LED,
  NEON,
  bulbOff,
  bulbOn,
  neon,
  plate,
  rotate,
  scale2x,
  squeeze,
} from '../casino/sprites';

export const LIME = ['#16200e', '#2a3a1c', '#5aa83a', '#b8f07a'];
export const NGREEN = ['#16241a', '#2a3a2c', '#4fb83c', '#8af060'];
export const NRED = ['#2a0c0e', '#4a1e22', '#c8302a', '#ff4a3a'];
const cv = (s: Sprite) => s.canvas();

// Rubber stamp: a double frame with the word, slightly rotated so it reads as slammed by hand.
const stamps = new Map<string, HTMLCanvasElement>();
export function stamp(word: string, ramp: Ramp, deg = -6): HTMLCanvasElement {
  const key = word + deg;
  const cached = stamps.get(key);
  if (cached) return cached;
  const w = measure(word, 'jersey') + 14,
    h = 32;
  const s = new Sprite(w, h);
  for (const k of [0, 1]) {
    s.hline(k, k, w - 2 * k, ramp[2]);
    s.hline(k, h - 1 - k, w - 2 * k, ramp[2]);
    s.vline(k, k, h - 2 * k, ramp[2]);
    s.vline(w - 1 - k, k, h - 2 * k, ramp[2]);
  }
  text(s, word, 7, 4, ramp[3], 'jersey', { alignTop: true });
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++)
      if (s.get(x, y) && bayer(x * 3, y * 5) < 0.12) s.set(x, y, ramp[2]);
  const img = cv(rotate(s, deg));
  if (stamps.size > 160) stamps.clear();
  stamps.set(key, img);
  return img;
}

// LED panel with fixed width and rows of micro text, each row centred.
const leds = new Map<string, HTMLCanvasElement>();
export function ledPanel(rows: readonly string[], w: number, ramp: Ramp = LED): HTMLCanvasElement {
  const key = w + '|' + ramp[3] + '|' + rows.join('|');
  const cached = leds.get(key);
  if (cached) return cached;
  const h = rows.length * 10 + 5;
  const s = new Sprite(w, h);
  s.rect(0, 0, w, h, '#0c0810');
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) if ((x + y) % 2 === 0 && y % 2 === 0) s.set(x, y, '#160c12');
  s.hline(0, 0, w, ramp[0]);
  s.hline(0, h - 1, w, ramp[0]);
  rows.forEach((str, i) => {
    if (!str) return;
    const tw = measure(str, 'micro');
    text(s, str, Math.max(2, Math.floor((w - tw) / 2)), 3 + i * 10, ramp[3], 'micro', {
      alignTop: true,
      shadow: ramp[1],
    });
  });
  const img = cv(s);
  if (leds.size > 160) leds.clear();
  leds.set(key, img);
  return img;
}

// ----- surfaces -----
// Stained plaster: a flat tone, water streaks running down from the ceiling and grime
// gathering towards the floor.
export function grimeWall(
  s: Sprite,
  x0: number,
  y0: number,
  w: number,
  h: number,
  ramp: Ramp,
  seed = 3,
) {
  srand(seed);
  const streaks: { x: number; len: number }[] = [];
  for (let i = 0; i < Math.ceil(w / 14); i++)
    streaks.push({ x: x0 + ri(0, w - 1), len: ri(10, h * 0.7) });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = x0 + x,
        Y = y0 + y,
        k = y / h;
      let c = ramp[2];
      if (bayer(X, Y) < k * 0.5) c = ramp[1];
      if (bayer(X * 7, Y * 3) < 0.03) c = ramp[1];
      s.set(X, Y, c);
    }
  for (const st of streaks) {
    for (let j = 0; j < st.len; j++) {
      const X = st.x + (j % 9 === 8 ? 1 : 0),
        Y = y0 + j;
      if (bayer(X, Y) < 0.75 - (j / st.len) * 0.6) s.set(X, Y, ramp[1]);
    }
  }
}
export function lino(s: Sprite, x0: number, y0: number, w: number, h: number) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = x0 + x,
        Y = y0 + y;
      const u = Math.floor((X + Math.floor(y * 0.5)) / 10),
        v = Math.floor(y / 6);
      let c = (u + v) % 2 ? '#2e2c28' : '#3c3a32';
      if ((u + v) % 2 === 0 && bayer(X, Y) < 0.06) c = '#46433a';
      if (bayer(X * 5, Y * 3) < 0.03) c = '#24221e';
      s.set(X, Y, c);
    }
  s.hline(x0, y0, w, '#1c1a16');
}
export function brick(
  s: Sprite,
  x0: number,
  y0: number,
  w: number,
  h: number,
  ramp: Ramp,
  opts: { grime?: number; seed?: number } = {},
) {
  srand(opts.seed || 9);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = x0 + x,
        Y = y0 + y;
      const row = Math.floor(Y / 5),
        off = row % 2 ? 6 : 0;
      const mortarH = Y % 5 === 4,
        mortarV = (X + off) % 12 === 11;
      let c = ramp[2];
      if (mortarH || mortarV) c = ramp[0];
      else if (Y % 5 === 0) c = ramp[3];
      else if ((X + off) % 12 === 10) c = ramp[1];
      if (!mortarH && !mortarV && bayer(X * 3, Y * 7) < (opts.grime || 0.08)) c = ramp[1];
      s.set(X, Y, c);
    }
}
// A dithered cone of light, tinting whatever is already painted.
export function cone(
  s: Sprite,
  cx: number,
  topY: number,
  baseY: number,
  halfTop: number,
  halfBase: number,
  tint: string,
  strength = 0.26,
  amt = 0.22,
) {
  for (let y = topY; y < baseY; y++) {
    const k = (y - topY) / (baseY - topY),
      half = halfTop + (halfBase - halfTop) * k;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const c = s.get(x, y);
      const edge = 1 - Math.abs(x - cx) / Math.max(1, half);
      if (c && bayer(x, y) < strength * (1 - k * 0.45) * (0.5 + edge))
        s.set(x, y, mix(c, tint, amt));
    }
  }
}
