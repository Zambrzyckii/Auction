// The members-only side door of the auction hall at night: wall, door, neon, props, the bouncer and
// his speech bubble. Everything is drawn at art resolution.
import { R, INK, Sprite, shape, box, text, measure, mix, bayer, srand, rand, ri } from '../pix';
import type { Col, Ramp } from '../pix';
import {
  GROUND,
  H,
  NEON,
  neonText,
  neonOverlay,
  brickWall,
  streaks,
  cornice,
  win,
  street,
  trashCan,
} from '../city';
import type { BouncerState } from './door-rules';

const PINK = NEON.pink;
const BW = 30;
const BH = 38;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DoorPlacement {
  door: Rect;
  bouncer: { x: number; y: number };
  neon: { cx: number; y: number };
  pipe: number;
  posters: number;
  trash: number;
  bags: number;
  puddle: { x: number; y: number };
  windows: number[];
}

interface DoorArt {
  bg: Sprite;
  glow: Sprite;
  neon: Sprite;
  P: DoorPlacement;
}

type BubbleSide = 'down' | 'left' | 'right';

interface NeonSign {
  pts: [number, number][];
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

// Everything hangs off C. The door's right edge sits at C - 4, the bouncer guards it from the left.
function place(C: number): DoorPlacement {
  return {
    door: { x: C - 26, y: GROUND - 46, w: 22, h: 46 },
    bouncer: { x: C - 60, y: GROUND + 9 - BH },
    neon: { cx: C - 22, y: GROUND - 80 },
    pipe: C - 134,
    posters: C - 176,
    trash: C - 176,
    bags: C - 160,
    puddle: { x: C - 30, y: GROUND + 6 },
    windows: [-250, -200, -150, -100, -50, 0, 50, 100, 150, 200, 250].map((d) => C + d - 8),
  };
}

function poster(s: Sprite, x: number, y: number, lines: readonly string[], ramp: Ramp, ink: Col) {
  const ws = lines.map((l) => measure(l)),
    w = Math.max(...ws) + 6,
    h = lines.length * 7 + 4;
  box(s, x, y, w, h, ramp);
  lines.forEach((l, k) =>
    text(s, l, x + Math.floor((w - ws[k]) / 2), y + 3 + k * 7, ink, 'tiny', { alignTop: true }),
  );
  return { w, h };
}
function tape(s: Sprite, x: number, y: number) {
  s.rect(x, y, 3, 2, R.white[2]);
  s.set(x + 2, y + 1, R.white[1]);
}
function tear(s: Sprite, x: number, y: number, w: number, h: number) {
  for (let j = 0; j < 4; j++)
    for (let i = 0; i <= j; i++)
      s.set(x + w - 1 - i, y + h - 4 + j, (i + j) % 2 ? R.brick[1] : R.brick[2]);
  s.set(x + w - 5, y + h - 1, R.paper[1]);
  s.set(x + w - 2, y + h - 4, R.paper[1]);
}

function door(s: Sprite, d: Rect) {
  s.rect(d.x - 3, d.y - 3, d.w + 6, d.h + 3, R.concrete[1]);
  s.hline(d.x - 3, d.y - 3, d.w + 6, R.concrete[3]);
  s.vline(d.x - 3, d.y - 3, d.h + 3, R.concrete[2]);
  s.vline(d.x + d.w + 2, d.y - 3, d.h + 3, R.concrete[0]);
  s.rect(d.x - 1, d.y - 1, d.w + 2, d.h + 1, R.black[1]);
  box(s, d.x, d.y, d.w, d.h, R.sign);
  for (const [px, py, pw, ph] of [
    [d.x + 3, d.y + 4, d.w - 6, 14],
    [d.x + 3, d.y + 21, d.w - 6, 14],
  ]) {
    s.hline(px, py, pw, R.sign[0]);
    s.vline(px, py, ph, R.sign[0]);
    s.hline(px, py + ph, pw + 1, R.sign[3]);
    s.vline(px + pw, py, ph, R.sign[3]);
  }
  s.rect(d.x + 6, d.y + 9, 10, 4, R.black[0]);
  s.hline(d.x + 6, d.y + 9, 10, R.black[2]);
  s.rect(d.x + 13, d.y + 10, 3, 2, R.steel[2]);
  s.set(d.x + 13, d.y + 10, R.steel[3]);
  s.hline(d.x + 5, d.y + 13, 12, R.sign[3]);
  s.rect(d.x + 2, d.y + 25, 2, 6, R.steel[1]);
  s.hline(d.x + 2, d.y + 25, 5, R.steel[3]);
  s.hline(d.x + 3, d.y + 26, 4, R.steel[2]);
  s.rect(d.x + 1, d.y + d.h - 7, d.w - 2, 6, R.steel[2]);
  s.hline(d.x + 1, d.y + d.h - 7, d.w - 2, R.steel[3]);
  for (let i = 0; i < d.w - 2; i += 3) s.set(d.x + 2 + i, d.y + d.h - 4 + (i % 2), R.steel[1]);
  for (const hy of [d.y + 5, d.y + d.h - 12]) {
    s.rect(d.x + d.w - 2, hy, 2, 3, R.steel[1]);
    streaks(s, d.x + d.w - 3, hy + 3, 3, 9, R.rust);
  }
  for (let k = 0; k < 7; k++) s.set(d.x + ri(2, d.w - 3), d.y + ri(2, d.h - 9), R.sign[1]);
}

function neonSign(s: Sprite, cx: number, y: number): NeonSign {
  const l1 = 'MEMBERS',
    l2 = 'ONLY',
    w1 = measure(l1),
    w2 = measure(l2);
  const pw = Math.max(w1, w2) + 9,
    ph = 19,
    px = cx - Math.floor(pw / 2);
  box(s, px, y, pw, ph, R.black);
  for (const [bx, by] of [
    [px + 1, y + 1],
    [px + pw - 2, y + 1],
    [px + 1, y + ph - 2],
    [px + pw - 2, y + ph - 2],
  ])
    s.set(bx, by, R.grey[1]);
  s.vline(px + 4, y - 6, 6, R.black[1]);
  s.vline(px + pw - 5, y - 6, 6, R.black[1]);
  const a = neonText(s, l1, cx - Math.floor(w1 / 2), y + 3, PINK),
    b = neonText(s, l2, cx - Math.floor(w2 / 2), y + 11, PINK);
  return { pts: a.pts.concat(b.pts), cx, cy: y + ph / 2, rx: pw / 2 + 14, ry: ph / 2 + 12 };
}

function bags(s: Sprite, x: number, y: number) {
  const blob = (cx: number, cy: number, rx: number, ry: number) =>
    shape(s, (i, j) => ((i + 0.5 - cx) / rx) ** 2 + ((j + 0.5 - cy) / ry) ** 2 <= 1, R.black, {
      x0: cx - rx - 1,
      y0: cy - ry - 1,
      x1: cx + rx + 1,
      y1: cy + ry + 1,
    });
  blob(x + 6, y + 6, 6, 5);
  blob(x + 15, y + 7, 5, 4);
  s.set(x + 6, y, R.black[2]);
  s.set(x + 5, y - 1, R.black[2]);
  s.set(x + 7, y - 1, R.black[2]);
  s.set(x + 4, y + 3, R.black[3]);
  s.set(x + 13, y + 5, R.black[3]);
}

function compose(W: number, C: number, opts: { bare?: boolean } = {}): DoorArt {
  srand(41);
  const s = new Sprite(W, H),
    glow = new Sprite(W, H),
    P = place(C);
  brickWall(s, 0, 0, W, GROUND, R.brick, { grime: 12 });
  cornice(s, 0, GROUND - 84, W, R.paper);
  P.windows.forEach((wx, k) => {
    if (wx > -18 && wx < W + 2)
      win(s, wx, 18, 16, 26, { lit: k % 4 === 1, blinds: k % 4 === 3, ac: k % 4 === 2 });
  });
  if (!opts.bare) {
    s.rect(P.pipe, 0, 2, GROUND, R.grey[1]);
    s.vline(P.pipe, 0, GROUND, R.grey[2]);
    for (let j = 10; j < GROUND; j += 24) s.hline(P.pipe - 1, j, 4, R.grey[0]);
    streaks(s, P.pipe - 1, 60, 4, 30, R.rust);
  }
  door(s, P.door);
  const sign = neonSign(s, P.neon.cx, P.neon.y);
  if (!opts.bare) {
    const p1 = poster(s, P.posters, GROUND - 54, ['AUCTION', 'TONITE', '9 PM'], R.paper, R.red[2]);
    tape(s, P.posters - 1, GROUND - 55);
    tape(s, P.posters + p1.w - 2, GROUND - 55);
    tear(s, P.posters, GROUND - 54, p1.w, p1.h);
    poster(s, P.posters + 12, GROUND - 27, ['CASH', 'ONLY'], R.taxi, INK);
    tape(s, P.posters + 11, GROUND - 28);
  }
  for (const gx of [C - 150, C - 96, C - 40, C + 30, C + 120])
    streaks(s, gx, GROUND - 80, 7, 26, R.brick);
  s.stamp(street(W).s, 0, GROUND);
  const d = P.door;
  s.rect(d.x - 4, GROUND, d.w + 8, 2, R.concrete[2]);
  s.hline(d.x - 4, GROUND, d.w + 8, R.concrete[3]);
  s.hline(d.x - 4, GROUND + 2, d.w + 8, R.concrete[1]);
  for (let i = -11; i <= 11; i++)
    for (let j = 0; j < 3; j++) {
      const x = P.bouncer.x + 15 + i,
        y = GROUND + 7 + j;
      if ((i * i) / 121 + ((j - 1) * (j - 1)) / 2.2 <= 1 && s.in(x, y)) {
        const under = s.get(x, y);
        if (under) s.set(x, y, mix(under, INK, 0.45));
      }
    }
  const pd = P.puddle;
  for (let i = 0; i < 22; i++)
    for (let j = 0; j < 3; j++) {
      const q = ((i - 10.5) / 11) ** 2 + ((j - 1) / 1.6) ** 2;
      if (q > 1) continue;
      s.set(pd.x + i, pd.y + j, q > 0.6 ? R.glass[1] : R.glass[0]);
    }
  s.hline(pd.x + 3, pd.y, 15, R.glass[2]);
  glow.hline(pd.x + 7, pd.y + 1, 7, mix(R.glass[0], PINK.mid, 0.55));
  glow.hline(pd.x + 9, pd.y + 2, 3, mix(R.glass[0], PINK.mid, 0.35));
  const trash = trashCan();
  s.stamp(trash, P.trash, GROUND - 4);
  bags(s, P.bags, GROUND - 1);
  for (let k = 0; k < 9; k++)
    s.set(ri(4, W - 4), GROUND + ri(4, 12), rand() < 0.5 ? R.paper[2] : R.white[1]);
  for (let y = Math.floor(sign.cy - sign.ry); y <= sign.cy + sign.ry; y++)
    for (let x = Math.floor(sign.cx - sign.rx); x <= sign.cx + sign.rx; x++) {
      const q = ((x - sign.cx) / sign.rx) ** 2 + ((y - sign.cy) / sign.ry) ** 2;
      if (q > 1 || !s.in(x, y)) continue;
      const c = s.get(x, y);
      if (!c) continue;
      const k = 1 - q;
      if (q < 0.35 || bayer(x, y) < k * 1.4) glow.set(x, y, mix(c, PINK.mid, 0.12 + 0.2 * k));
    }
  const neon = neonOverlay(s, sign.pts, PINK);
  return { bg: s, glow, neon, P };
}

function cardTop(pose: BouncerState, frame: number, ty: number) {
  if (pose === 'check') return ty - 2 + (frame % 2);
  if (pose === 'refuse') return ty + 3;
  return ty + 1;
}

// The bouncer faces right, towards his door and the sheet.
function bouncer(pose: BouncerState, frame = 0): Sprite {
  const s = new Sprite(BW, BH),
    skin = R.skinA,
    jk = R.black,
    jn = R.denim;
  const bob = pose === 'idle' && frame === 1 ? -1 : 0;
  const shake = pose === 'refuse' ? [0, -1, 1, -1, 1, 0][frame % 6] : 0;
  const look = pose === 'check' ? 1 : 0;
  const hx = 12 + shake,
    hy = 2 + bob + look,
    ty = 12 + bob;
  s.rect(10, 25, 4, 9, jn[1]);
  s.vline(10, 25, 9, jn[2]);
  s.rect(15, 25, 4, 9, jn[2]);
  s.vline(15, 25, 9, jn[3]);
  s.vline(18, 25, 9, jn[1]);
  s.set(16, 29, jn[1]);
  s.rect(9, 34, 5, 2, jk[1]);
  s.hline(9, 34, 5, jk[2]);
  s.rect(15, 34, 6, 2, jk[2]);
  s.hline(15, 34, 6, jk[3]);
  s.hline(15, 35, 6, jk[1]);
  s.rect(5, ty + 1, 3, 9, jk[1]);
  s.vline(5, ty + 1, 9, jk[2]);
  s.rect(5, ty + 10, 3, 2, skin[1]);
  s.set(5, ty + 10, skin[2]);
  s.rect(13, ty - 1, 5, 1, skin[1]);
  const torso = (i: number, j: number) =>
    (j === ty && i >= 9 && i <= 20) ||
    (j > ty && j <= ty + 8 && i >= 8 && i <= 21) ||
    (j > ty + 8 && j <= ty + 12 && i >= 9 && i <= 20);
  shape(s, torso, jk, { x0: 6, y0: ty - 1, x1: 24, y1: ty + 14 });
  s.hline(11, ty, 7, jk[3]);
  s.hline(13, ty, 4, R.rust[2]);
  s.set(14, ty + 1, R.rust[1]);
  s.set(10, ty + 1, jk[3]);
  s.set(18, ty + 1, jk[3]);
  s.vline(17, ty + 1, 11, R.grey[1]);
  s.set(17, ty + 2, R.grey[3]);
  for (let i = 9; i <= 20; i++) s.set(i, ty + 12, i % 2 ? jk[3] : jk[2]);
  const head = (i: number, j: number) => {
    if (i < hx || i > hx + 7 || j < hy || j > hy + 8) return false;
    const di = i - hx,
      dj = j - hy;
    if (dj === 0 && (di < 2 || di > 5)) return false;
    if (dj === 1 && (di === 0 || di === 7)) return false;
    if (dj === 8 && (di < 3 || di === 7)) return false;
    if (dj === 7 && di === 0) return false;
    return true;
  };
  shape(s, head, skin, { x0: hx - 1, y0: hy - 1, x1: hx + 9, y1: hy + 10 });
  s.set(hx + 2, hy + 4, skin[1]);
  s.set(hx + 2, hy + 5, skin[1]);
  s.set(hx + 3, hy + 5, skin[0]);
  s.hline(hx + 4, hy + 3, 4, jk[1]);
  s.hline(hx + 4, hy + 4, 4, jk[0]);
  s.set(hx + 3, hy + 3, jk[1]);
  const glint = pose === 'idle' && frame >= 2 ? hx + 3 + frame : hx + 5;
  if (glint <= hx + 7) s.set(glint, hy + 3, R.white[0]);
  s.set(hx + 8, hy + 5, skin[2]);
  s.hline(hx + 6, hy + 7, 2, skin[0]);
  s.hline(hx + 5, hy + 8, 2, R.hair[2]);
  const cy = cardTop(pose, frame, ty);
  s.rect(20, ty + 1, 2, 6, jk[2]);
  s.vline(21, ty + 1, 6, jk[1]);
  s.line(21, ty + 6, 22, cy + 6, jk[2]);
  s.line(20, ty + 6, 21, cy + 6, jk[2]);
  s.rect(23, cy, 6, 10, R.wood[1]);
  s.hline(23, cy, 6, R.wood[2]);
  s.vline(23, cy, 10, R.wood[2]);
  s.rect(24, cy + 2, 4, 7, R.paper[3]);
  s.hline(25, cy + 4, 2, R.paper[1]);
  s.hline(25, cy + 6, 3, R.paper[1]);
  s.hline(25, cy + 8, 2, R.paper[1]);
  s.hline(24, cy, 4, R.grey[3]);
  s.hline(24, cy + 1, 4, R.grey[1]);
  s.rect(22, cy + 5, 2, 2, skin[2]);
  s.set(22, cy + 6, skin[1]);
  const rim = (c: string) => mix(c, PINK.mid, 0.32);
  for (const [i, j] of [
    [20, ty],
    [21, ty + 1],
    [21, ty + 2],
  ]) {
    const c = s.get(i, j);
    if (c) s.set(i, j, rim(c));
  }
  s.outline();
  return s;
}

// A speech bubble whose tail points down (above the speaker) or sideways (beside the speaker).
const TAIL_DOWN = [
  [-1, 3],
  [0, 2],
  [0, 1],
];
function bubble(
  lines: readonly string[],
  side: BubbleSide = 'down',
): { s: Sprite; tip: { x: number; y: number } } {
  const tw = Math.max(...lines.map((l) => measure(l))),
    w = tw + 7,
    h = lines.length * 7 + 4;
  const left = side === 'left' ? 3 : 0,
    right = side === 'right' ? 3 : 0;
  const s = new Sprite(w + 2 + left + right, h + (side === 'down' ? 5 : 2)),
    X = 1 + left,
    Y = 1;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (!((i === 0 || i === w - 1) && (j === 0 || j === h - 1)))
        s.set(X + i, Y + j, j === h - 1 ? R.white[2] : R.white[3]);
  let tip: { x: number; y: number };
  if (side === 'down') {
    const tx = X + w - 7;
    TAIL_DOWN.forEach(([dx, len], k) => s.hline(tx + dx, Y + h + k, len, R.white[2]));
    tip = { x: tx, y: Y + h + 2 };
  } else if (side === 'left') {
    const ty = Y + Math.min(h - 4, 5);
    s.hline(X - 3, ty + 2, 3, R.white[3]);
    s.hline(X - 2, ty + 1, 2, R.white[3]);
    s.set(X - 1, ty, R.white[3]);
    tip = { x: X - 3, y: ty + 2 };
  } else {
    const ty = Y + Math.min(h - 4, 5);
    s.hline(X + w, ty + 2, 3, R.white[3]);
    s.hline(X + w, ty + 1, 2, R.white[3]);
    s.set(X + w, ty, R.white[3]);
    tip = { x: X + w + 2, y: ty + 2 };
  }
  lines.forEach((l, k) => text(s, l, X + 4, Y + 2 + k * 7, INK, 'tiny', { alignTop: true }));
  s.outline({ selective: false });
  return { s, tip };
}

export type { DoorPlacement, DoorArt, BubbleSide };
export { compose, bouncer, bubble };
