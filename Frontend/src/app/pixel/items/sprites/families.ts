import {
  INK,
  R,
  Sprite,
  bayer,
  box,
  rand,
  shape,
  sphere,
  srand,
  type Ramp,
} from '../../street/pix';
import type { Rarity } from '../rarity';
import { accentOf, cylTone, ell, poly } from './helpers';

const GLYPH_Q = [
  '.00000.',
  '0000000',
  '00...00',
  '00...00',
  '.....00',
  '....00.',
  '...00..',
  '...00..',
  '.......',
  '...00..',
  '...00..',
];

export function mystery(rarity: Rarity): Sprite {
  const s = new Sprite(32, 32);
  const acc = accentOf(rarity);
  shape(s, (i, j) => i >= 5 && i <= 26 && j >= 8 && j <= 29, R.tan, { band: 2 });
  for (let j = 9; j < 29; j++) {
    s.set(22, j, R.tan[1]);
    s.set(23, j, R.tan[1]);
  }
  s.rect(24, 9, 2, 20, R.tan[0]);
  shape(s, (i, j) => i >= 4 && i <= 27 && j >= 4 && j <= 10, R.tan, { band: 1 });
  s.hline(5, 9, 22, R.tan[1]);
  for (let i = 4; i <= 27; i += 4) s.set(i, 4, null);
  const gx = 10;
  const gy = 13;
  const glyph = (dx: number, dy: number, col: string) =>
    GLYPH_Q.forEach((row, j) =>
      [...row].forEach((v, i) => {
        if (v === '0') s.set(gx + i + dx, gy + j + dy, col);
      }),
    );
  glyph(1, 1, INK);
  glyph(1, 0, INK);
  glyph(0, 1, INK);
  GLYPH_Q.forEach((row, j) =>
    [...row].forEach((v, i) => {
      if (v === '0') s.set(gx + i, gy + j, acc[i < 3 ? 3 : 2]);
    }),
  );
  return s.outline();
}

export function warehouseFind(rarity: Rarity): Sprite {
  const s = new Sprite(32, 32);
  const acc = accentOf(rarity);
  const fx = 2;
  const fy = 14;
  const fw = 22;
  const fh = 14;
  const d = 6;
  poly(
    s,
    [
      [fx, fy],
      [fx + fw, fy],
      [fx + fw + d, fy - d],
      [fx + d, fy - d],
    ],
    R.tan[3],
  );
  poly(
    s,
    [
      [fx + fw, fy],
      [fx + fw + d, fy - d],
      [fx + fw + d, fy + fh - d],
      [fx + fw, fy + fh],
    ],
    R.tan[1],
  );
  s.rect(fx, fy, fw, fh, R.tan[2]);
  s.hline(fx, fy, fw, R.tan[3]);
  s.hline(fx, fy + fh - 1, fw, R.tan[1]);
  s.vline(fx, fy, fh, R.tan[3]);
  for (let k = 1; k < d; k++) s.set(fx + fw + k - 1, fy - k, R.tan[2]);
  s.line(fx + 3, fy - 3, fx + fw + 3, fy - 3, R.tan[1]);
  const tx = 10;
  const tw = 5;
  for (let k = 0; k <= d; k++) {
    s.hline(tx + k, fy - k, tw, acc[2]);
    s.set(tx + k, fy - k, acc[3]);
    s.set(tx + k + tw - 1, fy - k, acc[1]);
  }
  for (let j = fy; j < fy + 8; j++) {
    s.hline(tx, j, tw, acc[2]);
    s.set(tx, j, acc[3]);
    s.set(tx + tw - 1, j, acc[1]);
  }
  s.hline(tx, fy + 8, tw, acc[1]);
  s.rect(fx + 3, fy + 6, 5, 6, R.paper[3]);
  s.hline(fx + 4, fy + 8, 3, R.paper[1]);
  s.hline(fx + 4, fy + 10, 3, R.paper[1]);
  return s.outline();
}

export function pawnedGood(rarity: Rarity): Sprite {
  const s = new Sprite(32, 32);
  const acc = accentOf(rarity);
  shape(s, ell(13, 19, 11, 9.5), R.tan, { band: 2 });
  for (let k = 0; k < 6; k++) {
    s.set(9 - k, 13 + k, R.tan[1]);
    s.set(17 + k, 13 + k, R.tan[1]);
  }
  s.line(9, 22, 13, 27, R.tan[1]);
  for (let j = 9; j < 29; j++) {
    s.set(13, j, acc[2]);
    s.set(14, j, acc[1]);
  }
  for (let i = 3; i < 24; i++) {
    const y = 19 + Math.round(((i - 13) / 11) ** 2 * 2);
    s.set(i, y, acc[2]);
    s.set(i, y + 1, acc[1]);
  }
  box(s, 10, 6, 7, 4, R.tan);
  s.rect(11, 3, 2, 3, acc[2]);
  s.rect(14, 4, 2, 2, acc[2]);
  s.line(15, 10, 26, 13, acc[1]);
  shape(
    s,
    (i, j) => i >= 21 && i <= 29 && j >= 13 && j <= 28 && !((i === 21 || i === 29) && j === 13),
    R.paper,
    { band: 1 },
  );
  s.rect(22, 18, 7, 3, acc[2]);
  s.hline(22, 20, 7, acc[1]);
  s.hline(23, 23, 5, R.paper[0]);
  s.hline(23, 25, 4, R.paper[0]);
  s.set(25, 15, INK);
  return s.outline();
}

const WRENCH_TONES = [0, 0, 2, 3] as const;

