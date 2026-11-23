// The three rooms, composed from the sprite builders. Each room bakes a back layer and a
// front layer. The front layer is drawn over the staff, so a counter or a table rail hides
// them from the waist down. Anchors tell the live actors where they stand.
import type { Ramp } from '../street/pix';
import { INK, R, Sprite, bayer, box, cylH, disc, measure, mix, text } from '../street/pix';
import * as FL from './floor';
import * as SP from './sprites';
import { colorOf } from './wheel-math';

export const W = 480,
  H = 200;

type Pt = [number, number];
interface Spot {
  x: number;
  y: number;
}
export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface NeonDef {
  sign: ReturnType<typeof SP.neon>;
  x: number;
  y: number;
  flick: number;
}
export interface RingDef {
  pts: Pt[];
  mode: 'chase2' | 'chase3';
  speed: number;
}
export interface SlotDef {
  x: number;
  y: number;
  ramp: Ramp;
  label: string;
  seed: number;
  player?: boolean;
}

const toCanvas = (s: Sprite) => s.canvas();
const paint = (c: HTMLCanvasElement, img: CanvasImageSource, x: number, y: number) =>
  c.getContext('2d')!.drawImage(img, x, y);
function shell(s: Sprite, wallBottom: number, floorTop: number) {
  const bulbs = SP.ceiling(s, W);
  SP.wallpaper(s, 0, 11, W, wallBottom - 11);
  SP.wainscot(s, 0, wallBottom, W, floorTop - wallBottom);
  SP.carpet(s, 0, floorTop, W, H - floorTop);
  return bulbs;
}
function signRing(s: Sprite, x: number, y: number, w: number, h: number, step: number): Pt[] {
  const pts = SP.ring(x, y, w, h, step);
  for (const [px, py] of pts) SP.bulbOff(s, px, py);
  box(s, x - 2, y - 2, w + 5, 2, R.gold, { band: 1 });
  return pts.map(([px, py]) => [px + 1, py + 1]);
}
function palm(s: Sprite, x: number, baseY: number) {
  box(s, x + 4, baseY - 12, 16, 12, R.gold, { band: 1 });
  s.hline(x + 4, baseY - 12, 16, R.gold[3]);
  s.rect(x + 11, baseY - 36, 3, 24, R.wood[1]);
  s.vline(x + 11, baseY - 36, 24, R.wood[2]);
  for (let j = baseY - 34; j < baseY - 12; j += 3) s.hline(x + 11, j, 3, R.wood[0]);
  const leaf = (x0: number, y0: number, x1: number, y1: number, bend: number) => {
    for (let k = 0; k <= 16; k++) {
      const u = k / 16,
        px = x0 + (x1 - x0) * u,
        py = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * bend;
      s.set(Math.round(px), Math.round(py), u < 0.5 ? R.green[2] : R.green[3]);
      s.set(Math.round(px), Math.round(py) + 1, R.green[1]);
      if (k % 3 === 1) s.set(Math.round(px), Math.round(py) + 2, R.green[2]);
    }
  };
  const top: Pt = [x + 12, baseY - 37];
  leaf(...top, x - 2, baseY - 30, -6);
  leaf(...top, x + 26, baseY - 30, -6);
  leaf(...top, x + 2, baseY - 44, -2);
  leaf(...top, x + 22, baseY - 44, -2);
  leaf(...top, x + 12, baseY - 50, 0);
  s.outline();
}
function rack(s: Sprite, x: number, y: number, colors: Ramp[], heights: number[]) {
  colors.forEach((ramp, i) => {
    const n = heights[i % heights.length];
    for (let k = 0; k < n; k++) {
      const cy = y - (k + 1) * 3;
      s.hline(x + i * 11, cy, 9, k === n - 1 ? ramp[3] : ramp[2]);
      s.hline(x + i * 11, cy + 1, 9, ramp[2]);
      s.set(x + i * 11 + 2, cy + 1, R.white[2]);
      s.set(x + i * 11 + 6, cy + 1, R.white[2]);
      s.hline(x + i * 11, cy + 2, 9, ramp[1]);
    }
  });
}

