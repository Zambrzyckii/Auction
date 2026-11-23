// Sprite builders for the card room. Cards with clean rotation and flip frames, chips,
// plates, stamps, LED boards, neon, marquee bulbs, carpet and wallpaper.
// Pure drawing, no state. People, slot machines and the bar live in floor.ts.
import type { FontKey, Ramp } from '../street/pix';
import {
  INK,
  R,
  Sprite,
  bayer,
  box,
  cylH,
  disc,
  glyphMask,
  measure,
  mix,
  sphere,
  text,
} from '../street/pix';

export { cylH, sphere };

export type PlateLine = readonly [string, FontKey, string];
export interface Stack {
  key: string;
  n: number;
}

export const FELT = ['#0f2419', '#163626', '#1e4a33', '#2a6244'];
export const NEON = ['#38102e', '#6e1f57', '#b23386', '#ff7fd2'];
export const CYAN = ['#0b2530', '#164a58', '#2a8ea3', '#8ef0ff'];
export const AMBER = ['#3a1e08', '#7a4210', '#d98a1c', '#ffd166'];
export const LED = ['#2a0c10', '#571519', '#a82230', '#ff4a4e'];
export const CHIP: Record<string, Ramp> = {
  w: R.paper,
  r: R.red,
  g: R.sign,
  k: R.black,
  p: R.purple,
};
export const DENOMS: [number, string][] = [
  [500, 'p'],
  [100, 'k'],
  [25, 'g'],
  [5, 'r'],
  [1, 'w'],
];
export const CARD_RED = '#c42a36';
const cv = (s: Sprite) => s.canvas();

// ----- rotation: Scale2x twice, then sample the big copy at rotated art-pixel centres -----
export function scale2x(src: Sprite): Sprite {
  const w = src.w,
    h = src.h,
    out = new Sprite(w * 2, h * 2);
  const g = (x: number, y: number) =>
    src.c[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = g(x, y),
        A = g(x, y - 1),
        B = g(x + 1, y),
        C = g(x - 1, y),
        D = g(x, y + 1);
      const o = y * 2 * out.w + x * 2;
      out.c[o] = C === A && C !== D && A !== B ? A : P;
      out.c[o + 1] = A === B && A !== C && B !== D ? B : P;
      out.c[o + out.w] = D === C && D !== B && C !== A ? C : P;
      out.c[o + out.w + 1] = B === D && B !== A && D !== C ? D : P;
    }
  return out;
}
export function rotate(src: Sprite, deg: number): Sprite {
  if (!deg) return src;
  const big = scale2x(scale2x(src)),
    k = 4;
  const a = (deg * Math.PI) / 180,
    ca = Math.cos(a),
    sa = Math.sin(a);
  const W = Math.ceil(Math.abs(src.w * ca) + Math.abs(src.h * sa)) + 2;
  const H = Math.ceil(Math.abs(src.w * sa) + Math.abs(src.h * ca)) + 2;
  const out = new Sprite(W, H);
  const cx = src.w / 2,
    cy = src.h / 2,
    ox = W / 2,
    oy = H / 2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - ox,
        dy = y + 0.5 - oy;
      const sx = dx * ca + dy * sa + cx,
        sy = -dx * sa + dy * ca + cy;
      const bx = Math.floor(sx * k),
        by = Math.floor(sy * k);
      if (bx < 0 || by < 0 || bx >= big.w || by >= big.h) continue;
      const c = big.c[by * big.w + bx];
      if (c) out.c[y * W + x] = c;
    }
  return out;
}
// Narrow a sprite to width w for a flip frame, keeping both outline columns.
export function squeeze(src: Sprite, w: number): Sprite {
  const out = new Sprite(w, src.h);
  for (let x = 0; x < w; x++) {
    let sx: number;
    if (x === 0) sx = 0;
    else if (x === w - 1) sx = src.w - 1;
    else sx = 1 + Math.min(src.w - 3, Math.floor(((x - 0.5) * (src.w - 2)) / Math.max(1, w - 2)));
    for (let y = 0; y < src.h; y++) out.c[y * w + x] = src.c[y * src.w + sx];
  }
  return out;
}
const rot180 = (sp: Sprite) => {
  const o = new Sprite(sp.w, sp.h);
  sp.each((x, y, c) => {
    if (c) o.c[(sp.h - 1 - y) * o.w + (sp.w - 1 - x)] = c;
  });
  return o;
};

