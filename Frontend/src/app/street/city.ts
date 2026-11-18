// The street: sky, skyline, the six storefronts that stand for the app's
// modules, filler buildings, sidewalk, road and street furniture.
import type { Ramp, FontKey } from './pix';
import {
  R,
  INK,
  Sprite,
  shape,
  box,
  sphere,
  cylV,
  cylH,
  disc,
  text,
  measure,
  glyphMask,
  mix,
  bayer,
  rand,
  srand,
  ri,
  rampOf,
} from './pix';
const GROUND = 138,
  H = 180,
  WORLD = 640,
  CORE = 420,
  CORE_X = (WORLD - CORE) / 2;
interface Neon {
  core: string;
  mid: string;
  dim: string;
}
interface WinOpts {
  frame?: Ramp;
  lit?: boolean;
  figure?: boolean;
  blinds?: boolean;
  split?: boolean;
  ac?: boolean;
  tv?: boolean;
}
type BuildingId = 'room' | 'auction' | 'pawn' | 'bank' | 'casino' | 'storage';
interface Building {
  id: BuildingId;
  name: string;
  route: string;
  x: number;
  y: number;
  w: number;
  h: number;
  s: Sprite;
  fx: any;
  open?: any;
}
interface Billboard {
  s: Sprite;
  w: number;
  h: number;
  x: number;
  y: number;
}

const NEON = {
  pink: { core: '#ffd6ea', mid: '#ff5fa2', dim: '#4a2238' },
  cyan: { core: '#e0fbff', mid: '#4fd8f0', dim: '#1f3a48' },
  green: { core: '#eaffd0', mid: '#8af060', dim: '#2a3a2c' },
  amber: { core: '#fff0c0', mid: '#ffb040', dim: '#4a3424' },
  gold: { core: '#fff4c8', mid: '#f5b52e', dim: '#4a3a22' },
  red: { core: '#ffd8cc', mid: '#ff4a3a', dim: '#4a1e22' },
};

function brickWall(
  s: Sprite,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: Ramp,
  opts: { grime?: number } = {},
) {
  s.rect(x, y, w, h, ramp[2]);
  for (let j = 0; j < h; j++) {
    if (j % 4 === 3) {
      for (let i = 0; i < w; i++) if (rand() < 0.6) s.set(x + i, y + j, ramp[1]);
      continue;
    }
    const off = (Math.floor(j / 4) % 2) * 4;
    for (let i = off; i < w; i += 8) if (rand() < 0.35) s.set(x + i, y + j, ramp[1]);
  }
  for (let k = 0, n = Math.floor((w * h) / 26); k < n; k++) {
    const i = ri(0, w - 3),
      j = ri(0, h - 1);
    if (j % 4 !== 3) s.hline(x + i, y + j, ri(1, 3), rand() < 0.65 ? ramp[3] : ramp[1]);
  }
  s.vline(x, y, h, ramp[3]);
  s.vline(x + w - 1, y, h, ramp[0]);
  for (let j = 0; j < h; j++) if (bayer(x + w - 2, y + j) < 0.5) s.set(x + w - 2, y + j, ramp[1]);
  if (opts.grime)
    for (let j = 0; j < opts.grime; j++)
      for (let i = 1; i < w - 1; i++) {
        if (bayer(x + i, y + h - opts.grime + j) < (j / opts.grime) * 0.55)
          s.set(x + i, y + h - opts.grime + j, ramp[1]);
      }
  return s;
}
function streaks(s: Sprite, x: number, y: number, w: number, len: number, ramp: Ramp) {
  for (let i = 0; i < w; i++)
    for (let j = 0; j < len; j++)
      if (bayer(x + i, y + j) < 0.45 * (1 - j / len) && i % 3 !== 1) s.set(x + i, y + j, ramp[1]);
}
function cornice(s: Sprite, x: number, y: number, w: number, ramp: Ramp = R.concrete) {
  s.hline(x, y, w, ramp[3]);
  s.hline(x, y + 1, w, ramp[2]);
  for (let i = 0; i < w; i++) s.set(x + i, y + 2, i % 3 === 0 ? ramp[0] : ramp[2]);
  s.hline(x, y + 3, w, ramp[1]);
}
function reflect(s: Sprite, x: number, y: number, w: number, h: number, ramp: Ramp) {
  for (let k = 0; k < h; k++) {
    const i = x + w - 3 - k;
    if (i >= x) s.set(i, y + k, ramp[2]);
    if (i + 1 < x + w && i + 1 >= x) s.set(i + 1, y + k, ramp[3]);
  }
}
function win(s: Sprite, x: number, y: number, w: number, h: number, o: WinOpts = {}) {
  const fr = o.frame || R.paper;
  s.hline(x - 1, y - 2, w + 2, R.concrete[3]);
  s.hline(x - 1, y - 1, w + 2, R.concrete[1]);
  s.rect(x, y, w, h, fr[1]);
  s.hline(x, y, w, fr[2]);
  s.vline(x, y, h, fr[2]);
  const gx = x + 1,
    gy = y + 1,
    gw = w - 2,
    gh = h - 2;
  if (o.lit) {
    s.rect(gx, gy, gw, gh, R.lit[2]);
    s.hline(gx, gy, gw, R.lit[1]);
    s.rect(gx, gy, 2, gh, R.lit[1]);
    s.rect(gx + gw - 2, gy, 2, gh, R.lit[1]);
    s.set(gx + 2, gy + 1, R.lit[3]);
    if (o.figure) {
      s.rect(gx + Math.floor(gw / 2), gy + gh - 5, 3, 5, R.lit[0]);
      s.rect(gx + Math.floor(gw / 2), gy + gh - 7, 3, 2, R.lit[0]);
    }
  } else if (o.blinds) {
    for (let j = 0; j < gh; j++) s.hline(gx, gy + j, gw, j % 2 ? R.paper[1] : R.paper[2]);
  } else {
    s.rect(gx, gy, gw, gh, R.glass[1]);
    s.hline(gx, gy, gw, R.glass[0]);
    reflect(s, gx, gy + 1, gw, gh - 1, R.glass);
  }
  if (o.split !== false) s.hline(x, y + Math.floor(h / 2), w, fr[2]);
  s.hline(x - 1, y + h, w + 2, R.concrete[3]);
  s.hline(x - 1, y + h + 1, w + 2, R.concrete[0]);
  if (o.ac) {
    box(s, x + 1, y + h - 5, w - 2, 5, R.white);
    s.hline(x + 2, y + h - 3, w - 4, R.white[1]);
    s.hline(x + 2, y + h - 2, w - 4, R.white[0]);
  }
}
function neonOverlay(base: Sprite, pts: [number, number][], n: Neon) {
  const o = new Sprite(base.w, base.h),
    on = new Set(pts.map(([x, y]) => x + ',' + y));
  for (const [x, y] of pts)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const k = x + dx + ',' + (y + dy);
        if (on.has(k)) continue;
        const bg = base.get(x + dx, y + dy) || '#241c30';
        o.set(x + dx, y + dy, mix(bg, n.mid, Math.abs(dx) + Math.abs(dy) === 2 ? 0.28 : 0.5));
      }
  for (const [x, y] of pts) o.set(x, y, n.core);
  return o;
}
function neonText(
  base: Sprite,
  str: string,
  x: number,
  y: number,
  n: Neon,
  font: FontKey = 'tiny',
) {
  const m = glyphMask(str, font),
    pts = m.pts.map(([px, py]): [number, number] => [x + px, y + py - m.top]);
  for (const [px, py] of pts) base.set(px, py, n.dim);
  return { pts, w: m.w, h: m.bottom - m.top + 1 };
}
const pad = (w: number, h: number) => new Sprite(w + 2, h + 1);

