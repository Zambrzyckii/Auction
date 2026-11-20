import { R, Sprite, box, disc, shape, text } from '../../street/pix';
import { bezier, blit, ell, flat } from './helpers';

export function lumpyBeanBag(): Sprite {
  const s = new Sprite(32, 32);
  const lumps = [ell(16, 20, 13, 8.5), ell(9.5, 12, 6.5, 7.5), ell(4.5, 23, 2.5, 3)];
  const dent = ell(18, 13, 4.5, 3.4);
  shape(s, (x, y) => y <= 28 && lumps.some((f) => f(x, y)) && !dent(x, y), R.red, { band: 1 });
  s.line(8, 7, 7, 15, R.red[0]);
  s.line(12, 16, 9, 20, R.red[0]);
  s.line(21, 18, 25, 22, R.red[0]);
  s.line(7, 25, 11, 27, R.red[0]);
  s.hline(15, 18, 5, R.red[3]);
  s.hline(14, 22, 6, R.red[0]);
  for (const [x, y] of [
    [17, 22],
    [24, 27],
    [27, 25],
  ]) {
    s.rect(x, y, 2, 2, R.wood[2]);
    s.set(x, y, R.wood[3]);
  }
  return s.outline();
}

export function beadedDoorCurtain(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 3, 2, 26, 27, R.wood, { band: 1 });
  s.rect(6, 5, 20, 24, R.black[0]);
  const colours = [R.red, R.taxi, R.denim];
  const ends = [27, 23, 26, 21, 24];
  for (let i = 0; i < 5; i++) {
    const x = 6 + i * 4;
    s.vline(x + 1, 6, ends[i] - 6, R.wood[2]);
    for (let y = 6, j = 0; y + 2 < ends[i]; y += 4, j++) {
      const ramp = colours[(i + j) % 3];
      blit(s, ['010', '111', '010'], x, y, ramp[2]);
      s.set(x + 1, y, ramp[3]);
    }
  }
  s.hline(6, 5, 20, R.wood[0]);
  return s.outline();
}

const stroke =
  (pts: readonly (readonly [number, number])[], r: number) =>
  (x: number, y: number): boolean =>
    pts.some(([px, py]) => (x - px) ** 2 + (y - py) ** 2 <= r * r);

const PINK = [R.red[1], R.red[2], R.red[3], R.skinC[3]];

export function plasticLawnFlamingo(): Sprite {
  const s = new Sprite(32, 32);
  flat(s, (x, y) => y >= 27 && ell(15, 27.5, 12, 1.9)(x, y), R.green[2]);
  s.hline(5, 28, 4, R.green[1]);
  s.hline(19, 28, 6, R.green[1]);
  s.set(10, 26, R.green[2]);
  s.set(20, 26, R.green[2]);
  s.vline(12, 21, 7, PINK[1]);
  s.vline(13, 21, 7, PINK[2]);
  s.line(16, 21, 19, 24, PINK[1]);
  s.line(17, 21, 20, 24, PINK[2]);
  s.line(19, 24, 17, 27, PINK[1]);
  s.line(20, 24, 18, 27, PINK[2]);
  shape(s, ell(13.5, 16.5, 8.5, 5.5), PINK, { band: 1 });
  flat(s, ell(5, 16, 3, 2), PINK[1]);
  const neck = bezier([18, 14], [24, 12], [16, 6], [21, 4], 24);
  shape(s, stroke(neck, 1.7), PINK);
  shape(s, ell(22, 4.5, 2.6, 2.2), PINK);
  s.rect(24, 4, 3, 2, R.skinC[3]);
  s.rect(26, 6, 2, 2, R.black[0]);
  s.set(22, 4, R.black[0]);
  s.line(9, 17, 15, 19, PINK[0]);
  s.hline(10, 13, 4, PINK[3]);
  return s.outline();
}

const STAR5 = ['00100', '00100', '11111', '01110', '01010'];
const STAR7 = ['0001000', '0001000', '0011100', '1111111', '0111110', '0011100', '0110110'];

export function glowStarCeilingKit(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 6, 15, 20, 13, R.denim, { band: 1 });
  for (let x = 7; x < 25; x += 2) s.set(x, 15, null);
  s.rect(8, 19, 16, 7, R.denim[0]);
  text(s, 'GLOW', 9, 20, R.lit[3], 'micro', { alignTop: true });
  blit(s, STAR7, 13, 2, R.lit[3]);
  blit(s, STAR5, 5, 7, R.lit[3]);
  blit(s, STAR5, 22, 5, R.lit[2]);
  blit(s, STAR5, 21, 11, R.lit[3]);
  blit(s, STAR5, 8, 12, R.lit[2]);
  return s.outline();
}

export function handMeDownQuilt(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(4, 6, 24, 22, R.paper[2]);
  s.vline(27, 6, 22, R.paper[1]);
  s.hline(4, 27, 24, R.paper[1]);
  const patches = [R.red[2], R.denim[2], R.taxi[2], R.green[2]];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      s.rect(6 + c * 4, 7 + r * 4, 3, 3, patches[(r * 2 + c * 3) % 4]);
      s.set(9 + c * 4, 8 + r * 4, R.wood[1]);
      s.set(6 + c * 4, 10 + r * 4, R.wood[1]);
    }
  box(s, 2, 3, 28, 3, R.wood, { band: 1 });
  return s.outline();
}

