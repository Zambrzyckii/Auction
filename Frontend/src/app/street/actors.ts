// Things that move on the street: passers-by, cars, pigeons, speech bubbles.
import type { Col, Ramp } from './pix';
import { R, INK, Sprite, shape, box, sphere, cylV, disc, text, measure, mix, bayer } from './pix';

interface PersonSpec {
  skin: Ramp;
  top: Ramp;
  bottom: Ramp;
  pose: 'walk' | 'idle' | 'gesture' | 'push' | 'carry' | 'case' | 'bag' | 'cane';
  hair: 'short' | 'long' | 'cap' | 'beanie' | 'bald';
  hairRamp?: Ramp;
  capRamp?: Ramp;
  shoes?: Ramp;
  stripe?: string;
}

const STRIDE = [
  [3, -3],
  [0, 0],
  [-3, 3],
  [0, 0],
];

function leg(s: Sprite, x0: number, y0: number, x1: number, y1: number, col: Col) {
  s.line(x0, y0, x1, y1, col);
  s.line(x0 + 1, y0, x1 + 1, y1, col);
}
function arm(s: Sprite, x0: number, y0: number, x1: number, y1: number, sleeve: Col, hand: Col) {
  s.line(x0, y0, x1, y1, sleeve);
  s.line(x0 + 1, y0, x1 + 1, y1, sleeve);
  s.set(x1, y1 + 1, hand);
  s.set(x1 + 1, y1 + 1, hand);
}

function hair(s: Sprite, o: PersonSpec, hx: number, hy: number) {
  const h = o.hairRamp || R.hair,
    cap = o.capRamp!;
  switch (o.hair) {
    case 'cap':
      s.hline(hx, hy, 6, cap[3]);
      s.hline(hx, hy + 1, 6, cap[2]);
      s.hline(hx + 4, hy + 2, 4, cap[1]);
      s.set(hx, hy + 2, h[2]);
      s.set(hx, hy + 3, h[1]);
      return;
    case 'beanie':
      s.hline(hx + 1, hy - 1, 4, cap[3]);
      s.hline(hx, hy, 6, cap[2]);
      s.hline(hx, hy + 1, 6, cap[1]);
      s.set(hx + 2, hy - 2, cap[3]);
      return;
    case 'long':
      s.hline(hx, hy, 6, h[3]);
      s.hline(hx, hy + 1, 5, h[2]);
      for (let j = 1; j < 10; j++) {
        s.set(hx, hy + j, h[j > 6 ? 1 : 2]);
        s.set(hx - 1, hy + j + 1, h[1]);
      }
      s.set(hx + 1, hy + 2, h[2]);
      return;
    case 'bald':
      s.set(hx, hy + 3, h[2]);
      s.set(hx, hy + 4, h[1]);
      return;
    default:
      s.hline(hx, hy, 6, h[3]);
      s.hline(hx, hy + 1, 5, h[2]);
      s.vline(hx, hy + 1, 4, h[1]);
      s.set(hx + 1, hy + 2, h[2]);
  }
}