// ----- plates: same construction as the street popups -----
const LINE_H: Record<string, number> = { tiny: 10, micro: 12, jersey: 24 };
const plates = new Map<string, HTMLCanvasElement>();
export function plate(lines: readonly PlateLine[]): HTMLCanvasElement {
  const key = JSON.stringify(lines);
  const cached = plates.get(key);
  if (cached) return cached;
  const widths = lines.map(([t, f]) => measure(t, f));
  const w = Math.max(...widths) + 8;
  const h = lines.reduce((n, [, f]) => n + LINE_H[f], 0) + 5;
  const s = new Sprite(w, h);
  const tone = mix(lines[Math.min(1, lines.length - 1)][2], INK, 0.35);
  s.rect(1, 1, w - 2, h - 2, INK);
  s.hline(1, 0, w - 2, tone);
  s.hline(1, h - 1, w - 2, tone);
  s.vline(0, 1, h - 2, tone);
  s.vline(w - 1, 1, h - 2, tone);
  let y = 3;
  lines.forEach(([t, f, col], k) => {
    text(s, t, Math.floor((w - widths[k]) / 2), y, col, f, { alignTop: true });
    y += LINE_H[f];
  });
  const img = cv(s);
  if (plates.size > 160) plates.clear();
  plates.set(key, img);
  return img;
}

const stamps = new Map<string, HTMLCanvasElement>();
export function stamp(word: string, ramp: Ramp): HTMLCanvasElement {
  const cached = stamps.get(word);
  if (cached) return cached;
  const w = measure(word, 'jersey') + 14,
    h = 34;
  const s = new Sprite(w, h);
  for (const k of [0, 1]) {
    s.hline(k, k, w - 2 * k, ramp[2]);
    s.hline(k, h - 1 - k, w - 2 * k, ramp[2]);
    s.vline(k, k, h - 2 * k, ramp[2]);
    s.vline(w - 1 - k, k, h - 2 * k, ramp[2]);
  }
  text(s, word, 7, 5, ramp[3], 'jersey', { alignTop: true });
  const img = cv(s);
  stamps.set(word, img);
  return img;
}

const leds = new Map<string, HTMLCanvasElement>();
export function led(str: string, ramp: Ramp = LED): HTMLCanvasElement {
  const key = ramp[3] + str;
  const cached = leds.get(key);
  if (cached) return cached;
  const w = measure(str, 'micro') + 8,
    h = 15;
  const s = new Sprite(w, h);
  s.rect(0, 0, w, h, '#0c0810');
  s.hline(0, 0, w, ramp[0]);
  s.hline(0, h - 1, w, ramp[0]);
  text(s, str, 4, 3, ramp[3], 'micro', { alignTop: true, shadow: ramp[1] });
  const img = cv(s);
  if (leds.size > 160) leds.clear();
  leds.set(key, img);
  return img;
}

