// The player's opening poses: the key, pulling the door, the kick, the bulb's chain switch,
// pulling the cloth off the counter and the happy pose, plus the "he can buy now" glance.
// Same look as youFront, youBack and youWalk in the bank people (taxi cap, denim jacket, jeans,
// white sneakers), drawn with the same helpers. Each pose is baked once and cached.
// Side poses face right and are mirrored for the left. Anchors: the body's centre line sits
// at you.x + 19 in every view, like the walk frames, so a pose change never jumps.
import { INK, R, Sprite, shape } from '../street/pix';
import { YOU, ell, fist, stander, stroke } from '../bank/people';

type Pt = [number, number];
type Canvas = HTMLCanvasElement;
const cv = (s: Sprite) => s.canvas();
interface SideOpts {
  bob?: number;
  lean?: number;
  armF?: Pt[];
  armB?: Pt[];
  legF?: Pt[];
  legB?: Pt[];
  key?: 'flat' | 'up';
  squint?: boolean;
  grin?: boolean;
}
interface BackOpts {
  bob?: number;
  lean?: number;
  armL: Pt[];
  armR: Pt[];
}
interface FrontOpts {
  mood: 'smile' | 'grin';
  look?: number;
  hop?: number;
  armL: Pt[];
  armR: Pt[];
  envelope?: boolean;
}
export type PoseName =
  | 'stand'
  | 'keyDig'
  | 'keyReach'
  | 'keyTurn'
  | 'pull0'
  | 'pull1'
  | 'pull2'
  | 'kick0'
  | 'kick1'
  | 'kick2'
  | 'reach'
  | 'yank'
  | 'clothReach'
  | 'clothYank0'
  | 'clothYank1'
  | 'cheer0'
  | 'cheer1'
  | 'cheer2'
  | 'glance'
  | 'pat';

const JEANS_B = ['#121424', '#1c2036', '#282e4a', '#363e64'];
const DENIM_B = ['#141a32', '#1b2240', '#2b3a66', '#43598c'];
const SW = 52,
  SH = 104,
  SCX = 22,
  OY = 6;

