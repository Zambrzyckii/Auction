import { R, Sprite, box, disc, shape, sphere, text } from '../../street/pix';
import { bezier, lightTone, poly } from './helpers';

export function scratchedTapePlayer(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (i, j) =>
      i >= 3 && i <= 28 && j >= 6 && j <= 28 && !((i === 3 || i === 28) && (j === 6 || j === 28)),
    R.steel,
    { band: 1 },
  );
  s.rect(6, 9, 20, 11, R.black[0]);
  s.rect(7, 10, 18, 9, R.grey[1]);
  for (const cx of [11, 20]) {
    disc(s, cx, 14, 3.4, R.paper[2]);
    disc(s, cx, 14, 1.4, R.black[0]);
    s.set(cx - 2, 12, R.steel[3]);
  }
  s.hline(14, 17, 3, R.black[0]);
  for (let i = 5; i < 15; i += 2)
    for (let j = 22; j < 27; j += 2) s.set(i + (j % 4 ? 1 : 0), j, R.steel[0]);
  for (const x of [17, 21]) {
    s.rect(x, 22, 3, 5, R.steel[1]);
    s.hline(x, 22, 3, R.steel[3]);
  }
  s.rect(25, 22, 2, 5, R.red[2]);
  s.line(5, 24, 9, 28, R.steel[3]);
  s.line(10, 12, 15, 17, R.paper[2]);
  s.line(22, 10, 25, 13, R.paper[2]);
  s.line(18, 9, 21, 7, R.steel[3]);
  return s.outline();
}

export function boomboxMissingAKnob(): Sprite {
  const s = new Sprite(32, 32);
  for (const [x, y, w, h] of [
    [8, 3, 16, 2],
    [7, 4, 2, 6],
    [23, 4, 2, 6],
  ])
    box(s, x, y, w, h, R.black);
  shape(
    s,
    (i, j) =>
      i >= 2 && i <= 29 && j >= 9 && j <= 28 && !((i === 2 || i === 29) && (j === 9 || j === 28)),
    R.red,
    { band: 1 },
  );
  for (const cx of [8, 23]) {
    disc(s, cx, 20, 5.4, R.black[0]);
    disc(s, cx, 20, 4.2, R.grey[1]);
    disc(s, cx, 20, 1.8, R.black[0]);
    s.set(cx - 2, 18, R.grey[3]);
    s.set(cx - 3, 19, R.grey[2]);
  }
  box(s, 13, 11, 6, 6, R.black);
  s.rect(14, 12, 4, 4, R.grey[1]);
  s.hline(14, 12, 4, R.grey[2]);
  s.rect(14, 19, 4, 3, R.black[0]);
  s.rect(15, 20, 2, 1, R.grey[2]);
  sphere(s, 6, 11, 1.6, R.grey);
  sphere(s, 9, 11, 1.6, R.grey);
  s.rect(21, 10, 3, 3, R.black[0]);
  s.set(22, 11, R.grey[3]);
  s.line(3, 26, 6, 23, R.red[3]);
  s.hline(25, 26, 3, R.red[0]);
  return s.outline();
}

export function staticCbRadio(): Sprite {
  const s = new Sprite(32, 32);
  s.vline(5, 1, 8, R.black[1]);
  s.vline(4, 1, 8, R.black[3]);
  shape(
    s,
    (i, j) =>
      i >= 2 && i <= 21 && j >= 9 && j <= 28 && !((i === 2 || i === 21) && (j === 9 || j === 28)),
    R.olive,
    { band: 1 },
  );
  s.rect(4, 11, 14, 8, R.black[0]);
  s.dither(5, 12, 12, 6, R.black[0], R.grey[3], 7);
  s.hline(5, 15, 12, R.grey[1]);
  for (const cx of [7, 15]) {
    disc(s, cx, 23, 2.6, R.grey[1]);
    s.set(cx - 1, 22, R.grey[3]);
  }
  s.rect(10, 22, 2, 2, R.red[2]);
  s.rect(23, 4, 6, 12, R.black[1]);
  s.vline(23, 4, 12, R.black[3]);
  for (let j = 6; j < 12; j += 2) s.hline(24, j, 4, R.black[0]);
  s.rect(24, 13, 4, 1, R.red[2]);
  const coil = bezier([25, 16], [24, 24], [14, 30], [21, 25], 26);
  coil.forEach(([x, y], i) => s.set(x, y, R.black[i % 2 ? 3 : 1]));
  return s.outline();
}

