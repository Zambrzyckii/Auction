import { R, INK, Sprite, disc, shape, text } from '../../street/pix';
import { digits, ell, poly } from './helpers';

type Pt = readonly [number, number];

// Membership test for a polygon, so poly shapes can be bevelled by shape().
function mask(pts: readonly Pt[]): (x: number, y: number) => boolean {
  const m = new Sprite(32, 32);
  poly(m, pts, INK);
  return (x, y) => m.get(x, y) !== null;
}

const mirror = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]): Pt => [32 - x, y]);

export function neonFannyPack(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(2, 6, 28, 6, R.black[2]);
  s.hline(2, 6, 28, R.black[3]);
  s.hline(2, 11, 28, R.black[1]);
  const pouch = ell(16, 17.5, 12.2, 11.5);
  shape(s, (i, j) => j >= 11 && j <= 28 && pouch(i, j), R.sign, { band: 1 });
  s.rect(12, 6, 8, 5, R.taxi[2]);
  s.hline(12, 6, 8, R.taxi[3]);
  s.vline(12, 6, 5, R.taxi[3]);
  s.rect(15, 8, 2, 2, R.black[1]);
  for (let x = 8; x <= 24; x += 2) s.set(x, 14, R.taxi[2]);
  s.rect(23, 14, 2, 4, R.taxi[3]);
  shape(
    s,
    (i, j) => i >= 7 && i <= 25 && j >= 19 && j <= 26 && !((i === 7 || i === 25) && j === 26),
    R.sign,
    { band: 1 },
  );
  return s.outline();
}

export function fadedDenimJacket(): Sprite {
  const s = new Sprite(32, 32);
  const sleeve: Pt[] = [
    [9, 8],
    [5, 9],
    [2, 26],
    [7, 27],
    [7, 16],
    [9, 14],
  ];
  const collar: Pt[] = [
    [9, 9],
    [10, 4],
    [14, 4],
    [15.5, 13],
    [10, 12],
  ];
  const parts = [mask(sleeve), mask(mirror(sleeve)), mask(collar), mask(mirror(collar))];
  const body = (i: number, j: number) =>
    (i >= 9 && i <= 22 && j >= 8 && j <= 28) || parts.some((p) => p(i, j));
  poly(
    s,
    [
      [14, 4],
      [18, 4],
      [16, 13],
    ],
    R.denim[0],
  );
  shape(s, body, R.denim, { band: 1 });
  s.vline(15, 13, 15, R.denim[1]);
  s.hline(9, 24, 14, R.denim[1]);
  for (const y of [15, 19, 23]) s.set(16, y, R.taxi[2]);
  for (const x of [11, 17]) {
    s.hline(x, 14, 4, R.denim[3]);
    s.rect(x, 15, 4, 3, R.denim[1]);
    s.rect(x + 1, 15, 2, 2, R.denim[2]);
    s.hline(x, 18, 4, R.taxi[2]);
  }
  const wash: [number, number, number][] = [
    [5, 11, 4],
    [5, 12, 3],
    [6, 13, 2],
    [23, 11, 4],
    [24, 12, 3],
    [4, 19, 3],
    [4, 20, 4],
    [5, 21, 2],
    [26, 19, 3],
    [25, 20, 4],
    [11, 20, 4],
    [12, 21, 4],
    [11, 22, 3],
  ];
  for (const [x, y, w] of wash)
    for (let i = 0; i < w; i++) if (s.get(x + i, y) === R.denim[2]) s.set(x + i, y, R.steel[3]);
  return s.outline();
}

export function handPaintedVest(): Sprite {
  const s = new Sprite(32, 32);
  const left: Pt[] = [
    [8, 5],
    [13, 5],
    [16, 12],
  ];
  const vest = mask([
    ...left,
    ...mirror(left).reverse(),
    [26, 8],
    [24.5, 10],
    [23.5, 12.5],
    [24.5, 15],
    [26, 16.5],
    [26, 27],
    [21, 29],
    [16, 28],
    [11, 29],
    [6, 27],
    [6, 16.5],
    [7.5, 15],
    [8.5, 12.5],
    [7.5, 10],
    [6, 8],
  ]);
  shape(s, vest, R.plum, { band: 1 });
  for (const y of [16, 20, 24]) s.set(15, y, R.plum[3]);
  for (const x of [8, 19]) s.hline(x, 24, 5, R.plum[3]);
  poly(
    s,
    [
      [13, 14],
      [9, 21],
      [12, 21],
      [9, 27],
      [15, 19],
      [12, 19],
      [14, 14],
    ],
    R.taxi[3],
  );
  disc(s, 21.5, 19, 3, R.red[2]);
  s.set(20, 22, R.red[2]);
  s.set(22, 23, R.red[2]);
  s.set(21, 13, R.sign[3]);
  s.set(24, 16, R.sign[3]);
  s.set(19, 26, R.sign[3]);
  s.set(10, 13, R.sign[3]);
  s.hline(18, 11, 4, R.taxi[3]);
  return s.outline();
}