// A passer-by facing right. pose: walk | idle | gesture | push | carry | case | bag | cane
function person(o: PersonSpec, frame = 0) {
  const s = new Sprite(20, 28),
    X = 3,
    Y = 1;
  const walking = o.pose !== 'idle' && o.pose !== 'gesture';
  const st = walking ? STRIDE[frame % 4] : [1, -1];
  const bob = walking && frame % 2 === 1 ? -1 : 0;
  const hx = X + 4,
    hip = X + 6,
    top = o.top,
    bot = o.bottom,
    skin = o.skin;
  const shoe = o.shoes || R.black;
  leg(s, hip - 1, Y + 16 + bob, hip - 1 + st[1], Y + 23, bot[1]);
  s.hline(hip - 1 + st[1], Y + 24, 3, shoe[2]);
  s.hline(hip - 1 + st[1], Y + 25, 4, shoe[1]);
  const handBack = walking ? [hip + Math.sign(st[1]) * 3, Y + 16 + bob] : [hip - 2, Y + 16];
  if (o.pose === 'carry') arm(s, hip - 1, Y + 10 + bob, hip - 4, Y + 6 + bob, top[1], skin[1]);
  else if (o.pose !== 'push')
    arm(s, hip - 1, Y + 10 + bob, handBack[0], handBack[1], top[1], skin[1]);
  shape(
    s,
    (i, j) =>
      i >= hip - 3 &&
      i <= hip + 2 &&
      j >= Y + 9 + bob &&
      j <= Y + 16 + bob &&
      !(j === Y + 9 + bob && (i === hip - 3 || i === hip + 2)),
    top,
    { x0: hip - 4, y0: Y + 8, x1: hip + 4, y1: Y + 18 },
  );
  if (o.stripe) s.hline(hip - 3, Y + 12 + bob, 6, o.stripe);
  leg(s, hip, Y + 16 + bob, hip + st[0], Y + 23, bot[2]);
  s.set(hip, Y + 17 + bob, bot[3]);
  s.hline(hip + st[0], Y + 24, 3, shoe[3]);
  s.hline(hip + st[0], Y + 25, 4, shoe[2]);
  s.rect(hip - 1, Y + 8 + bob, 2, 1, skin[1]);
  shape(
    s,
    (i, j) =>
      i >= hx &&
      i < hx + 6 &&
      j >= Y + 1 + bob &&
      j < Y + 8 + bob &&
      !((i === hx || i === hx + 5) && (j === Y + 1 + bob || j === Y + 7 + bob)),
    skin,
    { x0: hx - 1, y0: Y, x1: hx + 7, y1: Y + 9 },
  );
  s.set(hx + 6, Y + 5 + bob, skin[2]);
  s.set(hx + 4, Y + 4 + bob, INK);
  s.set(hx + 2, Y + 4 + bob, skin[1]);
  hair(s, o, hx, Y + 1 + bob);
  let hand: [number, number];
  switch (o.pose) {
    case 'push':
      hand = [hip + 6, Y + 13 + bob];
      arm(s, hip, Y + 10 + bob, hand[0], hand[1], top[2], skin[2]);
      break;
    case 'gesture':
      hand = [hip + 4, Y + 10 + (frame % 2 ? -2 : 1)];
      arm(s, hip, Y + 10, hand[0], hand[1], top[2], skin[2]);
      break;
    case 'idle':
      hand = [hip + 1, Y + 16];
      arm(s, hip, Y + 10, hand[0], hand[1], top[2], skin[2]);
      break;
    default:
      hand = [hip - Math.sign(st[0]) * 3, Y + 16 + bob];
      arm(s, hip, Y + 10 + bob, hand[0], hand[1], top[2], skin[2]);
  }
  switch (o.pose) {
    case 'carry':
      box(s, hip - 10, Y + 2 + bob, 7, 5, R.black);
      s.set(hip - 9, Y + 4 + bob, R.grey[3]);
      s.set(hip - 5, Y + 4 + bob, R.grey[3]);
      s.hline(hip - 8, Y + 1 + bob, 3, R.grey[1]);
      break;
    case 'case':
      box(s, hand[0] - 2, hand[1] + 1, 6, 4, R.wood);
      s.hline(hand[0] - 1, hand[1] + 1, 4, R.gold[2]);
      break;
    case 'bag':
      box(s, hand[0] - 1, hand[1] - 1, 5, 6, R.paper);
      s.set(hand[0], hand[1] - 2, R.green[3]);
      s.set(hand[0] + 2, hand[1] - 2, R.red[3]);
      break;
    case 'cane':
      s.line(hand[0] + 1, hand[1] + 1, hand[0] + 2, Y + 25, R.wood[1]);
      break;
    default:
      break;
  }
  s.outline();
  return s;
}

function cart() {
  const s = new Sprite(19, 16);
  for (let j = 3; j < 11; j++)
    for (let i = 1 + Math.floor((j - 3) / 3); i < 17; i++)
      if ((i + j) % 2 === 0 || j === 3 || j === 10 || i === 16)
        s.set(i, j, j === 3 ? R.grey[3] : R.grey[2]);
  box(s, 3, 0, 6, 5, R.paper);
  s.hline(4, 2, 4, R.paper[1]);
  disc(s, 12.5, 2.5, 2.5, R.black[1]);
  disc(s, 12.5, 2.5, 1, R.black[3]);
  s.vline(15, -1, 4, R.grey[3]);
  s.rect(14, -1, 3, 1, R.lit[2]);
  s.hline(3, 11, 13, R.grey[1]);
  disc(s, 4, 13, 1.5, R.black[2]);
  disc(s, 14, 13, 1.5, R.black[2]);
  s.vline(17, 3, 7, R.grey[3]);
  return s.outline();
}

type CarKind = 'taxi' | 'wagon' | 'sedan' | 'van';
interface CarSpec {
  w: number;
  ramp: Ramp;
  cab: number[][] | null;
  pillars: number[];
}
const CARS: Record<CarKind, CarSpec> = {
  taxi: {
    w: 46,
    ramp: R.taxi,
    cab: [
      [11, 35],
      [15, 30],
    ],
    pillars: [23],
  },
  wagon: {
    w: 50,
    ramp: R.red,
    cab: [
      [6, 42],
      [8, 40],
    ],
    pillars: [19, 31],
  },
  sedan: {
    w: 42,
    ramp: R.denim,
    cab: [
      [10, 31],
      [14, 27],
    ],
    pillars: [20],
  },
  van: { w: 48, ramp: R.white, cab: null, pillars: [] },
};

