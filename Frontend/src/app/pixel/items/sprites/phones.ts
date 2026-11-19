import { R, Sprite, box, cylH, disc, shape } from '../../street/pix';
import { bezier, digits, ell } from './helpers';

export function chippedPager(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(8, 25, 16, 5, R.black[1]);
  s.hline(8, 25, 16, R.black[3]);
  const chipped = (i: number, j: number) =>
    (j === 8 && i >= 27) || (j === 9 && i === 29) || (j === 26 && i <= 3) || (j === 25 && i === 2);
  shape(s, (i, j) => i >= 2 && i <= 29 && j >= 8 && j <= 26 && !chipped(i, j), R.denim, {
    band: 1,
  });
  s.rect(5, 11, 22, 10, R.black[0]);
  s.rect(6, 12, 20, 8, R.taxi[3]);
  s.hline(6, 19, 20, R.taxi[2]);
  digits(s, '5550', 8, 13, R.taxi[0]);
  s.rect(25, 13, 1, 3, R.taxi[0]);
  for (const x of [6, 12, 18]) {
    s.rect(x, 22, 4, 3, R.black[1]);
    s.hline(x, 22, 4, R.black[3]);
  }
  s.rect(25, 23, 2, 2, R.red[2]);
  s.line(23, 21, 28, 24, R.denim[0]);
  s.line(10, 8, 11, 9, R.denim[0]);
  s.set(5, 25, R.denim[0]);
  return s.outline();
}

export function pocketTv(): Sprite {
  const s = new Sprite(32, 32);
  s.line(11, 11, 6, 3, R.black[1]);
  s.line(17, 11, 23, 3, R.black[1]);
  s.set(6, 2, R.black[3]);
  s.set(23, 2, R.black[3]);
  shape(
    s,
    (i, j) =>
      i >= 3 && i <= 28 && j >= 11 && j <= 28 && !((i === 3 || i === 28) && (j === 11 || j === 28)),
    R.concrete,
    { band: 1 },
  );
  s.rect(5, 13, 16, 12, R.black[0]);
  s.rect(6, 14, 14, 10, R.glass[2]);
  s.line(7, 15, 12, 15, R.glass[3]);
  s.line(7, 16, 9, 16, R.glass[3]);
  s.hline(6, 20, 14, R.glass[3]);
  s.hline(9, 22, 8, R.glass[3]);
  for (const cy of [16, 21]) {
    disc(s, 24, cy, 2, R.black[1]);
    s.set(23, cy - 1, R.grey[3]);
  }
  for (const y of [24, 26]) s.hline(22, y, 5, R.concrete[0]);
  return s.outline();
}

export function payphoneHandset(): Sprite {
  const s = new Sprite(32, 32);
  const ear = ell(7, 9, 5, 5.5);
  const mouth = ell(24, 9, 5, 5.5);
  shape(
    s,
    (i, j) => ear(i, j) || mouth(i, j) || (i >= 10 && i <= 21 && j >= 6 && j <= 11),
    R.black,
    {
      band: 1,
    },
  );
  s.hline(11, 7, 10, R.black[3]);
  for (const [x, y] of [
    [6, 7],
    [8, 7],
    [5, 9],
    [7, 9],
    [9, 9],
    [6, 11],
    [8, 11],
    [23, 7],
    [25, 7],
    [22, 9],
    [24, 9],
    [26, 9],
    [23, 11],
    [25, 11],
  ])
    s.set(x, y, R.steel[1]);
  for (let y = 13; y <= 24; y += 3) {
    s.line(17, y + 2, 26, y, R.steel[2]);
    s.line(17, y + 3, 26, y + 1, R.steel[1]);
    s.set(17, y + 2, R.steel[3]);
    s.set(18, y + 1, R.steel[3]);
  }
  box(s, 18, 26, 8, 4, R.steel);
  return s.outline();
}

