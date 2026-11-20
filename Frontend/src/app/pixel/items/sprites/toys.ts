import { R, Sprite, box, disc, shape, sphere } from '../../street/pix';
import { bezier, ell, poly } from './helpers';

const mirror = (x: number): number => 31 - x;

export function glowYoYo(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, ell(17, 20, 9, 9), R.sign, { band: 1 });
  shape(s, ell(15, 18, 9, 9), R.sign, { band: 2 });
  for (let y = 9; y < 28; y++)
    for (let x = 6; x < 26; x++) {
      const d = Math.hypot(x + 0.5 - 15, y + 0.5 - 18);
      if (d >= 5 && d < 6.2) s.set(x, y, R.sign[3]);
    }
  disc(s, 15, 18, 2.6, R.grey[1]);
  disc(s, 15, 18, 1.4, R.grey[3]);
  for (const [x, y] of bezier([16, 17], [22, 15], [32, 16], [28, 10], 14)) s.set(x, y, R.paper[3]);
  shape(s, (x, y) => ell(27, 6, 3, 4)(x, y) && !ell(27, 6, 1.4, 2.4)(x, y), R.paper, { band: 1 });
  for (const [x, y] of [
    [4, 12],
    [5, 13],
    [3, 19],
    [4, 19],
    [5, 25],
    [6, 26],
  ])
    s.set(x, y, R.sign[3]);
  return s.outline();
}

type Pt = readonly [number, number];

// A flat strip with a printed cross-bar pattern, shaded on the side that faces down and right.
function strip(s: Sprite, a: Pt, b: Pt, w: number, ramp: readonly string[]): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / len;
  const dy = (b[1] - a[1]) / len;
  const sign = dy - dx >= 0 ? 1 : -1;
  const nx = -dy * sign;
  const ny = dx * sign;
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const px = x + 0.5 - a[0];
      const py = y + 0.5 - a[1];
      const along = px * dx + py * dy;
      const across = px * nx + py * ny;
      if (along < 0 || along > len || Math.abs(across) > w / 2) continue;
      const bar = Math.floor(along) % 5 === 2 && Math.abs(across) < w / 2 - 1.2;
      if (bar) s.set(x, y, R.white[3]);
      else s.set(x, y, across > w / 2 - 1 ? ramp[1] : ramp[2]);
    }
}

export function slapBraceletBundle(): Sprite {
  const s = new Sprite(32, 32);
  strip(s, [3, 17], [27, 5], 5, R.red);
  strip(s, [3, 23], [27, 11], 5, R.taxi);
  strip(s, [3, 28], [21, 26], 4, R.sign);
  shape(s, ell(24, 23, 5, 5), R.sign);
  shape(s, ell(24, 23, 3, 3), R.sign, { band: 1 });
  disc(s, 24, 23, 1.5, R.sign[0]);
  return s.outline();
}

export function crackedSnowGlobe(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(7, 22, 18, 3, R.wood[2]);
  box(s, 9, 24, 14, 5, R.wood);
  s.hline(7, 24, 18, R.wood[1]);
  shape(s, (x, y) => ell(16, 13, 11, 11)(x, y) && y < 22, R.steel, { band: 2 });
  for (let y = 17; y < 22; y++)
    for (let x = 6; x < 26; x++)
      if (ell(16, 22, 8, 5)(x, y) && ell(16, 13, 11, 11)(x, y)) s.set(x, y, R.white[3]);
  poly(
    s,
    [
      [16, 7],
      [20, 14],
      [12, 14],
    ],
    R.green[2],
  );
  poly(
    s,
    [
      [16, 10],
      [21, 18],
      [11, 18],
    ],
    R.green[1],
  );
  s.vline(16, 18, 3, R.wood[1]);
  for (const [x, y] of [
    [9, 11],
    [23, 9],
    [11, 15],
    [14, 6],
    [20, 13],
    [8, 16],
  ])
    s.set(x, y, R.white[3]);
  for (const [x0, y0, x1, y1] of [
    [24, 5, 20, 9],
    [20, 9, 22, 12],
    [22, 12, 17, 16],
    [20, 9, 17, 8],
  ])
    s.line(x0, y0, x1, y1, R.steel[0]);
  return s.outline();
}

export function chippedBobblehead(): Sprite {
  const s = new Sprite(32, 32);
  sphere(s, 16, 9, 8, R.skinC);
  for (let y = 1; y < 5; y++)
    for (let x = 8; x < 24; x++) if (ell(16, 9, 8, 8)(x, y)) s.set(x, y, R.hair[1]);
  s.rect(11, 9, 2, 3, R.hair[0]);
  s.rect(19, 9, 2, 3, R.hair[0]);
  s.hline(14, 14, 4, R.skinC[0]);
  s.set(13, 13, R.skinC[0]);
  s.set(18, 13, R.skinC[0]);
  for (let i = 0; i < 4; i++) s.hline(i % 2 ? 15 : 14, 17 + i, i % 2 ? 2 : 4, R.red[3]);
  box(s, 11, 21, 10, 6, R.red, { band: 1 });
  for (const x of [9, 21]) {
    box(s, x, 22, 2, 3, R.red);
    s.rect(x, 25, 2, 1, R.skinC[2]);
  }
  box(s, 8, 27, 16, 2, R.red);
  for (const [x, y, w, h] of [
    [20, 7, 2, 2],
    [10, 12, 2, 2],
    [14, 23, 2, 1],
  ])
    s.rect(x, y, w, h, R.white[3]);
  return s.outline();
}