// Draws a cassette seen face-on and tilted by `a` radians around its centre.
function tape(s: Sprite, cx: number, cy: number, a: number, body: string): void {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const local = (x: number, y: number): [number, number] => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    return [dx * cos + dy * sin, -dx * sin + dy * cos];
  };
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const [u, v] = local(x, y);
      if (Math.abs(u) > 7 || Math.abs(v) > 6) continue;
      if (Math.abs(u) <= 5.5 && v >= -4.5 && v <= -1) s.set(x, y, R.paper[3]);
      else if (Math.abs(u) <= 5.5 && v > -1 && v <= 4.5) s.set(x, y, R.black[0]);
      else s.set(x, y, body);
    }
  for (const du of [-2.5, 2.5]) {
    const x = cx + du * cos - 1.5 * sin;
    const y = cy + du * sin + 1.5 * cos;
    disc(s, Math.floor(x), Math.floor(y), 1.5, R.paper[2]);
  }
}

export function crateOfMixtapes(): Sprite {
  const s = new Sprite(32, 32);
  tape(s, 10, 9, 0, R.black[1]);
  tape(s, 21, 9, 0.3, R.red[2]);
  box(s, 2, 14, 28, 15, R.wood, { band: 1 });
  s.hline(3, 18, 26, R.wood[1]);
  s.hline(3, 24, 26, R.wood[1]);
  s.rect(10, 20, 12, 3, R.paper[3]);
  s.hline(11, 21, 7, R.wood[0]);
  for (const [x, y] of [
    [4, 16],
    [27, 16],
    [4, 27],
    [27, 27],
  ])
    s.set(x, y, R.paper[3]);
  return s.outline();
}

export function overdubbedCassetteSingle(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (i, j) =>
      i >= 3 && i <= 28 && j >= 11 && j <= 28 && !((i === 3 || i === 28) && (j === 11 || j === 28)),
    R.black,
    { band: 1 },
  );
  s.rect(5, 12, 22, 10, R.paper[3]);
  s.hline(5, 12, 22, R.red[2]);
  s.hline(5, 13, 22, R.red[2]);
  s.rect(9, 15, 14, 6, R.black[0]);
  for (const cx of [12, 19]) {
    disc(s, cx, 18, 2, R.paper[2]);
    s.set(cx, 18, R.black[0]);
  }
  poly(
    s,
    [
      [13, 12],
      [26, 12],
      [26, 17],
      [20, 15],
    ],
    R.tan[2],
  );
  s.line(13, 12, 20, 15, R.paper[0]);
  s.line(7, 16, 12, 16, R.red[2]);
  s.line(6, 18, 9, 18, R.red[2]);
  s.hline(5, 21, 22, R.paper[0]);
  poly(
    s,
    [
      [6, 23],
      [25, 23],
      [27, 28],
      [4, 28],
    ],
    R.black[2],
  );
  s.hline(7, 23, 18, R.black[1]);
  for (const x of [9, 22]) s.rect(x, 25, 2, 2, R.black[0]);
  for (const x of [13, 16, 19]) s.set(x, 26, R.black[0]);
  return s.outline();
}

export function chewedCassetteDeck(): Sprite {
  const s = new Sprite(32, 32);
  const notch = (i: number, j: number) => j <= 9 && i >= 24 && (i + j) % 3 === 0;
  shape(
    s,
    (i, j) =>
      i >= 2 &&
      i <= 29 &&
      j >= 8 &&
      j <= 25 &&
      !notch(i, j) &&
      !((i === 2 || i === 29) && j === 25),
    R.grey,
    { band: 1 },
  );
  s.rect(5, 11, 14, 8, R.black[0]);
  s.rect(6, 12, 12, 6, R.grey[1]);
  for (const cx of [9, 15]) {
    disc(s, cx, 15, 1.9, R.grey[3]);
    s.set(cx, 15, R.black[0]);
  }
  s.rect(21, 11, 6, 2, R.black[0]);
  s.hline(22, 11, 3, R.sign[2]);
  s.hline(25, 11, 1, R.red[2]);
  s.rect(21, 14, 6, 2, R.black[0]);
  s.hline(22, 14, 2, R.sign[2]);
  for (const x of [21, 24]) {
    s.rect(x, 20, 3, 4, R.black[0]);
    s.hline(x, 20, 3, R.grey[1]);
  }
  const loop = (pts: [number, number][], col: string) =>
    pts.forEach(([x, y]) => {
      s.set(x, y, col);
      s.set(x + 1, y, col);
    });
  loop(bezier([11, 18], [4, 24], [14, 30], [20, 26], 22), R.tan[1]);
  loop(bezier([13, 18], [8, 27], [22, 30], [17, 27], 22), R.tan[2]);
  loop(bezier([20, 26], [24, 22], [16, 24], [18, 27], 12), R.tan[1]);
  s.hline(4, 9, 4, R.grey[0]);
  s.set(10, 22, R.grey[3]);
  return s.outline();
}

