import { INK, R, Sprite, box, disc, shape } from '../../street/pix';
import { bezier, blit, ell, flat, poly, sweep } from './helpers';

export function chewedLeash(): Sprite {
  const s = new Sprite(32, 32);
  const loop = (x: number, y: number) => ell(21, 7, 7, 5)(x, y) && !ell(21, 7, 4.2, 2.6)(x, y);
  shape(s, loop, R.tan, { band: 1 });
  const strap = bezier([17, 10], [8, 14], [22, 20], [9, 26], 16);
  shape(s, sweep(strap, 1.6), R.tan, { band: 1 });
  for (const [x, y] of [
    [13, 14],
    [17, 18],
    [14, 21],
  ])
    s.rect(x, y, 2, 1, R.tan[0]);
  s.set(12, 24, R.tan[3]);
  s.set(13, 25, R.tan[3]);
  shape(s, (x, y) => ell(8, 27, 4, 3.4)(x, y) && !ell(8, 27.5, 1.6, 1.3)(x, y), R.grey, {
    band: 1,
  });
  s.rect(10, 24, 3, 2, R.grey[2]);
  return s.outline();
}

export function squeakyRubberChicken(): Sprite {
  const s = new Sprite(32, 32);
  poly(
    s,
    [
      [23, 15],
      [29, 9],
      [28, 15],
      [31, 18],
      [24, 21],
    ],
    R.taxi[1],
  );
  s.line(24, 15, 28, 11, R.taxi[2]);
  for (const [x0, x1] of [
    [13, 11],
    [19, 20],
  ]) {
    s.line(x0, 24, x1, 28, R.rust[2]);
    s.hline(x1 - 2, 29, 4, R.rust[2]);
  }
  shape(s, ell(16, 19, 9, 6.5), R.taxi, { band: 1 });
  shape(s, ell(16, 20, 4.5, 3), R.taxi, { band: 1 });
  shape(
    s,
    sweep(
      [
        [9, 16],
        [8, 10],
      ],
      2.2,
    ),
    R.taxi,
    { band: 1 },
  );
  shape(s, ell(8.5, 7, 3.6, 3.3), R.taxi, { band: 1 });
  poly(
    s,
    [
      [5, 6],
      [1, 8],
      [5, 10],
    ],
    R.rust[2],
  );
  s.rect(7, 2, 3, 2, R.red[2]);
  s.set(10, 3, R.red[2]);
  s.set(5, 11, R.red[2]);
  s.rect(6, 12, 2, 1, R.red[2]);
  s.set(7, 6, INK);
  return s.outline();
}

export function hamsterWheel(): Sprite {
  const s = new Sprite(32, 32);
  const ring = (x: number, y: number) =>
    ell(16, 13.5, 12, 12)(x, y) && !ell(16, 13.5, 9.5, 9.5)(x, y);
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + 0.3;
    s.line(16, 13, 16 + 10 * Math.cos(a), 13 + 10 * Math.sin(a), R.denim[1]);
  }
  shape(s, ring, R.denim, { band: 1 });
  disc(s, 16, 13, 1.8, R.denim[3]);
  s.line(16, 14, 9, 26, R.grey[1]);
  s.line(17, 14, 24, 26, R.grey[1]);
  s.rect(6, 26, 21, 3, R.grey[1]);
  shape(s, ell(12.5, 19.5, 4.5, 3.2), R.tan, { band: 1 });
  shape(s, ell(16.8, 18.5, 2.6, 2.4), R.tan, { band: 1 });
  s.set(15, 16, R.tan[1]);
  s.set(18, 16, R.tan[1]);
  s.set(18, 18, INK);
  s.line(10, 22, 9, 24, R.tan[1]);
  s.line(15, 22, 16, 24, R.tan[1]);
  return s.outline();
}

export function aquariumCastle(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 2, 5, 28, 24, R.denim, { band: 1 });
  s.rect(4, 7, 24, 20, R.denim[2]);
  s.hline(4, 8, 24, R.denim[3]);
  s.rect(4, 26, 24, 2, R.tan[2]);
  box(s, 6, 11, 6, 15, R.concrete, { band: 1 });
  box(s, 19, 17, 6, 9, R.concrete, { band: 1 });
  box(s, 11, 18, 9, 8, R.concrete, { band: 1 });
  for (const x of [6, 9, 12]) s.rect(x, 10, 2, 2, R.concrete[2]);
  for (const x of [19, 22]) s.rect(x, 16, 2, 2, R.concrete[2]);
  s.rect(14, 22, 3, 4, INK);
  s.set(15, 21, INK);
  s.set(8, 15, INK);
  s.set(21, 21, INK);
  s.rect(2, 5, 28, 2, R.denim[0]);
  s.vline(5, 10, 6, R.denim[3]);
  for (const [x, y] of [
    [20, 14],
    [15, 10],
  ]) {
    s.rect(x, y, 3, 3, R.white[3]);
    s.set(x + 1, y + 1, R.denim[2]);
  }
  flat(s, ell(22, 11.5, 3.6, 2.3), R.rust[3]);
  poly(
    s,
    [
      [25, 11],
      [28, 9],
      [28, 14],
    ],
    R.rust[3],
  );
  s.set(20, 10, INK);
  for (const x of [25, 27]) s.vline(x, 22, 5, R.green[2]);
  s.vline(26, 20, 4, R.green[2]);
  return s.outline();
}

