import { R, Sprite, box, cylV, disc, shape, sphere } from '../../street/pix';
import { bezier, blit, ell, flat, mask, poly, sparkle, sweep, thick } from './helpers';

type Test = (x: number, y: number) => boolean;

export function snakeInACan(): Sprite {
  const s = new Sprite(32, 32);
  cylV(s, 6, 17, 14, 12, R.grey);
  shape(s, ell(13, 17, 7, 2.4), R.grey, {});
  flat(s, ell(13, 17, 5.6, 1.6), R.grey[0]);
  s.rect(6, 21, 14, 6, R.white[3]);
  s.hline(8, 23, 8, R.grey[1]);
  s.hline(8, 25, 5, R.grey[1]);
  shape(s, ell(6, 10, 3.2, 1.4), R.grey, {});
  const coils: [number, number][] = [
    [21, 5.5],
    [16, 6.5],
    [13, 8.5],
    [11, 11.5],
    [11, 14.5],
    [12, 17],
  ];
  for (const [x, y] of coils) shape(s, ell(x, y, 4.5, 1.9), R.green, {});
  shape(s, ell(24, 6, 4.4, 3.2), R.green, {});
  s.rect(23, 4, 2, 2, R.white[3]);
  s.set(24, 5, R.grey[0]);
  s.hline(27, 7, 3, R.red[2]);
  s.set(29, 6, R.red[2]);
  s.set(29, 8, R.red[2]);
  return s.outline();
}

export function luckyRabbitFoot(): Sprite {
  const s = new Sprite(32, 32);
  const paw = sweep(
    [
      [11, 10],
      [14, 16],
      [17, 21],
    ],
    4,
    4.8,
  );
  shape(s, paw, R.tan, { band: 1 });
  for (const [x, y] of [
    [13.5, 24],
    [17.5, 25.5],
    [21.5, 24],
  ])
    shape(s, thick(x - 1, y - 3, x, y, 2), R.tan, { band: 1 });
  for (const [x, y] of [
    [13, 27],
    [17, 28],
    [21, 26],
  ])
    s.set(x, y, R.paper[3]);
  for (const [x, y] of [
    [11, 12],
    [13, 15],
    [15, 18],
    [14, 21],
    [17, 20],
    [12, 18],
    [18, 23],
    [15, 24],
  ]) {
    s.set(x, y, R.tan[1]);
    s.set(x + 1, y - 1, R.tan[3]);
  }
  shape(s, thick(9.5, 6, 12, 10.5, 3.8), R.gold, { band: 1 });
  const loop: Test = (x, y) => ell(8, 4, 2.6, 2.6)(x, y) && !ell(8, 4, 1.2, 1.2)(x, y);
  shape(s, loop, R.gold, {});
  const chain = bezier([10, 3], [16, 0], [22, 3], [24, 9], 8);
  flat(s, sweep(chain, 0.9), R.gold[2]);
  chain.forEach(([x, y], i) => {
    if (i % 2 === 0) s.set(x, y, R.gold[0]);
  });
  const key: Test = (x, y) => ell(25, 13, 3, 3)(x, y) && !ell(25, 13, 1.4, 1.4)(x, y);
  shape(s, key, R.gold, {});
  return s.outline();
}

export function chatteringTeeth(): Sprite {
  const s = new Sprite(32, 32);
  for (const [x, y] of [
    [4, 26],
    [13, 27],
  ])
    shape(s, ell(x + 4, y + 1.5, 4.5, 2.5), R.gold, { band: 1 });
  s.rect(2, 5, 20, 21, R.red[2]);
  s.hline(2, 25, 20, R.red[1]);
  s.rect(3, 9, 18, 6, R.white[2]);
  s.rect(3, 17, 18, 5, R.white[2]);
  s.rect(3, 15, 18, 2, R.black[0]);
  for (let i = 0; i < 6; i++) {
    s.vline(3 + i * 3, 9, 6, R.white[3]);
    s.vline(5 + i * 3, 9, 6, R.white[1]);
    s.vline(3 + i * 3, 17, 5, R.white[3]);
    s.vline(5 + i * 3, 17, 5, R.white[1]);
  }
  const bow: Test = (x, y) => ell(26.5, 15, 3, 3.8)(x, y) && !ell(26.5, 15, 1.3, 2)(x, y);
  shape(s, bow, R.gold, { band: 1 });
  s.hline(22, 15, 3, R.gold[2]);
  return s.outline();
}

