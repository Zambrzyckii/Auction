import { R, Sprite, box, disc, shape, sphere } from '../../street/pix';
import { bezier, blit, digits, ell, flat, mask, sparkle, sweep, thick } from './helpers';

type Test = (x: number, y: number) => boolean;

function gem(s: Sprite, cx: number, cy: number, w: number, h: number): void {
  const cut = mask([
    [cx - w, cy - 1],
    [cx - w + 2, cy - h],
    [cx + w - 2, cy - h],
    [cx + w, cy - 1],
    [cx, cy + h],
  ]);
  for (let y = cy - h; y <= cy + h; y++)
    for (let x = cx - w; x <= cx + w; x++) {
      if (!cut(x, y)) continue;
      const left = x < cx;
      if (y < cy) s.set(x, y, left ? R.white[3] : R.white[2]);
      else s.set(x, y, left ? R.white[2] : R.white[1]);
    }
  s.hline(cx - w + 1, cy - 1, w * 2 - 1, R.white[1]);
}

export function cubicZirconiaEarrings(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 3, 3, 26, 26, R.denim, { band: 1 });
  s.rect(14, 5, 4, 1, R.denim[0]);
  for (const [x, y, gy] of [
    [10, 10, 17],
    [21, 14, 21],
  ]) {
    disc(s, x, y, 1.8, R.white[3]);
    s.vline(x, y + 1, gy - y - 3, R.steel[2]);
    gem(s, x, gy, 4, 5);
  }
  sparkle(s, 25, 8, R.white[3]);
  return s.outline();
}

function spoon(s: Sprite, x0: number, y0: number, angle: number): void {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const at = (t: number): [number, number] => [x0 + ux * 17 * t, y0 + uy * 17 * t];
  const [hx, hy] = at(0.62);
  const [bx, by] = at(1);
  const handle = thick(x0, y0, hx, hy, 1, 1.3);
  const end = thick(x0, y0, x0 + ux * 2, y0 + uy * 2, 1.9);
  const bowl = thick(hx + ux * 2, hy + uy * 2, bx, by, 3);
  const body: Test = (x, y) => handle(x, y) || end(x, y) || bowl(x, y);
  shape(s, body, R.grey);
  const [mx, my] = at(0.9);
  s.set(Math.round(mx), Math.round(my), R.steel[1]);
}

export function tarnishedSilverSpoonSet(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 2, 6, 28, 23, R.wood, { band: 1 });
  s.rect(4, 8, 24, 19, R.red[1]);
  s.rect(5, 9, 22, 17, R.red[2]);
  [8.5, 15.5, 22.5].forEach((x, i) => spoon(s, x, 26, -1.52 + i * 0.07));
  for (const [x, y] of [
    [8, 20],
    [14, 16],
    [19, 22],
    [20, 13],
    [14, 12],
  ])
    s.set(x, y, R.steel[1]);
  return s.outline();
}

const turn =
  (cx: number, cy: number, a: number) =>
  (test: Test): Test =>
  (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    return test(
      cx + dx * Math.cos(a) + dy * Math.sin(a) - 0.5,
      cy - dx * Math.sin(a) + dy * Math.cos(a) - 0.5,
    );
  };

export function classRingFromNowhere(): Sprite {
  const s = new Sprite(32, 32);
  const band: Test = (x, y) => ell(16, 23.5, 11.5, 5.7)(x, y) && !ell(16, 24, 7.5, 2.6)(x, y);
  shape(s, band, R.gold, { band: 1 });
  box(s, 4, 13, 24, 6, R.gold, { band: 1 });
  box(s, 7, 2, 12, 12, R.gold, { band: 1 });
  const cut: Test = (x, y) => x >= 9 && x <= 17 && y >= 4 && y <= 11 && !(x + y < 14 || x + y > 27);
  shape(s, cut, R.red, { band: 1 });
  s.rect(11, 6, 4, 3, R.red[3]);
  s.set(10, 5, R.white[3]);
  s.set(11, 4, R.white[3]);
  digits(s, '98', 20, 14, R.gold[0]);
  s.vline(5, 14, 4, R.gold[0]);
  return s.outline();
}