export function cordedBrickPhone(): Sprite {
  const s = new Sprite(32, 32);
  s.vline(7, 2, 5, R.black[1]);
  s.set(7, 2, R.black[3]);
  shape(
    s,
    (i, j) =>
      i >= 4 && i <= 17 && j >= 6 && j <= 29 && !((i === 4 || i === 17) && (j === 6 || j === 29)),
    R.black,
    { band: 1 },
  );
  s.rect(6, 8, 10, 5, R.black[0]);
  s.rect(7, 9, 8, 3, R.sign[3]);
  s.hline(7, 11, 8, R.sign[2]);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 3; c++) {
      s.rect(6 + c * 4, 15 + r * 3, 3, 2, R.grey[1]);
      s.set(6 + c * 4, 15 + r * 3, R.grey[3]);
    }
  const cord = bezier([17, 26], [24, 31], [31, 25], [27, 17], 30);
  cord.forEach(([x, y], i) => {
    s.set(x, y, R.black[i % 2 ? 3 : 1]);
    s.set(x + 1, y, R.black[i % 2 ? 1 : 3]);
  });
  s.rect(25, 13, 4, 4, R.black[1]);
  s.hline(25, 13, 4, R.black[3]);
  return s.outline();
}

export function blinkingAnsweringMachine(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (i, j) => (i >= 2 && i <= 29 && j >= 13 && j <= 28) || (i >= 5 && i <= 26 && j >= 9 && j <= 12),
    R.concrete,
    { band: 1 },
  );
  for (const y of [10, 11]) s.hline(7, y, 8, R.concrete[0]);
  s.rect(4, 15, 12, 8, R.black[0]);
  s.rect(5, 16, 10, 6, R.grey[1]);
  s.rect(6, 16, 8, 2, R.paper[2]);
  for (const cx of [8, 12]) disc(s, cx, 20, 1.4, R.black[0]);
  for (const [x, y] of [
    [24, 13],
    [24, 14],
    [24, 23],
    [24, 24],
    [18, 18],
    [19, 18],
    [29, 18],
    [28, 18],
    [20, 14],
    [28, 14],
    [20, 22],
    [28, 22],
  ])
    s.set(x, y, R.red[3]);
  disc(s, 24, 18, 3, R.red[2]);
  s.set(23, 17, R.red[3]);
  s.set(22, 17, R.red[3]);
  for (let x = 5; x < 26; x += 5) {
    s.rect(x, 25, 4, 3, R.black[1]);
    s.hline(x, 25, 4, R.concrete[3]);
  }
  return s.outline();
}

export function transparentLandline(): Sprite {
  const s = new Sprite(32, 32);
  const clear = [R.steel[1], R.steel[2], R.steel[3], R.steel[3]];
  shape(
    s,
    (i, j) =>
      (i >= 2 && i <= 9 && j >= 3 && j <= 10) ||
      (i >= 22 && i <= 29 && j >= 3 && j <= 10) ||
      (i >= 8 && i <= 23 && j >= 5 && j <= 8),
    clear,
    { band: 1 },
  );
  s.hline(10, 6, 12, R.red[2]);
  s.rect(4, 5, 4, 3, R.black[0]);
  s.rect(24, 5, 4, 3, R.black[0]);
  shape(s, (i, j) => (i === 6 || i === 25) && j >= 11 && j <= 14, clear, {});
  shape(
    s,
    (i, j) =>
      i >= 2 && i <= 29 && j >= 14 && j <= 29 && !((i === 2 || i === 29) && (j === 14 || j === 29)),
    clear,
    { band: 1 },
  );
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) s.rect(5 + c * 3, 17 + r * 3, 2, 2, R.paper[3]);
  s.rect(16, 16, 11, 6, R.green[2]);
  s.rect(17, 17, 3, 2, R.black[0]);
  s.rect(22, 17, 3, 2, R.black[0]);
  s.rect(17, 20, 3, 1, R.black[0]);
  for (const cx of [19, 25]) {
    disc(s, cx, 26, 2.4, R.gold[2]);
    s.set(cx - 1, 25, R.gold[3]);
  }
  s.hline(5, 27, 9, R.red[2]);
  s.line(4, 15, 6, 15, R.white[2]);
  return s.outline();
}