// ----- your room: tenement over a laundromat -----
function tenement(): Building {
  srand(11);
  const W = 70,
    HH = 110,
    s = pad(W, HH),
    X = 1,
    Y = 1,
    top = Y + 22,
    fx: any = {};
  const tx = X + 44;
  for (const lx of [tx + 1, tx + 7, tx + 13]) s.vline(lx, Y + 16, 6, R.black[3]);
  s.line(tx + 1, Y + 17, tx + 7, Y + 21, R.black[2]);
  s.line(tx + 13, Y + 17, tx + 7, Y + 21, R.black[2]);
  cylV(s, tx, Y + 4, 15, 12, R.wood);
  for (let i = 2; i < 15; i += 3)
    for (let j = 5; j < 15; j++) {
      const c = s.get(tx + i, Y + j),
        info = rampOf.get(c!);
      if (info && info.i > 0) s.set(tx + i, Y + j, info.ramp[info.i - 1]);
    }
  s.hline(tx, Y + 7, 15, R.black[2]);
  s.hline(tx, Y + 13, 15, R.black[2]);
  for (let j = 0; j < 4; j++) s.hline(tx + 6 - j * 2, Y + j, 3 + j * 4, R.steel[[3, 2, 2, 1][j]]);
  s.vline(X + 12, Y + 9, 13, R.black[3]);
  s.hline(X + 7, Y + 11, 11, R.black[3]);
  s.hline(X + 9, Y + 14, 7, R.black[3]);
  s.hline(X + 10, Y + 17, 5, R.black[3]);
  brickWall(s, X, top, W, HH - 22, R.mauve, { grime: 8 });
  cornice(s, X, top, W);
  const floors = [top + 7, top + 27, top + 47],
    cols = [X + 6, X + 26, X + 50];
  const looks: WinOpts[][] = [
    [{}, { lit: true, figure: true }, {}],
    [{ ac: true }, { tv: true }, {}],
    [{ lit: true }, {}, { lit: true }],
  ];
  floors.forEach((fy, r) =>
    cols.forEach((cx, c) => {
      const o = looks[r][c];
      win(s, cx, fy, 10, 12, o);
      streaks(s, cx, fy + 14, 10, 6, R.mauve);
      if (o.tv) fx.tv = { x: cx + 1, y: fy + 1, w: 8, h: 10 };
    }),
  );
  const ex = X + 44,
    ew = 23;
  for (const py of [top + 21, top + 41, top + 61]) {
    s.hline(ex, py, ew, R.black[3]);
    s.hline(ex, py + 1, ew, R.black[1]);
    s.hline(ex, py - 5, ew, R.black[2]);
    for (let i = 0; i < ew; i += 3) s.vline(ex + i, py - 4, 4, R.black[1]);
  }
  const stair = (x0: number, y0: number, x1: number, y1: number) => {
    s.line(x0, y0, x1, y1, R.black[3]);
    s.line(x0, y0 + 1, x1, y1 + 1, R.black[1]);
    for (let k = 2; k < Math.abs(x1 - x0); k += 3) {
      const t = k / Math.abs(x1 - x0),
        sx = x0 + (x1 - x0) * t,
        sy = y0 + (y1 - y0) * t;
      s.hline(Math.round(sx) - 1, Math.round(sy), 3, R.black[2]);
    }
  };
  stair(ex + 3, top + 22, ex + 18, top + 40);
  stair(ex + 19, top + 42, ex + 4, top + 60);
  s.vline(ex + 16, top + 62, 9, R.black[3]);
  s.vline(ex + 20, top + 62, 9, R.black[3]);
  for (let j = 64; j < 71; j += 2) s.hline(ex + 16, top + j, 5, R.black[2]);
  const sf = top + 63;
  box(s, X + 2, sf, W - 4, 7, R.steel);
  text(
    s,
    'WASH & FOLD',
    X + Math.floor((W - measure('WASH & FOLD')) / 2),
    sf + 1,
    R.white[3],
    'tiny',
    { alignTop: true },
  );
  s.rect(X + 2, sf + 8, 42, 16, R.black[1]);
  s.rect(X + 3, sf + 9, 40, 14, '#9fc2b0');
  s.hline(X + 3, sf + 9, 40, '#d6efe2');
  s.hline(X + 3, sf + 10, 40, '#b8d8c8');
  for (const wx of [X + 5, X + 18, X + 31]) {
    box(s, wx, sf + 13, 10, 10, R.white);
    s.hline(wx, sf + 14, 10, R.white[1]);
    disc(s, wx + 5, sf + 18.5, 3, R.white[0]);
    disc(s, wx + 5, sf + 18.5, 2, R.steel[3]);
    s.set(wx + 4, sf + 17, R.white[3]);
  }
  reflect(s, X + 3, sf + 9, 40, 12, ['', '', '#c8e4d6', '#e8fbf1']);
  box(s, X + 48, sf + 8, 14, 17, R.steel);
  s.rect(X + 50, sf + 10, 10, 7, '#9fc2b0');
  s.set(X + 58, sf + 13, R.gold[3]);
  s.hline(X + 46, sf + 24, 18, R.concrete[3]);
  s.outline();
  return {
    id: 'room',
    name: 'Your room',
    route: 'Inventory, wallet, profile',
    x: 0,
    y: 0,
    s,
    w: W,
    h: HH,
    fx,
  };
}