function wheel(s: Sprite, cx: number, cy: number, f: number, missing: boolean) {
  disc(s, cx, cy, 3.6, R.black[1]);
  for (let i = -2; i <= 1; i++) s.set(Math.floor(cx) + i, Math.floor(cy) - 3, R.black[3]);
  if (missing) {
    disc(s, cx, cy, 1.4, R.black[0]);
    return;
  }
  disc(s, cx, cy, 1.8, R.grey[2]);
  s.set(Math.floor(cx) - 1, Math.floor(cy) - 1, R.grey[3]);
  const sp = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ][f % 4];
  s.set(Math.floor(cx) + sp[0], Math.floor(cy) + sp[1], R.grey[0]);
}

function plank(i: number, row: number) {
  if (row === 9) return R.wood[3];
  if (i % 9 === 0) return R.wood[1];
  return R.wood[2];
}

// A car facing right. f is the wheel frame.
function car(kind: CarKind, f = 0, left = false) {
  const c = CARS[kind],
    W = c.w,
    OY = 3,
    s = new Sprite(W + 2, OY + 19),
    X = 1,
    rp = c.ramp;
  const w0 = X + 9,
    w1 = X + W - 11,
    wy = OY + 14;
  if (kind === 'van') {
    const body = (i: number, j: number) =>
      j >= OY &&
      j <= OY + 13 &&
      i >= X + 1 &&
      i <= X + W - 2 &&
      !(j < OY + 7 && i > X + W - 2 - (OY + 7 - j)) &&
      !(j === OY && i === X + 1);
    shape(s, body, rp, { x0: X, y0: OY - 1, x1: X + W, y1: OY + 15, band: 2 });
    for (let j = OY + 1; j < OY + 7; j++) {
      const e = X + W - 3 - (OY + 7 - j);
      s.hline(e - 6, j, 6, j === OY + 1 ? R.glass[3] : R.glass[1]);
      s.set(e - 2, j, R.glass[2]);
    }
    s.vline(X + W - 12, OY + 1, 12, rp[1]);
    for (let i = X + 6; i < X + 30; i += 5)
      for (let j = OY + 10; j < OY + 13; j++) if (bayer(i, j) < 0.5) s.set(i, j, R.rust[2]);
  } else {
    const [[b0, b1], [t0, t1]] = c.cab!;
    const cab = (i: number, j: number) => {
      if (j < OY + 2 || j > OY + 7) return false;
      const t = (j - OY - 2) / 5;
      return i >= X + Math.round(t0 + (b0 - t0) * t) && i <= X + Math.round(t1 + (b1 - t1) * t);
    };
    const body = (i: number, j: number) =>
      j >= OY + 7 &&
      j <= OY + 13 &&
      i >= X + 1 &&
      i <= X + W - 2 &&
      !(j === OY + 7 && (i < X + 4 || i > X + W - 5)) &&
      !(j === OY + 8 && (i === X + 1 || i === X + W - 2));
    shape(s, (i, j) => cab(i, j) || body(i, j), rp, {
      x0: X,
      y0: OY,
      x1: X + W,
      y1: OY + 15,
      band: 2,
    });
    for (let j = OY + 3; j <= OY + 7; j++)
      for (let i = X; i < X + W; i++)
        if (cab(i, j) && cab(i - 1, j) && cab(i + 1, j) && j < OY + 7)
          s.set(i, j, j === OY + 3 ? R.glass[3] : R.glass[1]);
    for (const p of c.pillars) s.vline(X + p, OY + 3, 4, rp[1]);
    for (let j = OY + 4; j < OY + 7; j++) s.set(X + c.pillars[0] - 3 - (j - OY - 4), j, R.glass[2]);
    s.hline(X + 4, OY + 9, W - 8, rp[1]);
    for (const p of c.pillars) s.vline(X + p, OY + 8, 5, rp[1]);
    if (kind === 'taxi') {
      for (let i = X + 4; i < X + W - 4; i++) {
        s.set(i, OY + 10, Math.floor(i / 2) % 2 ? INK : R.white[3]);
        s.set(i, OY + 11, Math.floor(i / 2) % 2 ? R.white[3] : INK);
      }
      box(s, X + 20, OY, 6, 2, R.white);
      s.hline(X + 21, OY, 4, R.taxi[3]);
    }
    if (kind === 'wagon') {
      for (let j = OY + 9; j <= OY + 12; j++)
        for (let i = X + 5; i < X + W - 6; i++) s.set(i, j, plank(i, j - OY));
      s.rect(X + 20, OY + 7, 10, 2, R.concrete[2]);
      s.rect(X + 20, OY + 9, 10, 4, R.concrete[1]);
      s.hline(X + 9, OY + 1, 32, R.black[2]);
      for (const i of [X + 11, X + 25, X + 38]) s.vline(i, OY + 1, 2, R.black[2]);
      for (let i = X + 12; i < X + 36; i++) {
        s.set(i, OY - 2, i % 4 < 2 ? R.white[3] : R.denim[3]);
        s.set(i, OY - 1, i % 4 < 2 ? R.white[2] : R.denim[2]);
        s.set(i, OY, R.white[1]);
      }
      s.set(X + 32, OY + 11, R.rust[2]);
      s.set(X + 33, OY + 11, R.rust[1]);
    }
    if (kind === 'sedan') {
      s.set(X + 26, OY + 10, rp[1]);
      s.set(X + 27, OY + 11, rp[1]);
      s.set(X + 26, OY + 11, rp[3]);
    }
  }
  for (const wx of [w0, w1])
    for (let j = OY + 9; j <= OY + 13; j++)
      for (let i = wx - 5; i <= wx + 5; i++) {
        const d = Math.hypot(i + 0.5 - wx, j + 0.5 - wy);
        if (d < 5 && d >= 3.6 && j < wy) s.set(i, j, R.black[0]);
      }
  wheel(s, w0, wy, f, false);
  wheel(s, w1, wy, f + 1, kind === 'sedan');
  box(s, X, OY + 11, 4, 2, R.grey);
  box(s, X + W - 4, OY + 11, 4, 2, R.grey);
  s.rect(X + W - 2, OY + 8, 1, 2, '#fff4c8');
  s.rect(X, OY + 8, 1, 2, R.red[3]);
  s.outline();
  const out = left ? s.flipX() : s;
  if (kind === 'van') {
    const label = 'JUNK HAUL',
      x0 = X + 2,
      span = measure(label, 'micro') - 1;
    text(out, label, left ? W + 2 - x0 - span : x0, OY + 3, R.red[1], 'micro', { alignTop: true });
  }
  return out;
}