export function pearlNecklaceWithAKnot(): Sprite {
  const s = new Sprite(32, 32);
  const n = 14;
  const gap = 0.36;
  const tilt = -0.3;
  const spot = (a: number): [number, number] => [
    16 + 11.5 * Math.cos(a) * Math.cos(tilt) - 8.5 * Math.sin(a) * Math.sin(tilt),
    12 + 11.5 * Math.cos(a) * Math.sin(tilt) + 8.5 * Math.sin(a) * Math.cos(tilt),
  ];
  const start = Math.PI / 2 + gap;
  const end = Math.PI / 2 - gap + Math.PI * 2;
  const [ax, ay] = spot(start);
  const [bx, by] = spot(end);
  const kx = (ax + bx) / 2;
  const ky = (ay + by) / 2 + 3;
  for (let i = 0; i < n; i++) {
    const [x, y] = spot(start + (i * (end - start)) / (n - 1));
    sphere(s, x, y, 2.5, R.white);
  }
  for (const [px, py] of [
    [ax, ay],
    [bx, by],
  ]) {
    sphere(s, kx, ky, 2.5, R.white);
    sphere(s, 2 * kx - px, 2 * ky - py, 2.5, R.white);
  }
  s.rect(Math.round(kx) - 1, Math.round(ky) - 1, 3, 3, R.red[2]);
  s.set(Math.round(kx) - 1, Math.round(ky) - 1, R.red[3]);
  return s.outline();
}

function chrome(s: Sprite, test: Test, shade: string): void {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      if (!test(x, y)) continue;
      if (!test(x - 1, y) || !test(x, y - 1)) s.set(x, y, R.white[2]);
      else if (!test(x + 1, y) || !test(x, y + 1)) s.set(x, y, shade);
      else if (!test(x - 2, y) || !test(x, y - 2)) s.set(x, y, R.white[3]);
      else s.set(x, y, R.white[2]);
    }
}

export function chromePinkyRing(): Sprite {
  const s = new Sprite(32, 32);
  const tilt = turn(16, 14, -0.28);
  const band: Test = (x, y) => ell(16, 14.5, 9.2, 9.2)(x, y) && !ell(16, 15.5, 5, 5.2)(x, y);
  chrome(s, tilt(band), R.white[1]);
  chrome(
    s,
    tilt((x, y) => x >= 11 && x <= 21 && y >= 3 && y <= 8),
    R.white[0],
  );
  sparkle(s, 27, 6, R.white[3]);
  const cushion = ell(15.5, 27, 11.5, 3.6);
  flat(s, cushion, R.plum[2]);
  flat(s, (x, y) => cushion(x, y) && !cushion(x, y + 1), R.plum[1]);
  s.hline(11, 25, 11, R.plum[0]);
  return s.outline();
}

export function solidGoldPocketWatch(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, ell(24.5, 18.5, 3.8, 8.6), R.gold, { band: 1 });
  flat(s, ell(25, 18.5, 2, 6.4), R.gold[1]);
  s.vline(24, 14, 8, R.gold[2]);
  const chain = bezier([10, 4], [6, 1], [2, 8], [4, 15], 10);
  flat(s, sweep(chain, 1.1), R.gold[2]);
  chain.forEach(([x, y], i) => {
    if (i % 2 === 0) s.set(x, y, R.gold[0]);
  });
  const bow: Test = (x, y) => ell(13.5, 4.5, 3.5, 3)(x, y) && !ell(13.5, 4.8, 1.8, 1.4)(x, y);
  shape(s, bow, R.gold);
  box(s, 12, 7, 3, 3, R.gold);
  shape(s, ell(13.5, 19, 9.5, 9.5), R.gold, { band: 1 });
  shape(s, ell(13.5, 19, 7.2, 7.2), R.paper);
  for (const [x, y] of [
    [13, 13],
    [13, 24],
    [7, 18],
    [19, 18],
  ])
    s.rect(x, y, 2, 2, R.black[0]);
  s.line(13, 19, 9, 15, R.black[0]);
  s.line(13, 19, 16, 14, R.black[0]);
  s.set(13, 19, R.red[2]);
  for (const [x, y] of [
    [7, 13],
    [6, 14],
    [6, 15],
  ])
    s.set(x, y, R.white[3]);
  sparkle(s, 27, 6, R.white[3]);
  sparkle(s, 3, 25, R.white[3]);
  return s.outline();
}

