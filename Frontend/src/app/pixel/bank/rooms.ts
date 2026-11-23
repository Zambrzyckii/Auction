// The CHECKS CASHED storefront at night as one side-view cross-section, 480x200 art px.
// Left the street and the facade, centre the loan window, right the wires window and the
// vault. The room bakes a back layer (everything behind the staff), a mid layer (desks and
// counter-top things behind the glass) and a front layer (bars, glass, counter), so the
// counter hides the staff from the waist down. Anchors tell the live actors where they stand.
import type { FontKey, Ramp } from '../street/pix';
import {
  INK,
  R,
  Sprite,
  bayer,
  box,
  disc,
  measure,
  mix,
  ri,
  shape,
  srand,
  text,
} from '../street/pix';
import { ell } from './people';
import * as SP from './sprites';

export const W = 480,
  H = 200;

type Pt = [number, number];
interface Spot {
  x: number;
  y: number;
}
export interface Layout {
  floorY: number;
  counterTop: number;
  counterBottom: number;
  fasciaTop: number;
  windowTop: number;
  facadeEnd: number;
  cutEnd: number;
  loan: Pt;
  wires: Pt;
  vault: Pt;
  board: { x: number; y: number; w: number; h: number };
  led: { x: number; y: number; w: number };
  tray: { x: number; y: number; w: number };
  opening: Pt;
  wiresOpening: Pt;
  shame: { x: number; y: number; w: number; h: number; slot: Pt };
  cage: { x: number; sill: number };
  desk: { x: number; y: number; w: number };
  tube: { x: number; top: number; bottom: number };
  teletype: Spot;
  spike: Spot;
  calc: Spot;
}
export interface Anchors {
  shark: Spot;
  brute: Spot;
  clerk: Spot;
  lackey: Spot;
  youQueue: number;
  youLoan: number;
  youWires: number;
  youCurb: number;
  queue: [number, number, number, number];
}
export interface Props {
  calc: HTMLCanvasElement;
  counter: HTMLCanvasElement;
  banker: HTMLCanvasElement;
  teletype: HTMLCanvasElement;
  basket: HTMLCanvasElement;
  tube: HTMLCanvasElement;
  tubeGlass: HTMLCanvasElement;
  tv: HTMLCanvasElement;
  beaconOff: HTMLCanvasElement;
  beaconOn: HTMLCanvasElement;
  flash: HTMLCanvasElement;
  lampOn: HTMLCanvasElement;
  desk: HTMLCanvasElement;
}
export interface BankArt extends Props {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  L: Layout;
  lampCone: HTMLCanvasElement;
  boxOff: HTMLCanvasElement;
  boxAt: Spot;
  anchors: Anchors;
}

const toCanvas = (s: Sprite) => s.canvas();

export const L: Layout = {
  floorY: 190,
  counterTop: 120,
  counterBottom: 164,
  fasciaTop: 10,
  windowTop: 58,
  facadeEnd: 144,
  cutEnd: 156,
  loan: [156, 318],
  wires: [318, 384],
  vault: [384, 480],
  board: { x: 158, y: 11, w: 158, h: 46 },
  led: { x: 252, y: 127, w: 54 },
  tray: { x: 228, y: 118, w: 26 },
  opening: [220, 264],
  wiresOpening: [334, 370],
  shame: { x: 164, y: 76, w: 42, h: 33, slot: [193, 93] },
  cage: { x: 386, sill: 158 },
  desk: { x: 404, y: 118, w: 54 },
  tube: { x: 322, top: 0, bottom: 106 },
  teletype: { x: 366, y: 104 },
  spike: { x: 386, y: 104 },
  calc: { x: 248, y: 108 },
};

export const anchors: Anchors = {
  shark: { x: 208, y: 64 },
  brute: { x: 258, y: 60 },
  clerk: { x: 330, y: 70 },
  lackey: { x: 410, y: 80 },
  youQueue: 128,
  youLoan: 214,
  youWires: 352,
  youCurb: 70,
  queue: [106, 84, 61, 38],
};

// Text drawn at twice the art scale, for big painted letters.
function bigText(
  s: Sprite,
  str: string,
  x: number,
  y: number,
  col: string,
  font: FontKey = 'micro',
  shadow?: string,
) {
  const t = new Sprite(measure(str, font) + 4, 16);
  text(t, str, 1, 1, col, font, { alignTop: true });
  t.each((i, j, c) => {
    if (!c) return;
    if (shadow) s.rect(x + i * 2 + 1, y + j * 2 + 1, 2, 2, shadow);
  });
  t.each((i, j, c) => {
    if (c) s.rect(x + i * 2, y + j * 2, 2, 2, col);
  });
}