// ----- side view, facing right. Points are in the walk frames' coordinates (feet at y 92). -----
function side(o: SideOpts) {
  const s = new Sprite(SW, SH),
    cx = SCX,
    b = o.bob || 0,
    ln = o.lean || 0;
  const Y = (y: number) => y + OY;
  const hip: Pt = [cx + Math.round(ln * 0.3), Y(56 + b)];
  const leg = (pts: Pt[], ramp: readonly string[], back: boolean) => {
    const knee: Pt = [pts[0][0], Y(pts[0][1])],
      foot: Pt = [pts[1][0], Y(pts[1][1])];
    stroke(s, [hip, knee, foot], 7, ramp);
    const fy = Math.min(Y(92), foot[1]);
    s.rect(foot[0] - 3, fy, 9, 4, back ? R.white[1] : R.white[2]);
    s.hline(foot[0] - 3, fy + 3, 9, R.grey[1]);
    s.set(foot[0] + 5, fy + 1, R.white[3]);
  };
  const sh: Pt = [cx + ln, Y(28 + b)];
  const arm = (pts: Pt[], ramp: readonly string[]) => {
    const p: Pt[] = [sh, ...pts.map(([x, y]): Pt => [x, Y(y)])];
    stroke(s, p, 5, ramp);
    const h = p[p.length - 1];
    fist(s, Math.round(h[0]), Math.round(h[1]), YOU.skin);
  };
  if (o.armB) arm(o.armB, DENIM_B);
  leg(
    o.legB || [
      [cx - 1, 75 + b],
      [cx - 2, 92],
    ],
    JEANS_B,
    true,
  );
  leg(
    o.legF || [
      [cx + 2, 75 + b],
      [cx + 2, 92],
    ],
    YOU.jeans,
    false,
  );
  const tilt = (j: number) => Math.round((ln * (58 + b - j)) / 35);
  const torso = (i: number, j: number) => {
    const jj = j - OY;
    return (
      jj >= 23 + b &&
      jj <= 58 + b &&
      Math.abs(i + 0.5 - cx - 1 - tilt(jj)) <= (jj < 27 + b ? 5 + (jj - 23 - b) : 8.5)
    );
  };
  shape(s, torso, YOU.jacket, { band: 1 });
  for (let j = 30; j < 54; j++) s.set(cx + 7 + tilt(j + b), Y(j + b), YOU.tee[2]);
  for (let i = -6; i < 9; i++) s.set(cx + i + tilt(54 + b), Y(54 + b), YOU.jacket[1]);
  const hx = cx + ln,
    hy = b + OY;
  s.rect(hx - 1, 18 + hy, 5, 6, YOU.skin[1]);
  shape(s, ell(hx + 1.5, 12 + hy, 7, 8.8), YOU.skin);
  shape(s, (i, j) => ell(hx + 1.5, 12 + hy, 7, 8.8)(i, j) && (i < hx - 1 || j < 9 + hy), R.hair);
  s.set(hx + 8, 12 + hy, YOU.skin[2]);
  s.set(hx + 9, 13 + hy, YOU.skin[1]);
  if (o.squint) s.hline(hx + 5, 11 + hy, 2, INK);
  else s.rect(hx + 5, 10 + hy, 2, 2, INK);
  s.set(hx + 4, 9 + hy, R.hair[1]);
  s.set(hx + 5, 9 + hy, R.hair[1]);
  if (o.grin) {
    s.hline(hx + 4, 16 + hy, 4, YOU.skin[0]);
    s.set(hx + 7, 15 + hy, YOU.skin[0]);
  } else s.hline(hx + 4, 16 + hy, 3, YOU.skin[0]);
  s.set(hx - 2, 12 + hy, YOU.skin[2]);
  s.set(hx - 2, 13 + hy, YOU.skin[1]);
  shape(s, (i, j) => ell(hx + 1.5, 7 + hy, 8.2, 5.6)(i, j) && j < 9 + hy, YOU.cap, { band: 1 });
  s.rect(hx + 6, 7 + hy, 7, 2, YOU.cap[1]);
  s.hline(hx + 6, 7 + hy, 7, YOU.cap[2]);
  if (o.armF) arm(o.armF, YOU.jacket);
  s.outline();
  if (o.key) {
    const h = o.armF![o.armF!.length - 1],
      kx = Math.round(h[0]) + 2,
      ky = Math.round(Y(h[1]));
    if (o.key === 'flat') {
      s.rect(kx, ky - 1, 2, 2, R.gold[3]);
      s.hline(kx + 2, ky, 4, R.gold[2]);
      s.set(kx + 4, ky + 1, R.gold[1]);
    } else {
      s.rect(kx, ky - 2, 2, 2, R.gold[3]);
      s.vline(kx + 2, ky - 2, 1, R.gold[2]);
      s.hline(kx + 2, ky, 3, R.gold[2]);
      s.set(kx + 3, ky - 1, R.gold[1]);
    }
  }
  return cv(s);
}
// ----- back view, for pulling the cloth off the counter in front of him -----
function back(o: BackOpts) {
  const Wd = 44,
    Hd = 104,
    cx = 22,
    s = new Sprite(Wd, Hd),
    b = o.bob || 0,
    ln = o.lean || 0;
  const shY = 24 + b + OY,
    waistY = 50 + b + OY,
    hipY = 56 + b + OY;
  for (const side2 of [-1, 1]) {
    const x0 = side2 < 0 ? cx - 8 : cx + 1,
      bend = b > 2 ? side2 * 1 : 0;
    shape(
      s,
      (i, j) =>
        i >= x0 + (j < 80 ? bend : 0) &&
        i < x0 + 7 + (j < 80 ? bend : 0) &&
        j >= hipY - 2 &&
        j < 93 + OY,
      YOU.jeans,
      { band: 1 },
    );
    shape(s, (i, j) => j >= 92 + OY && j < 96 + OY && i >= x0 - 1 && i < x0 + 8, R.white);
    s.hline(x0 - 1, 95 + OY, 9, R.grey[1]);
  }
  const torso = (i: number, j: number) => {
    if (j < shY) return false;
    const dx = Math.abs(i + 0.5 - cx - Math.round((ln * (hipY - j)) / 30));
    if (j < shY + 3) return dx <= 12 - (shY + 3 - j) * 1.6;
    if (j <= waistY) return dx <= 12 - ((j - shY - 3) * 3) / (waistY - shY - 3);
    return j <= hipY + 3 && dx <= 10;
  };
  shape(s, torso, YOU.jacket, { band: 1 });
  s.vline(cx, shY + 4, hipY - shY - 2, YOU.jacket[1]);
  s.hline(cx - 10, waistY, 21, YOU.jacket[1]);
  s.rect(cx - 5, shY - 1, 11, 3, YOU.jacket[3]);
  const armSides: [Pt[], number][] = [
    [o.armL, -1],
    [o.armR, 1],
  ];
  for (const [pts, side2] of armSides) {
    const p: Pt[] = [
      [cx + side2 * 10 + ln, shY + 3],
      ...pts.map(([x, y]): Pt => [cx + side2 * x + ln, y + b + OY]),
    ];
    stroke(s, p, 5, YOU.jacket);
    const h = p[p.length - 1];
    fist(s, Math.round(h[0]), Math.round(h[1]), YOU.skin);
  }
  const hx = cx + ln,
    hy = b + OY;
  s.rect(hx - 2, 16 + hy, 5, 9, YOU.skin[1]);
  shape(s, ell(hx + 0.5, 11 + hy, 7.6, 9), R.hair);
  s.set(hx - 8, 12 + hy, YOU.skin[2]);
  s.set(hx + 8, 12 + hy, YOU.skin[2]);
  shape(s, (i, j) => ell(hx + 0.5, 6 + hy, 8.4, 6)(i, j) && j < 9 + hy, YOU.cap, { band: 1 });
  s.hline(hx - 8, 8 + hy, 17, YOU.cap[1]);
  s.rect(hx - 2, 6 + hy, 5, 2, YOU.cap[0]);
  s.outline();
  return cv(s);
}
// ----- front view: youFront's body with arms drawn on their own outlined layer -----
function front(o: FrontOpts) {
  const b = stander({
    h: 96,
    w: 40,
    skin: YOU.skin,
    hair: 'short',
    hairRamp: R.hair,
    top: YOU.tee,
    coat: YOU.jacket,
    coatLen: 58,
    pants: YOU.jeans,
    shoes: YOU.shoes,
    look: o.look || 0,
    blink: false,
    mood: o.mood === 'grin' ? 'smile' : o.mood,
    arms: 'none',
  });
  const body = b.s,
    cx = b.cx;
  shape(body, (i, j) => ell(cx + 0.5, 5.5, 8.2, 5)(i, j) && j < 7, YOU.cap, { band: 1 });
  for (let i = -10; i <= 10; i++) {
    const y = 7 + (Math.abs(i) > 7 ? 1 : 0);
    body.set(cx + i, y, YOU.cap[3]);
    body.set(cx + i, y + 1, YOU.cap[2]);
  }
  for (let i = -7; i <= 7; i++) {
    const c = body.get(cx + i, 9);
    if (c) body.set(cx + i, 9, YOU.skin[0]);
  }
  if (o.mood === 'grin') body.hline(cx - 1, 18, 3, '#5a2228');
  body.outline();
  const OYF = 18,
    s = new Sprite(44, 96 + OYF),
    arms = new Sprite(44, 96 + OYF),
    dy = o.hop || 0;
  body.each((x, y, c) => {
    if (c) s.set(x + 2, y + OYF + dy, c);
  });
  const shL: Pt = [cx + 2 - 9, 27 + OYF + dy],
    shR: Pt = [cx + 2 + 9, 27 + OYF + dy];
  const shoulders: [Pt, Pt[]][] = [
    [shL, o.armL],
    [shR, o.armR],
  ];
  for (const [sh, pts] of shoulders) {
    const p: Pt[] = [sh, ...pts.map(([x, y]): Pt => [cx + 2 + x, y + OYF + dy])];
    stroke(arms, p, 5, YOU.jacket);
    const h = p[p.length - 1];
    fist(arms, Math.round(h[0]), Math.round(h[1]), YOU.skin);
  }
  if (o.envelope) {
    arms.rect(cx + 2 + 1, 40 + OYF + dy, 8, 5, R.paper[3]);
    arms.hline(cx + 3, 44 + OYF + dy, 8, R.paper[1]);
    arms.set(cx + 6, 41 + OYF + dy, '#2a6a3a');
  }
  arms.outline();
  s.stamp(arms, 0, 0);
  return cv(s);
}

