import { R, Sprite, box, cylH, shape, sphere } from '../../street/pix';
import { bezier, ell, lightTone, poly } from './helpers';

function blit(s: Sprite, rows: readonly string[], x: number, y: number, col: string): void {
  rows.forEach((row, j) =>
    [...row].forEach((v, i) => {
      if (v === '1') s.set(x + i, y + j, col);
    }),
  );
}

export function beadedCarSeatCover(): Sprite {
  const s = new Sprite(32, 32);
  const head = (x: number, y: number) =>
    x >= 10 && x <= 21 && y >= 3 && y <= 8 && !((x < 11 || x > 20) && (y < 4 || y > 7));
  const back = (x: number, y: number) =>
    x >= 6 &&
    x <= 25 &&
    y >= 11 &&
    y <= 28 &&
    !((x < 8 || x > 23) && y < 13) &&
    !((x < 7 || x > 24) && y < 12);
  for (const x of [12, 18]) {
    s.rect(x, 9, 2, 2, R.tan[2]);
    s.set(x, 9, R.tan[3]);
    s.set(x + 1, 10, R.tan[1]);
  }
  for (const part of [head, back]) {
    shape(s, part, R.wood, { band: 1 });
    const inner = (x: number, y: number) =>
      [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => part(x + dx, y + dy)));
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) if (inner(x, y)) s.set(x, y, R.wood[0]);
    for (let by = 3; by < 28; by += 3)
      for (let bx = 6 + ((by / 3) % 2); bx < 26; bx += 3) {
        const cells = [
          [bx, by],
          [bx + 1, by],
          [bx, by + 1],
          [bx + 1, by + 1],
        ];
        if (!cells.every(([x, y]) => inner(x, y))) continue;
        const ramp = bx < 10 || bx > 21 ? R.tan : R.wood;
        s.set(bx, by, ramp[3]);
        s.set(bx + 1, by, ramp[2]);
        s.set(bx, by + 1, ramp[2]);
        s.set(bx + 1, by + 1, ramp[1]);
      }
  }
  return s.outline();
}

export function fuzzyDice(): Sprite {
  const s = new Sprite(32, 32);
  s.line(16, 2, 10, 14, R.gold[2]);
  s.line(17, 2, 11, 14, R.gold[1]);
  s.line(16, 2, 22, 17, R.gold[2]);
  s.line(17, 2, 23, 17, R.gold[1]);
  const die = (x: number, y: number, pips: readonly (readonly [number, number])[]) => {
    s.rect(x, y, 12, 12, R.red[2]);
    s.hline(x, y, 12, R.red[3]);
    s.vline(x, y, 12, R.red[3]);
    s.vline(x + 11, y, 12, R.red[1]);
    s.hline(x, y + 11, 12, R.red[1]);
    for (const [px, py] of pips) {
      s.rect(x + px, y + py, 2, 2, R.white[2]);
    }
    for (let i = 1; i < 12; i += 2) {
      s.set(x + i, y - 1, R.red[3]);
      s.set(x + i - 1, y + 12, R.red[1]);
      s.set(x - 1, y + i, R.red[3]);
      s.set(x + 12, y + i - 1, R.red[1]);
    }
  };
  die(4, 14, [
    [2, 2],
    [8, 2],
    [5, 5],
    [2, 8],
    [8, 8],
  ]);
  die(17, 17, [
    [2, 2],
    [5, 5],
    [8, 8],
  ]);
  return s.outline();
}

export function spinningHubcap(): Sprite {
  const s = new Sprite(32, 32);
  const cx = 16;
  const cy = 15.5;
  const sector = Math.PI / 3;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      if (d >= 12.3 && d <= 13.3 && ((deg > 195 && deg < 255) || (deg > 15 && deg < 75)))
        s.set(x, y, R.white[2]);
      if (d > 11) continue;
      if (d > 9) {
        s.set(x, y, R.steel[lightTone(dx, dy, d)]);
        continue;
      }
      const delta = (((Math.atan2(dy, dx) % sector) + sector) % sector) - sector / 2;
      const spoke = d >= 2.5 && Math.abs(delta) * d <= 1.5;
      if (spoke) s.set(x, y, R.steel[Math.max(2, lightTone(dx, dy, d))]);
      else s.set(x, y, R.steel[d > 8.4 ? 1 : 0]);
    }
  sphere(s, cx, cy, 3.2, R.gold);
  return s.outline();
}

// Chrome strip along a path, shaded across its width so the lit side faces the top left.
function strip(s: Sprite, path: readonly (readonly [number, number])[], w: number): void {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      let best = Infinity;
      let side = 0;
      for (const [px, py] of path) {
        const dx = x + 0.5 - px;
        const dy = y + 0.5 - py;
        const d = Math.hypot(dx, dy);
        if (d < best) {
          best = d;
          side = (-dx - dy) / (d * 1.414 || 1);
        }
      }
      if (best > w / 2) continue;
      const f = (side * best) / (w / 2);
      let tone = R.steel[1];
      if (f > 0.55) tone = R.steel[3];
      else if (f > 0.15) tone = R.white[2];
      else if (f > -0.25) tone = R.steel[2];
      else if (f > -0.6) tone = R.steel[0];
      s.set(x, y, tone);
    }
}