// ----- chips -----
function chipSide(key: string) {
  const ramp = CHIP[key],
    s = new Sprite(9, 3);
  s.hline(0, 0, 9, ramp[3]);
  s.set(2, 0, R.white[3]);
  s.set(6, 0, R.white[3]);
  s.hline(0, 1, 9, ramp[2]);
  s.set(2, 1, R.white[2]);
  s.set(6, 1, R.white[2]);
  s.hline(0, 2, 9, ramp[1]);
  return cv(s);
}
function chipFlat(key: string) {
  const ramp = CHIP[key],
    s = new Sprite(9, 9);
  disc(s, 4, 4, 4.2, ramp[2]);
  disc(s, 4, 4, 2.4, ramp[3]);
  s.set(4, 0, R.white[3]);
  s.set(4, 8, R.white[3]);
  s.set(0, 4, R.white[3]);
  s.set(8, 4, R.white[3]);
  s.set(1, 1, R.white[2]);
  s.set(7, 1, R.white[2]);
  s.set(1, 7, R.white[2]);
  s.set(7, 7, R.white[2]);
  return cv(s);
}
export const chips: {
  side: Record<string, HTMLCanvasElement>;
  flat: Record<string, HTMLCanvasElement>;
} = { side: {}, flat: {} };
for (const k of Object.keys(CHIP)) {
  chips.side[k] = chipSide(k);
  chips.flat[k] = chipFlat(k);
}
export function stacksOf(balance: number): Stack[] {
  const out: Stack[] = [];
  let rest = Math.max(0, Math.round(balance));
  for (const [value, key] of DENOMS) {
    let n = Math.floor(rest / value);
    rest -= n * value;
    while (n > 0) {
      const take = Math.min(8, n);
      out.push({ key, n: take });
      n -= take;
    }
  }
  return out.slice(0, 10);
}
export const chipKeyFor = (stake: number): string => {
  if (stake >= 500) return 'p';
  if (stake >= 100) return 'k';
  if (stake >= 25) return 'g';
  if (stake >= 5) return 'r';
  return 'w';
};

// ----- cards: 24x34, index top left and rotated bottom right -----
export const CW = 24,
  CH = 34;
