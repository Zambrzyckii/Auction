import { R, Sprite, box, shape } from '../../street/pix';
import { bezier, blit, ell, flat, poly, sweep, thick } from './helpers';

export function leakyCanteen(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 13, 3, 6, 5, R.steel, { band: 1 });
  box(s, 12, 2, 8, 2, R.steel);
  s.line(19, 5, 26, 9, R.olive[0]);
  s.line(26, 9, 26, 15, R.olive[0]);
  shape(s, ell(15.5, 16.5, 11, 10), R.olive, { band: 1 });
  const rim = ell(15.5, 16.5, 8.5, 7.5);
  const inner = ell(15.5, 16.5, 7.5, 6.5);
  flat(s, (x, y) => rim(x, y) && !inner(x, y), R.olive[1]);
  for (const [x, y] of [
    [11, 10],
    [16, 9],
    [21, 10],
  ])
    s.set(x, y, R.olive[3]);
  s.rect(20, 21, 2, 1, R.steel[0]);
  s.line(21, 22, 22, 26, R.steel[2]);
  s.rect(22, 27, 1, 2, R.steel[3]);
  return s.outline();
}

export function patchedTent(): Sprite {
  const s = new Sprite(32, 32);
  const tent = (x: number, y: number) =>
    y >= 3 && y <= 28 && x >= 13 - (y - 3) * 0.44 && x <= 13 + (y - 3) * 0.64;
  shape(s, tent, R.tan, { band: 1 });
  const door = (x: number, y: number) =>
    y >= 11 && x >= 19 - (y - 11) * 0.42 && x <= 19 + (y - 11) * 0.42 && tent(x, y);
  flat(s, door, R.black[0]);
  poly(
    s,
    [
      [19, 11],
      [29, 28],
      [24, 28],
    ],
    R.tan[3],
  );
  s.line(19, 11, 24, 28, R.tan[1]);
  box(s, 5, 20, 5, 5, R.olive);
  s.set(5, 20, R.wood[0]);
  s.set(9, 24, R.wood[0]);
  s.line(13, 4, 7, 28, R.tan[1]);
  return s.outline();
}

export function rustyPocketKnife(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, thick(18.5, 22.5, 29, 2.5, 2.9, 0.5), R.steel, { band: 1 });
  for (const [x, y] of [
    [20, 18],
    [23, 13],
    [25, 8],
    [21, 21],
  ])
    s.set(x, y, R.rust[2]);
  s.set(27, 5, R.rust[1]);
  s.line(20, 20, 24, 12, R.steel[3]);
  shape(s, (x, y) => x >= 3 && x <= 21 && y >= 20 && y <= 27 && !(x === 3 && y >= 26), R.red, {
    band: 1,
  });
  box(s, 18, 20, 4, 8, R.steel);
  s.set(19, 22, R.steel[3]);
  s.rect(5, 23, 2, 2, R.red[0]);
  return s.outline();
}

export function bentFishingRod(): Sprite {
  const s = new Sprite(32, 32);
  const rod = bezier([4, 27], [9, 13], [20, 0], [28, 9], 24);
  shape(s, sweep(rod, 1.5, 0.6), R.wood, {});
  shape(s, thick(3.5, 28.5, 10.5, 20.5, 2), R.wood, {});
  shape(s, ell(12, 20, 4, 3.5), R.steel, { band: 1 });
  s.set(12, 20, R.steel[0]);
  for (const [x, y] of bezier([28, 9], [29, 14], [25, 19], [27, 24], 14)) s.set(x, y, R.paper[3]);
  s.line(27, 25, 27, 27, R.paper[3]);
  s.line(27, 27, 25, 28, R.paper[3]);
  s.set(25, 26, R.paper[3]);
  return s.outline();
}

export function dentedCampLantern(): Sprite {
  const s = new Sprite(32, 32);
  for (const [x, y] of bezier([10, 8], [11, 0], [29, -2], [21, 8], 20)) s.set(x, y, R.steel[2]);
  shape(s, (x, y) => y <= 10 && ell(15.5, 10, 7, 4)(x, y), R.green, { band: 1 });
  box(s, 9, 10, 14, 2, R.green);
  shape(s, ell(15.5, 18, 7, 7), R.lit, { band: 1 });
  s.vline(9, 11, 14, R.steel[2]);
  s.vline(22, 11, 14, R.steel[2]);
  flat(s, ell(15.5, 18.5, 1.5, 3), R.taxi[3]);
  box(s, 8, 24, 16, 5, R.green, { band: 1 });
  s.rect(11, 25, 3, 2, R.green[0]);
  s.hline(12, 27, 3, R.green[3]);
  s.rect(18, 7, 2, 2, R.green[0]);
  return s.outline();
}