export function fortuneTellingBall(): Sprite {
  const s = new Sprite(32, 32);
  sphere(s, 16, 16.5, 13, R.black, R.white[2]);
  shape(s, ell(14.5, 14.5, 6.3, 6.3), R.white, {});
  blit(s, ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 12, 11, R.black[0]);
  return s.outline();
}

export function petRockWithAFace(): Sprite {
  const s = new Sprite(32, 32);
  const rock: Test = (x, y) =>
    ell(15, 14, 10.5, 9)(x, y) || ell(20, 11, 6, 5)(x, y) || ell(10, 13, 5, 5)(x, y);
  shape(s, rock, R.concrete, { band: 1 });
  disc(s, 12, 13, 2.8, R.white[3]);
  s.set(12, 14, R.black[0]);
  s.set(13, 14, R.black[0]);
  disc(s, 19, 12, 3.2, R.white[3]);
  s.set(19, 11, R.black[0]);
  s.set(20, 11, R.black[0]);
  const smile = bezier([10, 16], [12, 20], [18, 20], [21, 15], 6);
  smile.slice(1).forEach(([x, y], i) => s.line(smile[i][0], smile[i][1], x, y, R.black[0]));
  shape(s, ell(16, 25, 13, 4.5), R.taxi, {});
  for (const [x0, y0, x1, y1] of [
    [5, 22, 3, 19],
    [27, 22, 29, 19],
    [9, 21, 8, 18],
    [23, 21, 25, 18],
  ])
    s.line(x0, y0, x1, y1, R.taxi[2]);
  for (const [x, y, w] of [
    [8, 25, 5],
    [15, 27, 6],
    [20, 24, 4],
    [10, 28, 4],
    [18, 22, 3],
  ])
    s.hline(x, y, w, R.taxi[1]);
  for (const [x, y, w] of [
    [12, 23, 4],
    [19, 26, 4],
    [6, 26, 3],
  ])
    s.hline(x, y, w, R.taxi[3]);
  return s.outline();
}

export function jackalopeMount(): Sprite {
  const s = new Sprite(32, 32);
  const plaque = mask([
    [5, 14],
    [8, 9],
    [16, 7],
    [24, 9],
    [27, 14],
    [27, 24],
    [16, 29],
    [5, 24],
  ]);
  shape(s, plaque, R.purple, { band: 1 });
  shape(s, thick(11, 17, 6, 11, 2.2, 1.5), R.paper, {});
  shape(s, thick(21, 17, 26, 12, 2.2, 1.5), R.paper, {});
  shape(s, ell(16, 19, 6, 6.5), R.paper, {});
  shape(s, ell(16, 22, 3.5, 2.5), R.paper, {});
  s.set(12, 17, R.black[0]);
  s.set(19, 17, R.black[0]);
  s.rect(15, 21, 2, 1, R.black[0]);
  const antler = (pts: [number, number][]) => flat(s, sweep(pts, 0.8), R.tan[3]);
  antler([
    [14, 13],
    [13, 8],
    [11, 2],
  ]);
  antler([
    [13, 8],
    [9, 6],
  ]);
  antler([
    [18, 13],
    [18, 7],
    [20, 1],
  ]);
  antler([
    [18, 8],
    [23, 6],
  ]);
  antler([
    [19, 4],
    [24, 2],
  ]);
  s.rect(12, 26, 9, 2, R.paper[2]);
  s.hline(13, 26, 7, R.paper[3]);
  return s.outline();
}