const SUITS = [
  ['..#..', '.###.', '#.#.#', '#####', '..#..'],
  ['..#..', '.###.', '#####', '.###.', '..#..'],
  ['.#.#.', '#####', '#####', '.###.', '..#..'],
  ['..#..', '.###.', '#####', '..#..', '.###.'],
];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const FACES: Partial<Record<string, string[]>> = {
  K: [
    '.g.gg.g.',
    '.gGggGg.',
    '.ssssss.',
    '.sksskS.',
    '.ssssss.',
    '.hhhhhh.',
    '..hhhh..',
    'cgccccgc',
    'ccgccgcc',
    'cccggccc',
    'cCccccCc',
    'cCccccCc',
  ],
  Q: [
    '..g..g..',
    '..gGGg..',
    '.hssssh.',
    'hsksskSh',
    'hssssssh',
    'hsSrrSsh',
    'h.ssss.h',
    'cgcwwcgc',
    'ccwwwwcc',
    'cccwwccc',
    'cCccccCc',
    'cCccccCc',
  ],
  J: [
    '...ccw..',
    '..ccccw.',
    '.hssssh.',
    '.sksskS.',
    '.ssssss.',
    '..sSSs..',
    '...ss...',
    'cgcgcgcg',
    'gcgcgcgc',
    'cccccccc',
    'cCccccCc',
    'cCccccCc',
  ],
};
function suitInto(
  s: Sprite,
  mask: readonly string[],
  x: number,
  y: number,
  scale: number,
  col: string,
) {
  mask.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === '#') s.rect(x + i * scale, y + j * scale, scale, scale, col);
    }),
  );
}
function cardShape() {
  const s = new Sprite(CW, CH);
  for (let j = 1; j <= CH - 2; j++)
    for (let i = 1; i <= CW - 2; i++) {
      if ((i === 1 || i === CW - 2) && (j === 1 || j === CH - 2)) continue;
      s.set(i, j, R.white[3]);
    }
  for (let j = 2; j < CH - 2; j++) s.set(CW - 2, j, R.white[2]);
  for (let i = 2; i < CW - 2; i++) s.set(i, CH - 2, R.white[2]);
  return s;
}
function indexSprite(rank: string, suit: number, col: string) {
  const font = measure(rank, 'micro') <= 10 ? 'micro' : 'tiny';
  const t = new Sprite(10, 18);
  const m = text(t, rank, 0, 0, col, font, { alignTop: true });
  suitInto(t, SUITS[suit], 0, m.bottom - m.top + 3, 1, col);
  return t;
}
const cardSprites = new Map<number, Sprite>();
export function cardSprite(code: number): Sprite {
  const cached = cardSprites.get(code);
  if (cached) return cached;
  let s: Sprite;
  if (code < 0) s = backSprite();
  else {
    const rank = RANKS[code % 13],
      suit = Math.floor(code / 13);
    const red = suit === 1 || suit === 2;
    const col = red ? CARD_RED : INK;
    s = cardShape();
    const idx = indexSprite(rank, suit, col);
    s.stamp(idx, 2, 2);
    s.stamp(rot180(idx), CW - 12, CH - 20);
    const face = FACES[rank];
    if (face) {
      s.rect(7, 10, 10, 14, R.gold[2]);
      s.rect(8, 11, 8, 12, red ? '#f6dcd6' : '#dcd8ea');
      const pal: Record<string, string> = {
        g: R.gold[2],
        G: R.gold[3],
        s: R.skinC[3],
        S: R.skinC[2],
        k: INK,
        h: red ? R.blond[2] : R.hair[2],
        c: col,
        C: red ? '#8a1c26' : '#2c2735',
        w: R.white[3],
        r: CARD_RED,
      };
      face.forEach((row, j) =>
        [...row].forEach((ch, i) => {
          if (pal[ch]) s.set(8 + i, 11 + j, pal[ch]);
        }),
      );
    } else {
      suitInto(s, SUITS[suit], 7, 12, 2, col);
    }
    s.outline({ selective: false });
  }
  cardSprites.set(code, s);
  return s;
}
function backSprite() {
  const s = cardShape();
  for (let j = 3; j <= CH - 4; j++)
    for (let i = 3; i <= CW - 4; i++) {
      const lattice = (i + j) % 4 === 0 || (i - j + 64) % 4 === 0;
      s.set(i, j, lattice ? R.red[2] : R.red[1]);
    }
  for (let i = 3; i <= CW - 4; i++) {
    s.set(i, 3, R.red[3]);
    s.set(i, CH - 4, R.red[0]);
  }
  for (let j = 3; j <= CH - 4; j++) {
    s.set(3, j, R.red[3]);
    s.set(CW - 4, j, R.red[0]);
  }
  const cx = 11.5,
    cy = 16.5;
  for (let j = 0; j < CH; j++)
    for (let i = 0; i < CW; i++) {
      const d = Math.abs(i - cx) + Math.abs(j - cy);
      if (d <= 4) s.set(i, j, d <= 1.5 ? R.gold[3] : R.gold[2]);
      else if (d <= 5) s.set(i, j, R.red[0]);
    }
  s.outline({ selective: false });
  return s;
}
// Cached canvases: face (code >= 0) or back (-1), at a whole-degree tilt and a flip width.
const cardCache = new Map<string, HTMLCanvasElement>();
export function card(code: number, deg = 0, width = CW): HTMLCanvasElement {
  const key = code + '|' + deg + '|' + width;
  let c = cardCache.get(key);
  if (c) return c;
  let sp = cardSprite(code);
  if (width !== CW) sp = squeeze(sp, width);
  c = cv(rotate(sp, deg));
  if (cardCache.size > 1400) cardCache.clear();
  cardCache.set(key, c);
  return c;
}
export const cardShadow = (() => {
  const s = new Sprite(CW, CH);
  for (let j = 1; j < CH - 1; j++)
    for (let i = 1; i < CW - 1; i++) if (bayer(i, j) < 0.62) s.set(i, j, '#0a1a12');
  return cv(s);
})();