// ----- auction hall: an old vaudeville house turned auction room -----
function auctionHall(): Building {
  srand(23);
  const W = 88,
    HH = 92,
    s = pad(W, HH),
    X = 1,
    Y = 1,
    fx: any = { bulbs: [], blade: null };
  const body = (i: number, j: number) =>
    (i >= X && i < X + W && j >= Y + 5 && j < Y + HH) ||
    (i >= X + 30 && i < X + 58 && j >= Y && j < Y + HH);
  for (let j = Y; j < Y + HH; j++)
    for (let i = X; i < X + W; i++) if (body(i, j)) s.set(i, j, R.brick[2]);
  brickWall(s, X, Y + 5, W, HH - 5, R.brick, { grime: 8 });
  brickWall(s, X + 30, Y, 28, 6, R.brick);
  box(s, X + 30, Y, 28, 2, R.paper);
  box(s, X + 36, Y + 2, 16, 7, R.paper);
  text(s, '1911', X + 44 - Math.floor(measure('1911') / 2), Y + 3, R.paper[0], 'tiny', {
    alignTop: true,
  });
  cornice(s, X, Y + 9, W, R.paper);
  for (const qx of [X, X + W - 4])
    for (let j = Y + 13; j < Y + 80; j += 3)
      box(s, qx, j, Math.floor((j - Y) / 3) % 2 ? 4 : 3, 2, R.paper);
  const arch = (x: number, y: number, w: number, h: number) => {
    const r = w / 2,
      cx = x + r;
    const inside = (i: number, j: number) =>
      i >= x &&
      i < x + w &&
      j < y + h &&
      (j >= y + r || (i + 0.5 - cx) ** 2 + (j + 0.5 - (y + r)) ** 2 <= r * r) &&
      j >= y;
    const ring = (i: number, j: number) =>
      !inside(i, j) &&
      (inside(i - 1, j) ||
        inside(i + 1, j) ||
        inside(i, j - 1) ||
        inside(i, j + 1) ||
        inside(i - 1, j - 1) ||
        inside(i + 1, j - 1));
    for (let j = y - 2; j < y + h + 1; j++)
      for (let i = x - 2; i < x + w + 2; i++)
        if (ring(i, j)) s.set(i, j, j < y + r ? R.paper[3] : R.paper[2]);
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++)
        if (inside(i, j)) {
          const f = (j - y) / h;
          s.set(i, j, bayer(i, j) < f * 0.9 ? R.lit[2] : R.lit[3]);
        }
    for (let j = y; j < y + h; j++) if (inside(cx, j)) s.set(cx, j, R.wood[1]);
    for (let j = y + r; j < y + h; j += 6)
      for (let i = x; i < x + w; i++) if (inside(i, j)) s.set(i, j, R.wood[1]);
    for (let i = x; i < x + w; i++) if (inside(i, y + r - 1)) s.set(i, y + r - 1, R.wood[1]);
    s.rect(cx - 1, y - 3, 2, 3, R.paper[3]);
    s.set(cx, y - 3, R.paper[2]);
    s.hline(x - 1, y + h, w + 2, R.paper[3]);
    s.hline(x - 1, y + h + 1, w + 2, R.paper[1]);
    for (let k = 0; k < 3; k++) s.rect(x + 2 + k * 3, y + h - 3, 2, 3, R.lit[0]);
  };
  for (const ax of [X + 10, X + 32, X + 54]) arch(ax, Y + 17, 12, 30);
  const mq = { x: X + 3, y: Y + 60, w: 82, h: 18 };
  box(s, mq.x, mq.y, mq.w, mq.h, R.red);
  s.rect(mq.x + 3, mq.y + 3, mq.w - 6, mq.h - 6, R.paper[3]);
  s.hline(mq.x + 3, mq.y + mq.h - 4, mq.w - 6, R.paper[2]);
  const l1 = 'AUCTION TONITE',
    l2 = 'LOTS FROM $10';
  text(s, l1, mq.x + Math.floor((mq.w - measure(l1)) / 2), mq.y + 4, INK, 'tiny', {
    alignTop: true,
  });
  text(s, l2, mq.x + Math.floor((mq.w - measure(l2)) / 2), mq.y + 10, R.red[1], 'tiny', {
    alignTop: true,
  });
  for (let i = mq.x + 1; i < mq.x + mq.w - 1; i += 3) {
    fx.bulbs.push([i, mq.y + 1]);
    fx.bulbs.push([i, mq.y + mq.h - 2]);
  }
  for (const b of fx.bulbs) s.set(b[0], b[1], R.gold[1]);
  s.hline(mq.x, mq.y + mq.h, mq.w, R.black[1]);
  s.hline(mq.x + 1, mq.y + mq.h + 1, mq.w - 2, R.brick[0]);
  const bl = { x: X + 72, y: Y + 9, w: 11, h: 48 };
  box(s, bl.x, bl.y, bl.w, bl.h, R.red);
  s.rect(bl.x + 2, bl.y + 2, bl.w - 4, bl.h - 4, R.red[0]);
  const letters: [number, number][] = [];
  'AUCTION'.split('').forEach((ch, k) => {
    const m = neonText(
      s,
      ch,
      bl.x + Math.floor((bl.w - measure(ch)) / 2),
      bl.y + 4 + k * 6,
      NEON.gold,
    );
    letters.push(...m.pts);
  });
  fx.blade = neonOverlay(s, letters, NEON.gold);
  fx.bladeBulbs = [];
  for (let j = bl.y + 1; j < bl.y + bl.h - 1; j += 3) {
    fx.bladeBulbs.push([bl.x, j], [bl.x + bl.w - 1, j]);
  }
  s.rect(bl.x + 3, bl.y - 3, 1, 3, R.black[3]);
  s.rect(bl.x + 7, bl.y - 3, 1, 3, R.black[3]);
  const gy = Y + 80;
  box(s, X + 33, gy, 22, 12, R.wood);
  s.rect(X + 35, gy + 2, 8, 9, R.wood[1]);
  s.rect(X + 45, gy + 2, 8, 9, R.wood[1]);
  s.rect(X + 36, gy + 3, 6, 3, R.lit[2]);
  s.rect(X + 46, gy + 3, 6, 3, R.lit[2]);
  s.set(X + 42, gy + 7, R.gold[3]);
  s.set(X + 45, gy + 7, R.gold[3]);
  for (const px of [X + 9, X + 63]) {
    box(s, px, gy + 1, 14, 10, R.gold);
    s.rect(px + 2, gy + 3, 10, 6, R.paper[3]);
    s.hline(px + 3, gy + 4, 8, R.red[2]);
    s.hline(px + 3, gy + 6, 6, R.paper[0]);
    s.hline(px + 3, gy + 7, 7, R.paper[1]);
  }
  s.hline(X + 31, Y + HH - 1, 26, R.concrete[3]);
  s.outline();
  return { id: 'auction', name: 'Auction hall', route: 'Auctions', x: 0, y: 0, s, w: W, h: HH, fx };
}