export function dogBowlEngravedKing(): Sprite {
  const s = new Sprite(32, 32);
  for (const [x, y] of [
    [15, 8],
    [19, 9],
    [12, 10],
    [16, 11],
    [21, 11],
    [10, 13],
    [14, 13],
    [18, 13],
  ]) {
    disc(s, x, y, 2.1, R.wood[2]);
    s.set(x - 1, y - 1, R.wood[3]);
    s.set(x, y + 1, R.wood[1]);
  }
  shape(
    s,
    (x, y) => y >= 15 && y <= 28 && x >= 3 + (y - 15) * 0.33 && x <= 28 - (y - 15) * 0.33,
    R.denim,
    { band: 1 },
  );
  s.hline(3, 16, 26, R.denim[3]);
  const king = [
    ['101', '101', '110', '101', '101'],
    ['111', '010', '010', '010', '111'],
    ['101', '111', '111', '101', '101'],
    ['111', '100', '101', '101', '111'],
  ];
  king.forEach((rows, i) => blit(s, rows, 8 + i * 4, 20, R.white[3]));
  return s.outline();
}

export function birdcageMissingADoor(): Sprite {
  const s = new Sprite(32, 32);
  const arc = (x: number) => Math.round(18 - 10 * Math.sqrt(1 - ((x + 0.5 - 16) / 11.5) ** 2));
  for (const x of [9, 13, 18, 22]) s.vline(x, arc(x) + 1, (x < 15 ? 25 : 14) - arc(x), R.gold[2]);
  s.vline(26, 18, 7, R.gold[2]);
  s.hline(14, 14, 13, R.gold[2]);
  const dome = (x: number, y: number) =>
    y <= 18 && ell(16, 18, 11.5, 10)(x, y) && !ell(16, 18, 10, 8.5)(x, y);
  shape(s, dome, R.gold, {});
  s.vline(5, 18, 7, R.gold[2]);
  shape(s, (x, y) => ell(16, 5, 3, 3)(x, y) && !ell(16, 5, 1.4, 1.4)(x, y), R.gold, {});
  s.hline(6, 20, 9, R.gold[1]);
  box(s, 4, 25, 24, 4, R.gold, { band: 1 });
  shape(s, ell(9.5, 16.5, 3.6, 3), R.denim, { band: 1 });
  shape(s, ell(7, 14, 2.2, 2.2), R.denim, { band: 1 });
  s.set(5, 14, R.gold[3]);
  s.set(6, 13, INK);
  s.line(12, 19, 15, 18, R.denim[1]);
  return s.outline();
}

export function lizardHeatLamp(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, ell(19, 25, 10, 4), R.steel, { band: 1 });
  const tail = bezier([15, 20], [9, 21], [8, 15], [4, 16], 10);
  shape(s, sweep(tail, 1.4, 0.5), R.green, { band: 1 });
  shape(s, ell(19.5, 19.5, 6.5, 2.8), R.green, { band: 1 });
  shape(s, ell(27, 18.5, 2.8, 2.3), R.green, { band: 1 });
  s.line(16, 21, 15, 23, R.green[1]);
  s.line(23, 21, 25, 23, R.green[1]);
  s.set(28, 17, INK);
  for (const x of [17, 20, 23]) s.set(x, 18, R.green[3]);
  flat(s, ell(19, 11, 6, 2.4), R.lit[2]);
  shape(
    s,
    (x, y) =>
      y >= 3 &&
      y <= 9 &&
      x >= 15 - (y - 3) * 0.7 &&
      x <= 24 + (y - 3) * 0.7 &&
      !(y === 3 && x < 16),
    R.steel,
    { band: 1 },
  );
  disc(s, 19, 11, 2, R.lit[3]);
  shape(
    s,
    sweep(
      [
        [5, 23],
        [5, 7],
        [12, 6],
      ],
      1,
    ),
    R.steel,
    {},
  );
  box(s, 2, 22, 7, 7, R.steel, { band: 1 });
  s.rect(4, 24, 3, 3, R.steel[0]);
  return s.outline();
}

export function catTreeLeaningLeft(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 8, 27, 22, 3, R.denim, { band: 1 });
  const post = sweep(
    [
      [20, 27],
      [11, 11],
    ],
    1.6,
  );
  flat(s, post, R.tan[2]);
  for (let y = 14; y <= 26; y += 3) {
    const x = Math.round(20 - (9 * (27 - y)) / 16);
    s.hline(x - 1, y, 3, R.tan[1]);
  }
  box(s, 9, 18, 13, 3, R.denim, { band: 1 });
  box(s, 4, 11, 15, 3, R.denim, { band: 1 });
  shape(s, ell(13, 8, 3.8, 2.8), R.rust, { band: 1 });
  shape(s, ell(8.5, 6, 2.5, 2.2), R.rust, { band: 1 });
  poly(
    s,
    [
      [6, 5],
      [6, 2],
      [8, 4],
    ],
    R.rust[2],
  );
  poly(
    s,
    [
      [9, 4],
      [11, 2],
      [11, 5],
    ],
    R.rust[2],
  );
  s.set(7, 6, INK);
  s.set(10, 6, INK);
  shape(s, sweep(bezier([16, 9], [20, 10], [21, 6], [19, 3], 8), 0.9), R.rust, {});
  return s.outline();
}

export const PETS: Readonly<Record<string, () => Sprite>> = {
  'Chewed Leash': chewedLeash,
  'Squeaky Rubber Chicken': squeakyRubberChicken,
  'Hamster Wheel': hamsterWheel,
  'Aquarium Castle': aquariumCastle,
  'Dog Bowl Engraved KING': dogBowlEngravedKing,
  'Birdcage Missing a Door': birdcageMissingADoor,
  'Lizard Heat Lamp': lizardHeatLamp,
  'Cat Tree Leaning Left': catTreeLeaningLeft,
};