// ----- the street and the facade -----
function street(s: Sprite) {
  // upper floors fading into the night
  for (let y = 0; y < 164; y++) for (let x = 0; x < L.facadeEnd; x++) s.set(x, y, '#1a1622');
  SP.brick(s, 0, 0, L.facadeEnd, 164, ['#24202c', '#34303d', '#45404e', '#57515f'], {
    grime: 0.12,
    seed: 4,
  });
  for (let y = 0; y < 164; y++)
    for (let x = 0; x < L.facadeEnd; x++) {
      const c = s.get(x, y)!;
      if (y > 120 && bayer(x, y) < (y - 120) / 140) s.set(x, y, mix(c, '#141018', 0.4));
    }
  // cornice
  box(s, 0, 3, L.facadeEnd, 4, R.steel, { band: 1 });
  // green neon loan panel, same three lines as the street building
  box(s, 22, 9, 100, 22, R.steel, { band: 1 });
  s.rect(24, 11, 96, 18, '#1a1622');
  for (let j = 11; j < 29; j += 2) s.hline(24, j, 96, '#221c2c');
  // taxi box with CHECKS CASHED in red, painted at twice the scale
  box(s, 12, 33, 120, 24, R.taxi, { band: 1 });
  s.hline(12, 33, 120, R.taxi[3]);
  const cw = measure('CHECKS CASHED', 'micro') * 2;
  bigText(s, 'CHECKS CASHED', 72 - Math.floor(cw / 2), 37, R.red[1], 'micro', R.taxi[1]);
  box(s, 12, 57, 120, 2, R.steel, { band: 1 });
  // display window with a security grille, posters taped inside
  box(s, 14, 66, 104, 92, R.steel, { band: 1 });
  s.rect(16, 68, 100, 88, '#100c16');
  SP.cone(s, 66, 68, 156, 30, 50, '#3a2a40', 0.5, 0.5);
  s.rect(22, 96, 18, 24, R.paper[2]);
  s.hline(22, 96, 18, R.paper[3]);
  for (let j = 100; j < 118; j += 3) s.hline(24, j, 13, R.paper[0]);
  s.rect(94, 104, 16, 20, '#e0c040');
  text(s, '$$$', 96, 110, R.red[2], 'tiny', { alignTop: true });
  for (let x = 18; x < 116; x += 6) s.vline(x, 68, 88, '#2c2836');
  for (let y = 72; y < 156; y += 10) s.hline(16, y, 100, '#24202c');
  const ban = new Sprite(104, 11);
  box(ban, 0, 0, 104, 11, R.white, { band: 1 });
  ban.hline(0, 0, 104, R.red[2]);
  ban.hline(0, 10, 104, R.red[2]);
  const bt = 'NO CREDIT? NO PROBLEM!';
  text(ban, bt, 52 - Math.floor(measure(bt) / 2), 2, R.red[1], 'tiny', { alignTop: true });
  ban.set(1, 2, R.grey[1]);
  ban.set(102, 2, R.grey[1]);
  // hung crooked: the right end sags by a pixel past the last zip tie
  ban.each((x, y, c) => {
    if (c) s.set(10 + x, 57 + y + (x > 70 ? 1 : 0), c);
  });
  // the door, propped open with a brick, warm light spilling out on the sidewalk
  box(s, 116, 60, 28, 104, R.steel, { band: 1 });
  s.rect(119, 63, 25, 101, '#2a2018');
  for (let y = 63; y < 164; y++)
    for (let x = 119; x < 144; x++)
      if (bayer(x, y) < 0.18 + (x - 119) * 0.012) s.set(x, y, '#4a3a26');
  shape(s, (i, j) => i >= 116 && i < 122 && j >= 62 + (i - 116) && j < 164 - (i - 116), R.steel, {
    band: 1,
  });
  s.rect(117, 80, 4, 30, R.glass[2]);
  s.vline(117, 80, 30, R.glass[3]);
  box(s, 112, 158, 8, 5, R.brick, { band: 1 });
  box(
    s,
    L.facadeEnd,
    0,
    L.cutEnd - L.facadeEnd,
    164,
    ['#2a2430', '#3e3646', '#564c5e', '#6e6276'],
    {
      band: 1,
    },
  );
  SP.brick(
    s,
    L.facadeEnd + 1,
    0,
    L.cutEnd - L.facadeEnd - 2,
    60,
    ['#3a2428', '#5a3434', '#7a4a42', '#9a6650'],
    { seed: 8 },
  );
  s.rect(L.facadeEnd, 60, L.cutEnd - L.facadeEnd, 104, '#120e18');
  box(s, L.facadeEnd - 2, 58, L.cutEnd - L.facadeEnd + 4, 3, R.steel, { band: 1 });
  // sidewalk, curb and gutter
  for (let y = 164; y < 192; y++)
    for (let x = 0; x < L.cutEnd; x++) {
      let c = (x + Math.floor((y - 164) * 0.3)) % 24 === 0 || y === 177 ? '#2a2632' : '#3a3644';
      if (bayer(x * 3, y * 5) < 0.06) c = '#4a4554';
      if (bayer(x, y) < 0.12 && y - 164 < 6) c = '#2e2a38';
      s.set(x, y, c);
    }
  s.hline(0, 164, L.cutEnd, '#18141e');
  for (let y = 164; y < 192; y++) {
    const half = 12 + (y - 164) * 0.5;
    for (let x = Math.round(132 - half); x < L.cutEnd; x++) {
      const c = s.get(x, y);
      if (c && bayer(x, y) < 0.3 - Math.abs(x - 136) / 80) s.set(x, y, mix(c, '#f2c66d', 0.25));
    }
  }
  s.rect(0, 192, L.cutEnd, 2, '#6a6476');
  s.hline(0, 192, L.cutEnd, '#8a8494');
  for (let y = 194; y < H; y++)
    for (let x = 0; x < L.cutEnd; x++) s.set(x, y, bayer(x, y) < 0.15 ? '#1e1a24' : '#16121c');
  for (const [px, pw] of [
    [12, 34],
    [98, 30],
  ])
    for (let y = 194; y < H; y++)
      for (let x = px; x < px + pw; x++) {
        const e = Math.abs(x + 0.5 - px - pw / 2) / (pw / 2) + Math.abs(y - 197) / 4;
        if (e < 1) s.set(x, y, e < 0.6 ? '#0c0a14' : '#120f1a');
      }
  // steam grate
  s.rect(74, 189, 24, 3, INK);
  for (let x = 75; x < 97; x += 2) s.vline(x, 189, 3, '#4a4554');
  s.hline(74, 188, 24, '#5a5466');
  // sodium lamp on a pole at the far left
  s.rect(1, 14, 3, 178, '#2a2430');
  s.vline(1, 14, 178, '#4a4254');
  s.hline(2, 14, 16, '#3a3446');
  s.hline(2, 15, 16, '#2a2430');
  shape(
    s,
    (i, j) =>
      j >= 12 &&
      j < 19 &&
      i >= 11 &&
      i < 32 &&
      (j < 15 || (i > 12 + (j - 15) && i < 31 - (j - 15) * 0.5)),
    R.grey,
    { band: 1 },
  );
}