export function oneEyedCarnivalPlush(): Sprite {
  const s = new Sprite(32, 32);
  sphere(s, 7, 18, 3, R.taxi);
  sphere(s, 25, 18, 3, R.taxi);
  sphere(s, 16, 19, 8, R.taxi);
  sphere(s, 11, 26, 3, R.taxi);
  sphere(s, 21, 26, 3, R.taxi);
  sphere(s, 10, 4, 3, R.taxi);
  sphere(s, 22, 4, 3, R.taxi);
  sphere(s, 16, 9, 7, R.taxi);
  disc(s, 16, 12, 3, R.paper[2]);
  s.rect(15, 11, 2, 1, R.black[0]);
  disc(s, 12, 8, 1.6, R.black[0]);
  s.set(11, 7, R.grey[3]);
  s.line(19, 7, 21, 9, R.red[1]);
  s.line(21, 7, 19, 9, R.red[1]);
  s.line(21, 10, 22, 12, R.red[1]);
  s.set(22, 13, R.red[1]);
  return s.outline();
}

export function clawMachinePrize(): Sprite {
  const s = new Sprite(32, 32);
  sphere(s, 16, 21, 8, R.red);
  shape(s, (x, y) => ell(16, 21, 8, 8)(x, y) && y < 20, R.steel, { band: 1 });
  disc(s, 16, 18, 3.4, R.sign[2]);
  disc(s, 14, 16, 1.4, R.sign[2]);
  disc(s, 18, 16, 1.4, R.sign[2]);
  s.set(14, 17, R.steel[0]);
  s.set(17, 17, R.steel[0]);
  s.rect(15, 1, 2, 4, R.grey[1]);
  s.rect(13, 5, 6, 3, R.grey[1]);
  for (const [x0, y0, x1, y1] of [
    [13, 7, 6, 9],
    [6, 9, 3, 13],
    [3, 13, 2, 18],
    [2, 18, 2, 22],
    [2, 22, 4, 25],
  ]) {
    s.line(x0, y0, x1, y1, R.grey[1]);
    s.line(x0 + 1, y0, x1 + 1, y1, R.grey[1]);
    s.line(mirror(x0), y0, mirror(x1), y1, R.grey[1]);
    s.line(mirror(x0) - 1, y0, mirror(x1) - 1, y1, R.grey[1]);
  }
  return s.outline();
}

export function shipInABottle(): Sprite {
  const s = new Sprite(32, 32);
  const glass = (x: number, y: number): boolean => {
    if (x < 2 || x > 27) return false;
    if (x < 4) return y >= 12 + (4 - x) + 2 && y <= 30 - (4 - x) - 2;
    if (x < 20) return y >= 14 && y <= 28;
    if (x < 23) return y >= 13 + (x - 19) * 2 && y <= 29 - (x - 19) * 2;
    return y >= 19 && y <= 23;
  };
  shape(s, glass, R.steel, { band: 1 });
  s.rect(4, 16, 15, 10, R.glass[2]);
  s.rect(4, 23, 15, 3, R.denim[2]);
  s.hline(5, 23, 2, R.white[3]);
  s.hline(11, 23, 3, R.white[3]);
  poly(
    s,
    [
      [6, 21],
      [15, 21],
      [13, 24],
      [8, 24],
    ],
    R.wood[2],
  );
  s.vline(10, 16, 5, R.wood[2]);
  poly(
    s,
    [
      [9, 16],
      [9, 20],
      [5, 20],
    ],
    R.white[3],
  );
  poly(
    s,
    [
      [11, 17],
      [11, 20],
      [15, 20],
    ],
    R.white[3],
  );
  s.set(10, 16, R.red[2]);
  s.rect(28, 19, 2, 5, R.wood[2]);
  s.vline(29, 19, 5, R.wood[1]);
  return s.outline();
}

export function chippedDiscoBall(): Sprite {
  const s = new Sprite(32, 32);
  sphere(s, 16, 19, 10, R.grey);
  for (let y = 10; y < 30; y += 3)
    for (let x = 6; x < 26; x++) if (ell(16, 19, 10, 10)(x, y)) s.set(x, y, R.grey[1]);
  for (let y = 9; y < 29; y++) {
    const half = Math.sqrt(100 - (y + 0.5 - 19) ** 2);
    for (const m of [-0.75, -0.4, 0, 0.4, 0.75])
      s.set(Math.round(16 + m * half - 0.5), y, R.grey[1]);
  }
  for (const [x, y] of [
    [15, 12],
    [14, 16],
    [18, 12],
    [14, 18],
    [14, 21],
    [19, 17],
  ])
    s.set(x, y, R.white[3]);
  for (const [x, y] of [
    [20, 12],
    [21, 12],
    [21, 13],
    [22, 13],
    [22, 14],
    [21, 14],
    [10, 18],
    [11, 18],
    [11, 19],
    [12, 19],
    [11, 20],
  ])
    s.set(x, y, R.black[1]);
  s.set(20, 13, R.black[0]);
  s.vline(16, 4, 5, R.steel[1]);
  s.vline(15, 3, 3, R.steel[3]);
  s.vline(15, 6, 3, R.steel[2]);
  s.rect(14, 1, 4, 2, R.steel[2]);
  return s.outline();
}

export const TOYS: Readonly<Record<string, () => Sprite>> = {
  'Glow Yo-Yo': glowYoYo,
  'Slap Bracelet Bundle': slapBraceletBundle,
  'Cracked Snow Globe': crackedSnowGlobe,
  'Chipped Bobblehead': chippedBobblehead,
  'One-Eyed Carnival Plush': oneEyedCarnivalPlush,
  'Claw Machine Prize': clawMachinePrize,
  'Ship in a Bottle': shipInABottle,
  'Chipped Disco Ball': chippedDiscoBall,
};
