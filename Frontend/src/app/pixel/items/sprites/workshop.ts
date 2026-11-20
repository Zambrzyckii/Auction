import { R, Sprite, box, cylH, cylV, shape } from '../../street/pix';
import { bezier, ell, flat, poly, sweep, thick } from './helpers';

export function jarOfLooseScrews(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (x, y) => x >= 8 && x <= 23 && y >= 10 && y <= 28 && !((x < 10 || x > 21) && y > 26),
    R.steel,
    { band: 1 },
  );
  box(s, 10, 8, 12, 3, R.steel);
  flat(s, (x, y) => x >= 10 && x <= 21 && y >= 11 && y <= 26, R.steel[1]);
  s.vline(10, 12, 5, R.steel[3]);
  const heap = (x: number, y: number) =>
    x >= 10 && x <= 21 && y >= 16 + Math.abs(x - 15) * 0.5 && y <= 26;
  flat(s, heap, R.grey[1]);
  for (const [x0, y0, x1, y1, c] of [
    [10, 25, 14, 21, R.grey[3]],
    [12, 26, 18, 24, R.taxi[2]],
    [14, 22, 19, 20, R.grey[3]],
    [17, 25, 21, 22, R.grey[2]],
    [19, 22, 21, 19, R.grey[3]],
    [14, 19, 16, 23, R.grey[2]],
    [15, 18, 17, 18, R.grey[3]],
  ] as const) {
    s.line(x0, y0, x1, y1, c);
    s.set(x0, y0, R.grey[3]);
    s.set(x0 + 1, y0 - 1, R.grey[3]);
  }
  poly(
    s,
    [
      [11, 12],
      [19, 10],
      [20, 15],
      [12, 17],
    ],
    R.paper[2],
  );
  s.set(19, 15, null);
  s.line(13, 13, 17, 12, R.paper[0]);
  s.line(13, 15, 16, 14, R.paper[0]);
  shape(s, thick(8.5, 5.5, 23.5, 7.5, 1.9), R.grey, {});
  return s.outline();
}

export function rustyHandSaw(): Sprite {
  const s = new Sprite(32, 32);
  const bottom = (x: number) => 17 + (x - 3) * 0.22 + (x % 3);
  shape(s, (x, y) => x >= 3 && x <= 21 && y >= 11 && y <= bottom(x), R.steel, { band: 1 });
  shape(
    s,
    (x, y) => x >= 20 && x <= 29 && y >= 8 && y <= 28 && !ell(25.5, 14, 2.4, 3.6)(x, y),
    R.wood,
    { band: 1 },
  );
  s.set(21, 13, R.steel[3]);
  s.set(21, 22, R.steel[3]);
  for (const [x, y] of [
    [5, 14],
    [9, 16],
    [13, 13],
    [16, 17],
  ])
    s.set(x, y, R.rust[2]);
  s.hline(4, 12, 16, R.steel[3]);
  s.hline(6, bottom(6) | 0, 6, R.rust[1]);
  return s.outline();
}

export function crackedSpiritLevel(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 2, 17, 28, 12, R.taxi, { band: 1 });
  flat(s, ell(7, 23, 2.4, 2.4), null);
  flat(s, ell(25, 23, 2.4, 2.4), null);
  box(s, 11, 20, 10, 6, R.black, {});
  s.rect(12, 21, 8, 4, R.sign[3]);
  s.rect(14, 22, 3, 2, R.white[3]);
  s.line(21, 27, 23, 22, R.black[0]);
  s.line(23, 22, 22, 18, R.black[0]);
  s.line(23, 22, 27, 21, R.black[0]);
  s.line(18, 20, 17, 25, R.black[0]);
  return s.outline();
}

export function bentNailPuller(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 2, 22, 27, 7, R.wood, { band: 1 });
  s.vline(8, 14, 8, R.white[3]);
  s.vline(9, 14, 8, R.white[1]);
  s.rect(6, 12, 6, 2, R.white[3]);
  const bar = sweep(
    [
      [28, 3],
      [23, 6],
      [19, 12],
      [14, 17],
    ],
    1.6,
  );
  const prongs = [
    sweep(
      [
        [14, 17],
        [10, 14],
      ],
      1.5,
    ),
    sweep(
      [
        [14, 17],
        [10, 20],
      ],
      1.5,
    ),
  ];
  shape(s, (x, y) => bar(x, y) || prongs.some((p) => p(x, y)), R.grey, { band: 1 });
  return s.outline();
}