export function craftedItem(rarity: Rarity): Sprite {
  const s = new Sprite(32, 32);
  const acc = accentOf(rarity);
  const gear = (
    cx: number,
    cy: number,
    ro: number,
    rb: number,
    teeth: number,
    ramp: Ramp,
    hole: number,
    groove: boolean,
  ) => {
    const test = (i: number, j: number) => {
      const dx = i + 0.5 - cx;
      const dy = j + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d < hole) return false;
      return d <= (Math.cos(Math.atan2(dy, dx) * teeth) > -0.15 ? ro : rb);
    };
    shape(s, test, ramp, {
      band: 1,
      x0: Math.floor(cx - ro - 1),
      y0: Math.floor(cy - ro - 1),
      x1: Math.ceil(cx + ro + 2),
      y1: Math.ceil(cy + ro + 2),
    });
    if (!groove) return;
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 32; i++) {
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
        if (test(i, j) && d > rb - 3.2 && d < rb - 2.2) s.set(i, j, ramp[1]);
      }
  };
  gear(22.5, 22, 8, 6.4, 6, acc, 1.8, false);
  gear(12, 12, 10.2, 8.2, 8, R.steel, 2, true);
  sphere(s, 12.5, 12.5, 3.2, R.steel, R.white[3]);
  s.line(11, 14, 14, 11, R.steel[0]);
  sphere(s, 22.5, 22.5, 1.8, R.steel, R.white[3]);
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 32; i++) {
      const u = (i - j) / 1.414;
      const v = (i + j - 34) / 1.414;
      if (Math.abs(u) > 9 || Math.abs(v) > 2.4) continue;
      if (Math.abs(u) > 7.5 && (i + j) % 2 === 0) continue;
      s.set(i, j, R.white[WRENCH_TONES[cylTone((v + 2.4) / 4.8)]]);
    }
  for (const [x, y] of [
    [15, 14],
    [17, 12],
    [19, 10],
    [12, 16],
    [10, 18],
  ])
    s.set(x, y, R.white[0]);
  return s.outline();
}

export function rustyToolbox(): Sprite {
  srand(81);
  const s = new Sprite(32, 32);
  for (let i = 0; i < 9; i++) {
    const t = (i / 8) * Math.PI;
    s.set(Math.round(16 - Math.cos(t) * 5), Math.round(11 - Math.sin(t) * 5), R.grey[3]);
    s.set(Math.round(16 - Math.cos(t) * 5), Math.round(12 - Math.sin(t) * 5), R.grey[1]);
  }
  box(s, 3, 11, 26, 4, R.red);
  box(s, 3, 15, 26, 13, R.red, { band: 2 });
  s.hline(3, 15, 26, R.red[0]);
  box(s, 14, 14, 4, 3, R.grey);
  for (let k = 0; k < 70; k++) {
    const x = 4 + Math.floor(rand() * 24);
    const y = 11 + Math.floor(rand() * 15);
    if (bayer(x, y) < 0.45 && (x < 12 || y > 20)) s.set(x, y + 1, R.rust[rand() < 0.5 ? 1 : 2]);
  }
  s.set(22, 19, R.red[1]);
  s.set(23, 19, R.red[3]);
  return s.outline();
}

export function oldRadio(): Sprite {
  const s = new Sprite(32, 32);
  s.line(22, 10, 29, 1, R.gold[3]);
  s.line(23, 10, 30, 1, R.gold[1]);
  shape(
    s,
    (i, j) =>
      i >= 3 && i <= 28 && j >= 10 && j <= 27 && !((i === 3 || i === 28) && (j === 10 || j === 27)),
    R.wood,
    { band: 2 },
  );
  for (let j = 13; j < 25; j++)
    for (let i = 6; i < 16; i++) s.set(i, j, (i + j) % 2 ? R.paper[1] : R.paper[2]);
  s.hline(6, 13, 10, R.wood[0]);
  box(s, 18, 13, 8, 5, R.gold);
  s.vline(21, 14, 3, R.red[2]);
  sphere(s, 20, 22, 2.3, R.wood, R.wood[3]);
  sphere(s, 25.5, 22, 2.3, R.wood, R.wood[3]);
  return s.outline();
}

export function wornBackpack(): Sprite {
  srand(83);
  const s = new Sprite(32, 32);
  s.line(13, 4, 18, 4, R.black[2]);
  s.vline(12, 5, 3, R.black[2]);
  s.vline(19, 5, 3, R.black[2]);
  shape(
    s,
    (i, j) =>
      j >= 7 &&
      j <= 28 &&
      i >= 7 &&
      i <= 24 &&
      !(j < 11 && (i - 15.5) ** 2 / 75 + (j - 11) ** 2 / 16 > 1),
    R.olive,
    { band: 2 },
  );
  box(s, 9, 18, 14, 9, R.olive);
  s.hline(10, 19, 12, R.grey[2]);
  s.set(21, 19, R.grey[3]);
  box(s, 11, 11, 4, 4, R.red);
  s.hline(8, 27, 16, R.olive[0]);
  s.vline(6, 10, 14, R.black[2]);
  s.vline(25, 10, 14, R.black[2]);
  return s.outline();
}

export const STARTERS: Readonly<Record<string, () => Sprite>> = {
  'Rusty Toolbox': rustyToolbox,
  'Old Radio': oldRadio,
  'Worn Backpack': wornBackpack,
};

export const FAMILY_ART: Readonly<Record<string, (rarity: Rarity) => Sprite>> = {
  'Warehouse Find': warehouseFind,
  'Pawned Good': pawnedGood,
  'Crafted Item': craftedItem,
  Mystery: mystery,
};