// ======================================================= the cage
export function cage() {
  const s = new Sprite(W, H);
  const ceiling = shell(s, 118, 152);
  palm(s, 120, 154);
  // booth
  box(s, 146, 12, 188, 142, R.wood, { band: 2 });
  s.rect(152, 16, 176, 28, '#1a1220');
  s.rect(152, 46, 176, 16, '#0c0810');
  s.hline(152, 46, 176, R.gold[1]);
  s.hline(152, 61, 176, R.gold[0]);
  s.rect(152, 64, 176, 48, '#211a2b');
  for (let j = 64; j < 112; j++)
    for (let i = 152; i < 328; i++) if ((i + j) % 9 === 0) s.set(i, j, '#2a2135');
  box(s, 156, 92, 168, 3, R.wood, { band: 1 });
  rack(
    s,
    160,
    92,
    [
      R.purple,
      R.black,
      R.sign,
      R.red,
      R.paper,
      R.purple,
      R.black,
      R.sign,
      R.red,
      R.paper,
      R.purple,
      R.black,
      R.sign,
      R.red,
      R.paper,
    ],
    [6, 4, 7, 5, 3, 6, 5],
  );
  box(s, 156, 74, 40, 3, R.wood, { band: 1 });
  s.rect(160, 66, 12, 8, R.paper[2]);
  s.rect(174, 68, 10, 6, R.green[2]);
  s.hline(174, 70, 10, R.green[3]);
  s.rect(290, 66, 26, 26, R.steel[1]);
  box(s, 290, 66, 26, 26, R.steel, { band: 1 });
  disc(s, 303, 79, 5, R.steel[3]);
  disc(s, 303, 79, 3, R.steel[1]);
  s.rect(302, 72, 2, 3, R.white[2]);
  const fascia = signRing(s, 150, 15, 180, 30, 6);
  const back = toCanvas(s);
  const cashier = SP.neon('CASHIER', 'jersey', SP.AMBER, '#fff3c4');
  const cx0 = Math.round(240 - cashier.w / 2);
  paint(back, cashier.off, cx0, 17);
  // bar back and its neon
  const bs = new Sprite(W, H);
  const shelves = FL.barBack(bs, 352, 50, 122, 66, 11);
  paint(back, toCanvas(bs), 0, 0);
  const cocktails = SP.neon('COCKTAILS', 'jersey', SP.NEON, '#ffe0f4');
  const ckx = Math.round(413 - cocktails.w / 2);
  paint(back, cocktails.off, ckx, 15);
  const slots = SP.neon('SLOTS', 'jersey', SP.CYAN, '#e6fdff');
  const slx = Math.round(60 - slots.w / 2);
  const ss = new Sprite(W, H);
  const slotRing = signRing(ss, slx - 2, 26, slots.w + 4, slots.h + 2, 5);
  paint(back, toCanvas(ss), 0, 0);
  paint(back, slots.off, slx, 27);

  // front: bars, counter, base of the booth, the bar counter, then the ledge separately
  const f = new Sprite(W, H);
  for (let x = 156; x < 326; x += 9) {
    if (x > 222 && x < 256) continue;
    f.vline(x, 64, 48, R.gold[2]);
    f.vline(x + 1, 64, 48, R.gold[1]);
    f.set(x, 64, R.gold[3]);
  }
  f.rect(152, 64, 176, 2, R.gold[2]);
  for (const [x0, x1] of [
    [152, 224],
    [256, 328],
  ])
    f.rect(x0, 86, x1 - x0, 2, R.gold[1]);
  for (let i = 0; i <= 34; i++) {
    const a = Math.PI * (i / 34),
      px = Math.round(240 - Math.cos(a) * 17),
      py = Math.round(80 - Math.sin(a) * 12);
    f.set(px, py, R.gold[2]);
    f.set(px, py + 1, R.gold[1]);
  }
  f.vline(222, 80, 32, R.gold[2]);
  f.vline(223, 80, 32, R.gold[1]);
  f.vline(257, 80, 32, R.gold[2]);
  f.vline(258, 80, 32, R.gold[1]);
  box(f, 146, 112, 188, 8, R.grey, { band: 1 });
  f.hline(146, 112, 188, R.white[2]);
  f.rect(224, 114, 32, 4, INK);
  f.hline(224, 117, 32, R.black[2]);
  box(f, 146, 120, 188, 34, R.wood, { band: 2 });
  for (let x = 152; x + 40 <= 330; x += 44) {
    f.rect(x, 125, 40, 24, '#4f3624');
    f.hline(x, 125, 40, R.wood[0]);
    f.vline(x, 125, 24, R.wood[0]);
    f.hline(x, 148, 40, R.wood[2]);
  }
  box(f, 208, 128, 64, 14, R.gold, { band: 1 });
  const pw = measure('CHIPS 1 = $1', 'tiny');
  text(f, 'CHIPS 1 = $1', 240 - Math.floor(pw / 2), 131, INK, 'tiny', { alignTop: true });
  f.rect(160, 128, 32, 18, R.paper[2]);
  f.hline(160, 128, 32, R.paper[3]);
  f.hline(160, 145, 32, R.paper[0]);
  text(f, 'NO', 170, 130, INK, 'tiny', { alignTop: true });
  text(f, 'IOUs', 165, 137, R.red[2], 'tiny', { alignTop: true });
  FL.counter(f, 338, 120, 142, 36);
  const front = toCanvas(f);
  paint(front, FL.tap, 352, 102);
  paint(front, FL.martini, 434, 113);
  paint(front, FL.beer, 452, 113);

  const l = new Sprite(W, H);
  box(l, 0, 178, W, 22, R.wood, { band: 2, flatTop: true });
  l.rect(0, 178, W, 2, R.wood[3]);
  for (let x = 0; x < W; x += 60) l.vline(x, 181, 19, R.wood[1]);
  const ledge = toCanvas(l);

  return {
    back,
    front,
    ledge,
    neon: [
      { sign: cashier, x: cx0, y: 17, flick: 0.02 },
      { sign: cocktails, x: ckx, y: 15, flick: 0.05 },
      { sign: slots, x: slx, y: 27, flick: 0.03 },
    ],
    rings: [
      { pts: ceiling, mode: 'chase3', speed: 6 },
      { pts: fascia, mode: 'chase2', speed: 5 },
      { pts: slotRing, mode: 'chase3', speed: 9 },
    ] as RingDef[],
    slots: [
      { x: 2, y: 82, ramp: R.red, label: '777', seed: 3 },
      { x: 42, y: 82, ramp: R.purple, label: 'BAR', seed: 7, player: true },
      { x: 82, y: 82, ramp: R.denim, label: 'WIN', seed: 13, player: true },
    ],
    teller: { x: 220, y: 66 },
    bartender: { x: 393, y: 70 },
    shelves,
    ledLeft: { x: 160, y: 47 },
    ledRight: { x: 252, y: 47 },
    tray: { x: 240, y: 115 },
    stacks: { x: 20, y: 192 },
    stools: [
      { x: 51, y: 150 },
      { x: 91, y: 150 },
      { x: 370, y: 150 },
      { x: 447, y: 150 },
    ],
    sparkles: [
      [157, 70],
      [194, 100],
      [288, 66],
      [331, 112],
      [13, 105],
      [52, 105],
      [92, 105],
      [360, 104],
      [400, 60],
      [440, 60],
      [222, 82],
      [240, 129],
    ] as Pt[],
  };
}

