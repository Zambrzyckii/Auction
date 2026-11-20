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

// A bracelet curled into a short tube, seen from above: top ring with a dark mouth, then the wall.
function band(s: Sprite, cx: number, ty: number, ramp: readonly string[]): void {
  const top = ell(cx, ty, 8, 3);
  const low = ell(cx, ty + 5, 8, 3);
  const mouth = ell(cx, ty, 6, 2);
  for (let y = ty - 3; y <= ty + 8; y++)
    for (let x = cx - 8; x < cx + 8; x++) {
      const wall = x >= cx - 8 && x < cx + 8 && y >= ty && y < ty + 5;
      if (!top(x, y) && !low(x, y) && !wall) continue;
      if (mouth(x, y)) s.set(x, y, ramp[0]);
      else s.set(x, y, x >= cx + 4 || (y >= ty + 7 && low(x, y)) ? ramp[1] : ramp[2]);
    }
  for (const dx of [-6, -2, 2]) s.rect(cx + dx, ty + 3, 2, 2, R.white[3]);
}

export function slapBraceletBundle(): Sprite {
  const s = new Sprite(32, 32);
  band(s, 16, 8, R.sign);
  band(s, 10, 20, R.red);
  band(s, 22, 20, R.taxi);
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
  for (const [x, y, w, h] of [
    [20, 7, 2, 2],
    [10, 12, 2, 2],
    [14, 23, 2, 1],
  ])
    s.rect(x, y, w, h, R.white[3]);
  for (let i = 0; i < 4; i++) s.hline(i % 2 ? 15 : 14, 17 + i, i % 2 ? 2 : 4, R.red[3]);
  box(s, 11, 21, 10, 6, R.red, { band: 1 });
  box(s, 8, 27, 16, 2, R.red);
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
  sphere(s, 16, 19, 10, R.red);
  shape(s, (x, y) => ell(16, 19, 10, 10)(x, y) && y < 18, R.steel, { band: 1 });
  disc(s, 16, 15, 4, R.sign[2]);
  disc(s, 12, 11, 1.6, R.sign[2]);
  disc(s, 20, 11, 1.6, R.sign[2]);
  s.set(14, 14, R.steel[0]);
  s.set(17, 14, R.steel[0]);
  s.rect(15, 1, 2, 4, R.grey[1]);
  s.rect(11, 5, 10, 4, R.grey[1]);
  for (const [x0, y0, x1, y1] of [
    [12, 9, 6, 11],
    [6, 11, 5, 16],
    [5, 16, 8, 19],
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
  for (let y = 10; y < 30; y += 3) s.hline(7, y, 18, R.grey[1]);
  for (let y = 9; y < 29; y++) {
    const half = Math.sqrt(100 - (y + 0.5 - 19) ** 2);
    for (const m of [-0.75, -0.4, 0, 0.4, 0.75])
      s.set(Math.round(16 + m * half - 0.5), y, R.grey[1]);
  }
  for (const [x, y] of [
    [11, 12],
    [14, 15],
    [18, 12],
    [10, 18],
    [14, 21],
    [19, 17],
  ])
    s.set(x, y, R.white[3]);
  for (const [x, y] of [
    [21, 15],
    [22, 15],
    [21, 16],
    [22, 16],
    [23, 16],
    [22, 17],
    [12, 24],
    [13, 24],
    [13, 25],
  ])
    s.set(x, y, R.black[1]);
  s.set(20, 16, R.black[0]);
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