const cx = SCX;
const DEF: Record<PoseName, () => Canvas> = {
  stand: () =>
    side({
      armF: [
        [cx, 42],
        [cx, 53],
      ],
      armB: [
        [cx - 1, 42],
        [cx - 1, 53],
      ],
    }),
  // the key: hand to the pocket, out to the padlock, a turn
  keyDig: () =>
    side({
      armF: [
        [cx + 3, 44],
        [cx + 5, 55],
      ],
      armB: [
        [cx - 2, 42],
        [cx - 2, 53],
      ],
    }),
  keyReach: () =>
    side({
      lean: 1,
      armF: [
        [cx + 9, 40],
        [cx + 17, 37],
      ],
      armB: [
        [cx - 2, 42],
        [cx - 1, 53],
      ],
      key: 'flat',
    }),
  keyTurn: () =>
    side({
      lean: 1,
      armF: [
        [cx + 9, 41],
        [cx + 17, 38],
      ],
      armB: [
        [cx - 2, 42],
        [cx - 1, 53],
      ],
      key: 'up',
    }),
  // pulling the door by its handle while backing off
  pull0: () =>
    side({
      lean: 1,
      armF: [
        [cx + 7, 34],
        [cx + 13, 31],
      ],
      armB: [
        [cx + 3, 42],
        [cx + 6, 50],
      ],
    }),
  pull1: () =>
    side({
      lean: -1,
      armF: [
        [cx + 5, 33],
        [cx + 9, 31],
      ],
      armB: [
        [cx - 3, 42],
        [cx - 4, 52],
      ],
      legB: [
        [cx - 4, 75],
        [cx - 7, 92],
      ],
    }),
  pull2: () =>
    side({
      lean: -2,
      armF: [
        [cx + 2, 34],
        [cx + 5, 32],
      ],
      armB: [
        [cx - 4, 42],
        [cx - 5, 52],
      ],
      legB: [
        [cx - 5, 75],
        [cx - 8, 92],
      ],
    }),
  // the kick, built facing right and mirrored to face the boards
  kick0: () =>
    side({
      lean: -2,
      armF: [
        [cx + 5, 38],
        [cx + 9, 44],
      ],
      armB: [
        [cx - 6, 36],
        [cx - 10, 42],
      ],
      legF: [
        [cx + 9, 64],
        [cx + 7, 80],
      ],
      legB: [
        [cx - 1, 75],
        [cx - 2, 92],
      ],
    }),
  kick1: () =>
    side({
      lean: -4,
      armF: [
        [cx + 3, 40],
        [cx + 2, 48],
      ],
      armB: [
        [cx - 7, 34],
        [cx - 12, 36],
      ],
      legF: [
        [cx + 9, 56],
        [cx + 16, 53],
      ],
      legB: [
        [cx - 2, 75],
        [cx - 3, 92],
      ],
      squint: true,
    }),
  kick2: () =>
    side({
      lean: -1,
      armF: [
        [cx + 4, 40],
        [cx + 5, 50],
      ],
      armB: [
        [cx - 5, 38],
        [cx - 8, 46],
      ],
      legF: [
        [cx + 6, 70],
        [cx + 4, 86],
      ],
      legB: [
        [cx - 1, 75],
        [cx - 2, 92],
      ],
    }),
  // the bulb's chain switch: up on the toes, then a tug
  reach: () =>
    side({
      bob: -1,
      armF: [
        [cx + 6, 16],
        [cx + 7, -2],
      ],
      armB: [
        [cx - 2, 42],
        [cx - 2, 53],
      ],
      legF: [
        [cx + 2, 74],
        [cx + 3, 91],
      ],
      legB: [
        [cx - 1, 74],
        [cx - 2, 91],
      ],
    }),
  yank: () =>
    side({
      armF: [
        [cx + 7, 20],
        [cx + 7, 5],
      ],
      armB: [
        [cx - 2, 42],
        [cx - 2, 53],
      ],
    }),
  // the cloth, from behind: hands to the counter edge, then a crouching yank
  clothReach: () =>
    back({
      armL: [
        [12, 32],
        [9, 22],
      ],
      armR: [
        [12, 32],
        [9, 22],
      ],
    }),
  clothYank0: () =>
    back({
      bob: 3,
      armL: [
        [13, 38],
        [11, 46],
      ],
      armR: [
        [13, 38],
        [11, 46],
      ],
    }),
  clothYank1: () =>
    back({
      bob: 5,
      armL: [
        [12, 42],
        [10, 54],
      ],
      armR: [
        [12, 42],
        [10, 54],
      ],
    }),
  // the happy pose: a dip, then arms up on a small hop, then back down
  cheer0: () =>
    front({
      mood: 'smile',
      armL: [
        [-11, 40],
        [-8, 50],
      ],
      armR: [
        [11, 40],
        [8, 50],
      ],
      hop: 2,
    }),
  cheer1: () =>
    front({
      mood: 'grin',
      armL: [
        [-13, 16],
        [-12, 2],
      ],
      armR: [
        [13, 16],
        [12, 2],
      ],
      hop: -3,
    }),
  cheer2: () =>
    front({
      mood: 'grin',
      armL: [
        [-13, 18],
        [-13, 6],
      ],
      armR: [
        [13, 18],
        [13, 6],
      ],
      hop: 0,
    }),
  // he can buy now: a glance at the notice and a pat on the envelope in his jacket
  glance: () =>
    front({
      look: 1,
      mood: 'smile',
      armL: [
        [-12, 38],
        [-12, 52],
      ],
      armR: [
        [12, 38],
        [12, 52],
      ],
    }),
  pat: () =>
    front({
      look: 1,
      mood: 'smile',
      armL: [
        [-12, 38],
        [-12, 52],
      ],
      armR: [
        [8, 36],
        [3, 41],
      ],
      envelope: true,
    }),
};
const cache = new Map<string, Canvas>();
const flip = (c: Canvas) => {
  const o = document.createElement('canvas');
  o.width = c.width;
  o.height = c.height;
  const g = o.getContext('2d')!;
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(c, 0, 0);
  return o;
};
export function poseImg(name: PoseName, left = false) {
  const key = name + (left ? '<' : '>');
  if (!cache.has(key)) {
    const img = DEF[name]();
    cache.set(name + '>', img);
    cache.set(name + '<', flip(img));
  }
  return cache.get(key)!;
}
// Where to draw a pose so the body's centre line stays at you.x + 19 and the feet on feet.
export function placePose(name: PoseName, x: number, feet: number, left = false) {
  const img = poseImg(name, left);
  if (name.startsWith('cloth')) return { img, x: x + 19 - 22, y: feet - 96 - OY - 1 };
  if (name.startsWith('cheer') || name === 'glance' || name === 'pat')
    return { img, x: x - 2, y: feet - 96 - 18 };
  const ox = left ? x + 19 - (SW - 1 - SCX) : x + 19 - SCX;
  return { img, x: ox, y: feet - 97 - OY };
}
export const POSE_NAMES = Object.keys(DEF) as PoseName[];
