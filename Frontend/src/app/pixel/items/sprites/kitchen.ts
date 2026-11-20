import { R, Sprite, box, cylV, shape, sphere, text } from '../../street/pix';
import { ell, flat } from './helpers';

export function chippedDinerMug(): Sprite {
  const s = new Sprite(32, 32);
  const handle = ell(23, 18, 5.5, 6.5);
  const hole = ell(23, 18, 2.6, 3.6);
  shape(s, (x, y) => x >= 17 && handle(x, y) && !hole(x, y), R.white, { band: 1 });
  cylV(s, 4, 7, 16, 21, R.white);
  s.hline(4, 28, 16, R.white[0]);
  cylV(s, 4, 13, 16, 3, R.red);
  shape(s, ell(12, 7, 8, 2.8), R.white);
  flat(s, ell(12, 7.4, 6.2, 1.6), R.rust[1]);
  s.rect(6, 10, 3, 2, R.rust[1]);
  s.set(9, 11, R.white[0]);
  s.set(10, 12, R.white[0]);
  return s.outline();
}

function dent(s: Sprite, x: number, y: number): void {
  s.set(x, y, R.steel[0]);
  s.set(x + 1, y, R.steel[1]);
  s.set(x, y + 1, R.steel[1]);
  s.set(x + 1, y + 1, R.steel[3]);
}

export function dentedLunchThermos(): Sprite {
  const s = new Sprite(32, 32);
  const loop = ell(22.5, 18, 3.2, 5.5);
  const hole = ell(22.5, 18, 1.4, 3.3);
  flat(s, (x, y) => x >= 20 && loop(x, y) && !hole(x, y), R.black[1]);
  cylV(s, 7, 10, 14, 19, R.steel);
  s.hline(7, 28, 14, R.steel[0]);
  cylV(s, 7, 15, 14, 3, R.red);
  s.hline(6, 10, 16, R.black[0]);
  cylV(s, 6, 3, 16, 7, R.red);
  s.hline(6, 4, 16, R.red[3]);
  dent(s, 9, 21);
  dent(s, 15, 24);
  dent(s, 12, 12);
  return s.outline();
}

export function rustyWaffleIron(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(10, 7, 8, 3, R.black[1]);
  box(s, 3, 10, 22, 19, R.steel, { band: 1 });
  box(s, 6, 13, 16, 13, R.rust, { band: 1 });
  for (let i = 0; i < 4; i++) {
    s.vline(9 + i * 3, 14, 11, R.rust[0]);
    s.hline(7, 16 + i * 3, 14, R.rust[0]);
  }
  s.rect(25, 22, 6, 4, R.black[1]);
  s.hline(5, 25, 2, R.rust[3]);
  s.hline(4, 26, 2, R.rust[2]);
  s.set(21, 12, R.rust[2]);
  s.hline(22, 12, 2, R.rust[3]);
  s.vline(4, 14, 2, R.rust[2]);
  s.set(23, 19, R.rust[2]);
  s.set(23, 20, R.rust[3]);
  return s.outline();
}

const limb =
  (x0: number, y0: number, x1: number, y1: number, r0: number, r1: number) =>
  (x: number, y: number): boolean => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const f = Math.max(
      0,
      Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / (dx * dx + dy * dy)),
    );
    return Math.hypot(x + 0.5 - (x0 + f * dx), y + 0.5 - (y0 + f * dy)) <= r0 + (r1 - r0) * f;
  };

export function handCrankCanOpener(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, limb(12, 13, 7, 28, 1.9, 1.9), R.red, { band: 1 });
  shape(s, limb(12, 13, 17, 28, 1.9, 1.9), R.red, { band: 1 });
  box(s, 8, 9, 8, 7, R.steel, { band: 1 });
  s.set(11, 12, R.steel[0]);
  s.set(12, 12, R.steel[0]);
  s.rect(16, 12, 7, 2, R.steel[3]);
  s.hline(16, 14, 7, R.steel[1]);
  const upper = limb(22, 13, 26, 5, 1, 3.4);
  const lower = limb(22, 13, 26, 21, 1, 3.4);
  shape(s, (x, y) => upper(x, y) || lower(x, y), R.red, { band: 1 });
  flat(s, ell(22.5, 13, 2, 2), R.steel[3]);
  s.set(22, 13, R.steel[0]);
  return s.outline();
}