export function ceramicDogDoorstop(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 22, 2, 8, 26, R.wood, { band: 1 });
  s.rect(24, 5, 4, 8, R.wood[1]);
  s.rect(24, 16, 4, 8, R.wood[1]);
  s.hline(2, 27, 28, R.wood[2]);
  s.hline(2, 28, 28, R.wood[1]);
  shape(s, (x, y) => y <= 27 && ell(15, 20, 6.5, 8.5)(x, y), R.white, { band: 1 });
  shape(s, (x, y) => y <= 27 && ell(17, 23, 5.5, 4.5)(x, y), R.white, { band: 1 });
  box(s, 8, 19, 3, 9, R.white, { band: 1 });
  shape(s, ell(10, 9, 4.8, 4.4), R.white, { band: 1 });
  shape(s, ell(5.5, 11, 3, 2.2), R.white);
  s.rect(2, 10, 2, 2, R.black[0]);
  s.set(9, 8, R.black[0]);
  shape(s, ell(13.5, 10, 2, 4), R.wood, { band: 1 });
  s.hline(8, 14, 6, R.red[2]);
  flat(s, ell(18, 18, 2, 2), R.wood[1]);
  flat(s, ell(14, 24, 1.6, 1.6), R.wood[1]);
  return s.outline();
}

export function grandfatherClockMissingPendulum(): Sprite {
  const s = new Sprite(32, 32);
  const arch = ell(16, 6, 8, 5.5);
  shape(
    s,
    (x, y) => y >= 1 && y <= 11 && Math.abs(x + 0.5 - 16) <= 8 && (y >= 6 || arch(x, y)),
    R.wood,
    {
      band: 1,
    },
  );
  flat(s, ell(16, 6.5, 4.8, 4.8), R.taxi[2]);
  disc(s, 16, 6.5, 3.6, R.paper[3]);
  s.line(16, 6, 16, 4, R.wood[0]);
  s.line(16, 6, 18, 7, R.wood[0]);
  box(s, 10, 12, 12, 14, R.wood, { band: 1 });
  s.rect(12, 14, 8, 10, R.purple[0]);
  s.vline(12, 15, 8, R.purple[2]);
  s.vline(16, 14, 6, R.taxi[2]);
  s.set(15, 20, R.taxi[2]);
  s.set(17, 20, R.taxi[2]);
  s.set(15, 21, R.taxi[2]);
  s.set(17, 21, R.taxi[2]);
  s.vline(13, 14, 4, R.taxi[2]);
  s.rect(12, 18, 3, 4, R.taxi[3]);
  s.vline(19, 14, 4, R.taxi[2]);
  s.rect(18, 18, 3, 4, R.taxi[3]);
  box(s, 8, 26, 16, 3, R.wood, { band: 1 });
  return s.outline();
}

export function velvetCroonerPainting(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 3, 3, 26, 26, R.gold, { band: 1 });
  s.rect(5, 5, 22, 22, R.gold[1]);
  s.rect(6, 6, 20, 20, R.black[0]);
  for (const [x, y] of [
    [4, 4],
    [26, 4],
    [4, 26],
    [26, 26],
  ])
    s.rect(x, y, 2, 2, R.gold[3]);
  shape(s, (x, y) => y >= 19 && y <= 25 && Math.abs(x + 0.5 - 14) <= 6 + (y - 19) * 0.6, R.black);
  s.rect(12, 19, 5, 6, R.white[3]);
  s.rect(12, 19, 5, 2, R.red[2]);
  flat(s, ell(14, 13.5, 3.6, 4.4), R.skinC[2]);
  flat(s, ell(14, 10, 4.2, 2.6), R.black[2]);
  flat(s, ell(17, 8.5, 3, 2), R.black[2]);
  s.vline(10, 11, 4, R.black[2]);
  s.set(13, 13, R.black[0]);
  s.set(16, 13, R.black[0]);
  s.rect(14, 16, 2, 1, R.black[0]);
  flat(s, ell(21, 15, 1.8, 1.8), R.white[3]);
  s.vline(21, 16, 8, R.black[2]);
  return s.outline();
}

export const HOME: Readonly<Record<string, () => Sprite>> = {
  'Lumpy Bean Bag': lumpyBeanBag,
  'Beaded Door Curtain': beadedDoorCurtain,
  'Plastic Lawn Flamingo': plasticLawnFlamingo,
  'Glow Star Ceiling Kit': glowStarCeilingKit,
  'Hand-Me-Down Quilt': handMeDownQuilt,
  'Ceramic Dog Doorstop': ceramicDogDoorstop,
  'Grandfather Clock Missing Pendulum': grandfatherClockMissingPendulum,
  'Velvet Crooner Painting': velvetCroonerPainting,
};