// ----- pawnshop: boarded until the player has moved a million -----
function pawnshop(open: boolean): Building {
  srand(37);
  const W = 62,
    HH = 72,
    s = pad(W, HH),
    X = 1,
    Y = 1,
    fx: any = {};
  brickWall(s, X, Y, W, HH, R.tan, { grime: 10 });
  cornice(s, X, Y, W);
  const ghost = 'PAWN & LOAN';
  const gm = glyphMask(ghost, 'tiny'),
    gx = X + Math.floor((W - gm.w) / 2);
  const glyph = gm.pts.map(([px, py]) => [gx + px, Y + 7 + py - gm.top]),
    onGlyph = new Set(glyph.map(([x, y]) => x + ',' + y));
  if (open) {
    box(s, gx - 3, Y + 4, gm.w + 6, 10, R.red);
    for (const [x, y] of glyph) s.set(x, y, R.gold[3]);
  } else {
    s.rect(gx - 2, Y + 5, gm.w + 4, 8, mix(R.tan[2], R.paper[3], 0.26));
    for (const [x, y] of glyph) s.set(x, y, mix(R.tan[2], R.paper[3], 0.66));
    for (let k = 0; k < 26; k++) {
      const x = gx - 2 + ri(0, gm.w + 3),
        y = Y + 5 + ri(0, 7);
      if (!onGlyph.has(x + ',' + y)) s.set(x, y, R.tan[2]);
    }
  }
  for (const wx of [X + 8, X + 40]) {
    if (open) win(s, wx, Y + 17, 14, 13, { lit: true });
    else {
      win(s, wx, Y + 17, 14, 13, {});
      box(s, wx - 1, Y + 16, 16, 15, R.wood);
      for (let j = Y + 19; j < Y + 30; j += 4) s.hline(wx, j, 14, R.wood[1]);
      s.set(wx + 1, Y + 18, R.black[3]);
      s.set(wx + 12, Y + 18, R.black[3]);
      s.set(wx + 1, Y + 28, R.black[3]);
      s.set(wx + 12, Y + 28, R.black[3]);
    }
  }
  const sf = Y + 46;
  if (open) {
    box(s, X + 2, sf, 42, 26, R.black);
    s.rect(X + 3, sf + 1, 40, 24, '#2c2433');
    s.hline(X + 3, sf + 20, 40, R.wood[2]);
    s.hline(X + 3, sf + 21, 40, R.wood[1]);
    box(s, X + 5, sf + 9, 12, 11, R.black);
    s.rect(X + 6, sf + 10, 9, 7, '#7fa6b8');
    s.hline(X + 6, sf + 10, 9, '#cfe6ef');
    s.set(X + 16, sf + 12, R.red[3]);
    shape(
      s,
      (i, j) => {
        const a = (i - (X + 24)) ** 2 / 9 + (j - (sf + 16)) ** 2 / 12 <= 1,
          b = (i - (X + 24)) ** 2 / 6 + (j - (sf + 11)) ** 2 / 8 <= 1;
        return a || b;
      },
      R.wood,
      { x0: X + 18, y0: sf + 6, x1: X + 30, y1: sf + 21 },
    );
    s.vline(X + 24, sf + 1, 9, R.wood[0]);
    s.rect(X + 23, sf + 1, 3, 2, R.black[3]);
    disc(s, X + 24, sf + 14, 1.2, R.black[1]);
    box(s, X + 30, sf + 13, 12, 7, R.black);
    disc(s, X + 33, sf + 16.5, 2, R.grey[2]);
    disc(s, X + 39, sf + 16.5, 2, R.grey[2]);
    s.hline(X + 32, sf + 12, 8, R.grey[1]);
    s.line(X + 34, sf + 3, X + 37, sf + 10, R.gold[2]);
    s.line(X + 35, sf + 3, X + 38, sf + 10, R.gold[3]);
    s.rect(X + 36, sf + 10, 3, 2, R.gold[2]);
    box(s, X + 46, sf + 1, 14, 25, R.steel);
    s.rect(X + 48, sf + 3, 10, 10, '#2c2433');
    for (let i = X + 46; i < X + 60; i += 3) s.vline(i, sf + 1, 25, R.steel[0]);
    const nm = neonText(
      s,
      'Pawn',
      X + 3 + Math.floor((40 - measure('Pawn', 'black')) / 2),
      Y + 32,
      NEON.gold,
      'black',
    );
    fx.neon = neonOverlay(s, nm.pts, NEON.gold);
    s.vline(X + 45, Y + 32, 5, R.black[3]);
    s.hline(X + 45, Y + 33, 13, R.black[3]);
    s.line(X + 47, Y + 33, X + 50, Y + 31, R.black[2]);
    for (const [bx, by] of [
      [X + 49.5, Y + 38.5],
      [X + 56.5, Y + 38.5],
      [X + 53, Y + 43.5],
    ]) {
      s.vline(Math.round(bx), Y + 34, Math.round(by) - Y - 37, R.black[2]);
      sphere(s, bx, by, 2.6, R.gold, '#fff8d0');
    }
  } else {
    s.rect(X + 4, sf - 14, 40, 10, mix(R.tan[2], R.black[1], 0.35));
    for (const [bx, by] of [
      [X + 5, sf - 13],
      [X + 42, sf - 13],
      [X + 5, sf - 6],
      [X + 42, sf - 6],
    ])
      s.set(bx, by, R.black[3]);
    box(s, X + 1, sf, W - 2, 26, R.wood);
    for (let i = X + 15; i < X + W - 2; i += 15) {
      s.vline(i, sf, 26, R.wood[0]);
      s.vline(i + 1, sf, 26, R.wood[3]);
    }
    for (let k = 0; k < 40; k++)
      s.set(X + 2 + ri(0, W - 5), sf + 1 + ri(0, 23), rand() < 0.5 ? R.wood[1] : R.wood[3]);
    const tag = (x: number, y: number, col: string) => {
      let px = x,
        py = y;
      for (let k = 0; k < 14; k++) {
        const nx = px + 1,
          ny = py + ri(-1, 1);
        s.line(px, py, nx, Math.max(sf + 2, Math.min(sf + 24, ny)), col);
        px = nx;
        py = Math.max(sf + 2, Math.min(sf + 24, ny));
      }
    };
    tag(X + 3, sf + 20, '#ff5fa2');
    tag(X + 44, sf + 7, '#4fd8f0');
    tag(X + 40, sf + 21, R.white[3]);
    box(s, X + 15, sf + 6, 32, 13, R.paper);
    text(s, 'FOR LEASE', X + 31 - Math.floor(measure('FOR LEASE') / 2), sf + 8, R.red[2], 'tiny', {
      alignTop: true,
    });
    text(
      s,
      '555-0142',
      X + 31 - Math.floor(measure('555-0142', 'micro') / 2),
      sf + 13,
      R.paper[0],
      'micro',
      { alignTop: true },
    );
  }
  s.outline();
  return { id: 'pawn', name: 'Pawnshop', route: 'Pawnshop', x: 0, y: 0, s, w: W, h: HH, fx };
}