export function chromeBlowtorch(): Sprite {
  const s = new Sprite(32, 32);
  cylV(s, 3, 12, 10, 16, R.white);
  s.hline(3, 18, 10, R.white[0]);
  s.hline(3, 19, 10, R.white[3]);
  s.rect(6, 9, 4, 3, R.red[2]);
  cylH(s, 12, 11, 10, 4, R.white);
  s.rect(22, 9, 4, 7, R.steel[2]);
  s.vline(22, 9, 7, R.steel[3]);
  s.hline(26, 10, 4, R.denim[3]);
  s.hline(26, 11, 5, R.denim[3]);
  s.hline(26, 12, 4, R.denim[3]);
  s.hline(26, 11, 3, R.white[3]);
  s.set(27, 9, R.denim[3]);
  s.set(28, 13, R.denim[3]);
  return s.outline();
}

export function dentedOilCan(): Sprite {
  const s = new Sprite(32, 32);
  const loop = (x: number, y: number) => ell(6.5, 19, 4.5, 6)(x, y) && !ell(6.5, 19, 2.5, 4)(x, y);
  shape(s, loop, R.steel, {});
  shape(s, ell(14, 22, 8, 6.5), R.red, { band: 1 });
  shape(s, thick(18.5, 17.5, 29.5, 4.5, 1.9, 0.9), R.steel, {});
  shape(s, thick(5, 9.5, 14, 11, 1.4), R.steel, {});
  s.rect(10, 12, 2, 4, R.steel[2]);
  s.rect(10, 22, 3, 2, R.red[0]);
  s.hline(10, 24, 3, R.red[3]);
  s.rect(17, 19, 2, 2, R.red[0]);
  s.set(18, 21, R.red[3]);
  return s.outline();
}

export function workbenchVise(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 2, 22, 28, 7, R.wood, { band: 1 });
  box(s, 4, 8, 8, 14, R.denim, { band: 1 });
  box(s, 17, 8, 7, 14, R.denim, { band: 1 });
  box(s, 11, 17, 7, 5, R.denim);
  s.vline(11, 10, 8, R.steel[3]);
  s.vline(17, 10, 8, R.steel[3]);
  s.hline(7, 6, 4, R.steel[2]);
  s.hline(4, 21, 20, R.denim[0]);
  s.rect(23, 13, 6, 2, R.steel[2]);
  s.hline(23, 13, 6, R.steel[3]);
  s.rect(28, 11, 2, 6, R.steel[2]);
  s.set(28, 11, R.steel[3]);
  return s.outline();
}

export function goldPlatedHammer(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 12, 11, 5, 18, R.wood, { band: 1 });
  for (const y of [22, 24, 26]) s.hline(12, y, 5, R.wood[1]);
  const claw = bezier([21, 7], [25, 7], [29, 10], [29, 15], 12);
  shape(
    s,
    (x, y) => (x >= 4 && x <= 22 && y >= 4 && y <= 11) || sweep(claw, 2.6, 0.8)(x, y),
    R.gold,
    {
      band: 1,
    },
  );
  shape(s, (x, y) => x >= 3 && x <= 6 && y >= 3 && y <= 12, R.gold, {});
  s.hline(8, 5, 8, R.white[3]);
  s.hline(12, 3, 3, R.white[3]);
  s.vline(13, 2, 3, R.white[3]);
  return s.outline();
}

export const WORKSHOP: Readonly<Record<string, () => Sprite>> = {
  'Jar of Loose Screws': jarOfLooseScrews,
  'Rusty Hand Saw': rustyHandSaw,
  'Cracked Spirit Level': crackedSpiritLevel,
  'Bent Nail Puller': bentNailPuller,
  'Chrome Blowtorch': chromeBlowtorch,
  'Dented Oil Can': dentedOilCan,
  'Workbench Vise': workbenchVise,
  'Gold-Plated Hammer': goldPlatedHammer,
};