export function scuffedHighTops(): Sprite {
  const s = new Sprite(32, 32);
  const upper = mask([
    [3, 25],
    [2, 21],
    [4, 18],
    [8, 16],
    [11, 14],
    [13, 11],
    [14, 3],
    [27, 3],
    [29, 8],
    [29, 25],
  ]);
  shape(s, upper, R.red, { band: 1 });
  s.rect(15, 4, 12, 2, R.black[0]);
  const cap = ell(7, 22, 5, 4);
  shape(s, (i, j) => cap(i, j) && upper(i, j), R.white, { band: 1 });
  for (const [x, y] of [
    [15, 6],
    [15, 9],
    [14, 12],
  ]) {
    s.hline(x, y, 5, R.white[3]);
    s.set(x, y, R.black[1]);
    s.set(x + 4, y, R.black[1]);
  }
  disc(s, 23, 12, 2.6, R.white[2]);
  s.set(22, 11, R.red[2]);
  s.set(23, 12, R.red[2]);
  s.rect(2, 25, 28, 5, R.white[2]);
  s.hline(2, 29, 28, R.white[1]);
  s.hline(3, 25, 26, R.white[3]);
  s.hline(3, 27, 26, R.red[1]);
  s.line(3, 20, 5, 22, R.black[1]);
  s.line(7, 18, 9, 20, R.black[1]);
  s.line(24, 18, 27, 21, R.black[1]);
  s.hline(2, 28, 3, R.black[1]);
  s.hline(24, 25, 3, R.black[1]);
  return s.outline();
}

export function flannelWithBurnHole(): Sprite {
  const s = new Sprite(32, 32);
  const sleeve: Pt[] = [
    [9, 8],
    [5, 9],
    [2, 24],
    [6, 26],
    [8, 17],
    [9, 14],
  ];
  const collar: Pt[] = [
    [9, 9],
    [10, 4],
    [14, 4],
    [15.5, 13],
    [10, 12],
  ];
  const parts = [mask(sleeve), mask(mirror(sleeve)), mask(collar), mask(mirror(collar))];
  const body = (i: number, j: number) =>
    (i >= 9 && i <= 22 && j >= 8 && j <= 29 && !((i === 9 || i === 22) && j === 29)) ||
    parts.some((p) => p(i, j));
  poly(
    s,
    [
      [14, 4],
      [18, 4],
      [16, 13],
    ],
    R.paper[2],
  );
  shape(s, body, R.rust, { band: 1 });
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      if (s.get(x, y) !== R.rust[2]) continue;
      const v = x % 6 < 2;
      const h = y % 6 < 2;
      if (v && h) s.set(x, y, R.rust[0]);
      else if (v || h) s.set(x, y, R.rust[1]);
      else if (x % 6 === 4) s.set(x, y, R.rust[3]);
    }
  for (const y of [16, 20, 24, 28]) s.set(16, y, R.paper[2]);
  const ring = ell(20, 20, 2.8, 2.6);
  const hole = ell(20, 20, 1.4, 1.2);
  for (let y = 15; y < 25; y++)
    for (let x = 15; x < 25; x++) {
      if (hole(x, y)) s.set(x, y, null);
      else if (ring(x, y)) s.set(x, y, R.black[3]);
    }
  s.set(24, 17, R.black[2]);
  s.set(16, 22, R.black[2]);
  s.set(21, 24, R.black[2]);
  return s.outline();
}