// ----- the loan booth, the wires window and the vault -----
function interiorBack(s: Sprite) {
  // ceiling with a duct
  s.rect(L.cutEnd, 0, W - L.cutEnd, 10, '#0d0a12');
  s.hline(L.cutEnd, 9, W - L.cutEnd, '#2a2430');
  box(s, L.cutEnd, 2, W - L.cutEnd, 4, R.grey, { band: 1 });
  for (let x = L.cutEnd + 20; x < W; x += 40) s.rect(x, 1, 3, 6, R.grey[0]);
  // back wall behind the staff
  SP.grimeWall(s, L.cutEnd, 10, W - L.cutEnd, 154, R.bile, 11);
  // wall of shame corkboard
  const sh = L.shame;
  box(s, sh.x, sh.y, sh.w, sh.h, R.wood, { band: 1 });
  for (let y = sh.y + 2; y < sh.y + sh.h - 2; y++)
    for (let x = sh.x + 2; x < sh.x + sh.w - 2; x++)
      s.set(x, y, bayer(x, y) < 0.3 ? '#8a5a34' : '#a87446');
  const pol = [
    [sh.x + 3, sh.y + 3, -1],
    [sh.x + 15, sh.y + 2, 1],
    [sh.x + 28, sh.y + 4, 0],
    [sh.x + 5, sh.y + 18, 0],
    [sh.x + 17, sh.y + 19, -1],
  ];
  const faces = [R.skinA, R.skinC, R.skinB, R.skinC, R.skinA];
  pol.forEach(([x, y], i) => {
    s.rect(x, y, 10, 12, R.white[3]);
    s.rect(x + 1, y + 1, 8, 7, '#3a3446');
    disc(s, x + 5, y + 4, 2.4, faces[i][2]);
    s.rect(x + 2, y + 6, 6, 2, [R.red, R.green, R.purple, R.grey, R.denim][i][2]);
    s.set(x + 4, y - 1, R.red[2]);
    s.hline(x + 1, y + 9, 6, R.grey[1]);
  });
  const t1 = 'WALL OF',
    t2 = 'SHAME',
    mid = sh.x + sh.w / 2;
  s.rect(sh.x + 4, sh.y - 15, sh.w - 8, 15, R.paper[3]);
  s.hline(sh.x + 4, sh.y - 1, sh.w - 8, R.paper[1]);
  text(s, t1, Math.round(mid - measure(t1) / 2), sh.y - 13, R.red[1], 'tiny', { alignTop: true });
  text(s, t2, Math.round(mid - measure(t2) / 2), sh.y - 7, R.red[1], 'tiny', { alignTop: true });
  s.set(sh.x + 5, sh.y - 14, R.grey[2]);
  s.set(sh.x + sh.w - 6, sh.y - 14, R.grey[2]);
  // a rusty safe and a filing cabinet behind the enforcer
  box(s, 290, 90, 26, 30, R.steel, { band: 1 });
  box(s, 268, 96, 20, 24, R.grey, { band: 1 });
  vault(s);
}