// A soft wedge of light, drawn translucent by the scene. Only its far end is dithered.
function beam(len = 24) {
  const s = new Sprite(len, 12);
  for (let i = 0; i < len; i++) {
    const y0 = Math.round(4 - i * 0.04),
      y1 = Math.round(5 + i * 0.22),
      far = i / len;
    for (let j = y0; j <= y1; j++)
      if (far < 0.55 || bayer(i, j) < (1 - far) / 0.45) s.set(i, j, '#fff1c4');
  }
  return s;
}

// Hand-placed pixels: a small round head on a neck, a plump body, a short raised tail.
const PIGEON = [
  [
    '.......LL...',
    '......LMML..',
    '......MMEMB.',
    '.......GP...',
    '...DMMMMMM..',
    'DDMLLLDDMMM.',
    '.DMMMDDMMMK.',
    '...KMMMMMK..',
    '....F..F....',
  ],
  [
    '............',
    '............',
    '...DMMMMM...',
    'DDMLLLDDMMG.',
    '.DMMMDDMMMPL',
    '...KMMMMMKME',
    '.........MB.',
    '....F..F....',
    '............',
  ],
];
const PIGEON_COL: Record<string, string> = {
  L: R.grey[3],
  M: R.grey[2],
  D: R.grey[1],
  K: R.grey[0],
  E: INK,
  B: '#d9b38c',
  G: '#6fa58f',
  P: '#8a6aa8',
  F: '#c4665e',
};
function pigeon(f: number) {
  const rows = PIGEON[f],
    s = new Sprite(rows[0].length + 2, rows.length + 2);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (PIGEON_COL[ch]) s.set(x + 1, y + 1, PIGEON_COL[ch]);
    }),
  );
  return s.outline({ selective: false });
}

// tailAt is the x offset inside the bubble where its tail points down to the speaker.
const TAIL = [
  [-1, 3],
  [0, 2],
  [0, 1],
];
function bubble(lines: string[], tailAt = 4) {
  const tw = Math.max(...lines.map((l) => measure(l))),
    w = tw + 7,
    h = lines.length * 7 + 4,
    s = new Sprite(w + 2, h + 5),
    X = 1,
    Y = 1;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (!((i === 0 || i === w - 1) && (j === 0 || j === h - 1)))
        s.set(X + i, Y + j, j === h - 1 ? R.white[2] : R.white[3]);
  const tx = X + Math.max(3, Math.min(w - 4, tailAt));
  TAIL.forEach(([dx, len], k) => s.hline(tx + dx, Y + h + k, len, R.white[2]));
  lines.forEach((l, k) => text(s, l, X + 4, Y + 2 + k * 7, INK, 'tiny', { alignTop: true }));
  s.outline({ selective: false });
  return s;
}

export type { PersonSpec, CarKind };
export { person, cart, car, beam, pigeon, bubble, CARS };