// ----- check cashing: the bank of the block, with the billboard on top -----
function checks(): Building {
  srand(41);
  const W = 58,
    HH = 50,
    s = pad(W, HH),
    X = 1,
    Y = 1,
    fx: any = { loans: [] };
  brickWall(s, X, Y, W, HH, R.concrete, { grime: 6 });
  cornice(s, X, Y, W, R.steel);
  s.rect(X + 2, Y + 5, W - 4, 21, R.steel[1]);
  s.rect(X + 3, Y + 6, W - 6, 19, '#1a1622');
  for (let j = Y + 6; j < Y + 25; j += 2) s.hline(X + 3, j, W - 6, '#221c2c');
  const lines = ['QUICK $200', 'STD $1,000', 'LONG $5,000'];
  lines.forEach((ln, k) => {
    const m = neonText(s, ln, X + Math.floor((W - measure(ln)) / 2), Y + 8 + k * 6, NEON.green);
    fx.loans.push(neonOverlay(s, m.pts, NEON.green));
  });
  s.hline(X + 1, Y + 26, W - 2, R.concrete[3]);
  s.hline(X + 1, Y + 27, W - 2, R.concrete[0]);
  box(s, X + 1, Y + 28, W - 2, 9, R.taxi);
  const sign = 'CHECKS CASHED';
  text(s, sign, X + Math.floor((W - measure(sign, 'micro')) / 2), Y + 30, R.red[1], 'micro', {
    alignTop: true,
  });
  const sf = Y + 38;
  box(s, X + 2, sf, 31, 12, R.black);
  s.rect(X + 3, sf + 1, 29, 10, '#d8d0a8');
  s.hline(X + 3, sf + 1, 29, '#f2ecd0');
  s.rect(X + 6, sf + 6, 6, 5, R.denim[1]);
  s.rect(X + 7, sf + 3, 4, 3, R.skinB[2]);
  s.rect(X + 17, sf + 2, 11, 6, R.paper[3]);
  s.hline(X + 18, sf + 3, 7, R.red[2]);
  s.hline(X + 18, sf + 5, 9, R.paper[0]);
  s.hline(X + 18, sf + 6, 6, R.paper[1]);
  s.hline(X + 3, sf + 8, 29, R.wood[2]);
  for (let i = X + 4; i < X + 32; i += 3) s.vline(i, sf + 1, 10, R.black[2]);
  box(s, X + 35, sf - 1, 21, 13, R.steel);
  s.rect(X + 37, sf + 1, 17, 7, R.glass[2]);
  reflect(s, X + 37, sf + 1, 17, 7, R.glass);
  const om = neonText(
    s,
    'OPEN',
    X + 37 + Math.floor((17 - measure('OPEN', 'micro')) / 2),
    sf + 2,
    NEON.red,
    'micro',
  );
  fx.open = neonOverlay(s, om.pts, NEON.red);
  s.hline(X + 35, Y + HH - 1, 21, R.concrete[3]);
  s.outline();
  return {
    id: 'bank',
    name: 'Checks cashed',
    route: 'Bank and transfers',
    x: 0,
    y: 0,
    s,
    w: W,
    h: HH,
    fx,
  };
}

// A small kicker line over one big line keeps the board narrow enough to stand on the two
// low roofs (bank and card room) without touching the auction hall or the pawnshop.
const BILL = {
  kick: 'EVERYBODY STARTS',
  big: 'WITH $300.',
  tag: 'BID. FLIP. REPEAT.',
  PH: 44,
  Y: 4,
};
function billboardWidth() {
  return Math.max(measure(BILL.kick), measure(BILL.big, 'jersey'), measure(BILL.tag)) + 16;
}
function billboard(legs: { x: number; len: number }[]): Billboard {
  srand(5);
  const { kick, big, tag, PH, Y } = BILL,
    W = billboardWidth(),
    X = 1;
  const longest = Math.max(...legs.map((l) => l.len)),
    s = new Sprite(W + 2, Y + PH + longest + 1);
  for (const l of legs) {
    s.vline(X + l.x, Y + PH, l.len, R.black[3]);
    s.vline(X + l.x + 1, Y + PH, l.len, R.black[1]);
  }
  for (let k = 0; k + 1 < legs.length; k++) {
    const a = legs[k],
      b = legs[k + 1],
      drop = Math.min(a.len, b.len) - 4;
    s.line(X + a.x + 1, Y + PH + 2, X + b.x, Y + PH + drop, R.black[2]);
    s.line(X + b.x, Y + PH + 2, X + a.x + 1, Y + PH + drop, R.black[2]);
  }
  s.hline(X, Y + PH + 1, W, R.black[3]);
  s.hline(X, Y + PH + 2, W, R.black[1]);
  for (let i = X + 2; i < X + W - 2; i += 4) s.vline(i, Y + PH - 1, 3, R.black[2]);
  box(s, X, Y, W, PH, R.steel);
  const px = X + 2,
    py = Y + 2,
    pw = W - 4,
    ph = PH - 4;
  s.rect(px, py, pw, ph, R.paper[3]);
  for (let j = 0; j < ph; j++)
    for (let i = 0; i < pw; i++)
      if (bayer(px + i, py + j) < 0.12 + 0.3 * (j / ph) && rand() < 0.5)
        s.set(px + i, py + j, R.paper[2]);
  s.rect(px, py + ph - 9, pw, 9, R.red[2]);
  s.hline(px, py + ph - 9, pw, R.red[3]);
  text(s, kick, px + Math.floor((pw - measure(kick)) / 2), py + 3, R.black[3], 'tiny', {
    alignTop: true,
  });
  text(
    s,
    big,
    px + Math.floor((pw - measure(big, 'jersey')) / 2),
    py + 11,
    (x, y) => (y < 2 ? R.red[3] : R.red[2]),
    'jersey',
    { alignTop: true, shadow: R.paper[1] },
  );
  text(s, tag, px + Math.floor((pw - measure(tag)) / 2), py + ph - 7, R.paper[3], 'tiny', {
    alignTop: true,
  });
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 6 - j; i++)
      s.set(px + pw - 1 - i, py + j, i === 5 - j ? R.paper[1] : R.steel[2]);
  for (let k = 0; k < 4; k++) {
    const sx = px + ri(4, pw - 5);
    for (let j = 0; j < ri(3, 7); j++) if (rand() < 0.7) s.set(sx, py + ph - 9 - j, R.paper[2]);
  }
  for (const lx of [X + 14, X + W - 16]) {
    s.vline(lx, Y - 3, 3, R.black[3]);
    s.hline(lx - 2, Y - 4, 5, R.black[3]);
    s.set(lx - 2, Y - 3, '#ffd28a');
    s.set(lx + 2, Y - 3, '#ffd28a');
  }
  s.outline();
  return { s, w: W, h: Y + PH + longest, x: 0, y: 0 };
}

