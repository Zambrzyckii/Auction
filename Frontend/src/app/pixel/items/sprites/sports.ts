import { R, Sprite, box, shape, sphere, type Col } from '../../street/pix';
import { bezier, ell, lightTone, poly } from './helpers';

function flat(s: Sprite, test: (x: number, y: number) => boolean, col: Col): void {
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (test(x, y)) s.set(x, y, col);
}

// Distance along (u) and across (v, positive towards the lower right) a segment drawn from (x0, y0) to (x1, y1).
const along = (x0: number, y0: number, x1: number, y1: number) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  return (x: number, y: number): [number, number] => {
    const px = x + 0.5 - x0;
    const py = y + 0.5 - y0;
    return [(px * dx + py * dy) / len, (py * dx - px * dy) / len];
  };
};

export function deflatedBasketball(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, ell(16, 19.5, 13, 9), R.rust, { band: 1 });
  s.hline(4, 19, 25, R.black[0]);
  s.vline(16, 11, 17, R.black[0]);
  for (let i = 0; i <= 13; i++) {
    const bulge = Math.round(2.5 * Math.sin((Math.PI * i) / 13));
    s.set(10 + bulge, 13 + i, R.black[0]);
    s.set(22 - bulge, 13 + i, R.black[0]);
  }
  flat(s, ell(20.5, 14.5, 3.6, 1.8), R.rust[1]);
  s.hline(19, 16, 4, R.rust[3]);
  s.line(7, 22, 10, 24, R.rust[0]);
  s.line(22, 24, 25, 23, R.rust[0]);
  return s.outline();
}

function glove(s: Sprite, cx: number, thumbX: number): void {
  shape(s, ell(cx, 13, 6, 8), R.red, { band: 1 });
  shape(s, ell(thumbX, 16, 2.4, 4.2), R.red, { band: 1 });
  s.vline(Math.round(cx + (thumbX - cx) / 2.6), 13, 7, R.red[0]);
  box(s, cx - 4, 21, 8, 7, R.white, { band: 1 });
  s.hline(cx - 4, 22, 8, R.black[1]);
  s.vline(cx, 23, 5, R.white[0]);
}

export function scuffedBoxingGloves(): Sprite {
  const s = new Sprite(32, 32);
  glove(s, 10, 4);
  glove(s, 22, 28);
  s.line(8, 9, 10, 7, R.red[0]);
  s.line(7, 13, 8, 12, R.red[0]);
  s.line(21, 10, 23, 8, R.red[0]);
  s.set(12, 12, R.paper[2]);
  s.set(24, 14, R.paper[2]);
  return s.outline();
}

const stickWidth = 1.9;

export function crackedHockeyStick(): Sprite {
  const s = new Sprite(32, 32);
  const at = along(15, 24, 27, 3);
  const length = Math.hypot(12, 21);
  shape(s, (x, y) => x >= 3 && x <= 17 && y >= 25 && y <= 28 && !(x < 5 && y < 27), R.paper, {
    band: 1,
  });
  for (let x = 6; x <= 14; x += 3) s.vline(x, 26, 2, R.black[1]);
  const shaft = (x: number, y: number): boolean => {
    const [u, v] = at(x, y);
    return u >= -1 && u <= length && Math.abs(v) <= stickWidth;
  };
  shape(s, shaft, R.wood, { band: 1 });
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      if (!shaft(x, y)) continue;
      const [u, v] = at(x, y);
      if (u > 20) s.set(x, y, Math.floor(u) % 2 === 0 ? R.black[1] : R.paper[2]);
      if (Math.abs(u - 12 - 1.2 * Math.sin(v * 2.4)) < 0.7) s.set(x, y, R.black[0]);
      if (Math.abs(v - 1) < 0.6 && u > 12 && u < 15.5) s.set(x, y, R.black[0]);
      if (Math.abs(v + 1) < 0.6 && u > 8.5 && u < 11.5) s.set(x, y, R.paper[3]);
    }
  return s.outline();
}

function ballTone(x: number, y: number): number {
  return lightTone(x + 0.5 - 15.5, y + 0.5 - 17, 12.5);
}

export function lopsidedBowlingBall(): Sprite {
  const s = new Sprite(32, 32);
  const left = ell(14, 16, 9.5, 10.5);
  const right = ell(19.5, 19.5, 9.5, 9);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (left(x, y) || right(x, y)) s.set(x, y, R.purple[ballTone(x, y)]);
  for (const [x, y, r] of [
    [15, 9, 1.6],
    [20, 11, 1.6],
    [19, 16, 1.6],
  ] as const)
    flat(s, ell(x, y, r, r), R.black[0]);
  s.set(11, 8, R.white[3]);
  s.set(12, 8, R.white[3]);
  s.set(10, 9, R.white[3]);
  return s.outline();
}