export function compassThatPointsSouth(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, ell(20, 10, 9, 9), R.grey, { band: 1 });
  flat(s, ell(20, 10, 6.5, 6.5), R.grey[2]);
  s.line(18, 6, 22, 5, R.grey[3]);
  shape(s, ell(14, 18.5, 11, 10.5), R.grey, { band: 1 });
  flat(s, ell(14, 18.5, 8.5, 8.5), R.paper[3]);
  blit(s, ['011', '100', '010', '001', '110'], 12, 11, R.red[1]);
  blit(s, ['1001', '1101', '1011', '1001', '1001'], 11, 22, R.paper[0]);
  s.set(6, 19, R.paper[0]);
  s.set(21, 19, R.paper[0]);
  poly(
    s,
    [
      [13, 16],
      [15, 19],
      [11, 19],
    ],
    R.red[2],
  );
  poly(
    s,
    [
      [11, 19],
      [15, 19],
      [13, 21],
    ],
    R.white[0],
  );
  s.set(13, 19, R.gold[2]);
  return s.outline();
}

const bootShape = (u: number, v: number): boolean =>
  (u >= 7 && u <= 14 && v >= 0 && v <= 18) ||
  (u >= 3 && u <= 14 && v >= 16 && v <= 24) ||
  ell(4, 20.5, 4, 3.5)(u, v);

const lying =
  (a: number, scale: number, ox: number, oy: number) =>
  (x: number, y: number): [number, number] => {
    const dx = x - ox;
    const dy = y - oy;
    return [
      14 - (dx * Math.cos(a) + dy * Math.sin(a)) / scale,
      (-dx * Math.sin(a) + dy * Math.cos(a)) / scale,
    ];
  };

export function armySurplusBoots(): Sprite {
  const s = new Sprite(32, 32);
  const flopped = lying(-1, 0.78, 12, 16);
  const flop = (x: number, y: number) => bootShape(...flopped(x, y));
  const stand = (x: number, y: number) => bootShape(x - 3, y - 4);
  shape(s, flop, R.olive, { band: 1 });
  flat(s, (x, y) => flop(x, y) && flopped(x, y)[1] >= 22, R.black[1]);
  flat(
    s,
    (x, y) =>
      flop(x, y) && !stand(x, y) && [-1, 0, 1].some((d) => stand(x + d, y) || stand(x, y + d)),
    R.black[0],
  );
  shape(s, stand, R.olive, { band: 1 });
  flat(s, (x, y) => stand(x, y) && y >= 26, R.black[1]);
  s.hline(4, 28, 14, R.black[0]);
  for (const y of [8, 11, 14]) s.hline(11, y, 4, R.paper[3]);
  return s.outline();
}

export function taxidermyBass(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (x, y) => x >= 3 && x <= 28 && y >= 2 && y <= 28 && !((x < 5 || x > 26) && y < 4),
    R.wood,
    {
      band: 1,
    },
  );
  const lift = (x: number) => Math.round((x - 14) * -0.22);
  shape(s, (x, y) => ell(14, 13, 8.5, 4.5)(x, y + lift(x)), R.green, { band: 1 });
  poly(
    s,
    [
      [22, 12],
      [27, 7],
      [27, 16],
    ],
    R.green[2],
  );
  poly(
    s,
    [
      [10, 8],
      [13, 4],
      [19, 8],
    ],
    R.green[1],
  );
  s.set(8, 11, R.black[0]);
  s.hline(5, 14, 3, R.black[0]);
  s.rect(12, 22, 10, 4, R.gold[2]);
  s.hline(12, 22, 10, R.gold[3]);
  s.hline(12, 25, 10, R.gold[1]);
  s.hline(14, 24, 6, R.gold[1]);
  return s.outline();
}

export const CAMPING: Readonly<Record<string, () => Sprite>> = {
  'Leaky Canteen': leakyCanteen,
  'Patched Tent': patchedTent,
  'Rusty Pocket Knife': rustyPocketKnife,
  'Bent Fishing Rod': bentFishingRod,
  'Dented Camp Lantern': dentedCampLantern,
  'Compass That Points South': compassThatPointsSouth,
  'Army Surplus Boots': armySurplusBoots,
  'Taxidermy Bass': taxidermyBass,
};