// ======================================================= roulette
export function feltBoard() {
  const w = 250,
    h = 70,
    s = new Sprite(w, h);
  s.rect(0, 0, w, h, SP.FELT[1]);
  const zones: Record<string, Zone> = {};
  const frame = (x: number, y: number, zw: number, zh: number) => {
    s.hline(x, y, zw, R.gold[1]);
    s.hline(x, y + zh - 1, zw, R.gold[1]);
    s.vline(x, y, zh, R.gold[1]);
    s.vline(x + zw - 1, y, zh, R.gold[1]);
  };
  const label = (str: string, x: number, y: number, zw: number, zh: number, col: string) => {
    const tw = measure(str, 'tiny');
    text(s, str, x + Math.floor((zw - tw) / 2), y + Math.floor((zh - 7) / 2), col, 'tiny', {
      alignTop: true,
    });
  };
  // zero
  s.rect(1, 1, 14, 42, '#24603f');
  frame(0, 0, 16, 44);
  label('0', 0, 0, 16, 44, R.white[3]);
  zones['n0'] = { x: 0, y: 0, w: 16, h: 44 };
  for (let c = 0; c < 12; c++)
    for (let r = 0; r < 3; r++) {
      const n = 3 * c + (3 - r),
        x = 15 + c * 18,
        y = r * 14 + (r ? 1 : 0);
      const red = colorOf(n) === 'red';
      s.rect(x + 1, y + 1, 17, 13, red ? R.red[2] : R.black[1]);
      s.hline(x + 1, y + 1, 17, red ? R.red[3] : R.black[2]);
      frame(x, y, 19, 15);
      label(String(n), x, y, 19, 15, R.white[3]);
      zones['n' + n] = { x, y, w: 19, h: 15 };
    }
  for (let r = 0; r < 3; r++) {
    const y = r * 14 + (r ? 1 : 0);
    frame(231, y, 19, 15);
    label('2:1', 231, y, 19, 15, R.paper[3]);
    zones['col' + (3 - r)] = { x: 231, y, w: 19, h: 15 };
  }
  ['1ST 12', '2ND 12', '3RD 12'].forEach((str, i) => {
    const x = 15 + i * 72;
    frame(x, 44, 73, 13);
    label(str, x, 44, 73, 13, R.paper[3]);
    zones['dozen' + (i + 1)] = { x, y: 44, w: 73, h: 13 };
  });
  const even = [
    ['low', '1-18'],
    ['even', 'EVEN'],
    ['red', ''],
    ['black', ''],
    ['odd', 'ODD'],
    ['high', '19-36'],
  ];
  even.forEach(([key, str], i) => {
    const x = 15 + i * 36;
    frame(x, 56, 37, 14);
    if (str) label(str, x, 56, 37, 14, R.paper[3]);
    else {
      const col = key === 'red' ? R.red[2] : R.black[0],
        hi = key === 'red' ? R.red[3] : R.black[2];
      for (let j = -4; j <= 4; j++)
        for (let i2 = -8; i2 <= 8; i2++)
          if (Math.abs(i2) / 8 + Math.abs(j) / 4 <= 1)
            s.set(x + 18 + i2, 63 + j, j < 0 && i2 < 0 ? hi : col);
    }
    zones[key] = { x, y: 56, w: 37, h: 14 };
  });
  return { img: toCanvas(s), zones, w, h };
}
function chandelier(s: Sprite, cx: number): Pt[] {
  s.vline(cx, 10, 6, R.gold[1]);
  box(s, cx - 14, 16, 28, 3, R.gold, { band: 1 });
  box(s, cx - 8, 19, 16, 3, R.gold, { band: 1 });
  for (let k = -12; k <= 12; k += 4) {
    s.vline(cx + k, 19, 3 + (Math.abs(k) < 8 ? 4 : 1), R.white[2]);
    s.set(cx + k, 22 + (Math.abs(k) < 8 ? 4 : 1), R.white[3]);
  }
  for (let k = -6; k <= 6; k += 4) {
    s.vline(cx + k, 22, 6, R.white[1]);
    s.set(cx + k, 28, R.white[3]);
  }
  return [
    [cx - 12, 23],
    [cx - 4, 27],
    [cx + 4, 27],
    [cx + 12, 23],
    [cx, 17],
  ];
}
export function roulette() {
  const s = new Sprite(W, H);
  const ceiling = shell(s, 78, 96);
  const drops = chandelier(s, 86);
  for (let y = 30; y < 100; y++) {
    const k = (y - 30) / 70,
      half = 6 + 44 * k;
    for (let x = Math.round(86 - half); x <= Math.round(86 + half); x++) {
      const c = s.get(x, y);
      if (c && bayer(x, y) < 0.2 * (1 - k * 0.4)) s.set(x, y, mix(c, '#fff3c4', 0.2));
    }
  }
  box(s, 436, 14, 38, 80, R.black, { band: 1 });
  s.rect(440, 26, 30, 64, '#0c0810');
  text(s, 'LAST', 446, 17, SP.AMBER[3], 'tiny', { alignTop: true });
  const sign = SP.neon(
    'ROULETTE',
    'jersey',
    ['#3a0b12', '#7a1420', '#d02a3a', '#ff6b6b'],
    '#ffe4e4',
  );
  const sx = Math.round(252 - sign.w / 2);
  const ring = signRing(s, sx - 3, 13, sign.w + 6, sign.h + 4, 6);
  const back = toCanvas(s);
  paint(back, sign.off, sx, 15);

  const f = new Sprite(W, H);
  box(f, 8, 94, 464, 8, R.wood, { band: 1 });
  f.hline(8, 94, 464, R.wood[3]);
  f.rect(12, 102, 456, 82, SP.FELT[1]);
  for (let y = 102; y < 184; y++)
    for (let x = 12; x < 468; x++) {
      const v = Math.abs(x - 240) / 228 + (Math.abs(y - 143) / 41) * 0.4;
      if (v > 0.9 && bayer(x, y) < (v - 0.9) * 2) f.set(x, y, SP.FELT[0]);
      else if (v < 0.5 && bayer(x, y) < 0.12) f.set(x, y, SP.FELT[2]);
    }
  disc(f, 86, 143, 43, '#0c1c13');
  cylH(f, 4, 184, 472, 10, ['#2a0c14', '#4a1622', '#6e2230', '#8e3a44']);
  f.hline(4, 184, 472, '#a45058');
  const board = feltBoard();
  const front = toCanvas(f);
  paint(front, board.img, 180, 108);
  return {
    back,
    front,
    board,
    boardAt: { x: 180, y: 108 },
    neon: [{ sign, x: sx, y: 15, flick: 0.03 }],
    rings: [
      { pts: ceiling, mode: 'chase3', speed: 6 },
      { pts: ring, mode: 'chase2', speed: 6 },
    ] as RingDef[],
    drops,
    wheel: { x: 86, y: 143 },
    tote: { x: 440, y: 26 },
    slots: [
      { x: 314, y: 26, ramp: R.red, label: 'HOT', seed: 21 },
      { x: 352, y: 26, ramp: R.sign, label: '$$$', seed: 29 },
    ],
    croupier: { x: 110, y: 46 },
    woman: { x: 18, y: 44 },
    man: { x: 388, y: 42 },
    rail: { x: 440, y: 190 },
    stacks: { x: 392, y: 190 },
  };
}