export function knockoffDiamondWatch(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 11, 2, 10, 8, R.purple, { band: 1 });
  box(s, 11, 22, 10, 8, R.purple, { band: 1 });
  for (const y of [25, 27]) s.set(17, y, R.purple[1]);
  shape(s, ell(15.5, 15.5, 9.8, 9.8), R.gold, { band: 1 });
  for (let y = 4; y < 28; y++)
    for (let x = 4; x < 28; x++) {
      const dx = x + 0.5 - 15.5;
      const dy = y + 0.5 - 15.5;
      const r = Math.hypot(dx, dy);
      if (r > 8.6 || r < 6.3) continue;
      const sector = Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 7));
      s.set(x, y, sector % 2 === 0 ? R.white[3] : R.white[1]);
    }
  flat(s, ell(15.5, 15.5, 6.3, 6.3), R.glass[1]);
  s.vline(15, 12, 4, R.white[3]);
  s.hline(15, 15, 4, R.white[3]);
  s.set(15, 9, R.white[3]);
  s.rect(25, 14, 2, 3, R.gold[2]);
  sparkle(s, 26, 5, R.gold[3]);
  return s.outline();
}

export function beltBuckleTheSizeOfAPlate(): Sprite {
  const s = new Sprite(32, 32);
  const outer = mask([
    [7, 5],
    [21, 5],
    [24, 8],
    [24, 25],
    [21, 28],
    [7, 28],
    [4, 25],
    [4, 8],
  ]);
  const inner = mask([
    [9, 8],
    [19, 8],
    [21, 10],
    [21, 23],
    [19, 25],
    [9, 25],
    [7, 23],
    [7, 10],
  ]);
  shape(s, (x, y) => outer(x, y) && !inner(x, y), R.gold, { band: 1 });
  blit(
    s,
    ['11000011', '11000011', '11000011', '11000011', '11100111', '01111110', '00111100'],
    10,
    8,
    R.gold[1],
  );
  s.set(10, 8, R.gold[3]);
  s.set(10, 10, R.gold[3]);
  const tip = mask([
    [22, 17],
    [27, 17],
    [30, 20],
    [27, 23],
    [22, 23],
  ]);
  shape(s, tip, R.brick);
  shape(s, (x, y) => x >= 1 && x <= 23 && y >= 17 && y <= 23, R.brick);
  s.set(26, 20, R.brick[0]);
  s.set(22, 20, R.brick[0]);
  s.hline(3, 18, 18, R.brick[1]);
  s.hline(3, 22, 18, R.brick[1]);
  s.rect(8, 19, 11, 2, R.gold[2]);
  s.hline(8, 19, 11, R.gold[3]);
  disc(s, 8, 20, 1.6, R.gold[3]);
  sparkle(s, 3, 3, R.white[3]);
  return s.outline();
}

export const BLING: Readonly<Record<string, () => Sprite>> = {
  'Cubic Zirconia Earrings': cubicZirconiaEarrings,
  'Tarnished Silver Spoon Set': tarnishedSilverSpoonSet,
  'Class Ring from Nowhere': classRingFromNowhere,
  'Pearl Necklace with a Knot': pearlNecklaceWithAKnot,
  'Chrome Pinky Ring': chromePinkyRing,
  'Solid Gold Pocket Watch': solidGoldPocketWatch,
  'Knockoff Diamond Watch': knockoffDiamondWatch,
  'Belt Buckle the Size of a Plate': beltBuckleTheSizeOfAPlate,
};