// The vault room behind a floor-to-ceiling cage: the round door hangs open, shelves of cash
// bricks and gold bars inside, sacks of gold piled on the floor and coins spilled around.
const CASH = ['#1f3a22', '#2c5a34', '#468a4a', '#78b860'];
function sack(s: Sprite, x: number, y: number, r: number, tint?: Ramp) {
  const ramp = tint || ['#5a3a1a', '#8a6030', '#b88a48', '#dcb870'];
  shape(
    s,
    (i, j) =>
      (ell(x, y, r, r * 0.86)(i, j) && j > y - r * 0.7) ||
      (j <= y - r * 0.55 &&
        j > y - r * 1.25 &&
        Math.abs(i + 0.5 - x) < r * 0.32 + (y - r * 0.55 - j) * 0.35),
    ramp,
    { band: 1 },
  );
  s.hline(Math.round(x - r * 0.35), Math.round(y - r * 0.6), Math.round(r * 0.7) + 1, R.wood[0]);
  const tw = measure('$');
  text(s, '$', Math.round(x - tw / 2), Math.round(y - 2), R.gold[3], 'tiny', {
    alignTop: true,
    shadow: ramp[1],
  });
}
function goldBar(s: Sprite, x: number, y: number) {
  shape(
    s,
    (i, j) => j >= y && j < y + 5 && i >= x + (y + 4 - j) * 0.5 && i < x + 11 - (y + 4 - j) * 0.5,
    R.gold,
    { band: 1 },
  );
  s.hline(x + 2, y, 7, R.gold[3]);
}
function cashBrick(s: Sprite, x: number, y: number) {
  box(s, x, y, 9, 6, CASH, { band: 1 });
  s.vline(x + 4, y, 6, R.paper[3]);
  s.set(x + 4, y + 2, R.paper[1]);
}
function vault(s: Sprite) {
  const x0 = L.cage.x;
  // tiled floor of the vault room behind the cage
  for (let y = 120; y < L.cage.sill; y++)
    for (let x = x0; x < W; x++) s.set(x, y, ((x >> 3) + (y >> 2)) % 2 ? '#2a2632' : '#34303c');
  s.hline(x0, 120, W - x0, '#1a1620');
  // the vault opening with shelves, and a bare bulb inside
  shape(
    s,
    (i, j) =>
      i >= 402 &&
      i < 462 &&
      j >= 58 &&
      j < 120 &&
      ((i + 0.5 - 432) / 30) ** 2 + (Math.max(0, 84 - j) / 26) ** 2 <= 1,
    ['#0c0a12', '#14111c', '#1c1826', '#262032'],
  );
  for (let i = 0; i < 64; i++) {
    const a = Math.PI * (i / 63),
      px = Math.round(432 - Math.cos(a) * 31),
      py = Math.round(84 - Math.sin(a) * 27);
    s.set(px, py, R.steel[3]);
    s.set(px, py + 1, R.steel[1]);
  }
  SP.cone(s, 432, 62, 120, 4, 26, '#ffe9a8', 0.4, 0.22);
  s.rect(431, 58, 2, 4, R.grey[1]);
  s.rect(430, 62, 4, 3, '#ffe9a8');
  for (const sy of [78, 96]) {
    s.hline(406, sy, 52, R.steel[2]);
    s.hline(406, sy + 1, 52, R.steel[0]);
  }
  for (let x = 408; x < 454; x += 10) {
    cashBrick(s, x, 72);
    if (x % 20 === 8) cashBrick(s, x + 4, 66);
  }
  for (let x = 408; x < 452; x += 11) goldBar(s, x, 91);
  for (let x = 413; x < 446; x += 11) goldBar(s, x, 86);
  for (let x = 408; x < 456; x += 10) cashBrick(s, x, 113);
  for (let x = 412; x < 452; x += 10) cashBrick(s, x, 107);
  // the round door swung open against the right wall
  shape(s, (i, j) => ((i + 0.5 - 471) / 9) ** 2 + ((j + 0.5 - 88) / 30) ** 2 <= 1, R.steel, {
    band: 2,
  });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    s.line(471, 88, 471 + Math.cos(a) * 5, 88 + Math.sin(a) * 16, R.grey[3]);
  }
  disc(s, 471, 88, 2.4, R.gold[2]);
  box(s, 461, 60, 3, 58, R.steel, { band: 1 });
  // sacks piled on the floor on both sides, a gold bar pyramid and spilled coins
  sack(s, 396, 148, 10);
  sack(s, 392, 129, 8);
  sack(s, 401, 114, 6);
  sack(s, 470, 148, 10);
  sack(s, 475, 129, 7);
  srand(77);
  for (let k = 0; k < 26; k++) {
    const cx = x0 + 4 + ri(0, 88),
      cy = 152 + ri(0, 5);
    s.set(cx, cy, R.gold[3]);
    s.set(cx + 1, cy, R.gold[2]);
  }
}