export function bootlegConcertTape(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 6, 3, 20, 26, R.glass, { band: 1 });
  s.rect(8, 5, 16, 11, R.paper[2]);
  s.dither(8, 5, 16, 11, R.paper[2], R.paper[1], 4);
  s.rect(8, 5, 16, 2, R.black[1]);
  for (const x of [10, 14, 18, 22]) s.rect(x, 12, 2, 4, R.black[1]);
  disc(s, 12, 10, 1.4, R.black[1]);
  disc(s, 20, 9, 1.4, R.black[1]);
  text(s, 'LIVE', 10, 11, R.red[2], 'micro');
  box(s, 8, 18, 16, 9, R.black, { band: 1 });
  s.rect(9, 19, 14, 4, R.paper[3]);
  s.line(10, 21, 14, 20, R.red[2]);
  s.line(14, 20, 19, 22, R.red[2]);
  for (const cx of [12, 19]) {
    disc(s, cx, 25, 1.6, R.paper[1]);
    s.set(cx, 25, R.black[0]);
  }
  s.line(24, 4, 24, 28, R.glass[3]);
  return s.outline();
}

export function oneSpeakerKaraokeMachine(): Sprite {
  const s = new Sprite(32, 32);
  bezier([17, 12], [12, 2], [5, 2], [4, 14], 24).forEach(([x, y], i) =>
    s.set(x, y, i % 2 ? R.black[0] : R.grey[1]),
  );
  s.line(23, 9, 18, 13, R.black[0]);
  s.line(24, 10, 19, 14, R.black[0]);
  disc(s, 25, 6, 3.6, R.grey[1]);
  for (let y = 2; y < 10; y++)
    for (let x = 21; x < 30; x++)
      if ((x + y) % 2 === 0 && s.get(x, y) === R.grey[1]) s.set(x, y, R.black[0]);
  s.set(23, 4, R.grey[3]);
  s.hline(23, 9, 4, R.grey[3]);
  shape(
    s,
    (i, j) =>
      i >= 2 && i <= 29 && j >= 12 && j <= 28 && !((i === 2 || i === 29) && (j === 12 || j === 28)),
    R.purple,
    { band: 1 },
  );
  disc(s, 10, 20, 6.4, R.black[0]);
  disc(s, 10, 20, 5.2, R.grey[1]);
  disc(s, 10, 20, 2.2, R.black[0]);
  s.set(7, 17, R.grey[3]);
  s.set(6, 18, R.grey[3]);
  s.rect(18, 14, 10, 7, R.black[0]);
  s.hline(19, 16, 7, R.green[3]);
  s.hline(19, 18, 5, R.green[3]);
  s.set(25, 19, R.red[2]);
  s.rect(21, 23, 5, 4, R.black[0]);
  s.set(23, 24, R.grey[1]);
  s.set(22, 25, R.grey[1]);
  s.set(24, 25, R.grey[1]);
  s.set(23, 26, R.grey[1]);
  s.rect(18, 24, 2, 2, R.red[2]);
  return s.outline();
}

export function miniDiscNobodyCanPlay(): Sprite {
  const s = new Sprite(32, 32);
  const rounded = (i: number, j: number) => {
    if (i < 4 || i > 27 || j < 5 || j > 28) return false;
    const dx = Math.max(8 - i, i - 23, 0);
    const dy = j - 24;
    return dy <= 0 || dx * dx + dy * dy <= 20;
  };
  shape(s, rounded, R.denim, { band: 1 });
  disc(s, 16, 13, 6.5, R.black[0]);
  for (let y = 6; y < 21; y++)
    for (let x = 9; x < 24; x++) {
      const dx = x + 0.5 - 16;
      const dy = y + 0.5 - 13;
      const d = Math.hypot(dx, dy);
      if (d <= 5.7 && d >= 1.6) s.set(x, y, R.steel[lightTone(dx, dy, d)]);
    }
  s.rect(10, 5, 13, 4, R.steel[2]);
  s.hline(10, 5, 13, R.steel[3]);
  s.hline(10, 8, 13, R.steel[1]);
  s.rect(7, 20, 18, 8, R.paper[3]);
  text(s, 'MD', 9, 26, R.denim[0], 'micro');
  text(s, '?', 20, 26, R.red[2], 'micro');
  s.line(5, 10, 5, 15, R.denim[3]);
  s.line(26, 20, 26, 22, R.denim[0]);
  return s.outline();
}

export const AUDIO: Readonly<Record<string, () => Sprite>> = {
  'Scratched Tape Player': scratchedTapePlayer,
  'Boombox Missing a Knob': boomboxMissingAKnob,
  'Static CB Radio': staticCbRadio,
  'Crate of Mixtapes': crateOfMixtapes,
  'Overdubbed Cassette Single': overdubbedCassetteSingle,
  'Chewed Cassette Deck': chewedCassetteDeck,
  'Bootleg Concert Tape': bootlegConcertTape,
  'One-Speaker Karaoke Machine': oneSpeakerKaraokeMachine,
  'Mini Disc Nobody Can Play': miniDiscNobodyCanPlay,
};