export function chromeBeeperClip(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(21, 3, 4, 25, R.white[1]);
  s.vline(21, 3, 25, R.white[2]);
  s.rect(15, 28, 10, 2, R.white[1]);
  s.hline(15, 28, 10, R.white[2]);
  shape(
    s,
    (i, j) =>
      i >= 7 && i <= 21 && j >= 5 && j <= 27 && !((i === 7 || i === 21) && (j === 5 || j === 27)),
    R.grey,
    { band: 1 },
  );
  s.vline(9, 7, 19, R.grey[3]);
  s.vline(10, 7, 12, R.grey[3]);
  s.rect(9, 8, 11, 8, R.black[0]);
  s.rect(10, 9, 9, 6, R.sign[3]);
  digits(s, '12', 11, 9, R.sign[0]);
  s.rect(11, 17, 2, 1, R.red[2]);
  for (const x of [9, 13, 17]) {
    s.rect(x, 19, 3, 2, R.black[0]);
    s.hline(x, 19, 3, R.grey[3]);
  }
  for (const y of [23, 25]) s.hline(10, y, 7, R.black[0]);
  return s.outline();
}

export function dialUpModem(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (i, j) =>
      (i >= 3 && i <= 28 && j >= 15 && j <= 28) || (i >= 5 && i <= 26 && j >= 11 && j <= 14),
    R.concrete,
    { band: 1 },
  );
  for (const y of [12, 13]) s.hline(14, y, 10, R.concrete[0]);
  s.rect(4, 17, 24, 4, R.black[0]);
  const leds = [
    R.sign[3],
    R.sign[3],
    R.red[2],
    R.sign[3],
    R.gold[2],
    R.sign[3],
    R.red[2],
    R.sign[3],
  ];
  leds.forEach((col, k) => s.rect(5 + k * 3, 18, 2, 2, col));
  s.rect(4, 23, 8, 3, R.concrete[1]);
  disc(s, 24, 25, 2, R.black[1]);
  s.set(23, 24, R.concrete[3]);
  bezier([8, 11], [8, 4], [3, 4], [3, 12], 14).forEach(([x, y], i) => {
    s.set(x, y, R.black[i % 2 ? 3 : 1]);
    s.set(x + 1, y, R.black[i % 2 ? 1 : 3]);
  });
  s.rect(2, 11, 3, 4, R.black[1]);
  s.hline(2, 11, 3, R.black[3]);
  bezier([25, 11], [25, 3], [30, 3], [28, 12], 14).forEach(([x, y], i) => {
    s.set(x, y, R.black[i % 2 ? 3 : 1]);
    s.set(x - 1, y, R.black[i % 2 ? 1 : 3]);
  });
  s.rect(26, 12, 3, 4, R.black[1]);
  s.hline(26, 12, 3, R.black[3]);
  return s.outline();
}

export function dustyCamcorder(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 14, 5, 9, 6, R.black, { band: 1 });
  s.rect(24, 6, 3, 4, R.steel[1]);
  shape(
    s,
    (i, j) => i >= 12 && i <= 29 && j >= 11 && j <= 26 && !(i === 29 && (j === 11 || j === 26)),
    R.black,
    {
      band: 1,
    },
  );
  cylH(s, 3, 14, 10, 11, R.steel);
  s.rect(2, 15, 2, 9, R.black[0]);
  s.set(2, 16, R.steel[3]);
  box(s, 14, 13, 13, 9, R.steel, { band: 1 });
  s.rect(16, 15, 9, 3, R.black[0]);
  s.hline(16, 20, 9, R.steel[1]);
  s.rect(14, 23, 3, 2, R.red[2]);
  box(s, 17, 27, 7, 2, R.steel);
  for (const [x, y] of [
    [16, 12],
    [20, 11],
    [25, 12],
    [27, 13],
    [14, 6],
  ])
    s.set(x, y, R.grey[3]);
  s.dither(4, 21, 5, 3, R.steel[2], R.grey[3], 4);
  s.line(4, 15, 8, 17, R.grey[3]);
  return s.outline();
}

export const PHONES: Readonly<Record<string, () => Sprite>> = {
  'Chipped Pager': chippedPager,
  'Pocket TV': pocketTv,
  'Payphone Handset': payphoneHandset,
  'Corded Brick Phone': cordedBrickPhone,
  'Blinking Answering Machine': blinkingAnsweringMachine,
  'Transparent Landline': transparentLandline,
  'Chrome Beeper Clip': chromeBeeperClip,
  'Dial-Up Modem': dialUpModem,
  'Dusty Camcorder': dustyCamcorder,
};