// ----- card room: the casino of the block -----
function cardRoom(): Building {
  srand(53);
  const W = 60,
    HH = 52,
    s = pad(W, HH),
    X = 1,
    Y = 1,
    fx: any = {};
  brickWall(s, X, Y, W, HH, R.plum, { grime: 6 });
  cornice(s, X, Y, W, R.purple);
  const cm = neonText(
    s,
    'CARDS',
    X + Math.floor((W - measure('CARDS', 'jersey')) / 2),
    Y + 6,
    NEON.pink,
    'jersey',
  );
  fx.cards = neonOverlay(s, cm.pts, NEON.pink);
  const om = neonText(
    s,
    'OPEN 24 HRS',
    X + Math.floor((W - measure('OPEN 24 HRS')) / 2),
    Y + 23,
    NEON.amber,
  );
  const dead = om.pts.filter(
    ([x]) =>
      x >= X + Math.floor((W - measure('OPEN 24 HRS')) / 2) + measure('OPEN 24 H') &&
      x < X + Math.floor((W - measure('OPEN 24 HRS')) / 2) + measure('OPEN 24 HR'),
  );
  const alive = om.pts.filter((p) => !dead.includes(p));
  for (const [x, y] of dead) s.set(x, y, mix(NEON.amber.mid, R.plum[1], 0.5));
  fx.hours = neonOverlay(s, alive, NEON.amber);
  fx.hoursDead = neonOverlay(s, dead, NEON.amber);
  for (const [x, y] of dead) fx.hours.set(x, y, null);
  const gy = Y + 30;
  s.rect(X + 19, gy - 1, 22, 3, R.red[2]);
  for (let i = X + 19; i < X + 41; i += 2) s.set(i, gy + 2, R.red[1]);
  s.hline(X + 19, gy - 1, 22, R.red[3]);
  box(s, X + 24, gy + 3, 12, 19, R.red);
  s.rect(X + 26, gy + 6, 8, 2, R.black[1]);
  s.set(X + 33, gy + 13, R.gold[3]);
  s.rect(X + 26, gy + 9, 8, 11, R.red[1]);
  s.hline(X + 26, gy + 9, 8, R.red[3]);
  for (const wx of [X + 4, X + 42]) {
    box(s, wx, gy + 4, 14, 12, R.black);
    s.rect(wx + 1, gy + 5, 12, 10, '#140f1a');
  }
  const dice: [number, number][] = [];
  const die = (x: number, y: number) => {
    for (let i = 0; i < 6; i++) {
      dice.push([x + i, y], [x + i, y + 5]);
    }
    for (let j = 1; j < 5; j++) {
      dice.push([x, y + j], [x + 5, y + j]);
    }
  };
  die(X + 6, gy + 7);
  die(X + 10, gy + 9);
  const dPts = dice.filter((p, i, a) => a.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i);
  for (const [x, y] of dPts) s.set(x, y, NEON.cyan.dim);
  fx.dice = neonOverlay(s, dPts, NEON.cyan);
  const tm = neonText(s, '21', X + 46, gy + 7, NEON.red, 'tiny');
  fx.bj = neonOverlay(s, tm.pts, NEON.red);
  s.hline(X + 22, Y + HH - 1, 16, R.concrete[3]);
  s.outline();
  return { id: 'casino', name: 'Card room', route: 'Casino', x: 0, y: 0, s, w: W, h: HH, fx };
}

// ----- storage yard: the warehouse wars behind a chain-link fence -----
function storage(): Building {
  srand(61);
  const W = 82,
    HH = 76,
    s = pad(W, HH),
    X = 1,
    Y = 1,
    fx: any = {};
  const by = Y + 48;
  box(s, X, by, W, 2, R.steel);
  s.rect(X, by + 2, W, HH - 50, R.steel[2]);
  s.vline(X, by + 2, HH - 50, R.steel[3]);
  s.vline(X + W - 1, by + 2, HH - 50, R.steel[0]);
  const doors = [X + 5, X + 31, X + 57];
  doors.forEach((dx, k) => {
    text(s, '0' + (7 + k), dx + 7, by + 3, R.white[3], 'tiny', { alignTop: true });
    const dy = by + 9,
      dh = HH - 57;
    s.rect(dx - 1, dy - 1, 22, dh + 1, R.steel[0]);
    const openRows = k === 1 ? 10 : dh;
    for (let j = 0; j < openRows; j++) s.hline(dx, dy + j, 20, R.rust[[3, 2, 1][j % 3]]);
    if (k === 1) {
      s.rect(dx, dy + openRows, 20, dh - openRows, R.black[0]);
      box(s, dx + 2, dy + 13, 6, 6, R.wood);
      box(s, dx + 3, dy + 9, 5, 4, R.wood);
      s.vline(dx + 13, dy + 12, 7, R.grey[1]);
      s.rect(dx + 11, dy + 11, 5, 2, R.lit[1]);
      shape(s, (i, j) => (i - (dx + 17)) ** 2 + (j - (dy + 17)) ** 2 <= 5, R.olive, {
        x0: dx + 14,
        y0: dy + 14,
        x1: dx + 20,
        y1: dy + 20,
      });
      s.hline(dx, dy + openRows, 20, R.rust[0]);
      fx.openDoor = { x: dx, y: dy + openRows, w: 20, h: dh - openRows };
    } else {
      s.rect(dx + 9, dy + dh - 3, 3, 3, R.gold[2]);
      s.set(dx + 9, dy + dh - 3, R.gold[3]);
    }
  });
  const fy = by + 4;
  for (let j = fy; j < Y + HH; j++)
    for (let i = X; i < X + W; i++)
      if ((i + j) % 6 === 0 || (i - j + 600) % 6 === 0)
        s.set(i, j, (i + j) % 12 === 0 ? R.grey[3] : R.grey[2]);
  s.hline(X, fy, W, R.grey[3]);
  s.hline(X, fy + 1, W, R.grey[1]);
  for (let i = X; i < X + W; i += 20) {
    s.vline(i, fy - 1, HH - 51, R.grey[3]);
    s.vline(i + 1, fy - 1, HH - 51, R.grey[1]);
  }
  for (let i = X + 1; i < X + W - 2; i += 3) {
    s.set(i, fy - 2, R.grey[3]);
    s.set(i + 1, fy - 3, R.grey[2]);
    s.set(i + 2, fy - 2, R.grey[1]);
    s.set(i + 1, fy - 1, R.grey[2]);
  }
  box(s, X + 15, fy + 6, 52, 14, R.paper);
  text(s, 'SMALL WAR', X + 41 - Math.floor(measure('SMALL WAR') / 2), fy + 8, R.red[2], 'tiny', {
    alignTop: true,
  });
  text(
    s,
    'ENTRY $500',
    X + 41 - Math.floor(measure('ENTRY $500', 'micro') / 2),
    fy + 13,
    INK,
    'micro',
    { alignTop: true },
  );
  s.rect(X + 40, fy + 21, 3, 3, R.gold[2]);
  s.set(X + 41, fy + 20, R.grey[3]);
  s.set(X + 40, fy + 21, R.gold[3]);
  cylV(s, X + 65, Y + 14, 3, by - Y - 14, R.steel);
  box(s, X + 46, Y, 36, 15, R.rust);
  s.rect(X + 48, Y + 2, 32, 11, R.rust[1]);
  text(s, 'SELF', X + 64 - Math.floor(measure('SELF') / 2), Y + 2, R.white[3], 'tiny', {
    alignTop: true,
  });
  text(s, 'STORAGE', X + 64 - Math.floor(measure('STORAGE') / 2), Y + 8, R.white[3], 'tiny', {
    alignTop: true,
  });
  s.hline(X + 60, Y + 22, 5, R.black[3]);
  box(s, X + 58, Y + 21, 3, 3, R.steel);
  fx.lamp = { x: X + 59, y: Y + 24 };
  s.outline();
  return {
    id: 'storage',
    name: 'Storage yard',
    route: 'Warehouses',
    x: 0,
    y: 0,
    s,
    w: W,
    h: HH,
    fx,
  };
}