// ----- neon: bright tube, coloured rim, dithered spill; "off" keeps the dark tube -----
export function neon(str: string, font: FontKey, ramp: Ramp, core?: string) {
  const m = glyphMask(str, font);
  const pad = 4,
    gw = m.w + 3,
    gh = m.bottom - m.top + 1;
  const w = gw + pad * 2,
    h = gh + pad * 2;
  const grid = new Int8Array(w * h).fill(-1);
  const q: number[] = [];
  for (const [x, y] of m.pts) {
    const gx = x + pad + 1,
      gy = y - m.top + pad;
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
    const k = gy * w + gx;
    if (grid[k] !== 0) {
      grid[k] = 0;
      q.push(k);
    }
  }
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi],
      d = grid[k];
    if (d >= 3) continue;
    const x = k % w,
      y = (k / w) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx;
      if (grid[nk] === -1) {
        grid[nk] = d + 1;
        q.push(nk);
      }
    }
  }
  const on = new Sprite(w, h),
    off = new Sprite(w, h);
  const glyph = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && grid[y * w + x] === 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = grid[y * w + x];
      if (d === 0) {
        const inner = glyph(x - 1, y) && glyph(x + 1, y) && glyph(x, y - 1) && glyph(x, y + 1);
        on.set(x, y, inner ? core || ramp[3] : ramp[3]);
        off.set(x, y, inner ? ramp[1] : mix(ramp[1], INK, 0.3));
      } else if (d === 1) on.set(x, y, ramp[2]);
      else if (d === 2 && bayer(x, y) < 0.5) on.set(x, y, ramp[1]);
      else if (d === 3 && bayer(x, y) < 0.22) on.set(x, y, ramp[0]);
    }
  return { on: cv(on), off: cv(off), w, h };
}

// ----- marquee bulbs -----
export const bulbOn = (() => {
  const s = new Sprite(5, 5);
  s.set(2, 0, R.gold[1]);
  s.set(0, 2, R.gold[1]);
  s.set(4, 2, R.gold[1]);
  s.set(2, 4, R.gold[1]);
  s.set(1, 1, R.lit[2]);
  s.set(3, 1, R.lit[2]);
  s.set(1, 3, R.lit[2]);
  s.set(3, 3, R.lit[2]);
  s.set(2, 1, R.lit[3]);
  s.set(1, 2, R.lit[3]);
  s.set(3, 2, R.lit[3]);
  s.set(2, 3, R.lit[3]);
  s.set(2, 2, '#ffffff');
  return cv(s);
})();
export function bulbOff(s: Sprite, x: number, y: number) {
  s.set(x, y, '#5a3a20');
  s.set(x + 1, y, '#3f2a1e');
  s.set(x, y + 1, '#3f2a1e');
  s.set(x + 1, y + 1, '#2a1c16');
}
// Bulb centres around a rectangle, clockwise from the top left, every `step` pixels.
export function ring(x: number, y: number, w: number, h: number, step: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < w; i += step) pts.push([x + i, y]);
  for (let j = step; j < h; j += step) pts.push([x + w, y + j]);
  for (let i = w; i > 0; i -= step) pts.push([x + i, y + h]);
  for (let j = h; j > 0; j -= step) pts.push([x, y + j]);
  return pts;
}