const batWidth = (u: number): number => {
  if (u < 0 || u > 31) return -1;
  if (u < 2.5) return 2.2;
  if (u < 12) return 1.3;
  if (u < 22) return 1.3 + (u - 12) * 0.25;
  if (u < 27) return 3.8;
  return 3.8 * Math.sqrt(1 - ((u - 27) / 4) ** 2);
};

export function tapedBaseballBat(): Sprite {
  const s = new Sprite(32, 32);
  const at = along(5, 27, 27, 5);
  const bat = (x: number, y: number): boolean => {
    const [u, v] = at(x, y);
    return Math.abs(v) <= batWidth(u);
  };
  shape(s, bat, R.wood, { band: 1 });
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      if (!bat(x, y)) continue;
      const [u, v] = at(x, y);
      if (u > 4 && u < 11) s.set(x, y, R.black[Math.floor(u) % 2 === 0 ? 1 : 2]);
      const strip = (u > 14.5 && u < 17.5) || (u > 19 && u < 21.5);
      if (!strip) continue;
      if (v < -1.2) s.set(x, y, R.paper[3]);
      else s.set(x, y, v > 1.8 ? R.paper[1] : R.paper[2]);
    }
  s.set(18, 15, R.paper[3]);
  return s.outline();
}

export function trophyMissingItsPlate(): Sprite {
  const s = new Sprite(32, 32);
  for (const cx of [6.5, 25.5]) {
    const ring = ell(cx, 8, 3.4, 4);
    const hole = ell(cx, 8, 1.4, 2.2);
    shape(s, (x, y) => ring(x, y) && !hole(x, y), R.gold);
  }
  shape(
    s,
    (x, y) =>
      y >= 3 &&
      y <= 15 &&
      Math.abs(x + 0.5 - 16) <= 8 - (y - 3) * 0.22 &&
      (y <= 12 || ell(16, 12, 5.8, 3.6)(x, y)),
    R.gold,
    { band: 1 },
  );
  box(s, 14, 15, 4, 5, R.gold, { band: 1 });
  box(s, 11, 19, 10, 3, R.gold, { band: 1 });
  box(s, 7, 22, 18, 7, R.wood, { band: 1 });
  s.rect(10, 24, 12, 3, R.wood[3]);
  s.set(11, 25, R.wood[0]);
  s.set(20, 25, R.wood[0]);
  return s.outline();
}

export function signedGameBall(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 8, 24, 16, 5, R.purple, { band: 1 });
  sphere(s, 16, 13, 10.5, R.white);
  for (let i = 0; i <= 15; i++) {
    const bulge = Math.round(2.5 * Math.sin((Math.PI * i) / 15));
    s.set(11 + bulge, 6 + i, R.red[2]);
    s.set(21 - bulge, 6 + i, R.red[2]);
    if (i % 2 === 0) {
      s.set(10 + bulge, 6 + i, R.red[1]);
      s.set(22 - bulge, 6 + i, R.red[1]);
    }
  }
  const ink: [number, number][] = [
    [10, 17],
    [12, 11],
    [13, 17],
    [15, 11],
    [17, 17],
    [19, 12],
    [21, 15],
  ];
  for (let i = 1; i < ink.length; i++) s.line(...ink[i - 1], ...ink[i], R.denim[1]);
  for (const [x, y] of bezier([10, 19], [14, 21], [18, 18], [22, 19], 12)) s.set(x, y, R.denim[1]);
  return s.outline();
}

export function fadedWrestlingBelt(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 2, 14, 28, 12, R.mauve, { band: 1 });
  s.hline(3, 16, 26, R.mauve[0]);
  s.hline(3, 23, 26, R.mauve[0]);
  s.line(4, 20, 7, 18, R.concrete[2]);
  s.line(24, 21, 27, 19, R.concrete[2]);
  box(s, 2, 15, 4, 10, R.gold, { band: 1 });
  box(s, 26, 15, 4, 10, R.gold, { band: 1 });
  shape(s, ell(16, 19, 8.5, 10), R.gold, { band: 1 });
  flat(s, ell(16, 19, 6, 7.5), R.gold[1]);
  const star: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 5 : 2.2;
    star.push([16 + r * Math.cos(a), 19.5 + r * Math.sin(a)]);
  }
  poly(s, star, R.gold[3]);
  s.set(12, 14, R.gold[1]);
  s.set(20, 25, R.gold[0]);
  return s.outline();
}

export const SPORTS: Readonly<Record<string, () => Sprite>> = {
  'Deflated Basketball': deflatedBasketball,
  'Scuffed Boxing Gloves': scuffedBoxingGloves,
  'Cracked Hockey Stick': crackedHockeyStick,
  'Lopsided Bowling Ball': lopsidedBowlingBall,
  'Taped Baseball Bat': tapedBaseballBat,
  'Trophy Missing Its Plate': trophyMissingItsPlate,
  'Signed Game Ball': signedGameBall,
  'Faded Wrestling Belt': fadedWrestlingBelt,
};