export function crackedCookieJar(): Sprite {
  const s = new Sprite(32, 32);
  cylV(s, 6, 11, 20, 18, R.denim);
  for (const [x, y] of [
    [6, 11],
    [25, 11],
    [6, 28],
    [25, 28],
  ])
    s.set(x, y, null);
  s.rect(9, 8, 14, 3, R.denim[1]);
  s.rect(7, 6, 18, 2, R.tan[2]);
  s.hline(7, 6, 18, R.tan[3]);
  sphere(s, 16, 3.5, 2.5, R.tan);
  sphere(s, 16.5, 20, 5.5, R.tan);
  for (const [x, y] of [
    [14, 18],
    [18, 17],
    [17, 21],
    [14, 22],
  ])
    s.set(x, y, R.tan[0]);
  for (const [x, y] of [
    [9, 13],
    [8, 14],
    [9, 15],
    [8, 16],
    [9, 17],
    [8, 18],
  ])
    s.set(x, y, R.black[0]);
  return s.outline();
}

export function mismatchedSaltShakers(): Sprite {
  const s = new Sprite(32, 32);
  cylV(s, 4, 12, 9, 17, R.white);
  flat(s, (x, y) => ell(8.5, 12, 5, 5.5)(x, y) && y <= 13, R.steel[2]);
  s.vline(5, 9, 3, R.steel[3]);
  for (const [x, y] of [
    [7, 8],
    [9, 8],
    [8, 10],
  ])
    s.set(x, y, R.steel[0]);
  text(s, 'S', 6, 17, R.red[1], 'micro', { alignTop: true });
  sphere(s, 22, 21, 7, R.red);
  s.rect(19, 9, 7, 6, R.steel[2]);
  s.hline(19, 9, 7, R.steel[3]);
  for (const [x, y] of [
    [21, 11],
    [23, 11],
    [22, 13],
  ])
    s.set(x, y, R.steel[0]);
  text(s, 'P', 20, 19, R.white[3], 'micro', { alignTop: true });
  return s.outline();
}

const BURNT = [R.rust[0], R.rust[0], R.rust[1], R.rust[1]];

export function burntPopcornMaker(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, (x, y) => ell(16, 11, 12, 7.5)(x, y) && y <= 11, R.red, { band: 1 });
  for (let x = 8; x <= 24; x += 4) s.vline(x, 6, 5, R.red[1]);
  sphere(s, 16, 4.5, 2, R.red);
  s.rect(5, 11, 22, 11, R.glass[1]);
  s.vline(5, 11, 11, R.red[1]);
  s.vline(26, 11, 11, R.red[0]);
  for (const [x, y, burnt] of [
    [13, 14, false],
    [17, 14, true],
    [9, 17, false],
    [13, 17, true],
    [17, 17, false],
    [21, 17, true],
    [8, 20, true],
    [11, 20, false],
    [15, 20, true],
    [19, 20, true],
    [23, 20, false],
  ] as const)
    shape(s, ell(x, y, 2.6, 2.6), burnt ? BURNT : R.paper);
  s.set(14, 16, R.rust[0]);
  s.set(10, 19, R.rust[0]);
  box(s, 4, 22, 24, 7, R.red, { band: 1 });
  s.rect(8, 24, 16, 3, R.red[0]);
  s.set(20, 25, R.red[3]);
  flat(s, ell(8, 28, 2.4, 2.4), R.glass[1]);
  flat(s, ell(24, 28, 2.4, 2.4), R.glass[1]);
  s.set(21, 7, R.red[0]);
  s.set(21, 8, R.red[0]);
  s.set(10, 9, R.red[0]);
  return s.outline();
}

export function neonDinerSign(): Sprite {
  const s = new Sprite(32, 32);
  s.vline(8, 3, 7, R.steel[1]);
  s.vline(23, 3, 7, R.steel[1]);
  box(s, 3, 9, 26, 19, R.black, { band: 1 });
  s.rect(5, 11, 22, 15, R.black[0]);
  s.rect(5, 11, 22, 1, R.red[3]);
  s.rect(5, 25, 22, 1, R.red[3]);
  s.vline(5, 11, 15, R.red[3]);
  s.vline(26, 11, 15, R.red[3]);
  text(s, 'DINER', 8, 15, R.gold[3], 'micro', { alignTop: true });
  s.hline(9, 21, 15, R.gold[3]);
  s.hline(6, 12, 20, R.red[1]);
  s.hline(6, 24, 20, R.red[1]);
  s.vline(6, 12, 13, R.red[1]);
  s.vline(25, 12, 13, R.red[1]);
  return s.outline();
}

export const KITCHEN: Readonly<Record<string, () => Sprite>> = {
  'Chipped Diner Mug': chippedDinerMug,
  'Dented Lunch Thermos': dentedLunchThermos,
  'Rusty Waffle Iron': rustyWaffleIron,
  'Hand-Crank Can Opener': handCrankCanOpener,
  'Cracked Cookie Jar': crackedCookieJar,
  'Mismatched Salt Shakers': mismatchedSaltShakers,
  'Burnt Popcorn Maker': burntPopcornMaker,
  'Neon Diner Sign': neonDinerSign,
};