function interiorFront(f: Sprite) {
  // fascia above the windows
  box(f, L.cutEnd, L.fasciaTop, W - L.cutEnd, L.windowTop - L.fasciaTop, R.wood, { band: 1 });
  for (let y = L.fasciaTop + 3; y < L.windowTop - 2; y += 4)
    f.hline(L.cutEnd + 2, y, W - L.cutEnd - 4, R.wood[1]);
  for (let x = L.cutEnd; x < W; x++) if (bayer(x, 40) < 0.2) f.set(x, L.windowTop - 2, R.wood[0]);
  // letter board
  const b = L.board;
  box(f, b.x, b.y, b.w, b.h, R.black, { band: 1 });
  f.rect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, '#141018');
  for (let y = b.y + 3; y < b.y + b.h - 2; y += 2) f.hline(b.x + 2, y, b.w - 4, '#1c1622');
  // bars and the window frames
  f.rect(L.cutEnd, L.windowTop, W - L.cutEnd, 2, R.steel[1]);
  f.hline(L.cutEnd, L.windowTop, W - L.cutEnd, R.steel[3]);
  const bars = (x0: number, x1: number, step: number, gap?: Pt) => {
    for (let x = x0; x < x1; x += step) {
      if (gap && x > gap[0] - 3 && x < gap[1]) continue;
      f.vline(x, L.windowTop + 2, L.counterTop - L.windowTop - 2, R.steel[3]);
      f.vline(x + 1, L.windowTop + 2, L.counterTop - L.windowTop - 2, R.steel[2]);
      f.vline(x + 2, L.windowTop + 2, L.counterTop - L.windowTop - 2, R.steel[0]);
    }
  };
  bars(L.loan[0] + 4, L.loan[1], 13, L.opening);
  bars(L.wires[0] + 4, L.cage.x - 2, 11, L.wiresOpening);
  for (const x of [L.loan[1] - 1, L.cage.x - 3]) {
    f.rect(x, L.windowTop, 4, L.counterTop - L.windowTop, R.wood[1]);
    f.vline(x, L.windowTop, L.counterTop - L.windowTop, R.wood[2]);
  }
  // the vault cage runs down to the floor, with a pass-through over the counting desk
  for (let x = L.cage.x + 2; x < W; x += 11) {
    const top = x > 412 && x < 444 ? L.desk.y : L.windowTop + 2;
    f.vline(x, top, L.cage.sill - top, R.steel[3]);
    f.vline(x + 1, top, L.cage.sill - top, R.steel[1]);
  }
  for (const y of [L.windowTop + 30, 124]) {
    f.hline(L.cage.x, y, W - L.cage.x, R.steel[3]);
    f.hline(L.cage.x, y + 1, W - L.cage.x, R.steel[1]);
  }
  f.rect(412, L.desk.y - 2, 33, 2, R.steel[2]);
  box(f, L.cage.x - 3, L.cage.sill, W - L.cage.x + 3, L.counterBottom - L.cage.sill, R.steel, {
    band: 1,
  });
  // glass streaks over the barred parts
  for (const [x0, len] of [
    [162, 30],
    [270, 26],
    [330, 16],
    [372, 8],
  ])
    for (let k = 0; k < len; k++) {
      const x = x0 + k,
        y = L.counterTop - 4 - k * 2;
      if (y > L.windowTop) {
        f.set(x, y, '#8db0b0');
        f.set(x + 1, y, '#5a7b8a');
      }
    }
  // speaker grille on the glass
  disc(f, 214, 90, 4, R.grey[1]);
  for (const [dx, dy] of [
    [-2, -1],
    [0, -2],
    [2, -1],
    [-2, 1],
    [0, 0],
    [2, 1],
    [0, 2],
  ])
    f.set(214 + dx, 90 + dy, INK);
  // counter top and a dark veneer front, scuffed
  const cw = L.cage.x - 3 - L.cutEnd,
    VENEER = ['#20140f', '#352219', '#4e3424', '#6a4a32'];
  f.rect(L.cutEnd, L.counterTop, cw, 4, R.grey[2]);
  f.hline(L.cutEnd, L.counterTop, cw, R.white[2]);
  f.hline(L.cutEnd, L.counterTop + 3, cw, R.grey[0]);
  box(f, L.cutEnd, L.counterTop + 4, cw, L.counterBottom - L.counterTop - 4, VENEER, { band: 1 });
  for (let x = L.cutEnd + 4; x < L.cutEnd + cw - 4; x++)
    for (let y = L.counterTop + 6; y < L.counterBottom - 6; y++) {
      if (x % 26 === 0) f.set(x, y, VENEER[0]);
      else if (bayer(x * 2, y * 3) < 0.06) f.set(x, y, VENEER[3]);
      else if (bayer(x, y) < 0.05) f.set(x, y, VENEER[1]);
    }
  f.rect(L.cutEnd, L.counterBottom - 5, cw, 5, R.black[1]);
  f.hline(L.cutEnd, L.counterBottom - 5, cw, R.black[2]);
  // FINE PRINT poster, with lines too small to read
  f.rect(178, 128, 22, 30, R.paper[3]);
  f.hline(178, 157, 22, R.paper[1]);
  f.set(178, 128, R.paper[1]);
  f.set(199, 157, R.paper[0]);
  text(f, 'FINE', 189 - Math.floor(measure('FINE') / 2), 130, INK, 'tiny', { alignTop: true });
  text(f, 'PRINT', 189 - Math.floor(measure('PRINT') / 2), 137, INK, 'tiny', { alignTop: true });
  for (let y = 145; y < 156; y++)
    for (let x = 180; x < 198; x++)
      if ((x + (y % 2)) % 2 === 0 && bayer(x, y * 3) < 0.8)
        f.set(x, y, y % 3 ? R.paper[1] : R.grey[1]);
  f.set(181, 129, R.grey[2]);
  f.set(196, 129, R.grey[2]);
  // wires counter: a slot in the glass and a brass plate
  f.rect(340, L.counterTop, 24, 3, '#1a1622');
  f.hline(339, L.counterTop, 26, R.grey[3]);
  box(f, 334, 136, 34, 10, R.gold, { band: 1 });
  text(f, 'WIRES', 351 - Math.floor(measure('WIRES') / 2), 138, '#3a2a08', 'tiny', {
    alignTop: true,
  });
  // tray dip
  const t = L.tray;
  f.rect(t.x, t.y, t.w, 5, '#1a1622');
  f.hline(t.x, t.y + 4, t.w, R.grey[1]);
  f.hline(t.x - 1, t.y, t.w + 2, R.grey[3]);
  // gate flap for staff
  f.rect(158, 126, 18, 32, '#2a1a12');
  f.vline(158, 126, 32, '#4e3424');
  f.vline(175, 126, 32, '#140c08');
  f.hline(158, 126, 18, '#5a3e2a');
  for (let y = 131; y < 154; y += 7) {
    f.hline(161, y, 12, R.red[2]);
    f.hline(161, y + 1, 12, R.taxi[2]);
  }
  f.rect(170, 143, 3, 2, R.gold[2]);
  // floor of the lobby
  SP.lino(f, L.cutEnd, L.counterBottom, W - L.cutEnd, H - L.counterBottom);
  f.hline(L.cutEnd, L.counterBottom, W - L.cutEnd, INK);
}