// ----- floor and walls -----
export function carpetAt(u: number, v: number): string {
  const cu = ((u % 16) + 16) % 16,
    cvv = ((v % 16) + 16) % 16;
  const near = (px: number, py: number, r: number) => {
    for (const [ox, oy] of [
      [0, 0],
      [16, 0],
      [0, 16],
      [16, 16],
      [8, 8],
    ]) {
      const d = Math.abs(cu - ox - px) + Math.abs(cvv - oy - py);
      if (d <= r) return d;
    }
    return -1;
  };
  const star = near(0, 0, 2);
  if (star === 0) return '#ffd166';
  if (star === 1) return '#d9a520';
  if (star === 2 && (cu % 16 === 0 || cvv % 16 === 0 || cu === 8 || cvv === 8)) return '#a06a14';
  const dot = (() => {
    for (const [ox, oy] of [
      [8, 0],
      [0, 8],
      [16, 8],
      [8, 16],
    ]) {
      if (Math.abs(cu - ox) + Math.abs(cvv - oy) <= 1) return true;
    }
    return false;
  })();
  if (dot) return '#b0383a';
  if ((cu === 4 || cu === 12) && (cvv === 4 || cvv === 12)) return '#2a8ea3';
  const a = (u + v) & 7,
    b = (u - v) & 7;
  if (a === 0 || b === 0) return '#45204f';
  return (u ^ v) & 1 ? '#2a1131' : '#26102c';
}
export function carpet(s: Sprite, x0: number, y0: number, w: number, h: number) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) s.set(x0 + x, y0 + y, carpetAt(x0 + x, Math.floor(y * 1.6)));
  for (let x = 0; x < w; x++) s.set(x0 + x, y0, '#170a1b');
}
const FLEUR = [
  '...#...',
  '..###..',
  '.#.#.#.',
  '#..#..#',
  '#.###.#',
  '.#####.',
  '..###..',
  '...#...',
  '.#####.',
  '#.....#',
  '...#...',
];
export function wallpaper(s: Sprite, x0: number, y0: number, w: number, h: number) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = x0 + x,
        Y = y0 + y;
      const row = Math.floor(Y / 20),
        ox = row % 2 ? 9 : 0;
      const fx = ((((X + ox) % 18) + 18) % 18) - 5,
        fy = (((Y % 20) + 20) % 20) - 4;
      let c = R.plum[1];
      if (X % 18 === 0) c = '#2b1a31';
      if (fx >= 0 && fx < 7 && fy >= 0 && fy < 11 && FLEUR[fy][fx] === '#') c = '#40264a';
      s.set(X, Y, c);
    }
}
export function wainscot(s: Sprite, x0: number, y0: number, w: number, h: number) {
  s.rect(x0, y0, w, 3, R.wood[2]);
  s.hline(x0, y0, w, R.wood[3]);
  s.hline(x0, y0 + 3, w, R.wood[0]);
  s.rect(x0, y0 + 4, w, h - 4, R.wood[0]);
  for (let x = x0 + 4; x + 30 < x0 + w; x += 36) {
    s.rect(x, y0 + 8, 30, h - 12, '#33231a');
    s.hline(x, y0 + 8, 30, '#2a1c16');
    s.vline(x, y0 + 8, h - 12, '#2a1c16');
    s.hline(x, y0 + h - 5, 30, R.wood[1]);
    s.vline(x + 29, y0 + 8, h - 12, R.wood[1]);
  }
}
export function ceiling(s: Sprite, w: number): [number, number][] {
  s.rect(0, 0, w, 10, '#0d0a12');
  s.hline(0, 9, w, R.gold[1]);
  s.hline(0, 10, w, R.gold[0]);
  const pts: [number, number][] = [];
  for (let x = 4; x < w; x += 8) {
    bulbOff(s, x, 4);
    pts.push([x + 1, 5]);
  }
  return pts;
}
// A pendant lamp with a dithered cone of warm light.
export function lamp(
  s: Sprite,
  cx: number,
  topY: number,
  baseY: number,
  halfW: number,
  tint: string = '#f2c66d',
) {
  for (let y = topY; y < baseY; y++) {
    const k = (y - topY) / (baseY - topY),
      half = 3 + halfW * k;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const c = s.get(x, y);
      if (c && bayer(x, y) < 0.26 * (1 - k * 0.5)) s.set(x, y, mix(c, tint, 0.2));
    }
  }
  s.rect(cx, 10, 1, topY - 16, R.black[2]);
  box(s, cx - 6, topY - 7, 12, 6, R.rust, { band: 1 });
  s.rect(cx - 4, topY - 2, 8, 2, '#ffe9a8');
}
