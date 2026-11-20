import { INK, R, Sprite, type Col, type Ramp } from '../../street/pix';
import type { Rarity } from '../rarity';

const ACCENT: Readonly<Record<Rarity, Ramp>> = {
  Common: R.grey,
  Rare: R.denim,
  Epic: R.purple,
  Legendary: R.gold,
};

export const accentOf = (rarity: Rarity): Ramp => ACCENT[rarity];

export const ell =
  (cx: number, cy: number, rx: number, ry: number) =>
  (x: number, y: number): boolean =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

type Point = readonly [number, number];

const inside = (pts: readonly Point[], x: number, y: number): boolean => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi)
      c = !c;
  }
  return c;
};

export function poly(s: Sprite, pts: readonly Point[], col: Col): void {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) if (inside(pts, x, y)) s.set(x, y, col);
}

export function cylTone(f: number): 0 | 1 | 2 | 3 {
  if (f < 0.12) return 2;
  if (f < 0.4) return 3;
  if (f < 0.72) return 2;
  if (f < 0.9) return 1;
  return 0;
}

export function lightTone(dx: number, dy: number, d: number): 0 | 1 | 2 | 3 {
  const l = (-dx - dy) / (d * 1.414);
  if (l > 0.55) return 3;
  if (l > -0.25) return 2;
  if (l > -0.75) return 1;
  return 0;
}

export function bezier(p0: Point, p1: Point, p2: Point, p3: Point, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0];
    const y = u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1];
    const q: [number, number] = [Math.round(x), Math.round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  return out;
}

const DIGITS: Readonly<Record<string, readonly string[]>> = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

export function digits(s: Sprite, str: string, x: number, y: number, col: Col): void {
  [...str].forEach((ch, n) => {
    const glyph = DIGITS[ch];
    if (!glyph) throw new Error(`digits: unsupported character "${ch}"`);
    glyph.forEach((row, j) =>
      [...row].forEach((v, i) => {
        if (v === '1') s.set(x + n * 4 + i, y + j, col);
      }),
    );
  });
}

export function mask(pts: readonly Point[]): (x: number, y: number) => boolean {
  const m = new Sprite(32, 32);
  poly(m, pts, INK);
  return (x, y) => m.get(x, y) !== null;
}

export function flat(s: Sprite, test: (x: number, y: number) => boolean, col: Col): void {
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (test(x, y)) s.set(x, y, col);
}

export function blit(s: Sprite, rows: readonly string[], x: number, y: number, col: string): void {
  rows.forEach((row, j) =>
    [...row].forEach((v, i) => {
      if (v === '1') s.set(x + i, y + j, col);
    }),
  );
}

export const thick =
  (x0: number, y0: number, x1: number, y1: number, r0: number, r1 = r0) =>
  (x: number, y: number): boolean => {
    const px = x + 0.5 - x0;
    const py = y + 0.5 - y0;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - t * dx, py - t * dy) <= r0 + (r1 - r0) * t;
  };

export const sweep = (
  pts: readonly Point[],
  r0: number,
  r1 = r0,
): ((x: number, y: number) => boolean) => {
  const last = pts.length - 1;
  const parts = pts
    .slice(1)
    .map((p, i) =>
      thick(
        pts[i][0] + 0.5,
        pts[i][1] + 0.5,
        p[0] + 0.5,
        p[1] + 0.5,
        r0 + ((r1 - r0) * i) / last,
        r0 + ((r1 - r0) * (i + 1)) / last,
      ),
    );
  return (x, y) => parts.some((f) => f(x, y));
};

export function starPoints(cx: number, cy: number, ro: number, ri: number): Point[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? ri : ro;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  });
}

export function sparkle(s: Sprite, x: number, y: number, col: string): void {
  s.set(x, y, col);
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    s.set(x + dx, y + dy, col);
}