// ----- small baked props the scene draws on top -----
const prop = (w: number, h: number, fn: (p: Sprite) => void, outline = true) => {
  const p = new Sprite(w, h);
  fn(p);
  if (outline) p.outline();
  return toCanvas(p);
};
function props(): Props {
  const calc = prop(26, 16, (p) => {
    box(p, 0, 0, 26, 16, R.black, { band: 1 });
    p.rect(2, 1, 22, 7, '#1c2a1e');
    p.hline(2, 1, 22, '#0f1a12');
    for (let j = 9; j < 15; j += 2)
      for (let i = 2; i < 24; i += 4)
        p.rect(i, j, 3, 1, j === 9 && i === 22 ? R.red[2] : R.grey[2]);
  });
  const counter = prop(24, 16, (p) => {
    box(p, 0, 4, 24, 12, R.grey, { band: 1 });
    p.rect(3, 0, 14, 5, R.black[2]);
    p.hline(3, 0, 14, R.black[3]);
    p.rect(4, 8, 8, 3, '#1c2a1e');
    p.rect(5, 9, 6, 1, '#9be86a');
    p.rect(15, 8, 6, 5, '#78b860');
    p.hline(15, 8, 6, '#a8d880');
  });
  const banker = prop(18, 22, (p) => {
    shape(
      p,
      (i, j) => j >= 1 && j < 8 && Math.abs(i + 0.5 - 9) <= 3 + j,
      ['#0f3020', '#1a5a34', '#2a8a4a', '#6ad08a'],
      {
        band: 1,
      },
    );
    p.hline(2, 8, 15, '#ffe9a8');
    p.vline(9, 9, 10, R.gold[2]);
    p.vline(10, 9, 10, R.gold[1]);
    box(p, 4, 18, 11, 4, R.gold, { band: 1 });
  });
  const teletype = prop(20, 16, (p) => {
    box(p, 0, 3, 20, 13, R.cream, { band: 1 });
    p.rect(3, 0, 14, 4, R.cream[1]);
    p.hline(3, 0, 14, R.cream[2]);
    for (let i = 2; i < 18; i += 3) p.rect(i, 11, 2, 2, R.black[2]);
    p.rect(4, 6, 12, 3, R.black[1]);
  });
  const basket = prop(12, 10, (p) => {
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 12; x++)
        if (y === 8 || x === 0 || x === 11 || (x + y) % 3 === 0) p.set(x, y, R.steel[2]);
    p.hline(0, 0, 12, R.steel[3]);
  });
  const tube = (() => {
    const p = new Sprite(8, L.tube.bottom);
    p.rect(1, 0, 6, L.tube.bottom, '#1a2a30');
    p.vline(0, 0, L.tube.bottom, R.steel[1]);
    p.vline(7, 0, L.tube.bottom, R.steel[0]);
    for (let y = 12; y < L.tube.bottom; y += 26) p.rect(0, y, 8, 3, R.steel[2]);
    return toCanvas(p);
  })();
  const tubeGlass = (() => {
    const p = new Sprite(8, L.tube.bottom);
    for (let y = 0; y < L.tube.bottom; y++)
      if (y % 26 > 3) {
        p.set(2, y, '#8db0b0');
        if (y % 5 === 0) p.set(3, y, '#5a7b8a');
      }
    for (let y = 12; y < L.tube.bottom; y += 26) {
      p.rect(0, y, 8, 3, R.steel[2]);
      p.hline(0, y, 8, R.steel[3]);
    }
    return toCanvas(p);
  })();
  const tv = prop(36, 28, (p) => {
    box(p, 0, 0, 36, 26, R.black, { band: 1 });
    p.rect(2, 2, 32, 22, INK);
    p.rect(28, 25, 2, 3, R.grey[1]);
    p.rect(6, 25, 2, 3, R.grey[1]);
    p.set(31, 3, R.red[3]);
  });
  const beaconOff = prop(10, 9, (p) => {
    shape(
      p,
      (i, j) => j >= 1 && j < 7 && Math.abs(i + 0.5 - 5) <= 3.6,
      ['#2a0c10', '#4a1420', '#6e2030', '#8e3a44'],
      {
        band: 1,
      },
    );
    p.rect(1, 7, 8, 2, R.grey[1]);
  });
  const beaconOn = prop(
    16,
    12,
    (p) => {
      for (let j = 0; j < 12; j++)
        for (let i = 0; i < 16; i++) {
          const d = Math.hypot(i - 7.5, j - 5);
          if (d < 7.5 && bayer(i, j) < 0.5 - d * 0.06) p.set(i, j, '#7a1420');
        }
      shape(
        p,
        (i, j) => j >= 2 && j < 8 && Math.abs(i + 0.5 - 8) <= 3.6,
        ['#a8222e', '#ff4a4e', '#ff8a8a', '#ffe0e0'],
        {
          band: 1,
        },
      );
      p.rect(4, 8, 8, 2, R.grey[1]);
    },
    false,
  );
  const flash = prop(
    36,
    30,
    (p) => {
      for (let j = 0; j < 30; j++)
        for (let i = 0; i < 36; i++) {
          const d = Math.hypot((i - 17.5) / 1.2, j - 14.5);
          if (d < 14 && bayer(i, j) < 1 - d / 14) p.set(i, j, d < 5 ? '#ffffff' : '#fff3c4');
        }
    },
    false,
  );
  const lampOn = prop(
    22,
    10,
    (p) => {
      for (let j = 0; j < 10; j++)
        for (let i = 0; i < 22; i++) {
          const d = Math.hypot((i - 10.5) / 2, j - 2);
          if (d < 4.5 && bayer(i, j) < 0.6 - d * 0.12) p.set(i, j, '#d9822a');
        }
      p.rect(3, 0, 15, 3, '#ffc070');
      p.hline(5, 1, 11, '#fff0c0');
    },
    false,
  );
  const desk = prop(L.desk.w, L.cage.sill - L.desk.y, (p) => {
    const w = L.desk.w,
      h = L.cage.sill - L.desk.y;
    box(p, 0, 0, w, 4, R.wood, { band: 1 });
    p.hline(0, 0, w, R.wood[3]);
    box(p, 2, 4, w - 4, h - 4, ['#2a1c14', '#45301f', '#5a3e28', '#76563a'], { band: 1 });
    for (const dy of [8, 20]) {
      p.rect(6, dy, w - 12, 9, '#3a2618');
      p.hline(6, dy, w - 12, '#5a3e28');
      p.rect(Math.floor(w / 2) - 3, dy + 4, 6, 2, R.gold[2]);
    }
    p.rect(4, 0, w - 8, 2, '#1f4a2c');
  });
  return {
    calc,
    counter,
    banker,
    teletype,
    basket,
    tube,
    tubeGlass,
    tv,
    beaconOff,
    beaconOn,
    flash,
    lampOn,
    desk,
  };
}