function filler(seedN: number, w: number, h: number, ramp: Ramp) {
  srand(seedN);
  const s = pad(w, h),
    X = 1,
    Y = 1;
  brickWall(s, X, Y, w, h, ramp, { grime: 8 });
  cornice(s, X, Y, w);
  for (let fy = Y + 8; fy < Y + h - 26; fy += 18)
    for (let fx = X + 5; fx < X + w - 10; fx += 14) win(s, fx, fy, 8, 11, { lit: rand() < 0.25 });
  const sf = Y + h - 20;
  box(s, X + 2, sf, w - 4, 4, ramp === R.tan ? R.green : R.red);
  box(s, X + 4, sf + 5, w - 18, 15, R.black);
  s.rect(X + 5, sf + 6, w - 20, 13, R.glass[1]);
  reflect(s, X + 5, sf + 6, w - 20, 13, R.glass);
  for (let i = X + 5; i < X + w - 15; i += 4) s.vline(i, sf + 6, 13, R.steel[1]);
  box(s, X + w - 12, sf + 5, 9, 15, R.wood);
  s.outline();
  return { s, w, h };
}

function sky(W: number) {
  srand(3);
  const s = new Sprite(W, GROUND);
  const bands = [
    '#151129',
    '#1d1636',
    '#271b45',
    '#36214f',
    '#4a2856',
    '#62305a',
    '#7e3b5c',
    '#9c4a5b',
    '#b85c55',
    '#cc7450',
  ];
  const top = 0,
    span = GROUND - 22;
  for (let y = 0; y < GROUND; y++) {
    const f = Math.min(bands.length - 1.001, ((y - top) / span) * (bands.length - 1)),
      b = Math.floor(f),
      frac = f - b;
    const t = Math.max(0, (frac - 0.55) / 0.45);
    for (let x = 0; x < W; x++) s.set(x, y, bayer(x, y) < t ? bands[b + 1] : bands[b]);
  }
  for (let k = 0; k < W / 9; k++)
    s.set(ri(0, W - 1), ri(0, 34), rand() < 0.3 ? '#efe6ff' : '#8f86b8');
  const sx = W * 0.83,
    sy = 112;
  for (let y = sy - 22; y < sy + 22; y++)
    for (let x = sx - 22; x < sx + 22; x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d < 14) s.set(x, y, d < 11 ? '#f2b06a' : '#e39060');
      else if (d < 19 && bayer(x, y) < (19 - d) / 10)
        s.set(x, y, mix(s.get(x, y) || '#cc7450', '#e39060', 0.5));
    }
  return s;
}
function skyline(W: number, s: Sprite) {
  srand(7);
  const layer = (
    col: string,
    winDim: string,
    winLit: string,
    hMin: number,
    hMax: number,
    litP: number,
    base: number,
  ) => {
    let x = -4;
    while (x < W) {
      const w = ri(10, 28),
        h = ri(hMin, hMax),
        top = base - h;
      for (let j = top; j < base; j++) for (let i = x; i < x + w; i++) s.set(i, j, col);
      if (rand() < 0.35) {
        const sw = Math.max(3, Math.floor(w / 3));
        for (let j = top - ri(4, 9); j < top; j++)
          for (let i = x + Math.floor((w - sw) / 2); i < x + Math.floor((w + sw) / 2); i++)
            s.set(i, j, col);
      }
      if (rand() < 0.25) s.vline(x + ri(2, w - 3), top - ri(6, 14), 14, col);
      if (rand() < 0.3) {
        const tx = x + ri(2, Math.max(2, w - 8));
        for (let j = 0; j < 6; j++) s.hline(tx, top - 8 + j, 6, col);
        s.hline(tx + 1, top - 9, 4, col);
        s.vline(tx + 1, top - 2, 2, col);
        s.vline(tx + 4, top - 2, 2, col);
      }
      for (let j = top + 3; j < base - 2; j += 4)
        for (let i = x + 2; i < x + w - 2; i += 3) {
          const r = rand();
          if (r < litP) s.set(i, j, winLit);
          else if (r < 0.32) s.set(i, j, winDim);
        }
      x += w + ri(-2, 3);
    }
  };
  layer('#2a2240', '#352c4e', '#b98a52', 46, 104, 0.05, GROUND);
  layer('#382b4c', '#43355a', '#d4a25e', 22, 62, 0.07, GROUND);
}

function street(W: number) {
  srand(17);
  const s = new Sprite(W, H - GROUND);
  s.hline(0, 0, W, R.concrete[0]);
  for (let y = 1; y < 14; y++)
    for (let x = 0; x < W; x++) s.set(x, y, y < 3 ? R.concrete[1] : R.concrete[2]);
  for (let x = 0; x < W; x++) {
    if (rand() < 0.1) s.set(x, ri(3, 13), R.concrete[3]);
    if (rand() < 0.04) s.set(x, ri(3, 13), R.concrete[1]);
  }
  for (let x = 7; x < W; x += 18)
    for (let y = 3; y < 14; y++) s.set(x + (y > 8 ? 1 : 0), y, R.concrete[1]);
  for (let k = 0; k < W / 14; k++) s.set(ri(0, W - 1), ri(4, 13), '#2a2530');
  for (let k = 0; k < W / 40; k++) {
    const x = ri(0, W - 6),
      y = ri(4, 11);
    s.line(x, y, x + ri(2, 5), y + ri(0, 2), R.concrete[1]);
  }
  s.hline(0, 14, W, R.concrete[3]);
  s.hline(0, 15, W, R.concrete[2]);
  s.hline(0, 16, W, R.concrete[1]);
  for (let y = 17; y < 40; y++)
    for (let x = 0; x < W; x++) {
      let c = R.asphalt[1];
      if (y === 17) c = R.asphalt[0];
      else if (bayer(x * 3, y * 5) < 0.12 && rand() < 0.6) c = R.asphalt[2];
      else if (rand() < 0.03) c = R.asphalt[0];
      s.set(x, y, c);
    }
  for (let x = 0; x < W; x++)
    if (x % 16 < 8)
      s.set(x, 28, bayer(x, 28) < 0.75 ? mix(R.taxi[1], R.asphalt[1], 0.35) : R.asphalt[2]);
  for (let k = 0; k < 6; k++) {
    let x = ri(0, W),
      y = ri(19, 38);
    for (let i = 0; i < ri(20, 60); i++) {
      s.set(x + i, y, R.asphalt[0]);
      if (rand() < 0.2) y += rand() < 0.5 ? -1 : 1;
      y = Math.max(18, Math.min(39, y));
    }
  }
  const mx = Math.floor(W * 0.62);
  for (let i = -6; i <= 6; i++)
    for (let j = -2; j <= 2; j++)
      if ((i * i) / 36 + (j * j) / 4.5 <= 1)
        s.set(mx + i, 34 + j, (Math.abs(i) + j) % 2 ? R.black[2] : R.black[3]);
  s.hline(0, 40, W, R.concrete[3]);
  s.hline(0, 41, W, R.concrete[2]);
  return { s, manhole: { x: mx, y: GROUND + 33 } };
}