export function chromeBumperPiece(): Sprite {
  const s = new Sprite(32, 32);
  for (let x = 2; x <= 29; x++) {
    const edge = Math.min(x - 2, 29 - x);
    const wrap = Math.max(0, 6 - edge) / 6;
    const yc = 22 + 2 * wrap;
    const half = 5.5 - 2.5 * wrap;
    for (let y = Math.floor(yc - half); y <= Math.ceil(yc + half); y++) {
      const f = (y + 0.5 - yc) / half;
      if (Math.abs(f) > 1) continue;
      let tone = R.steel[1];
      if (f < -0.6) tone = R.steel[3];
      else if (f < -0.2) tone = x > 20 ? R.steel[3] : R.white[2];
      else if (f < 0.15) tone = R.steel[2];
      else if (f < 0.5) tone = R.steel[0];
      s.set(x, y, tone);
    }
  }
  s.rect(8, 26, 16, 2, R.black[1]);
  s.hline(8, 26, 16, R.black[3]);
  s.rect(13, 20, 6, 3, R.steel[0]);
  s.hline(13, 23, 6, R.steel[3]);
  for (const x of [5, 25]) {
    s.rect(x, 21, 2, 2, R.steel[0]);
    s.set(x, 23, R.steel[3]);
  }
  return s.outline();
}

export function toolboxWithStuckDrawer(): Sprite {
  const s = new Sprite(32, 32);
  s.hline(13, 3, 6, R.steel[3]);
  s.vline(12, 4, 2, R.steel[2]);
  s.vline(19, 4, 2, R.steel[1]);
  box(s, 4, 5, 24, 7, R.sign, { band: 1 });
  s.rect(4, 12, 24, 6, R.black[0]);
  s.rect(6, 13, 20, 5, R.steel[2]);
  s.vline(6, 13, 5, R.steel[3]);
  s.vline(25, 13, 5, R.steel[1]);
  s.line(8, 15, 14, 15, R.steel[3]);
  s.rect(15, 14, 5, 2, R.red[2]);
  box(s, 4, 23, 24, 6, R.sign, { band: 1 });
  s.line(10, 26, 21, 26, R.steel[3]);
  poly(
    s,
    [
      [3, 17],
      [28, 19],
      [28, 26],
      [3, 24],
    ],
    R.sign[2],
  );
  s.line(3, 17, 27, 19, R.sign[3]);
  s.line(3, 24, 27, 26, R.sign[1]);
  s.line(10, 20, 21, 21, R.steel[3]);
  s.line(10, 21, 21, 22, R.steel[1]);
  return s.outline();
}

export function subwayTokenRoll(): Sprite {
  const s = new Sprite(32, 32);
  cylH(s, 2, 15, 18, 13, R.paper);
  s.rect(8, 15, 5, 13, R.denim[2]);
  s.vline(3, 15, 13, R.paper[1]);
  for (let y = 15; y < 28; y += 2) s.set(2, y, null);
  cylH(s, 20, 16, 4, 11, R.gold);
  s.vline(22, 16, 11, R.gold[1]);
  shape(s, ell(24.5, 21.5, 3.6, 6.5), R.gold, { band: 1 });
  blit(s, ['10001', '01010', '00100', '00100', '00100'], 22, 19, R.gold[0]);
  return s.outline();
}

export function suspiciousLuckyDice(): Sprite {
  const s = new Sprite(32, 32);
  const sixes = [
    [2, 1],
    [7, 1],
    [2, 4],
    [7, 4],
    [2, 7],
    [7, 7],
  ];
  const die = (x: number, y: number) => {
    s.rect(x, y, 11, 11, R.white[2]);
    s.hline(x, y, 11, R.white[3]);
    s.vline(x, y, 11, R.white[3]);
    poly(
      s,
      [
        [x, y],
        [x + 3, y - 3],
        [x + 14, y - 3],
        [x + 11, y],
      ],
      R.white[3],
    );
    poly(
      s,
      [
        [x + 11, y],
        [x + 14, y - 3],
        [x + 14, y + 8],
        [x + 11, y + 11],
      ],
      R.white[1],
    );
    for (const [px, py] of sixes) s.rect(x + px, y + py, 2, 2, R.black[1]);
  };
  die(15, 11);
  die(2, 17);
  s.rect(13, 24, 2, 2, R.steel[1]);
  s.set(13, 24, R.steel[3]);
  return s.outline();
}

function coinTone(lx: number, ly: number): string {
  if (ly === 0) return R.gold[3];
  if (ly === 2 || lx === 3) return R.gold[1];
  return R.gold[2];
}

export function arcadeTokenJar(): Sprite {
  const s = new Sprite(32, 32);
  const body = (x: number, y: number) =>
    x >= 4 && x <= 27 && y >= 9 && y <= 28 && !((x < 6 || x > 25) && (y < 11 || y > 26));
  const neck = (x: number, y: number) => x >= 8 && x <= 23 && y >= 6 && y < 9;
  shape(s, (x, y) => body(x, y) || neck(x, y), R.steel, { band: 1 });
  for (let y = 10; y < 28; y++)
    for (let x = 6; x < 26; x++) {
      if (!body(x, y) || !body(x - 1, y - 1) || !body(x + 1, y + 1)) continue;
      const row = Math.floor((y - 10) / 3);
      s.set(x, y, coinTone((x - 6 - (row % 2) * 2) % 4, (y - 10) % 3));
    }
  box(s, 7, 3, 18, 4, R.red, { band: 1 });
  s.vline(7, 11, 10, R.steel[3]);
  s.vline(8, 11, 6, R.steel[3]);
  return s.outline();
}

export const CAR: Readonly<Record<string, () => Sprite>> = {
  'Beaded Car Seat Cover': beadedCarSeatCover,
  'Fuzzy Dice': fuzzyDice,
  'Spinning Hubcap': spinningHubcap,
  'Chrome Bumper Piece': chromeBumperPiece,
  'Toolbox with Stuck Drawer': toolboxWithStuckDrawer,
  'Subway Token Roll': subwayTokenRoll,
  'Suspicious Lucky Dice': suspiciousLuckyDice,
  'Arcade Token Jar': arcadeTokenJar,
};
