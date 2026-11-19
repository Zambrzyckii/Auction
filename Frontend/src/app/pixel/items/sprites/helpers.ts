import { R, type Col, type Ramp, type Sprite } from '../../street/pix';
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
  [...str].forEach((ch, n) =>
    DIGITS[ch]?.forEach((row, j) =>
      [...row].forEach((v, i) => {
        if (v === '1') s.set(x + n * 4 + i, y + j, col);
      }),
    ),
  );
}