export function lightUpSneakers(): Sprite {
  const s = new Sprite(32, 32);
  const upper = mask([
    [3, 25],
    [2, 22],
    [4, 19],
    [9, 17],
    [12, 15],
    [13, 13],
    [17, 13],
    [18, 15],
    [23, 15],
    [25, 13],
    [29, 14],
    [29, 25],
  ]);
  shape(s, upper, R.denim, { band: 1 });
  s.rect(19, 15, 6, 2, R.denim[0]);
  for (const [x, y] of [
    [10, 17],
    [12, 15],
  ]) {
    s.line(x, y, x + 2, y + 2, R.lit[3]);
    s.line(x + 2, y, x, y + 2, R.lit[3]);
  }
  shape(
    s,
    (i, j) =>
      i >= 2 && i <= 29 && j >= 25 && j <= 29 && !((i === 2 || i === 29) && (j === 25 || j === 29)),
    R.lit,
    { band: 1 },
  );
  s.rect(3, 28, 26, 1, R.lit[2]);
  s.hline(3, 26, 26, R.lit[3]);
  [4, 9, 14, 19, 24].forEach((x, n) => s.rect(x, 26, 2, 2, n % 2 ? R.sign[3] : R.red[2]));
  return s.outline();
}

export function puffyTeamJacket(): Sprite {
  const s = new Sprite(32, 32);
  for (const [cx, cy] of [
    [6.2, 12],
    [5.6, 16],
    [5.2, 20],
    [5, 24],
  ].reverse()) {
    shape(s, ell(cx, cy, 3.3, 3.2), R.red, { band: 1 });
    shape(s, ell(32 - cx, cy, 3.3, 3.2), R.red, { band: 1 });
  }
  for (const cy of [26, 22, 18, 14, 10]) shape(s, ell(16, cy, 9.5, 3.8), R.red, { band: 1 });
  shape(s, ell(16, 6.5, 5.5, 2.8), R.red, { band: 1 });
  s.rect(13, 5, 6, 2, R.red[0]);
  s.vline(16, 9, 20, R.steel[3]);
  s.rect(17, 9, 1, 3, R.steel[3]);
  for (const x of [4, 5, 6, 25, 26, 27]) s.vline(x, 19, 2, R.white[2]);
  disc(s, 22, 13, 2.2, R.white[2]);
  s.set(21, 12, R.red[2]);
  s.set(22, 13, R.red[2]);
  return s.outline();
}

export function mysteryTeamSnapback(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, ell(16, 24, 13.5, 4.8), R.taxi, { band: 1 });
  const dome = ell(16, 15.5, 11.5, 12);
  shape(s, (i, j) => j <= 23 && dome(i, j), R.purple, { band: 1 });
  disc(s, 16, 5, 1.6, R.taxi[3]);
  s.vline(16, 7, 5, R.purple[1]);
  s.line(12, 8, 10, 15, R.purple[1]);
  s.line(20, 8, 22, 15, R.purple[1]);
  text(s, '?', 14, 18, R.taxi[3], 'micro');
  return s.outline();
}

export function misspelledNameJersey(): Sprite {
  const s = new Sprite(32, 32);
  const sleeve: Pt[] = [
    [9, 7],
    [3, 11],
    [5, 17],
    [8, 15],
  ];
  const parts = [mask(sleeve), mask(mirror(sleeve))];
  const body = (i: number, j: number) =>
    (i >= 8 && i <= 23 && j >= 7 && j <= 29 && !((i === 8 || i === 23) && j === 29)) ||
    parts.some((p) => p(i, j));
  shape(s, body, R.taxi, { band: 1 });
  poly(
    s,
    [
      [11, 7],
      [21, 7],
      [16, 14],
    ],
    R.denim[2],
  );
  poly(
    s,
    [
      [13, 7],
      [19, 7],
      [16, 11],
    ],
    R.denim[0],
  );
  s.rect(8, 27, 16, 2, R.denim[2]);
  for (const x of [4, 5, 26, 27]) s.set(x, 15, R.denim[2]);
  text(s, 'ALXE', 9, 18, R.denim[0], 'micro');
  digits(s, '7', 15, 21, R.denim[0]);
  return s.outline();
}

export const WEAR: Readonly<Record<string, () => Sprite>> = {
  'Neon Fanny Pack': neonFannyPack,
  'Faded Denim Jacket': fadedDenimJacket,
  'Hand-Painted Vest': handPaintedVest,
  'Scuffed High-Tops': scuffedHighTops,
  'Flannel with Burn Hole': flannelWithBurnHole,
  'Light-Up Sneakers': lightUpSneakers,
  'Puffy Team Jacket': puffyTeamJacket,
  'Mystery Team Snapback': mysteryTeamSnapback,
  'Misspelled Name Jersey': misspelledNameJersey,
};