function lamp() {
  const s = new Sprite(18, 64);
  cylV(s, 3, 6, 3, 58, R.steel);
  box(s, 2, 58, 5, 6, R.steel);
  s.line(4, 6, 8, 3, R.steel[2]);
  s.line(4, 7, 8, 4, R.steel[1]);
  s.hline(8, 3, 4, R.steel[2]);
  box(s, 10, 2, 7, 3, R.steel);
  s.hline(11, 5, 5, '#ffe1a0');
  s.hline(12, 6, 3, '#ffc860');
  s.outline({ skip: new Set(['#ffe1a0', '#ffc860']) });
  return { s, head: { x: 13, y: 6 } };
}
function hydrant() {
  const s = new Sprite(9, 11);
  box(s, 2, 3, 5, 7, R.red);
  sphere(s, 4.5, 3, 2.5, R.red);
  s.rect(1, 5, 7, 2, R.red[2]);
  s.hline(1, 5, 7, R.red[3]);
  s.rect(2, 9, 5, 1, R.red[1]);
  return s.outline();
}
function payphone() {
  const s = new Sprite(12, 26);
  cylV(s, 5, 10, 2, 16, R.steel);
  box(s, 1, 0, 10, 12, R.steel);
  s.rect(3, 2, 6, 3, R.glass[2]);
  s.rect(3, 6, 4, 4, R.black[3]);
  for (let j = 6; j < 10; j += 2) for (let i = 3; i < 7; i += 2) s.set(i, j, R.white[2]);
  s.vline(8, 5, 5, R.black[2]);
  s.rect(8, 5, 2, 2, R.black[2]);
  return s.outline();
}
function newsBox() {
  const s = new Sprite(10, 13);
  box(s, 1, 1, 8, 9, R.denim);
  s.rect(2, 3, 6, 3, R.paper[3]);
  s.hline(2, 4, 6, R.paper[1]);
  s.rect(2, 7, 6, 1, R.taxi[2]);
  s.vline(2, 10, 3, R.black[2]);
  s.vline(7, 10, 3, R.black[2]);
  return s.outline();
}
function trashCan() {
  const s = new Sprite(11, 14);
  for (let j = 3; j < 13; j++)
    for (let i = 1; i < 10; i++)
      if ((i + j) % 2 === 0 || j === 3 || j === 12) s.set(i, j, j === 3 ? R.grey[3] : R.grey[2]);
  shape(s, (i, j) => (i - 5) ** 2 / 14 + (j - 2.5) ** 2 / 5 <= 1, R.black, {
    x0: 0,
    y0: 0,
    x1: 11,
    y1: 6,
  });
  s.set(4, 1, R.paper[3]);
  s.set(7, 2, R.paper[2]);
  return s.outline();
}

function compose(turnover: number) {
  const W = WORLD,
    bg = new Sprite(W, H);
  bg.stamp(sky(W), 0, 0);
  skyline(W, bg);
  const fill = [
    filler(91, 56, 78, R.brick),
    filler(92, 54, 66, R.tan),
    filler(93, 58, 84, R.mauve),
    filler(94, 52, 70, R.brick),
  ];
  const place = (sp: Sprite, x: number, h: number) => bg.stamp(sp, x - 1, GROUND - h - 1);
  place(fill[0].s, CORE_X - 110, 78);
  place(fill[1].s, CORE_X - 54, 66);
  place(fill[2].s, CORE_X + CORE, 84);
  place(fill[3].s, CORE_X + CORE + 58, 70);
  const order = [tenement(), auctionHall(), null, checks(), cardRoom(), storage()];
  const pawnBoarded = pawnshop(false),
    pawnOpen = pawnshop(true);
  const widths = [70, 88, 62, 58, 60, 82];
  let x = CORE_X;
  const buildings: Building[] = [];
  widths.forEach((w, k) => {
    const b = order[k] || pawnBoarded;
    b.x = x;
    b.y = GROUND - b.h;
    if (k === 2) {
      b.open = pawnOpen;
    }
    buildings.push(b);
    x += w;
  });
  const bank = buildings[3],
    card = buildings[4],
    bw = billboardWidth(),
    boardLeft = bank.x + 3,
    bottom = 64;
  const roofAt = (x: number) => (x < card.x ? bank.y : card.y);
  const legs = [10, Math.floor(bw / 2) - 1, bw - 13].map((x) => ({
    x,
    len: roofAt(boardLeft + x) - bottom,
  }));
  const bill = billboard(legs);
  bill.x = boardLeft - 1;
  bill.y = bottom - BILL.Y - BILL.PH;
  bg.stamp(bill.s, bill.x, bill.y);
  for (const b of buildings) if (b.id !== 'pawn') bg.stamp(b.s, b.x - 1, b.y - 1);
  const st = street(W);
  bg.stamp(st.s, 0, GROUND);
  const lampS = lamp(),
    lamps = [CORE_X + 66, CORE_X + 216, CORE_X + 334, CORE_X - 60, CORE_X + CORE + 64];
  const glow = (cx: number, cy: number, rx: number, ry: number, strength: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d > 1 || !bg.in(x, y)) continue;
        const t = 1 - d;
        if (d < 0.45 || bayer(x, y) < t * 1.6)
          bg.set(x, y, mix(bg.get(x, y)!, '#ffe2a8', strength * 0.38));
      }
  };
  const fg = new Sprite(W, H);
  for (const lx of lamps) {
    glow(lx + 13, GROUND + 9, 22, 8, 0.55);
    glow(lx + 13, GROUND - 14, 12, 18, 0.25);
    fg.stamp(lampS.s, lx, GROUND + 15 - 63);
  }
  const props: [Sprite, number, number][] = [
    [hydrant(), CORE_X + 128, GROUND + 3],
    [payphone(), CORE_X + 148, GROUND - 12],
    [newsBox(), CORE_X + 300, GROUND + 1],
    [trashCan(), CORE_X + 266, GROUND],
  ];
  for (const [sp, px, py] of props) fg.stamp(sp, px, py);
  return {
    bg,
    fg,
    buildings,
    billboard: bill,
    manhole: st.manhole,
    lamps: lamps.map((l) => ({ x: l + 13, y: GROUND - 57 })),
    W,
    H,
    GROUND,
  };
}

export type { BuildingId, Building };
export {
  compose,
  GROUND,
  H,
  WORLD,
  CORE,
  CORE_X,
  NEON,
  neonOverlay,
  neonText,
  brickWall,
  streaks,
  cornice,
  win,
  street,
  trashCan,
};
