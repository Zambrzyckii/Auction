// The pawnshop as one side-view cross-section, 480x200 art px, on the shared room base of the
// casino and the bank. Left the tan-brick front from city.ts at dusk, then the cut wall, then
// the shop dressed as an attic. Round two: the front is weathered instead of labelled, the
// signs are painted or mounted objects, and all light follows one logic. Locked, cold dusk
// light falls through the round window and two roof gaps as soft stepped beams. Open, the
// bare bulb takes over. Beams are baked as flat masks that pawn.js blends at fixed alphas,
// so the steps stay crisp at every scale and nothing is dithered.
import {
  INK,
  R,
  Sprite,
  box,
  disc,
  glyphMask,
  measure,
  mix,
  ri,
  shape,
  sphere,
  srand,
  text,
} from '../street/pix';
import type { Ramp } from '../street/pix';
import { brick, bulbOn, rotate, squeeze } from '../bank/sprites';

type Pt = [number, number];
export const W = 480,
  H = 200;
const cv = (s: Sprite) => s.canvas();

export const L = {
  floorY: 194,
  counterTop: 120,
  counterBottom: 176,
  cut: 118,
  inside: 128,
  sign: { x: 8, y: 5, w: 104, h: 15 },
  uppers: [
    [14, 25],
    [80, 25],
  ] as Pt[],
  window: { x: 6, y: 62, w: 54, h: 90 },
  door: { x: 66, y: 58, w: 44, h: 118 },
  balls: { x: 104, y: 40 },
  neon: { x: 4, y: 40 },
  counter: { x: 178, w: 144 },
  flap: { x: 178, w: 10 },
  shelf: { x: 246, w: 156, rows: [40, 69], pitch: 26 },
  register: { x: 272, y: 99 },
  nextSign: { x: 198, y: 132, w: 74 },
  board: { x: 408, y: 48, w: 70, h: 94 },
  bulb: { x: 198, y: 27, cordY: 94 },
  round: { x: 158, y: 46, r: 9 },
  clock: { x: 328, y: 104 },
  spiderX: 356,
  tie: 28,
  // the chain runs from an eye bolt on the left jamb to the hasp staple on the right jamb
  eye: { x: 64, y: 115 },
  staple: { x: 111, y: 119 },
  heap: { x: 104, y: 175 },
};
// youDoor: where he stands with the key, his hand reaches the padlock on the right jamb.
// youOwner: his corner after the opening, between the clock and the board.
export const A = {
  buddy: { x: 182, y: 60 },
  you: 22,
  youDoor: 70,
  youOwner: 366,
  cust: 132,
  swap: 150,
  doorX: 88,
  youKick: 62,
  youBulb: 172,
};

const WOOD_D = ['#1e140f', '#33231a', '#4a3424', '#62482f'];
const WALL = ['#2a2228', '#3a3036', '#4a3e42', '#5e5054'];
const PLANK = ['#29211d', '#463b33', '#655749', '#84765f'];
const DOOR = ['#271c17', '#43322a', '#5c4639', '#765d4a'];
export const CLOTH = ['#4c463e', '#7a7262', '#a0977f', '#c2b9a2'];
export const DUSTC = '#d3cab3';

// Deterministic hash, so the weathering lands in the same place on every build.
const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const stepOf = (v: number, n: number) => Math.max(0, Math.min(n, Math.floor(v * n))) / n;