export function bank(): BankArt {
  const s = new Sprite(W, H);
  street(s);
  interiorBack(s);
  // the banker's lamp throws a green cone on the vault wall
  SP.cone(s, 455, 110, 160, 4, 18, '#6ad08a', 0.4, 0.18);
  const back = toCanvas(s);
  // sodium cone over the sidewalk, as an overlay so the lamp can flicker
  const coneS = new Sprite(W, H);
  for (let y = 19; y < 192; y++) {
    const k = (y - 19) / 173,
      half = 6 + 58 * k,
      cx = 21 + 24 * k;
    for (
      let x = Math.max(0, Math.round(cx - half));
      x <= Math.min(L.facadeEnd - 1, Math.round(cx + half));
      x++
    ) {
      const c = s.get(x, y),
        edge = 1 - Math.abs(x - cx) / half;
      if (c && bayer(x, y) < 0.46 * (0.35 + edge) * (1 - k * 0.3))
        coneS.set(x, y, mix(c, '#ffb050', 0.3));
    }
  }
  const lampCone = toCanvas(coneS);
  // the CHECKS CASHED box with its backlight dying for a moment
  const boxAt = { x: 12, y: 33 },
    bw = 120,
    bh = 24,
    boxS = new Sprite(bw, bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const c = s.get(boxAt.x + x, boxAt.y + y);
      if (c) boxS.set(x, y, mix(c, '#1a1418', 0.55));
    }
  const boxOff = toCanvas(boxS);
  const f = new Sprite(W, H);
  interiorFront(f);
  const front = toCanvas(f);
  return { back, front, L, lampCone, boxOff, boxAt, ...props(), anchors };
}