// ======================================================= blackjack
function bumperTone(k: number) {
  if (k > -0.012) return '#2a0c14';
  if (k > -0.03) return '#4a1622';
  return '#6e2230';
}
export function blackjack() {
  const s = new Sprite(W, H);
  const ceiling = shell(s, 80, 98);
  FL.barBack(s, 14, 46, 92, 46, 5);
  const barSign = SP.neon('BAR', 'jersey', SP.CYAN, '#e6fdff');
  const bsx = Math.round(60 - barSign.w / 2);
  const sign = SP.neon('BLACKJACK', 'jersey', SP.AMBER, '#fff3c4');
  const sx = Math.round(240 - sign.w / 2);
  const ring = signRing(s, sx - 3, 11, sign.w + 6, sign.h + 3, 6);
  const back = toCanvas(s);
  paint(back, barSign.off, bsx, 16);
  paint(back, sign.off, sx, 13);

  const f = new Sprite(W, H);
  const cx = 240,
    cy = 100,
    a = 212,
    b = 118;
  const inE = (x: number, y: number, da: number) =>
    y >= cy && ((x + 0.5 - cx) / (a + da)) ** 2 + ((y + 0.5 - cy) / (b + da)) ** 2 <= 1;
  for (let y = cy; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (inE(x, y, 0)) {
        const v = ((x + 0.5 - cx) / a) ** 2 + ((y + 0.5 - cy) / b) ** 2;
        let c = SP.FELT[1];
        if (v > 0.8 && bayer(x, y) < (v - 0.8) * 2.2) c = SP.FELT[0];
        else if (v < 0.35 && bayer(x, y) < 0.14) c = SP.FELT[2];
        f.set(x, y, c);
      } else if (inE(x, y, 8)) {
        const v = Math.sqrt(((x + 0.5 - cx) / (a + 8)) ** 2 + ((y + 0.5 - cy) / (b + 8)) ** 2);
        f.set(x, y, bumperTone(v - 1));
      }
    }
  box(f, 24, 94, 432, 7, R.wood, { band: 1 });
  f.hline(24, 94, 432, R.wood[3]);
  f.hline(24, 100, 432, R.gold[1]);
  // chip tray
  f.rect(212, 102, 56, 12, INK);
  f.rect(213, 103, 54, 10, '#0c0810');
  [R.purple, R.black, R.sign, R.red, R.paper, R.purple, R.black, R.sign, R.red].forEach(
    (ramp, i) => {
      for (let j = 0; j < 9; j++) f.hline(214 + i * 6, 104 + j, 5, j % 2 ? ramp[2] : ramp[3]);
    },
  );
  // shoe within the dealer's reach, mouth facing the table centre
  box(f, 276, 101, 28, 20, R.black, { band: 1 });
  f.rect(279, 104, 21, 12, R.red[1]);
  f.hline(279, 104, 21, R.red[2]);
  f.rect(272, 107, 6, 9, R.red[2]);
  f.vline(272, 107, 9, R.white[3]);
  // discard holder with a few backs
  box(f, 176, 102, 30, 16, R.black, { band: 1 });
  for (let k = 0; k < 4; k++) f.hline(180, 106 + k * 2, 22, k % 2 ? R.red[1] : R.white[2]);
  const t1 = 'DEALER STANDS ON 17',
    t2 = 'BLACKJACK PAYS 3 TO 2';
  text(f, t1, 108 - Math.floor(measure(t1, 'tiny') / 2), 128, SP.FELT[3], 'tiny', {
    alignTop: true,
  });
  text(f, t2, 384 - Math.floor(measure(t2, 'tiny') / 2), 128, R.gold[2], 'tiny', {
    alignTop: true,
  });
  const circle: Spot = { x: 194, y: 180 };
  for (let k = 0; k < 96; k++) {
    const px = Math.round(circle.x + Math.cos((k / 96) * Math.PI * 2) * 16),
      py = Math.round(circle.y + Math.sin((k / 96) * Math.PI * 2) * 9);
    if (f.get(px, py) && f.get(px, py) !== R.paper[1]) f.set(px, py, R.paper[1]);
  }
  f.outline({ selective: false, skip: new Set([SP.FELT[0], SP.FELT[1], SP.FELT[2]]) });
  const front = toCanvas(f);
  const pl = new Sprite(64, 13);
  pl.rect(0, 0, 64, 13, R.wood[1]);
  pl.rect(1, 1, 62, 11, INK);
  text(pl, '5 - 2,000', 32 - Math.floor(measure('5 - 2,000', 'tiny') / 2), 3, R.gold[3], 'tiny', {
    alignTop: true,
  });
  paint(front, toCanvas(pl), 318, 103);
  return {
    back,
    front,
    neon: [
      { sign, x: sx, y: 13, flick: 0.02 },
      { sign: barSign, x: bsx, y: 16, flick: 0.06 },
    ],
    rings: [
      { pts: ceiling, mode: 'chase3', speed: 6 },
      { pts: ring, mode: 'chase2', speed: 5 },
    ] as RingDef[],
    slots: [
      { x: 330, y: 24, ramp: R.purple, label: '777', seed: 41 },
      { x: 368, y: 24, ramp: R.red, label: 'WIN', seed: 43 },
    ],
    dealer: { x: 220, y: 44 },
    boss: { x: 436, y: 40 },
    shoe: { x: 271, y: 111 },
    discard: { x: 191, y: 110 },
    railY: 94,
    tray: { x: 240, y: 106 },
    circle,
    dealerRow: { cx: 240, y: 133 },
    playerRow: { cx: 272, y: 178 },
    ledChips: { x: 6, y: 183 },
    ledClock: { x: 404, y: 183 },
    sparkles: [
      [218, 104],
      [262, 104],
      [290, 104],
      [30, 56],
      [70, 56],
      [100, 76],
      [140, 96],
      [340, 96],
    ] as Pt[],
  };
}