export function singingFishPlaque(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, ell(16, 16, 13.5, 13), R.gold, { band: 1 });
  flat(s, ell(16, 16, 11.5, 11), R.wood[2]);
  s.rect(18, 23, 6, 3, R.black[0]);
  for (const x of [19, 21, 23]) s.set(x, 24, R.gold[2]);
  const fish = new Sprite(32, 32);
  poly(
    fish,
    [
      [19, 12],
      [22.5, 6],
      [23, 11.5],
      [26, 13.5],
      [20, 15],
    ],
    R.green[2],
  );
  poly(
    fish,
    [
      [13, 16],
      [13.5, 11],
      [15, 13.5],
      [17, 10.5],
      [18, 13],
      [19.5, 11.5],
      [19.5, 14],
    ],
    R.green[1],
  );
  poly(
    fish,
    [
      [12, 22],
      [14, 26],
      [17, 23],
    ],
    R.green[1],
  );
  shape(
    fish,
    sweep(
      [
        [12, 20],
        [20, 12.5],
      ],
      4.6,
      1.8,
    ),
    R.green,
    {},
  );
  flat(fish, ell(14, 23, 3.5, 1.3), R.green[3]);
  poly(
    fish,
    [
      [6.5, 18],
      [10, 19],
      [10, 24],
      [6.5, 22.5],
    ],
    R.black[0],
  );
  fish.set(7, 19, R.white[3]);
  fish.set(9, 19, R.white[3]);
  fish.set(7, 22, R.white[3]);
  disc(fish, 12, 17.5, 1.8, R.white[3]);
  fish.set(12, 18, R.black[0]);
  fish.line(15, 15, 17, 13, R.white[3]);
  fish.line(16, 17, 16, 20, R.green[1]);
  s.stamp(fish.outline({ ink: R.green[0], selective: false }), 0, 0);
  blit(s, ['000110', '000101', '000100', '000100', '011100', '111100', '011000'], 8, 6, R.white[3]);
  return s.outline();
}

export function genuineFakeMoonRock(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 7, 21, 14, 4, R.gold, { band: 1 });
  box(s, 5, 25, 18, 5, R.gold, { band: 1 });
  s.hline(11, 27, 8, R.gold[1]);
  s.hline(12, 28, 6, R.gold[3]);
  const rock: Test = (x, y) =>
    ell(13, 15, 9, 6.5)(x, y) ||
    ell(11, 10.5, 6, 4.5)(x, y) ||
    ell(19, 16, 4.5, 4.5)(x, y) ||
    ell(8, 17, 4, 3.5)(x, y);
  shape(s, rock, R.concrete, { band: 1 });
  flat(s, ell(12, 15, 3, 2), R.concrete[1]);
  flat(s, ell(18, 17, 2, 1.5), R.concrete[1]);
  flat(s, ell(10, 9, 2, 1.5), R.concrete[1]);
  s.hline(11, 17, 3, R.concrete[3]);
  s.line(21, 14, 23, 15, R.paper[0]);
  poly(
    s,
    [
      [22, 16],
      [28, 15],
      [29, 24],
      [23, 25],
    ],
    R.paper[2],
  );
  s.hline(24, 18, 3, R.paper[0]);
  s.hline(24, 20, 3, R.paper[0]);
  disc(s, 26, 23, 1.4, R.red[2]);
  sparkle(s, 4, 6, R.gold[3]);
  sparkle(s, 26, 6, R.gold[3]);
  return s.outline();
}

export const ODD: Readonly<Record<string, () => Sprite>> = {
  'Snake in a Can': snakeInACan,
  'Lucky Rabbit Foot': luckyRabbitFoot,
  'Chattering Teeth': chatteringTeeth,
  'Fortune Telling Ball': fortuneTellingBall,
  'Pet Rock with a Face': petRockWithAFace,
  'Jackalope Mount': jackalopeMount,
  'Singing Fish Plaque': singingFishPlaque,
  'Genuine Fake Moon Rock': genuineFakeMoonRock,
};