// ----- hand-made painted letters, 2 px strokes, 9 rows. No UI font on brick or paper. -----
const BIG: Record<string, string[]> = {
  P: ['#####.', '##..##', '##..##', '##..##', '#####.', '##....', '##....', '##....', '##....'],
  A: ['.####.', '##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##', '##..##'],
  W: [
    '##...##',
    '##...##',
    '##...##',
    '##.#.##',
    '##.#.##',
    '##.#.##',
    '#######',
    '###.###',
    '##...##',
  ],
  N: [
    '##...##',
    '###..##',
    '####.##',
    '##.####',
    '##..###',
    '##...##',
    '##...##',
    '##...##',
    '##...##',
  ],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '##....', '######', '######'],
  O: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  '&': [
    '.###...',
    '##.##..',
    '##.##..',
    '.###...',
    '.###.##',
    '##.###.',
    '##..##.',
    '##.####',
    '.###.##',
  ],
};
// tiny 3x5 hand letters for the paper notice
const SMALL: Record<string, string[]> = {
  F: ['###', '#..', '##.', '#..', '#..'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  E: ['###', '#..', '##.', '#..', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  5: ['###', '#..', '##.', '..#', '##.'],
  0: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  1: ['.#', '##', '.#', '.#', '.#'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  '-': ['..', '..', '##', '..', '..'],
};
function letters(font: Record<string, string[]>, str: string, gap: number, space: number) {
  const pts: Pt[] = [];
  let x = 0;
  for (const ch of str) {
    if (ch === ' ') {
      x += space;
      continue;
    }
    const g = font[ch];
    g.forEach((row, j) =>
      [...row].forEach((c, i) => {
        if (c === '#') pts.push([x + i, j]);
      }),
    );
    x += g[0].length + gap;
  }
  return { pts, w: x - gap };
}

// ----- the street front -----
function weatherBrick(s: Sprite) {
  for (let y = 0; y < 176; y++)
    for (let x = 0; x < L.cut; x++) {
      const row = Math.floor(y / 5),
        off = row % 2 ? 6 : 0,
        col = Math.floor((x + off) / 12),
        r = hash(row, col);
      let c = s.get(x, y)!;
      if (r < 0.1) c = mix(c, R.tan[1], 0.35);
      else if (r > 0.93) c = mix(c, R.tan[3], 0.25);
      // soot climbs from the cornice down, stepped per brick so it never reads as a gradient sheet
      const soot = stepOf(Math.max(0, (70 - y) / 70) * 0.75 + r * 0.18, 4) * 0.42;
      if (soot) c = mix(c, '#2a1c26', soot);
      // grime splashes up from the sidewalk
      const grime = stepOf(Math.max(0, (y - 146) / 30) * 0.8 + r * 0.12, 3) * 0.4;
      if (grime) c = mix(c, '#33261c', grime);
      s.set(x, y, mix(c, '#241c34', 0.12));
    }
  // chipped bricks: a corner knocked out to the mortar, a pale broken edge
  for (const [x, y] of [
    [3, 51],
    [44, 13],
    [97, 22],
    [62, 46],
    [27, 158],
    [100, 160],
    [112, 92],
    [4, 118],
  ]) {
    s.rect(x, y, 3, 2, R.tan[0]);
    s.set(x + 3, y, mix(R.tan[3], '#e0d4c0', 0.2));
    s.set(x, y + 2, mix(R.tan[3], '#e0d4c0', 0.2));
    s.set(x + 1, y + 1, '#2a1c1a');
  }
  // water streaks running down under the sills
  const streak = (x: number, y: number, len: number) => {
    for (let j = 0; j < len; j++) {
      const c = s.get(x, y + j);
      if (c) s.set(x, y + j, mix(c, '#22181a', j < len * 0.55 ? 0.3 : 0.16));
    }
  };
  for (const [x, y, len] of [
    [17, 44, 14],
    [22, 44, 8],
    [35, 44, 11],
    [84, 44, 9],
    [93, 44, 15],
    [101, 44, 6],
    [9, 156, 12],
    [30, 156, 7],
    [52, 156, 14],
    [58, 156, 5],
  ])
    streak(x, y, len);
}
function ghostSign(s: Sprite) {
  const sg = L.sign,
    m = letters(BIG, 'PAWN & LOAN', 2, 5),
    gx = sg.x + Math.floor((sg.w - m.w) / 2),
    gy = sg.y + 3;
  // the old painted panel, oxblood gone brown, flaked off in patches
  for (let y = sg.y; y < sg.y + sg.h; y++)
    for (let x = sg.x; x < sg.x + sg.w; x++) {
      if (hash(x >> 1, y >> 1) < 0.16) continue;
      const c = s.get(x, y)!;
      s.set(x, y, mix(c, '#4a2620', 0.3));
    }
  for (const [px, py] of m.pts) {
    const x = gx + px,
      y = gy + py;
    if (hash((x * 3) >> 1, (y * 5) >> 1) < 0.13) continue;
    s.set(x, y, mix(s.get(x, y)!, '#d8ccb2', y % 5 === 4 ? 0.32 : 0.5));
  }
}
function street(s: Sprite) {
  s.rect(0, 0, L.inside, H, '#1a1424');
  brick(s, 0, 0, L.cut, 176, R.tan, { grime: 0, seed: 37 });
  weatherBrick(s);
  ghostSign(s);
  box(s, 0, 0, L.cut, 3, R.concrete, { band: 1 });
  s.hline(0, 3, L.cut, '#1e1820');
  // upper windows: stone sills, dark glass, the boards or the light are overlays
  for (const [x, y] of L.uppers) {
    box(s, x - 1, y - 1, 26, 18, R.concrete, { band: 1 });
    s.rect(x, y, 24, 16, '#141020');
    s.vline(x + 12, y, 16, R.concrete[1]);
    box(s, x - 3, y + 17, 30, 2, R.concrete, { band: 1 });
  }
  // display window: frame, glass, the goods behind it, and a stone sill
  const w = L.window;
  box(s, w.x - 2, w.y - 2, w.w + 4, w.h + 4, R.black, { band: 1 });
  s.rect(w.x, w.y, w.w, w.h, '#231d2b');
  for (let k = 0; k < 3; k++)
    s.line(w.x + 6 + k * 2, w.y + 34, w.x + 26 + k * 2, w.y + 2, '#2c2536');
  s.rect(w.x, w.y + 68, w.w, 3, R.wood[2]);
  s.hline(w.x, w.y + 71, w.w, R.wood[1]);
  box(s, w.x + 3, w.y + 48, 20, 20, R.black, { band: 1 });
  s.rect(w.x + 5, w.y + 50, 16, 12, '#4a6a78');
  s.hline(w.x + 5, w.y + 50, 16, '#6a8a96');
  s.line(w.x + 9, w.y + 47, w.x + 6, w.y + 40, R.grey[2]);
  s.line(w.x + 15, w.y + 47, w.x + 19, w.y + 41, R.grey[2]);
  shape(
    s,
    (i, j) =>
      ((i + 0.5 - w.x - 34) / 6) ** 2 + ((j + 0.5 - w.y - 60) / 7) ** 2 <= 1 ||
      (i >= w.x + 33 && i < w.x + 36 && j >= w.y + 22 && j < w.y + 55),
    R.rust,
    { band: 1 },
  );
  disc(s, w.x + 34, w.y + 59, 2, '#1a1020');
  s.rect(w.x + 32, w.y + 19, 5, 4, R.wood[1]);
  box(s, w.x + 40, w.y + 56, 13, 12, R.grey, { band: 1 });
  disc(s, w.x + 43, w.y + 63, 2.4, INK);
  disc(s, w.x + 50, w.y + 63, 2.4, INK);
  s.rect(w.x + 43, w.y + 57, 7, 3, R.steel[1]);
  for (let i = 0; i < 18; i++)
    s.set(
      w.x + 8 + i * 2,
      w.y + 14 + Math.round(Math.sin((i / 17) * Math.PI) * 9),
      i % 2 ? R.gold[1] : R.gold[2],
    );
  box(s, w.x - 4, w.y + w.h + 1, w.w + 8, 3, R.concrete, { band: 1 });
  // the doorway, recessed: a deep jamb, its shadow, a worn threshold
  const d = L.door;
  box(s, d.x - 3, d.y - 3, d.w + 6, d.h + 3, DOOR, { band: 1 });
  s.rect(d.x, d.y, d.w, d.h, '#0e0a10');
  s.rect(d.x - 3, d.y - 3, d.w + 6, 2, '#1a1216');
  box(s, d.x - 5, 174, d.w + 10, 3, R.concrete, { band: 1 });
  s.hline(d.x + 8, 174, 24, R.concrete[2]);
  // the eye bolt on the left jamb and the hasp staple on the right jamb
  s.rect(L.eye.x - 1, L.eye.y - 1, 3, 3, R.steel[0]);
  s.set(L.eye.x, L.eye.y, '#0e0a10');
  s.set(L.eye.x - 1, L.eye.y - 1, R.steel[2]);
  s.rect(L.staple.x - 1, L.staple.y - 2, 3, 4, R.steel[0]);
  s.set(L.staple.x, L.staple.y - 1, R.steel[2]);
  s.set(L.staple.x, L.staple.y + 2, R.rust[1]);
  s.set(L.staple.x, L.staple.y + 3, R.rust[0]);
  // the bracket that carries the three balls
  s.hline(L.balls.x - 2, L.balls.y, 14, R.black[3]);
  s.vline(L.balls.x + 11, L.balls.y - 4, 6, R.black[3]);
  // sidewalk slabs, cracks, the curb
  for (let y = 177; y < H; y++)
    for (let x = 0; x < L.inside; x++) {
      const seam = (x + Math.floor((y - 177) * 0.3)) % 22 === 0;
      let c = seam ? '#29252f' : '#38343f';
      if (!seam && hash(Math.floor((x + Math.floor((y - 177) * 0.3)) / 22), 7) < 0.3) c = '#34303b';
      if (y < 181) c = mix(c, '#1c1820', 0.35);
      s.set(x, y, c);
    }
  for (const [x0, y0, x1, y1] of [
    [14, 184, 22, 190],
    [22, 190, 25, 196],
    [76, 182, 81, 187],
    [40, 193, 47, 198],
  ])
    s.line(x0, y0, x1, y1, '#24202a');
  s.hline(0, 176, L.inside, '#18141e');
  // the cut through the wall
  box(s, L.cut, 0, L.inside - L.cut, 176, ['#2a2430', '#3e3646', '#564c5e', '#6e6276'], {
    band: 1,
  });
  brick(s, L.cut + 1, 34, L.inside - L.cut - 2, 140, R.tan, { seed: 8, grime: 0 });
  for (let y = 34; y < 174; y++)
    for (let x = L.cut + 1; x < L.inside - 1; x++) s.set(x, y, mix(s.get(x, y)!, '#1a1218', 0.45));
}

// ----- the attic -----
function skyOf(k: number) {
  if (k < 0.35) return '#5a5c7c';
  if (k < 0.7) return '#7c7c9a';
  return '#9a92a6';
}
function attic(s: Sprite) {
  const x0 = L.inside;
  s.rect(x0, 0, W - x0, 176, WALL[2]);
  s.rect(x0, 148, W - x0, 28, WALL[1]);
  s.hline(x0, 147, W - x0, WALL[3]);
  s.hline(x0, 148, W - x0, WALL[0]);
  for (let x = x0 + 9; x < W; x += 17) s.vline(x, 30, 117, WALL[1]);
  srand(21);
  for (let k = 0; k < 9; k++) {
    const x = x0 + ri(4, W - x0 - 4);
    s.vline(x, 30, ri(14, 60), WALL[1]);
  }
  // ceiling boards, a tie beam, rafters, the slanted roof corner
  for (let y = 0; y < L.tie; y++)
    for (let x = x0; x < W; x++) s.set(x, y, (x >> 4) % 2 ? WOOD_D[1] : WOOD_D[0]);
  for (let x = x0; x < W; x += 16) s.vline(x, 0, L.tie, INK);
  // two gaps between the roof boards, the dusk sky showing through
  for (const gx of [304]) {
    s.rect(gx, 0, 2, L.tie - 4, '#7c82a4');
    s.vline(gx, 0, L.tie - 4, '#565a7a');
  }
  box(s, x0, L.tie - 4, W - x0, 5, R.wood, { band: 1 });
  for (const rx of [176, 290]) {
    shape(
      s,
      (i, j) => j >= 0 && j < L.tie - 4 && Math.abs(i - rx - (L.tie - 4 - j) * 0.9) < 3,
      R.wood,
      { band: 1 },
    );
  }
  shape(s, (i, j) => i >= 396 && j < (i - 396) * 0.8 + 2 && j >= 0, WOOD_D, { band: 1 });
  for (let i = 396; i < W; i++) {
    const y = Math.round((i - 396) * 0.8);
    s.set(i, y + 2, R.wood[2]);
    s.set(i, y + 3, R.wood[1]);
    s.set(i, y + 4, INK);
  }
  for (let j = 2; j < 30; j++) {
    const i = 432;
    if (j < (i - 396) * 0.8) {
      s.set(i, j, '#7c82a4');
      s.set(i + 1, j, '#565a7a');
    }
  }
  // the round window: a cold dusk sky in three bands behind a cross of muntins
  const r = L.round;
  disc(s, r.x, r.y, r.r + 2, R.wood[1]);
  for (let y = r.y - r.r; y <= r.y + r.r; y++)
    for (let x = r.x - r.r; x <= r.x + r.r; x++) {
      if ((x + 0.5 - r.x) ** 2 + (y + 0.5 - r.y) ** 2 > r.r * r.r) continue;
      const k = (y - r.y + r.r) / (2 * r.r);
      s.set(x, y, skyOf(k));
    }
  s.hline(r.x - r.r, r.y, r.r * 2 + 1, R.wood[1]);
  s.vline(r.x, r.y - r.r, r.r * 2 + 1, R.wood[1]);
  // the stock shelf: two clean lit planks with brackets
  const sh = L.shelf;
  box(s, sh.x - 4, sh.rows[0] - 6, sh.w + 8, 64, ['#1a1418', '#2a2026', '#3a2e34', '#4a3c42'], {
    band: 1,
  });
  for (const ry of sh.rows) {
    box(s, sh.x - 4, ry + 23, sh.w + 8, 3, R.wood, { band: 1 });
    s.hline(sh.x - 4, ry + 23, sh.w + 8, R.wood[3]);
  }
  for (let y = sh.rows[0] - 6; y < sh.rows[1] + 26; y++) {
    const k = (y - sh.rows[0] + 6) / 64,
      half = 30 + 50 * k;
    for (let x = Math.round(sh.x + sh.w / 2 - half); x <= sh.x + sh.w / 2 + half; x++) {
      const c = s.get(x, y);
      if (c)
        s.set(x, y, mix(c, '#ffe9a8', Math.abs(x - sh.x - sh.w / 2) < half * 0.55 ? 0.14 : 0.07));
    }
  }
  box(s, sh.x + 40, sh.rows[0] - 8, 76, 3, R.gold, { band: 1 });
  // the CREW WANTED board: cork with a few darker patches, content drawn live
  const b = L.board;
  box(s, b.x, b.y, b.w, b.h, R.wood, { band: 1 });
  s.rect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, '#a87446');
  for (let y = b.y + 2; y < b.y + b.h - 2; y++)
    for (let x = b.x + 2; x < b.x + b.w - 2; x++)
      if (hash(x >> 2, y >> 2) < 0.3) s.set(x, y, '#966640');
  s.line(b.x + 8, b.y, b.x + b.w / 2, b.y - 10, R.grey[1]);
  s.line(b.x + b.w - 8, b.y, b.x + b.w / 2, b.y - 10, R.grey[1]);
  // right-hand junk: grandfather clock, portraits, trunk with gramophone, dummy, rocking horse
  const c = L.clock;
  box(s, c.x, c.y + 4, 22, 86, R.wood, { band: 1 });
  shape(
    s,
    (i, j) => j >= c.y && j < c.y + 6 && Math.abs(i + 0.5 - c.x - 11) < 12 - (c.y + 6 - j),
    R.wood,
    { band: 1 },
  );
  disc(s, c.x + 11, c.y + 16, 7, R.gold[1]);
  disc(s, c.x + 11, c.y + 16, 6, R.paper[3]);
  s.line(c.x + 11, c.y + 16, c.x + 7, c.y + 12, INK);
  s.line(c.x + 11, c.y + 16, c.x + 14, c.y + 14, INK);
  s.rect(c.x + 5, c.y + 28, 12, 44, '#1a1418');
  s.vline(c.x + 11, c.y + 28, 30, R.gold[1]);
  disc(s, c.x + 11, c.y + 60, 3, R.gold[2]);
  const portraits: [number, number, number, number, Ramp][] = [
    [358, 116, 22, 28, R.gold],
    [374, 128, 24, 30, R.wood],
  ];
  for (const [px, py, pw, ph, ramp] of portraits) {
    box(s, px, py, pw, ph, ramp, { band: 1 });
    s.rect(px + 3, py + 3, pw - 6, ph - 6, '#2a2a3a');
    disc(s, px + pw / 2, py + ph / 2 - 2, 4, R.skinC[1]);
    s.rect(px + pw / 2 - 5, py + ph / 2 + 3, 10, 6, R.plum[2]);
  }
  box(s, 410, 168, 40, 26, R.rust, { band: 1 });
  s.hline(410, 176, 40, R.rust[0]);
  s.rect(427, 172, 6, 6, R.gold[2]);
  middleZone(s);
  // dust on the old junk, baked, it stays after the opening
  for (const [x, y, w2, h2] of [
    [328, 100, 24, 94],
    [356, 112, 46, 50],
    [408, 136, 70, 58],
  ]) {
    for (let j = y; j < y + h2; j++)
      for (let i = x; i < x + w2; i++) {
        const cc = s.get(i, j);
        if (cc && !WALL.includes(cc)) s.set(i, j, mix(cc, '#a49c90', 0.22));
      }
  }
  cap(s, L.clock.x + 1, L.clock.y, 20);
  cap(s, 358, 116, 22);
  cap(s, 374, 128, 24);
  cap(s, L.board.x + 2, L.board.y, L.board.w - 4);
  cap(s, x0, L.tie - 4, W - x0);
  cap(s, L.round.x - 10, L.round.y - 10, 20);
  web(s, L.inside, L.tie + 1, 1, 1, 14);
  web(s, 395, L.tie + 1, -1, 1, 12);
  web(s, W - 1, 40, -1, 1, 10);
}
const DUST = ['#8a8478', '#a49c90', '#c2b9a8'];
function cap(s: Sprite, x: number, y: number, w2: number) {
  s.hline(x, y - 1, w2, DUST[1]);
  s.hline(x + 1, y - 2, w2 - 2, DUST[2]);
  for (let k = 0; k < w2 / 5; k++)
    s.set(x + 1 + Math.floor(hash(x + k, y) * (w2 - 2)), y - 3, DUST[0]);
}
function web(s: Sprite, cx: number, cy: number, dx: number, dy: number, n: number) {
  for (let k = 0; k <= n; k++) s.line(cx, cy, cx + dx * k, cy + dy * (n - k), '#6e6a78');
  for (let r2 = 4; r2 < n * 1.6; r2 += 4)
    for (let a = 0; a <= 8; a++) {
      const t = a / 8;
      s.set(
        Math.round(cx + dx * r2 * t * 0.75),
        Math.round(cy + dy * r2 * (1 - t) * 0.75),
        '#8a8692',
      );
    }
}
// The middle corner where the gauge stood: frames leaning face to the wall, a hat stand with
// an old coat and a bowler, suitcases tied with string. The wardrobe beside it is a sheet.
// Kept low in value so customers at the counter stay in front of it.
function middleZone(s: Sprite) {
  const LEATHER = ['#26160f', '#40261a', '#5a3a26', '#765036'],
    CANVAS = ['#1c221e', '#2c362e', '#405044', '#5a6a5c'];
  // two frames leaning with their backs out: brown backing board, a hanging wire, a paper label
  shape(
    s,
    (i, j) =>
      j >= 132 &&
      j < 176 &&
      i >= 152 + Math.floor((j - 132) * 0.12) &&
      i < 166 + Math.floor((j - 132) * 0.12),
    WOOD_D,
    { band: 1 },
  );
  s.rect(155, 138, 9, 32, '#3a2a20');
  s.line(156, 142, 160, 138, R.grey[1]);
  s.line(160, 138, 163, 142, R.grey[1]);
  s.rect(157, 156, 5, 4, '#7a7060');
  shape(
    s,
    (i, j) =>
      j >= 146 &&
      j < 176 &&
      i >= 160 + Math.floor((j - 146) * 0.1) &&
      i < 172 + Math.floor((j - 146) * 0.1),
    R.wood,
    { band: 1 },
  );
  s.rect(163, 150, 7, 22, '#4a3424');
  s.set(165, 160, '#7a7060');
  s.set(166, 160, '#7a7060');
  // hat stand with an old overcoat and a bowler
  s.rect(173, 92, 2, 84, WOOD_D[2]);
  s.vline(173, 92, 84, WOOD_D[3]);
  s.line(169, 176, 173, 168, WOOD_D[1]);
  s.line(178, 176, 174, 168, WOOD_D[1]);
  disc(s, 174, 90, 2, WOOD_D[3]);
  s.line(170, 95, 173, 97, WOOD_D[2]);
  s.line(178, 95, 175, 97, WOOD_D[2]);
  shape(
    s,
    (i, j) => {
      if (j < 97 || j > 142) return false;
      const half = j < 103 ? 3 + (j - 97) * 0.8 : 7 + (j - 103) * 0.06;
      return Math.abs(i + 0.5 - 171) < half;
    },
    R.coat,
    { band: 1 },
  );
  s.vline(171, 104, 38, R.coat[0]);
  s.line(168, 100, 171, 106, R.coat[3]);
  s.line(174, 100, 171, 106, R.coat[1]);
  s.set(172, 112, R.coat[0]);
  s.set(172, 120, R.coat[0]);
  s.set(172, 128, R.coat[0]);
  shape(
    s,
    (i, j) =>
      (((i + 0.5 - 175) / 5) ** 2 + ((j + 0.5 - 88) / 3.4) ** 2 <= 1 && j < 89) ||
      (j >= 88 && j < 90 && Math.abs(i + 0.5 - 175) < 7),
    R.black,
    { band: 1 },
  );
  s.hline(171, 87, 8, '#3a2a30');
  // suitcases tied with string, stacked on the floor
  box(s, 150, 162, 26, 14, LEATHER, { band: 1 });
  s.rect(160, 160, 6, 2, LEATHER[0]);
  box(s, 153, 152, 21, 10, CANVAS, { band: 1 });
  s.rect(161, 150, 5, 2, CANVAS[0]);
  for (const [x, y, w2, h2] of [
    [150, 162, 26, 14],
    [153, 152, 21, 10],
  ]) {
    s.vline(x + Math.floor(w2 * 0.3), y, h2, '#8a7e64');
    s.vline(x + Math.floor(w2 * 0.72), y, h2, '#8a7e64');
    s.hline(x, y + Math.floor(h2 / 2), w2, '#8a7e64');
    s.set(x + Math.floor(w2 * 0.3), y + Math.floor(h2 / 2), '#b0a27e');
    s.set(x + 2, y + 2, R.gold[1]);
    s.set(x + w2 - 3, y + 2, R.gold[1]);
  }
  for (let i = 150; i < 176; i++) {
    const cc = s.get(i, 170);
    if (cc) s.set(i, 170, mix(cc, '#1a1214', 0.2));
  }
  cap(s, 153, 152, 21);
  cap(s, 150, 162, 3);
  cap(s, 152, 132, 13);
  cap(s, 168, 87, 12);
  cap(s, 165, 97, 12);
  web(s, 151, 147, 1, 1, 5);
}

function boardTone(dy: number, seam: boolean, row: number) {
  if (dy % 6 === 0 || seam) return WOOD_D[0];
  return row % 2 ? WOOD_D[2] : WOOD_D[1];
}
function front(f: Sprite) {
  const c = L.counter,
    top = L.counterTop,
    bot = L.counterBottom;
  f.rect(c.x - 2, top, c.w + 4, 4, R.wood[3]);
  f.hline(c.x - 2, top, c.w + 4, '#e2c08a');
  f.hline(c.x - 2, top + 3, c.w + 4, R.wood[0]);
  box(f, c.x, top + 4, c.w, bot - top - 4, R.wood, { band: 1 });
  for (let x = c.x + 12; x < c.x + c.w - 4; x += 34) {
    f.rect(x, top + 10, 28, bot - top - 18, R.wood[1]);
    f.hline(x, top + 10, 28, R.wood[0]);
    f.hline(x, bot - 8, 28, R.wood[3]);
  }
  f.rect(c.x, bot - 4, c.w, 4, R.wood[0]);
  f.hline(c.x, top + 6, c.w, R.gold[2]);
  f.rect(L.flap.x, top + 4, L.flap.w, bot - top - 4, R.wood[1]);
  f.vline(L.flap.x + L.flap.w - 1, top + 4, bot - top - 4, INK);
  f.rect(L.flap.x + 3, top + 24, 3, 3, R.gold[2]);
  for (let y = bot; y < H; y++)
    for (let x = L.inside; x < W; x++) {
      const row = Math.floor((y - bot) / 6),
        seam = (x + row * 23) % 48 === 0;
      let col = boardTone(y - bot, seam, row);
      if (!seam && (y - bot) % 6 === 3 && hash(x >> 3, row) < 0.12) col = WOOD_D[3];
      f.set(x, y, col);
    }
  f.hline(L.inside, bot, W - L.inside, INK);
  for (const [x, y] of [
    [134, 180],
    [170, 186],
    [326, 179],
    [344, 190],
    [402, 181],
    [438, 188],
    [472, 182],
    [300, 195],
    [228, 197],
  ]) {
    f.rect(x, y, 5, 2, '#8a8478');
    f.hline(x + 1, y - 1, 3, '#a49c90');
    f.set(x + 2, y - 2, '#c2b9a8');
    f.set(x - 1, y + 1, '#6e6a62');
    f.set(x + 5, y + 1, '#6e6a62');
  }
}

// ----- overlays -----
const artProp = (w: number, h: number, fn: (p: Sprite) => void, outline = true) => {
  const p = new Sprite(w, h);
  fn(p);
  if (outline) p.outline();
  return cv(p);
};
// Rows sampled down to h, keeping the top and bottom rows, for a plank tipping flat.
function squashV(src: Sprite, h: number) {
  const out = new Sprite(src.w, h);
  for (let y = 0; y < h; y++) {
    let sy: number;
    if (y === 0) sy = 0;
    else if (y === h - 1) sy = src.h - 1;
    else sy = 1 + Math.min(src.h - 3, Math.floor(((y - 0.5) * (src.h - 2)) / Math.max(1, h - 2)));
    for (let x = 0; x < src.w; x++) out.c[y * src.w + x] = src.c[sy * src.w + x];
  }
  return out;
}
function plank(w: number, h: number, seed: number, nails: number[]) {
  const p = new Sprite(w, h);
  p.rect(0, 0, w, h, PLANK[2]);
  for (let y = 1; y < h - 1; y++)
    for (let x = 0; x < w; x++)
      if (hash(x >> 2, y + seed * 31) < 0.08) p.set(x, y, mix(PLANK[2], PLANK[3], 0.5));
  for (let g = 0; g < 3; g++) {
    const y = 2 + Math.floor(hash(seed, g) * (h - 4));
    for (let x = 0; x < w; x++) if (hash(x >> 3, g + seed * 7) > 0.35) p.set(x, y, PLANK[1]);
  }
  const kx = 8 + Math.floor(hash(seed, 9) * (w - 16)),
    ky = 3 + Math.floor(hash(seed, 8) * (h - 7));
  p.rect(kx, ky, 3, 2, PLANK[0]);
  p.set(kx - 1, ky, PLANK[1]);
  p.set(kx + 3, ky + 1, PLANK[1]);
  p.hline(kx, ky - 1, 3, PLANK[3]);
  p.hline(0, 0, w, PLANK[3]);
  p.hline(0, h - 1, w, PLANK[1]);
  p.vline(0, 0, h, PLANK[1]);
  p.vline(w - 1, 0, h, PLANK[0]);
  p.set(0, 0, null);
  p.set(w - 1, h - 1, null);
  p.set(w - 1, 1, null);
  for (const nx of nails) {
    const ny = Math.floor(h / 2) - 1;
    p.rect(nx, ny, 2, 2, '#2a2224');
    p.set(nx, ny, '#6a5a52');
    for (let j = 2; j < Math.min(h - ny, 6); j++)
      p.set(nx + (j > 3 ? 1 : 0), ny + j, j < 4 ? R.rust[1] : R.rust[0]);
  }
  p.outline({ ink: '#120e10' });
  return p;
}
// the dead neon: dark glass tube in two tones, a dull highlight along each stroke's top,
// clips holding it to the brick and a cable. Lit copies are cut per letter.
function buildNeon() {
  const m = glyphMask('Pawn', 'jersey'),
    pad = 4,
    w = m.w + 3 + pad * 2,
    h = m.bottom - m.top + 1 + pad * 2;
  const grid = new Int8Array(w * h).fill(-1),
    q: number[] = [];
  for (const [x, y] of m.pts) {
    const gx = x + pad + 1,
      gy = y - m.top + pad;
    if (gx >= 0 && gy >= 0 && gx < w && gy < h) {
      const k = gy * w + gx;
      if (grid[k]) {
        grid[k] = 0;
        q.push(k);
      }
    }
  }
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi],
      dd = grid[k];
    if (dd >= 3) continue;
    const x = k % w,
      y = (k / w) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx;
      if (grid[nk] === -1) {
        grid[nk] = dd + 1;
        q.push(nk);
      }
    }
  }
  const g = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && grid[y * w + x] === 0;
  const off = new Sprite(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!g(x, y)) continue;
      const inner = g(x - 1, y) && g(x + 1, y) && g(x, y - 1) && g(x, y + 1);
      let col = inner ? '#3a3330' : '#2a2422';
      if (!g(x, y - 1) && g(x, y + 1)) col = '#57504a';
      off.set(x, y, col);
    }
  // clips under the strokes and a cable to the right edge
  const clipXs: Pt[] = [];
  for (let x = pad; x < w - pad; x += 9) {
    let yy = -1;
    for (let y = h - 1; y >= 0; y--)
      if (g(x, y)) {
        yy = y;
        break;
      }
    if (yy > 0) clipXs.push([x, yy + 1]);
  }
  for (const [x, y] of clipXs) {
    off.set(x, y, '#5a5662');
    off.set(x + 1, y, '#3a3640');
  }
  off.outline({ ink: '#120e14' });
  for (let x = w - pad - 1; x < w; x++) off.set(x, h - 3, '#16121a');
  // letters by prefix width
  const cuts = ['P', 'Pa', 'Paw'].map((t) => measure(t, 'jersey') + pad + 1);
  const letterOf = (x: number) => {
    let i = 0;
    while (i < 3 && x >= cuts[i]) i++;
    return i;
  };
  const parts = [0, 1, 2, 3].map(() => ({
    tube: new Sprite(w, h),
    glow1: new Sprite(w, h),
    glow2: new Sprite(w, h),
  }));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dd = grid[y * w + x];
      if (dd < 0) continue;
      // a glow pixel belongs to the nearest tube's letter, checked in a small window
      let li = letterOf(x);
      if (dd > 0) {
        let best = 9;
        for (let j = -3; j <= 3; j++)
          for (let i = -3; i <= 3; i++)
            if (g(x + i, y + j) && Math.abs(i) + Math.abs(j) < best) {
              best = Math.abs(i) + Math.abs(j);
              li = letterOf(x + i);
            }
      }
      const pt = parts[li];
      if (dd === 0) {
        const inner = g(x - 1, y) && g(x + 1, y) && g(x, y - 1) && g(x, y + 1);
        pt.tube.set(x, y, inner ? '#fff4c0' : '#ffd75e');
      } else if (dd === 1) pt.glow1.set(x, y, '#d9a520');
      else pt.glow2.set(x, y, '#8a6418');
    }
  return {
    off: cv(off),
    w,
    h,
    letters: parts.map((p) => ({ tube: cv(p.tube), glow1: cv(p.glow1), glow2: cv(p.glow2) })),
  };
}
function paperNotice() {
  const w = 31,
    h = 23,
    p = new Sprite(w, h + 1);
  p.rect(0, 0, w, h, '#cdbd8e');
  p.hline(0, h - 1, w, '#b0a072');
  p.vline(w - 1, 0, h, '#b8a87a');
  p.hline(0, 0, w, '#ddd0a4');
  p.vline(15, 1, h - 2, '#c2b282');
  const put = (str: string, y: number, col: string) => {
    const m = letters(SMALL, str, 1, 2),
      x = Math.floor((w - m.w) / 2);
    for (const [px, py] of m.pts) p.set(x + px, y + py, col);
  };
  put('FOR', 2, '#a05a48');
  put('LEASE', 8, '#a05a48');
  put('555-0142', 15, '#4a3a2c');
  p.rect(1, 0, 4, 2, '#e4dab4');
  p.rect(w - 5, 0, 4, 2, '#e4dab4');
  // a slight tilt: the right half sits one pixel lower
  const t = new Sprite(w, h + 1);
  p.each((x, y, c) => {
    if (c) t.set(x, y + (x >= 16 ? 1 : 0), c);
  });
  return t;
}
function glassBand(x: number, y: number) {
  if (y > 33) return 0.34;
  if (y > 26) return 0.2;
  return hash(x >> 2, y >> 2) < 0.25 ? 0.16 : 0.08;
}
function doorLeaf() {
  const d = L.door,
    p = new Sprite(d.w, d.h);
  box(p, 0, 0, d.w, d.h, DOOR, { band: 1 });
  for (let x = 3; x < d.w - 3; x += 7) p.vline(x, 2, d.h - 4, DOOR[1]);
  // the small grimy window with the notice taped inside
  p.rect(5, 7, 34, 36, DOOR[0]);
  p.rect(6, 8, 32, 34, '#1c1822');
  p.stamp(paperNotice(), 7, 13);
  for (let y = 8; y < 42; y++)
    for (let x = 6; x < 38; x++) {
      const c = p.get(x, y)!,
        band = glassBand(x, y);
      p.set(x, y, mix(c, '#3a3436', band));
    }
  p.line(8, 30, 17, 10, mix('#cdbd8e', '#3a3436', 0.4));
  p.hline(5, 42, 34, DOOR[3]);
  // lower panels, the pull handle, the hasp plate, a kick plate
  for (const [y0, hh] of [
    [50, 24],
    [80, 30],
  ]) {
    p.rect(6, y0, 32, hh, DOOR[1]);
    p.hline(6, y0, 32, DOOR[0]);
    p.vline(6, y0, hh, DOOR[0]);
    p.hline(6, y0 + hh - 1, 32, DOOR[3]);
    p.vline(37, y0, hh, DOOR[3]);
  }
  p.rect(35, 45, 2, 12, R.steel[1]);
  p.vline(35, 45, 12, R.steel[2]);
  p.set(35, 44, R.steel[0]);
  p.set(35, 57, R.steel[0]);
  p.rect(38, 58, 6, 5, R.steel[1]);
  p.hline(38, 58, 6, R.steel[2]);
  p.set(39, 60, R.steel[0]);
  p.set(39, 63, R.rust[1]);
  p.set(39, 64, R.rust[0]);
  p.rect(3, d.h - 12, d.w - 6, 9, mix(R.steel[1], DOOR[1], 0.5));
  p.hline(3, d.h - 12, d.w - 6, R.steel[2]);
  for (let y = 0; y < d.h; y++)
    for (let x = 0; x < d.w; x++) {
      const c = p.get(x, y);
      if (!c) continue;
      if (y > d.h - 24) p.set(x, y, mix(c, '#2a1e16', stepOf((y - d.h + 24) / 24, 3) * 0.4));
      else if (y < 10) p.set(x, y, mix(c, '#1e161a', 0.25));
    }
  return p;
}
// The door swings toward the street on its left hinge: the panel narrows and shows its edge.
function doorFrames() {
  const leaf = doorLeaf(),
    d = L.door;
  return [
    [44, 0],
    [31, 2],
    [18, 3],
    [9, 3],
    [6, 3],
  ].map(([pw, ew], i) => {
    const p = new Sprite(pw + ew + 1, d.h + 4);
    const sq = i ? squeeze(leaf, pw) : leaf;
    sq.each((x, y, c) => {
      if (c) p.set(x, y + 2, c);
    });
    for (let y = 0; y < d.h + (i >= 2 ? 4 : 0); y++)
      for (let k = 0; k < ew; k++)
        p.set(pw + k, y + (i >= 2 ? 0 : 2), k === ew - 1 ? DOOR[1] : DOOR[3]);
    if (i) p.vline(pw, 2, d.h, DOOR[0]);
    return { img: cv(p), w: pw + ew };
  });
}
// Dusty off-white cloth. Columns from top(x) to bottom(x), lit top surfaces with a dust
// layer, fold lines that start at the high points, a hem that pools on the floor.
interface ClothOpts {
  x0: number;
  x1: number;
  top: (x: number) => number | null;
  bottom: (x: number) => number;
  clip?: (x: number) => number;
  folds?: [number, number, number][];
  ties?: [number, number, number, number][];
  crumple?: [number, number][];
  pool?: boolean;
}
export interface Cloth {
  img: HTMLCanvasElement;
  x: number;
  y: number;
}
function cloth(o: ClothOpts): Cloth {
  const xs: number[] = [];
  for (let x = o.x0; x <= o.x1; x++) if (o.top(x) !== null) xs.push(x);
  const bx = xs[0] - 4,
    ex = xs[xs.length - 1] + 4;
  let minY = 999,
    maxY = 0;
  for (const x of xs) {
    minY = Math.min(minY, Math.round(o.top(x)!));
    maxY = Math.max(maxY, Math.round(o.bottom(x)) + 1);
  }
  const by = minY - 2,
    s = new Sprite(ex - bx + 1, maxY - by + 2);
  const set = (x: number, y: number, c: string) => {
    if (o.clip && y >= o.clip(x)) return;
    s.set(x - bx, y - by, c);
  };
  const first = xs[0],
    last = xs[xs.length - 1],
    folds = o.folds || [];
  // Hanging folds are soft ridges that widen as they fall: the left flank catches the light,
  // the right flank sits in shade. The hem dips one pixel under each ridge.
  const ridge = (x: number, y: number) => {
    let tone = 0;
    for (const [fx, fy, dx] of folds) {
      if (y < fy) continue;
      const d = x + 0.5 - (fx + (y - fy) * dx),
        fw = 1.5 + Math.min(3, (y - fy) / 9);
      if (d > -fw - 1.5 && d <= -0.5) tone = 3;
      else if (d > -0.5 && d < fw) tone = 1;
    }
    return tone;
  };
  for (const x of xs) {
    const t = Math.round(o.top(x)!),
      r0 = ridge(x, t + 8),
      b = Math.round(o.bottom(x)) + (r0 === 3 && o.pool ? 1 : 0);
    for (let y = t; y <= b; y++) {
      let c = CLOTH[2];
      const r = ridge(x, y);
      if (r === 3) c = CLOTH[3];
      if (r === 1) c = CLOTH[1];
      if (x - first < 1 || last - x < 2) c = CLOTH[1];
      if (y >= b - 1 && c === CLOTH[3]) c = CLOTH[2];
      set(x, y, c);
    }
    const tl = o.top(x - 1),
      tr = o.top(x + 1);
    const flat = tl !== null && tr !== null && Math.abs(tl - t) <= 1 && Math.abs(tr - t) <= 1;
    if (flat) {
      set(x, t, DUSTC);
      set(x, t + 1, CLOTH[3]);
    } else set(x, t, CLOTH[3]);
    set(x, b, CLOTH[1]);
  }
  for (const [x0, y0, x1, y1] of o.ties || []) {
    s.line(x0 - bx, y0 - by, x1 - bx, y1 - by, CLOTH[1]);
    s.line(x0 - bx, y0 - by - 1, x1 - bx, y1 - by - 1, CLOTH[3]);
  }
  for (const [x, y] of o.crumple || []) {
    set(x, y, CLOTH[1]);
    set(x + 1, y, CLOTH[1]);
    set(x + 2, y + 1, CLOTH[1]);
    set(x, y - 1, CLOTH[3]);
    set(x + 1, y - 1, CLOTH[3]);
    set(x - 1, y + 1, CLOTH[0]);
  }
  // the hem pools: a few extra columns flaring at both feet
  if (o.pool) {
    const fb = Math.round(o.bottom(first)),
      lb = Math.round(o.bottom(last));
    for (let k = 1; k <= 3; k++) {
      for (let y = fb - 3 + k; y <= fb; y++) set(first - k, y, k === 3 ? CLOTH[1] : CLOTH[2]);
      for (let y = lb - 3 + k; y <= lb; y++) set(last + k, y, k === 3 ? CLOTH[1] : CLOTH[2]);
    }
  }
  s.outline({ ink: '#2a2420' });
  return { img: cv(s), x: bx, y: by };
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const head =
  (cx: number, cy: number, r: number) =>
  (x: number): number | null =>
    Math.abs(x + 0.5 - cx) <= r ? cy - Math.sqrt(r * r - (x + 0.5 - cx) ** 2) : null;
function sheets() {
  // the counter cloth, humped over the register, and its pull: corner grabbed, slide, bunch, pile
  const cTop = (x: number) =>
    102 +
    (x - 172 >= 98 && x - 172 <= 128 ? 2 + Math.max(0, Math.abs(x - 172 - 113) - 9) * 1.2 : 16);
  // He pulls from the middle with both hands, so the cloth drops first at his hands and the far
  // corners slide off the counter last. Tension folds run from his hands to the corners.
  const GX = L.bulb.x - 9;
  const counter = [0, 0.3, 0.6, 0.85, 1].map((e) => {
    const xl = Math.round(lerp(172, 194, e)),
      xr = Math.round(lerp(328, 254, Math.pow(e, 0.9)));
    const pile = (u: number) =>
      192 -
      11 * Math.pow(Math.sin(Math.PI * Math.min(1, u)), 0.7) -
      2 * Math.max(0, Math.sin(u * 9));
    const top = (x: number) => {
      if (x < xl || x > xr) return null;
      const u = (x - xl) / Math.max(1, xr - xl),
        x0 = lerp(172, 328, u);
      const k = e >= 1 ? 1 : clamp01(e * 1.35 - (0.45 * Math.abs(x - GX)) / 150);
      return lerp(cTop(Math.round(x0)), pile(u), k * k * (3 - 2 * k));
    };
    const bottom = () => Math.round(lerp(177, 193, e));
    const folds: [number, number, number][] = [],
      ties: [number, number, number, number][] = [],
      crumple: Pt[] = [];
    if (e === 0)
      folds.push(
        [183, 119, -0.06],
        [203, 119, 0.04],
        [226, 119, -0.02],
        [249, 119, 0.05],
        [268, 112, -0.1],
        [290, 106, 0.14],
        [309, 119, 0.03],
        [322, 119, 0.08],
      );
    else if (e < 1) {
      const gy = Math.round(lerp(150, 184, e));
      for (const tx of [
        xl + 3,
        Math.round(lerp(xl, GX, 0.5)),
        Math.round(lerp(GX, xr, 0.4)),
        Math.round(lerp(GX, xr, 0.75)),
        xr - 3,
      ]) {
        const t = top(tx);
        if (t !== null) ties.push([GX + (tx < GX ? -4 : 4), gy, tx, Math.round(t) + 3]);
      }
    }
    if (e >= 0.85)
      for (let k = 0; k < 9; k++) {
        const x = Math.round(lerp(xl + 4, xr - 6, hash(k, 11)));
        const t = top(x);
        if (t !== null) crumple.push([x, Math.round(t) + 2 + Math.floor(hash(k, 12) * 6)]);
      }
    return cloth({ x0: xl, x1: xr, top, bottom, folds, ties, crumple, pool: e === 0 });
  });
  // the drape over the stock shelf, tucked under the counter cloth: it follows the pull and
  // slides down behind the counter, sagging in the middle, and the counter hides it
  const drape = [0, 0.4, 0.75].map((e) => {
    const xl = Math.round(lerp(241, 246, e)),
      xr = Math.round(lerp(406, 388, e));
    const top = (x: number) => {
      if (x < xl || x > xr) return null;
      const u = (x - xl) / (xr - xl);
      return 32 + e * 72 + Math.sin(Math.PI * u) * 10 * e + ((x - xl) % 22 < 2 ? 1 : 0);
    };
    const bottom = (x: number) => 95 + e * 60 + Math.sin((Math.PI * (x - xl)) / (xr - xl)) * 4 * e;
    const folds: [number, number, number][] = [];
    for (let fx = xl + 11; fx < xr; fx += 22)
      folds.push([fx, Math.round(top(fx) ?? 32) + 1, (fx - (xl + xr) / 2) * -0.004 * e]);
    return cloth({
      x0: xl,
      x1: xr,
      top,
      bottom,
      folds,
      clip: (x: number) => (x >= 176 ? L.counterTop : 999),
    });
  });
  // sheets that stay: wardrobe in the middle corner, clock, rocking horse, trunk, dummy
  const stay = [
    cloth({
      x0: 129,
      x1: 150,
      top: (x: number) => 84 + Math.abs(x + 0.5 - 139.5) * 0.35 + (x < 131 || x > 148 ? 3 : 0),
      bottom: () => 179,
      folds: [
        [134, 90, -0.03],
        [139, 86, 0],
        [145, 90, 0.04],
      ],
      pool: true,
    }),
    cloth({
      x0: 327,
      x1: 350,
      top: (x: number) => 104 + Math.abs(x + 0.5 - 338.5) * 0.5,
      bottom: () => 192,
      folds: [
        [334, 110, 0.02],
        [343, 110, -0.02],
      ],
      pool: true,
    }),
    cloth({
      x0: 349,
      x1: 397,
      top: (x: number) => {
        const i = x - 349;
        if (i < 4) return 160 - i;
        if (i < 34) return 158 + (Math.abs(i - 20) < 5 ? 2 : 0);
        if (i < 40) return 158 - (i - 34) * 1.6;
        return (head(393, 154, 5)(x) ?? 154) - (x === 391 || x === 395 ? 2 : 0);
      },
      bottom: () => 179,
      folds: [
        [361, 160, 0.1],
        [377, 160, -0.1],
        [393, 156, 0],
      ],
    }),
    cloth({
      x0: 405,
      x1: 450,
      top: (x: number) => {
        const i = x - 405;
        if (i < 2) return 166;
        if (i >= 14 && i <= 30) return 136 + Math.abs(i - 22) * 0.9 + (i > 22 ? 4 : 0);
        return 164;
      },
      bottom: () => 192,
      folds: [
        [413, 166, 0.05],
        [427, 142, 0.05],
        [443, 166, -0.05],
      ],
      pool: true,
    }),
    cloth({
      x0: 453,
      x1: 474,
      top: (x: number) => head(464, 139, 5)(x) ?? 142 + Math.abs(x - 464) * 0.4,
      bottom: () => 192,
      folds: [
        [460, 146, -0.1],
        [468, 146, 0.1],
      ],
      pool: true,
    }),
  ];
  return { counter, drape, stay };
}
// ----- light: one logic. Bands nest, so each band image is drawn on top of the wider one. -----
// Locked, cold dusk light enters through the round window and two roof gaps, all slanting
// the same way, and each beam ends in a pool on what it hits. Open, the bulb cone.
export const SLANT = -0.42;
export interface Beam {
  x0: number;
  y0: number;
  y1: number;
  h0: number;
  h1: number;
  pool: Pt;
}
export const BEAMS: Beam[] = [
  { x0: L.round.x, y0: L.round.y + 2, y1: 90, h0: 7, h1: 11, pool: [10, 3] },
  { x0: 305, y0: 4, y1: 117, h0: 1.5, h1: 9, pool: [11, 2] },
  { x0: 433, y0: 30, y1: 156, h0: 1.5, h1: 8, pool: [10, 3] },
];
function bandSet(fill: string) {
  const masks = [new Sprite(W, H), new Sprite(W, H), new Sprite(W, H), new Sprite(W, H)],
    grid = new Int8Array(W * H);
  const put = (x: number, y: number, band: number) => {
    if (x < L.inside || x >= W || y < 0 || y >= H) return;
    for (let k = 0; k < Math.min(band, 3); k++) masks[k].set(x, y, fill);
    if (band === 4) masks[3].set(x, y, fill);
    grid[y * W + x] = Math.max(grid[y * W + x], Math.min(band, 3));
  };
  return { masks, grid, put };
}
const bandOf = (d: number) => {
  if (d < 0.36) return 3;
  if (d < 0.7) return 2;
  return 1;
};
function beams() {
  const bs = bandSet('#c4d0f0');
  for (const b of BEAMS) {
    for (let y = b.y0; y <= b.y1; y++) {
      const t = (y - b.y0) / (b.y1 - b.y0),
        cx = b.x0 + (y - b.y0) * SLANT,
        half = lerp(b.h0, b.h1, t);
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const dd = Math.abs(x + 0.5 - cx) / half;
        if (dd <= 1) bs.put(x, y, bandOf(dd));
      }
    }
    const px = b.x0 + (b.y1 - b.y0) * SLANT,
      [rx, ry] = b.pool;
    for (let y = Math.floor(b.y1 - ry); y <= b.y1 + ry; y++)
      for (let x = Math.floor(px - rx); x <= px + rx; x++) {
        const dd = Math.hypot((x + 0.5 - px) / rx, (y + 0.5 - b.y1) / ry);
        if (dd <= 1) bs.put(x, y, dd < 0.5 ? 4 : bandOf(dd));
      }
  }
  return { imgs: bs.masks.map(cv), grid: bs.grid };
}
function cone() {
  const bs = bandSet('#ffd896'),
    bb = L.bulb,
    top = bb.y + 9;
  for (let y = top; y < H; y++) {
    if (y > L.counterTop - 1) break;
    const half = 3 + (y - top) * 0.62;
    for (let x = Math.floor(bb.x - half); x <= Math.ceil(bb.x + half); x++) {
      const dd = Math.abs(x + 0.5 - bb.x) / half;
      if (dd <= 1) bs.put(x, y, bandOf(dd));
    }
  }
  // the pools on the counter top and the floor are separate, so pawn.js can lay them under the people
  const ps = bandSet('#ffd896');
  const pools: [number, number, number, number][] = [
    [L.counterTop + 1, 44, 2, L.counter.x],
    [187, 78, 7, L.inside],
  ];
  for (const [cy, rx, ry, minX] of pools) {
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = Math.max(minX, bb.x - rx); x <= bb.x + rx; x++) {
        const dd = Math.hypot((x + 0.5 - bb.x) / rx, (y + 0.5 - cy) / ry);
        if (dd <= 1) {
          const band = dd < 0.5 ? 4 : bandOf(dd);
          ps.put(x, y, band);
          bs.grid[y * W + x] = Math.max(bs.grid[y * W + x], Math.min(band, 3));
        }
      }
  }
  return { imgs: bs.masks.map(cv), pools: ps.masks.map(cv), grid: bs.grid };
}
// the lit room seen through the display window and the open doorway
function warmGlass() {
  const w = L.window,
    d = L.door;
  const win = artProp(
    w.w,
    w.h,
    (p) => {
      p.rect(0, 0, w.w, w.h, '#f2b866');
      p.rect(0, 0, w.w, 30, '#e8a456');
    },
    false,
  );
  const door = artProp(
    d.w,
    d.h,
    (p) => {
      p.rect(0, 0, d.w, d.h, '#3a2a22');
      p.rect(0, d.h - 18, d.w, 18, '#5a4030');
      p.rect(0, 0, 8, d.h - 18, '#2a1e1a');
      p.rect(14, 20, 20, 50, '#4a362a');
    },
    false,
  );
  return { win, door };
}
export type ChainPt = [number, number, 'face' | 'edge'];
export interface Plank {
  x: number;
  y: number;
  crooked: boolean;
  w: number;
  h: number;
  img: HTMLCanvasElement;
  fall: HTMLCanvasElement[];
}
export interface Neon {
  off: HTMLCanvasElement;
  w: number;
  h: number;
  letters: { tube: HTMLCanvasElement; glow1: HTMLCanvasElement; glow2: HTMLCanvasElement }[];
}
export interface Sheets {
  counter: Cloth[];
  drape: Cloth[];
  stay: Cloth[];
}
type Canvas = HTMLCanvasElement;
interface Overlays {
  door: { img: Canvas; w: number }[];
  planks: Plank[];
  upperBoards: Canvas;
  upperSeams: Canvas;
  upperLit: Canvas;
  signLit: Canvas;
  neon: Neon;
  ballsDull: Canvas;
  ballsLit: Canvas;
  help: Canvas;
  sheets: Sheets;
  dim: Canvas;
  beams: { imgs: Canvas[]; grid: Int8Array };
  cone: { imgs: Canvas[]; pools: Canvas[]; grid: Int8Array };
  glass: { win: Canvas; door: Canvas };
  lock: Canvas;
  lockOpen: Canvas;
  key: Canvas;
  linkFace: Canvas;
  linkEdge: Canvas;
  heap: Canvas[];
  chainPts: ChainPt[];
  bulbOn: Canvas;
  register: Canvas;
  drawer: Canvas;
}
export interface PawnArt extends Overlays {
  back: Canvas;
  front: Canvas;
  L: typeof L;
  A: typeof A;
  SLANT: number;
  BEAMS: Beam[];
}
function overlays() {
  const o = {} as Overlays,
    w = L.window;
  o.door = doorFrames();
  // the boards over the display window, one hanging crooked on a single nail
  const rows = [
    [61, 14, 2, 64],
    [76, 13, 1, 62],
    [91, 15, 3, 65],
    [109, 13, 0, 63],
    [123, 14, 2, 64],
    [140, 13, 1, 62],
  ];
  o.planks = rows.map(([y, hh, x, ww], i) => {
    const crooked = i === 3;
    const p = plank(ww, hh, i + 3, crooked ? [3] : [3, ww - 6]);
    const img = crooked ? rotate(p, 11) : p;
    return {
      x: w.x - 4 + x - (crooked ? 2 : 0),
      y: crooked ? y - 2 : y,
      crooked,
      w: img.w,
      h: img.h,
      img: cv(img),
      fall: [10, 7, 4].map((h2) => cv(squashV(p, h2))),
    };
  });
  o.upperBoards = artProp(28, 20, (p) => {
    box(p, 0, 0, 28, 20, PLANK, { band: 1 });
    for (let j = 4; j < 18; j += 5) {
      p.hline(1, j, 26, PLANK[0]);
      p.hline(1, j + 1, 26, PLANK[3]);
    }
    for (const [x, y] of [
      [2, 2],
      [25, 2],
      [2, 17],
      [25, 17],
    ]) {
      p.set(x, y, '#2a2224');
      p.set(x, y + 1, R.rust[1]);
    }
  });
  // open: nobody lives upstairs yet, but the shop light leaks through the seams of the boards
  o.upperSeams = artProp(28, 20, (p) => {
    box(p, 0, 0, 28, 20, PLANK, { band: 1 });
    for (let j = 4; j < 18; j += 5) {
      p.hline(1, j, 26, '#e8a456');
      p.hline(1, j + 1, 26, PLANK[3]);
      p.set(1 + ((j * 7) % 20), j, PLANK[0]);
    }
    for (const [x, y] of [
      [2, 2],
      [25, 2],
      [2, 17],
      [25, 17],
    ]) {
      p.set(x, y, '#2a2224');
      p.set(x, y + 1, R.rust[1]);
    }
  });
  o.upperLit = artProp(
    24,
    16,
    (p) => {
      p.rect(0, 0, 24, 16, R.lit[2]);
      p.rect(0, 0, 11, 16, R.lit[3]);
      p.vline(12, 0, 16, R.concrete[1]);
      p.rect(2, 9, 8, 7, R.lit[1]);
    },
    false,
  );
  const sg = L.sign,
    m = letters(BIG, 'PAWN & LOAN', 2, 5);
  o.signLit = artProp(
    sg.w,
    sg.h,
    (p) => {
      box(p, 0, 0, sg.w, sg.h, R.red, { band: 1 });
      const gx = Math.floor((sg.w - m.w) / 2);
      for (const [x, y] of m.pts) p.set(gx + x, 3 + y, y < 2 ? R.gold[3] : R.gold[2]);
    },
    false,
  );
  o.neon = buildNeon();
  const ballsImg = (ramp: Ramp, spec: string) =>
    artProp(18, 24, (p) => {
      for (const [x, y] of [
        [4, 6],
        [13, 6],
        [8.5, 15],
      ]) {
        p.vline(Math.round(x), 0, y, R.black[3]);
        sphere(p, x, y + 4, 4, ramp, spec);
      }
    });
  o.ballsDull = ballsImg(['#1e1810', '#2e2618', '#433822', '#544630'], '#544630');
  o.ballsLit = ballsImg(R.gold, '#fff8d0');
  o.help = artProp(34, 14, (p) => {
    p.rect(0, 0, 34, 14, R.white[3]);
    p.hline(0, 13, 34, R.white[1]);
    text(p, 'HELP', 17 - Math.floor(measure('HELP') / 2), 1, R.red[1], 'tiny', { alignTop: true });
    text(p, 'WANTED', 17 - Math.floor(measure('WANTED') / 2), 7, R.red[1], 'tiny', {
      alignTop: true,
    });
  });
  o.sheets = sheets();
  // the shut room's warm dark; the round window and the roof gaps are the light, so they stay clear
  o.dim = artProp(
    W,
    H,
    (p) => {
      const r = L.round;
      for (let y = 0; y < H; y++)
        for (let x = L.inside; x < W; x++) {
          if ((x + 0.5 - r.x) ** 2 + (y + 0.5 - r.y) ** 2 <= r.r * r.r) continue;
          if (y < L.tie && (x === 304 || x === 305 || x === 432 || x === 433)) continue;
          p.set(x, y, '#120a0c');
        }
    },
    false,
  );
  o.beams = beams();
  o.cone = cone();
  o.glass = warmGlass();
  // padlock shut and sprung, the key, chain links face-on and edge-on, the heap
  o.lock = artProp(9, 11, (p) => {
    for (let a = 0; a < 12; a++) {
      const t = Math.PI + (a / 11) * Math.PI;
      p.set(Math.round(4 + Math.cos(t) * 2.6), Math.round(4 + Math.sin(t) * 3.2), R.grey[2]);
    }
    p.vline(1, 4, 2, R.grey[2]);
    p.vline(7, 4, 2, R.grey[2]);
    box(p, 0, 5, 9, 6, ['#3a2a10', '#6a4a18', '#8a6a2a', '#a8884a'], { band: 1 });
    p.set(4, 7, INK);
    p.set(4, 8, INK);
  });
  o.lockOpen = artProp(9, 12, (p) => {
    for (let a = 0; a < 12; a++) {
      const t = Math.PI + (a / 11) * Math.PI;
      p.set(Math.round(4 + Math.cos(t) * 2.6), Math.round(3 + Math.sin(t) * 3.2), R.grey[2]);
    }
    p.vline(1, 3, 3, R.grey[2]);
    box(p, 0, 6, 9, 6, ['#3a2a10', '#6a4a18', '#8a6a2a', '#a8884a'], { band: 1 });
    p.set(4, 8, INK);
    p.set(4, 9, INK);
  });
  o.key = artProp(8, 5, (p) => {
    disc(p, 2, 2, 2, R.gold[3]);
    p.set(2, 2, R.gold[1]);
    p.hline(4, 2, 4, R.gold[2]);
    p.set(6, 3, R.gold[2]);
    p.set(7, 3, R.gold[1]);
  });
  o.linkFace = artProp(
    3,
    3,
    (p) => {
      p.hline(0, 0, 3, R.grey[2]);
      p.set(0, 1, R.grey[1]);
      p.set(2, 1, R.grey[1]);
      p.hline(0, 2, 3, R.grey[1]);
    },
    false,
  );
  o.linkEdge = artProp(
    3,
    1,
    (p) => {
      p.hline(0, 0, 3, R.grey[2]);
      p.set(2, 0, R.grey[3]);
    },
    false,
  );
  o.heap = [3, 5, 7].map((hw, i) =>
    artProp(hw * 2 + 2, i + 3, (p) => {
      for (let j = 0; j < i + 2; j++)
        for (let x = j; x < hw * 2 + 1 - j; x++)
          p.set(x, i + 1 - j, (x + j) % 3 ? R.grey[1] : R.grey[2]);
      p.set(hw, 0, R.grey[3]);
    }),
  );
  o.chainPts = (() => {
    const pts: ChainPt[] = [],
      a = L.eye,
      b = L.staple,
      n = 15;
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = lerp(a.x, b.x, t),
        y = lerp(a.y, b.y, t) + Math.sin(Math.PI * t) * 11;
      pts.push([Math.round(x) - 1, Math.round(y) - 1, i % 2 ? 'edge' : 'face']);
    }
    return pts;
  })();
  o.bulbOn = bulbOn;
  o.register = artProp(30, 22, (p) => {
    shape(p, (i, j) => j >= 6 && j < 22 && i >= 1 + Math.max(0, 10 - j) && i < 29, R.gold, {
      band: 1,
    });
    p.rect(6, 0, 18, 7, R.gold[1]);
    p.rect(8, 1, 14, 4, '#1c1408');
    p.hline(6, 0, 18, R.gold[3]);
    for (let j = 10; j < 18; j += 3) for (let i = 4; i < 26; i += 4) p.rect(i, j, 2, 2, R.paper[3]);
    p.rect(26, 4, 2, 8, R.black[2]);
    disc(p, 27, 3, 2, R.red[2]);
  });
  o.drawer = artProp(26, 5, (p) => {
    box(p, 0, 0, 26, 5, R.gold, { band: 1 });
    p.rect(10, 1, 6, 2, '#5a8a4a');
  });
  return o;
}

export function build(): PawnArt {
  const s = new Sprite(W, H);
  street(s);
  attic(s);
  const f = new Sprite(W, H);
  front(f);
  return { back: cv(s), front: cv(f), ...overlays(), L, A, SLANT, BEAMS };
}
