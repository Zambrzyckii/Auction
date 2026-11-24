// The crew and the customers. A buddy is one full-body sprite, 56x104, with a head 21 px wide
// so the face reads at scale 2. Behind the counter the front layer hides him from the waist
// down, on the floor he walks whole.
import type { Ramp } from '../street/pix';
import type { CrewKey, Foot, Walker, WalkerId } from './gait';
import {
  ARM,
  GAIT,
  KB,
  KS,
  SIDE,
  armAngles,
  armPoints,
  idOf,
  knee,
  pose as walkPose,
  shakeOf,
  sizeOf,
  stepSign,
} from './gait';
import { INK, R, Sprite, bayer, box, disc, mix, shape, sphere, text } from '../street/pix';
import type { Arms, StanderOpts } from '../bank/people';
import { YOU, ell, fist, prop, stander, stroke } from '../bank/people';
import { accentOf } from '../items/sprites/helpers';
import { pawnedCore } from '../items/sprites/families';
import { rarityOf } from '../items/rarity';

type Pt = [number, number];
export type { CrewKey };
const cv = (s: Sprite) => s.canvas();
export const BW = 56,
  BH = 104,
  CX = 28,
  EYE = 17;
const blushOf = (sk: Ramp) => mix(sk[2], '#e0605a', 0.35);

const KEY_OF = {
  Common: 'clerk',
  Rare: 'appraiser',
  Epic: 'dealer',
  Legendary: 'magnate',
} as const;
export const crewKeyOf = (rarity: string | null | undefined): CrewKey => KEY_OF[rarityOf(rarity)];

export interface Look {
  skin: Ramp;
  hair: Ramp;
  build: [number, number];
  top: Ramp;
  over?: Ramp;
  plaid?: boolean;
  cardigan?: boolean;
  track?: boolean;
  velvet?: boolean;
  fanny?: boolean;
  chain?: boolean;
  mustache?: boolean;
  glasses?: boolean;
  pants: Ramp;
  shoes: Ramp;
  hat: 'beanie' | 'bun' | 'cap' | 'bowler';
  hatRamp?: Ramp;
  capRamp?: Ramp;
  neckLen?: number;
}
export const LOOK: Record<CrewKey, Look> = {
  clerk: {
    skin: R.skinB,
    hair: R.hair,
    build: [11, 9],
    top: R.white,
    over: ['#3a0e14', '#7a1c24', '#b0303a', '#d9584a'],
    plaid: true,
    pants: R.denim,
    shoes: R.white,
    hat: 'beanie',
    hatRamp: R.green,
    neckLen: 1,
  },
  appraiser: {
    skin: R.skinC,
    hair: R.grey,
    build: [12, 11],
    top: R.cream,
    over: R.mauve,
    cardigan: true,
    pants: R.coat,
    shoes: R.coat,
    hat: 'bun',
    glasses: true,
  },
  dealer: {
    skin: R.skinA,
    hair: R.hair,
    build: [16, 14],
    top: R.white,
    over: R.teal,
    track: true,
    pants: R.teal,
    shoes: R.white,
    hat: 'cap',
    capRamp: R.purple,
    chain: true,
    fanny: true,
  },
  magnate: {
    skin: ['#4a2a22', '#7a4a38', '#a8704f', '#c99272'],
    hair: R.white,
    build: [15, 16],
    top: R.cream,
    over: ['#2a0e1a', '#4a1a2c', '#6e2a40', '#8e4258'],
    velvet: true,
    pants: R.black,
    shoes: R.black,
    hat: 'bowler',
    mustache: true,
  },
};

// Arm points [shoulder, elbow, hand] per pose, relative to the shoulder half-width sh. Side 1 is the
// viewer's right. A pose 'a>b:k' is k quarters of the way from pose a to pose b, the in-between frames.
function armKey(pose: string, side: number, sh: number): Pt[] {
  const s: Pt = [CX + side * (sh - 2), 35],
    right = side > 0;
  switch (pose) {
    case 'hold':
      return [s, [CX + side * (sh + 1), 48], [CX + side * 6, 55]];
    case 'guns':
      return [s, [CX + side * (sh + 2), 46], [CX + side * (sh + 8), 42]];
    case 'gunsWind':
      return [s, [CX + side * (sh + 3), 47], [CX + side * (sh - 1), 41]];
    case 'gunsRecoil':
      return [s, [CX + side * (sh + 3), 42], [CX + side * (sh + 9), 34]];
    case 'shrug':
      return [s, [CX + side * (sh + 4), 44], [CX + side * (sh + 8), 36]];
    case 'lean':
      return [s, [CX + side * (sh + 1), 47], [CX + 3 + side, 56]];
    default:
      break;
  }
  if (right) {
    switch (pose) {
      case 'wave':
        return [s, [CX + sh + 6, 30], [CX + sh + 5, 17]];
      case 'wave2':
        return [s, [CX + sh + 6, 30], [CX + sh + 10, 19]];
      case 'up':
        return [s, [CX + sh + 3, 22], [CX + sh + 1, 6]];
      case 'dustA':
        return [s, [CX + sh + 5, 44], [CX + sh + 9, 53]];
      case 'dustB':
        return [s, [CX + sh + 2, 49], [CX + 7, 58]];
      case 'dustC':
        return [s, [CX + sh - 2, 49], [CX - 7, 57]];
      case 'loupe':
        return [s, [CX + sh + 3, 43], [CX + 5, EYE + 4]];
      case 'twirl':
        return [s, [CX + sh + 4, 41], [CX + 9, EYE + 9]];
      case 'twirl2':
        return [s, [CX + sh + 4, 39], [CX + 10, EYE + 7]];
      case 'nose':
        return [s, [CX + sh + 3, 43], [CX + 3, EYE + 8]];
      default:
        break;
    }
  } else if (pose === 'reach' || pose === 'give') return [s, [CX - sh - 5, 46], [CX - sh - 12, 56]];
  return [s, [CX + side * (sh + 1), 47], [CX + side * sh, 59]];
}
function splitPose(pose: string) {
  if (!pose.includes('>')) return { a: pose, b: pose, k: 0 };
  const [a, rest] = pose.split('>'),
    [b, k] = rest.split(':');
  return { a, b, k: Number(k || 0) / 4 };
}
function armPts(pose: string, side: number, sh: number): Pt[] {
  const p = splitPose(pose),
    A = armKey(p.a, side, sh);
  if (!p.k) return A;
  const B = armKey(p.b, side, sh);
  return A.map(([x, y], i): Pt => [
    Math.round(x + (B[i][0] - x) * p.k),
    Math.round(y + (B[i][1] - y) * p.k),
  ]);
}
// The hand shape follows the pose the arm is closer to.
function handPose(pose: string) {
  const p = splitPose(pose);
  return p.k >= 0.5 ? p.b : p.a;
}

function eyeOpen(s: Sprite, x: number, sk: Ramp, wide: boolean, look: number) {
  s.rect(x, EYE - (wide ? 1 : 0), 4, wide ? 4 : 3, R.white[3]);
  s.rect(x + 1 + look, EYE - (wide ? 1 : 0), 2, wide ? 4 : 3, INK);
  s.set(x + 1 + look, EYE - (wide ? 1 : 0), '#ffffff');
  s.hline(x, EYE + (wide ? 3 : 2) + 1, 4, sk[1]);
}
// fx shifts the features sideways for the three-quarter turn frame.
function face(s: Sprite, o: Look, mood: string, look = 0, fx = 0) {
  const sk = o.skin,
    br = (o.hair === R.white ? R.grey : o.hair)[1],
    C = CX + fx;
  const eyes = [C - 6, C + 2];
  if (mood === 'blink' || mood === 'laugh' || mood === 'sneeze') {
    for (const x of eyes) {
      if (mood === 'laugh') {
        s.set(x, EYE + 1, INK);
        s.hline(x + 1, EYE, 2, INK);
        s.set(x + 3, EYE + 1, INK);
      } else if (mood === 'sneeze') {
        s.hline(x, EYE + 1, 4, INK);
        s.set(x + (x < C ? 3 : 0), EYE, INK);
      } else s.hline(x, EYE + 1, 4, sk[0]);
    }
  } else if (mood === 'half') {
    for (const x of eyes) {
      eyeOpen(s, x, sk, false, look);
      s.hline(x, EYE, 4, sk[1]);
      s.hline(x, EYE + 1, 4, sk[0]);
    }
  } else if (mood === 'squint') {
    s.hline(eyes[0], EYE + 1, 4, INK);
    s.set(eyes[0] + 3, EYE, INK);
    eyeOpen(s, eyes[1], sk, true, 0);
  } else {
    for (const x of eyes) eyeOpen(s, x, sk, mood === 'wow', look);
  }
  const by = mood === 'wow' ? EYE - 4 : EYE - 3;
  s.hline(eyes[0], by, 4, br);
  s.set(eyes[0] - 1, by + 1, br);
  s.hline(eyes[1], by, 4, br);
  s.set(eyes[1] + 4, by + 1, br);
  s.set(C, EYE + 3, sk[1]);
  s.set(C, EYE + 4, sk[1]);
  s.set(C - 1, EYE + 4, sk[3]);
  s.set(C + 1, EYE + 5, sk[0]);
  for (const x of [C - 8, C + 6]) {
    s.set(x, EYE + 4, blushOf(sk));
    s.set(x + 1, EYE + 4, blushOf(sk));
  }
  const my = EYE + 7;
  if (o.mustache) {
    s.hline(C - 5, my - 1, 11, o.hair[3]);
    s.hline(C - 6, my, 4, o.hair[2]);
    s.hline(C + 3, my, 4, o.hair[2]);
    s.set(C - 7, my + 1, o.hair[2]);
    s.set(C + 7, my + 1, o.hair[2]);
  }
  if (mood === 'laugh' || mood === 'sneeze') {
    shape(
      s,
      (i, j) =>
        j >= my && j <= my + 3 && Math.abs(i + 0.5 - C) <= 4 - Math.max(0, j - my - 1) * 1.2,
      ['#3a0c18', '#3a0c18', '#5a1222', '#5a1222'],
    );
    if (mood === 'laugh') {
      s.hline(C - 3, my, 7, R.white[3]);
      s.hline(C - 1, my + 2, 3, '#d8606a');
    }
  } else if (mood === 'wow' || mood === 'squint') {
    s.rect(C - 1, my, 3, 3, '#3a0c18');
    s.hline(C - 1, my - 1, 3, sk[0]);
  } else {
    s.hline(C - 3, my + 1, 7, sk[0]);
    s.set(C - 4, my, sk[0]);
    s.set(C + 4, my, sk[0]);
    s.hline(C - 2, my, 5, R.white[3]);
  }
}

// o: a LOOK entry. pose: a key of armKey or an in-between 'a>b:k'. mood: 'smile' | 'blink' | 'half' |
// 'laugh' | 'wow' | 'sneeze' | 'squint'. step: 0 stands, 1 or -1 lifts a foot. turn: -1 or 1 draws the
// three-quarter frame of a turn. breath: 1 lifts the shoulders and the head by 1 px.
function buddyRaw(
  o: Look,
  pose = 'down',
  mood = 'smile',
  step = 0,
  look = 0,
  turn = 0,
  breath = 0,
) {
  const s = new Sprite(BW, BH),
    sk = o.skin,
    [sh, wh] = o.build;
  // legs and shoes
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? CX - 8 : CX + 1,
      lift = step === side ? 3 : 0;
    shape(s, (i, j) => i >= x0 && i < x0 + 7 && j >= 62 && j < BH - 4 - lift, o.pants, { band: 1 });
    if (o.track) s.vline(side < 0 ? x0 : x0 + 6, 64, BH - 70 - lift, R.white[3]);
    shape(
      s,
      (i, j) =>
        j >= BH - 5 - lift &&
        j < BH - lift &&
        i >= x0 - (side < 0 ? 2 : 0) &&
        i < x0 + 7 + (side > 0 ? 2 : 0),
      o.shoes,
    );
  }
  // torso, flaring over the hips for the oversized flannel and the heavyset build
  const torso = (i: number, j: number) => {
    if (j < 31) return false;
    const dx = Math.abs(i + 0.5 - CX);
    if (j < 35) return dx <= sh - (35 - j) * 1.8;
    if (j <= 66) return dx <= sh + (wh - sh) * ((j - 35) / 31);
    return false;
  };
  shape(s, torso, o.top, { band: 1 });
  const open = (i: number, j: number) =>
    Math.abs(i + 0.5 - CX) < Math.max(1.5, 6 - (j - 31) * 0.25) && j < 52;
  shape(s, (i, j) => torso(i, j) && !(o.over && open(i, j) && !o.track), o.over || o.top, {
    band: 1,
  });
  if (o.plaid)
    s.each((x, y, c) => {
      if (torso(x, y) && !open(x, y) && c) {
        if ((x - CX + 40) % 5 === 0) s.set(x, y, o.over![0]);
        else if (y % 5 === 0) s.set(x, y, mix(c, R.black[1], 0.5));
      }
    });
  if (o.track) {
    s.vline(CX, 33, 33, R.white[2]);
    s.set(CX, 33, R.gold[3]);
    s.set(CX, 34, R.gold[2]);
  }
  if (o.cardigan) for (let j = 38; j < 64; j += 5) s.set(CX + 2, j, R.gold[2]);
  if (o.velvet) {
    s.each((x, y, c) => {
      if (c === o.over![2] && bayer(x * 3, y) < 0.08) s.set(x, y, '#a89d8a');
    });
    s.hline(CX + 4, 50, 7, R.gold[3]);
    s.set(CX + 10, 51, R.gold[2]);
    s.rect(CX - 2, 32, 4, 4, R.gold[2]);
    s.set(CX - 2, 32, R.gold[3]);
  }
  if (o.fanny) {
    s.line(CX - sh + 2, 34, CX + sh - 3, 58, R.black[1]);
    s.line(CX - sh + 3, 34, CX + sh - 2, 58, R.black[2]);
    box(s, CX - 7, 44, 12, 7, R.black, { band: 1 });
    s.rect(CX - 3, 46, 4, 2, R.gold[2]);
  }
  // arms by pose
  const sleeve = o.over || o.top,
    hp = handPose(pose);
  for (const side of [-1, 1]) {
    const pts = armPts(pose, side, sh);
    stroke(s, pts, 6, sleeve);
    if (o.track)
      stroke(
        s,
        pts.map(([x, y]) => [x + side * 2, y]),
        1,
        [R.white[3], R.white[3], R.white[3], R.white[3]],
      );
    const [hx, hy] = pts[pts.length - 1];
    if (hp === 'guns' || hp === 'gunsRecoil') {
      fist(s, hx, hy, sk);
      s.hline(hx + side * 2, hy - 1, 3, sk[2]);
      s.set(hx + side * 4, hy - 1, sk[3]);
    } else if ((hp === 'wave' || hp === 'wave2' || hp === 'up') && side > 0) {
      s.rect(hx - 2, hy - 3, 5, 6, sk[2]);
      s.set(hx - 2, hy - 3, sk[3]);
      for (let k = -2; k <= 2; k += 2) s.set(hx + k, hy - 4, sk[2]);
      s.set(hx - 3, hy, sk[2]);
    } else if (hp === 'reach' && side < 0) {
      s.rect(hx - 3, hy - 2, 5, 4, sk[2]);
      s.hline(hx - 3, hy - 2, 5, sk[3]);
      s.hline(hx - 3, hy + 1, 5, sk[1]);
    } else fist(s, hx, hy, sk);
  }
  // neck and head
  s.rect(CX - 3, 25, 6, 8, sk[1]);
  s.hline(CX - 3, 31, 6, sk[0]);
  if (o.chain) {
    for (let i = -5; i <= 5; i++) s.set(CX + i, 33 + Math.round((25 - i * i) * 0.12), R.gold[3]);
    s.rect(CX - 1, 36, 3, 3, R.gold[2]);
  }
  const head = ell(CX + 0.5, EYE, 9.6, 11);
  if (o.hat === 'bun') {
    shape(s, ell(CX + 0.5, 9, 10.6, 9), o.hair);
    shape(s, ell(CX + 0.5, 3, 3.6, 2.8), o.hair, { band: 1 });
  }
  shape(s, head, sk);
  for (const side of [-1, 1])
    if (side !== turn) shape(s, ell(CX + 0.5 + side * 10 + turn * 2, EYE + 1.5, 2, 3), sk);
  face(s, o, mood, look + turn, turn * 3);
  const hairTop = (i: number, j: number) =>
    head(i, j) && (j < EYE - 5 || (j < EYE && Math.abs(i + 0.5 - CX - 0.5) > 8));
  if (o.hat === 'beanie') {
    for (let i = -9; i <= 9; i += 3) {
      s.set(CX + i, EYE - 4, o.hair[1]);
      s.set(CX + i + 1, EYE - 4, o.hair[2]);
    }
    shape(
      s,
      (i, j) =>
        (ell(CX + 1.5, 7, 11, 9)(i, j) && j < 12) ||
        (j >= 9 && j < 12 && Math.abs(i + 0.5 - CX) <= 11),
      o.hatRamp!,
      { band: 1 },
    );
    for (let i = CX - 10; i <= CX + 10; i += 2) s.set(i, 10, o.hatRamp![1]);
    shape(s, ell(CX + 8.5, 1.5, 3, 2.4), o.hatRamp!);
  } else if (o.hat === 'bun') {
    shape(s, hairTop, o.hair);
    s.set(CX - 3, 8, o.hair[3]);
    s.set(CX + 2, 7, o.hair[3]);
  } else if (o.hat === 'cap') {
    shape(s, hairTop, o.hair);
    shape(s, (i, j) => ell(CX + 0.5, 8, 10.4, 6.4)(i, j) && j < 11, o.capRamp!, { band: 1 });
    s.rect(CX - 14, 8, 5, 2, o.capRamp![1]);
    s.hline(CX - 14, 8, 5, o.capRamp![2]);
    s.rect(CX - 1, 2, 2, 2, o.capRamp![3]);
  } else if (o.hat === 'bowler') {
    shape(
      s,
      (i, j) => head(i, j) && j >= EYE - 4 && j < EYE + 1 && Math.abs(i + 0.5 - CX - 0.5) > 8.4,
      o.hair,
    );
    shape(s, (i, j) => ell(CX + 0.5, 6, 9, 7)(i, j) && j < 9, R.black, { band: 1 });
    s.rect(CX - 13, 8, 27, 2, R.black[2]);
    s.hline(CX - 13, 8, 27, R.black[3]);
    s.hline(CX - 8, 7, 17, '#6e2a40');
  }
  if (o.glasses)
    for (const ex of [CX - 4, CX + 4])
      for (let a = 0; a < 24; a++) {
        const t = (a / 24) * Math.PI * 2;
        s.set(
          Math.round(ex + Math.cos(t) * 3.4 - (ex < CX ? 0.5 : 0.5)),
          Math.round(EYE + 1 + Math.sin(t) * 3),
          R.gold[1],
        );
      }
  if (o.glasses) {
    s.hline(CX - 1, EYE, 2, R.gold[1]);
    s.line(CX + 4, EYE + 4, CX + 5, 40, R.gold[2]);
    disc(s, CX + 5, 42, 2.2, R.black[2]);
    s.set(CX + 5, 42, '#8db0b0');
  }
  s.outline();
  if (breath) breathe(s);
  return s;
}
// The rows above the chest move up by one, the row at the chest stretches to close the gap.
function breathe(s: Sprite) {
  for (let y = 0; y < 45; y++)
    for (let x = 0; x < s.w; x++) s.c[y * s.w + x] = s.c[(y + 1) * s.w + x];
}
const cache = new Map<string, HTMLCanvasElement>();
export function buddy(
  key: CrewKey,
  pose = 'down',
  mood = 'smile',
  step = 0,
  look = 0,
  turn = 0,
  breath = 0,
) {
  const k = [key, pose, mood, step, look, turn, breath].join('|');
  const cached = cache.get(k);
  if (cached) return cached;
  const img = cv(buddyRaw(LOOK[key], pose, mood, step, look, turn, breath));
  if (cache.size > 320) cache.clear();
  cache.set(k, img);
  return img;
}
// Both hands of a pose in sprite coordinates, so the props follow the in-between frames.
export function hands(key: CrewKey, pose = 'down') {
  const sh = LOOK[key].build[0];
  return { L: armPts(pose, -1, sh)[2], R: armPts(pose, 1, sh)[2] };
}

// ----- props the crew holds -----
export const duster = prop(10, 16, (s) => {
  for (let k = 0; k < 7; k++) {
    const a = -1.2 + k * 0.4;
    s.line(5, 6, 5 + Math.cos(a) * 4.5, 6 - Math.sin(a + 1.6) * 5.5, k % 2 ? '#e070a0' : '#ffb0d0');
  }
  s.vline(5, 7, 9, R.wood[2]);
  s.vline(6, 7, 9, R.wood[1]);
});
export const loupe = prop(8, 8, (s) => {
  disc(s, 3.5, 3.5, 3.4, R.black[2]);
  disc(s, 3.5, 3.5, 2.2, '#8db0b0');
  s.set(2, 2, '#ffffff');
  s.line(6, 6, 7, 7, R.black[2]);
});
export const cane = prop(8, 46, (s) => {
  s.rect(3, 6, 2, 40, R.black[2]);
  s.vline(3, 6, 40, R.black[3]);
  sphere(s, 4, 3.5, 3.6, R.gold);
});
export const box2 = prop(22, 16, (s) => {
  box(s, 0, 2, 22, 14, R.tan, { band: 1 });
  s.hline(0, 2, 22, R.tan[3]);
  s.vline(10, 2, 14, R.paper[3]);
  s.rect(3, 0, 6, 3, R.tan[2]);
  s.rect(13, 0, 6, 3, R.tan[1]);
});
export const keys = prop(9, 9, (s) => {
  disc(s, 3, 3, 2.6, R.gold[2]);
  s.set(3, 3, null);
  s.set(2, 2, R.gold[3]);
  s.line(5, 5, 8, 8, R.gold[2]);
  s.set(7, 8, R.gold[1]);
});
export const envelope = prop(14, 9, (s) => {
  s.rect(0, 0, 14, 9, R.paper[3]);
  s.hline(0, 8, 14, R.paper[1]);
  s.line(0, 0, 7, 4, R.paper[1]);
  s.line(13, 0, 7, 4, R.paper[1]);
  text(s, '$', 5, 3, '#2a6a3a', 'tiny', { alignTop: true });
});
export const bundle = prop(18, 14, (s) => {
  shape(s, ell(9, 8, 8.6, 6), ['#3a2a3a', '#5a405a', '#7a5a78', '#9a7a96'], { band: 1 });
  s.rect(7, 0, 4, 4, '#7a5a78');
  s.hline(5, 3, 8, R.paper[1]);
  s.each((x, y, c) => {
    if (c && (x + y) % 6 === 0) s.set(x, y, '#5a405a');
  });
});
export const parcel = prop(16, 12, (s) => {
  box(s, 0, 0, 16, 12, R.paper, { band: 1 });
  s.vline(7, 0, 12, R.red[2]);
  s.hline(0, 5, 16, R.red[2]);
  s.rect(6, 3, 3, 3, R.red[3]);
});

// ----- customers: sympathetic street people with something wrapped to pawn -----
export const CUSTOMERS: StanderOpts[] = [
  {
    skin: R.skinA,
    hair: 'bun',
    hairRamp: R.hair,
    top: R.white,
    coat: R.teal,
    coatLen: 80,
    pants: R.black,
    shoes: R.coat,
    scarfNeck: R.gum,
  },
  {
    skin: R.skinB,
    hair: 'hood',
    hatRamp: R.hoodie,
    hairRamp: R.hair,
    top: R.hoodie,
    pants: R.denim,
    shoes: R.white,
  },
  {
    skin: R.skinC,
    hair: 'beanie',
    hatRamp: R.moss,
    hairRamp: R.grey,
    top: R.grey,
    coat: R.coat,
    coatLen: 82,
    pants: R.olive,
    shoes: R.black,
    stubble: true,
  },
  {
    skin: ['#4a2a22', '#7a4a38', '#a8704f', '#c99272'],
    hair: 'long',
    hairRamp: R.rust,
    top: R.purple,
    pants: R.denim,
    shoes: R.red,
  },
];
export interface Customer {
  img: HTMLCanvasElement;
  hand: number[];
}
const custCache = new Map<string, Customer>();
export function customer(
  i: number,
  mood: string,
  blink = false,
  turn = 0,
  arms: Arms = 'chest',
): Customer {
  const k = [i, mood, blink, turn, arms].join('|');
  const cached = custCache.get(k);
  if (cached) return cached;
  const b = stander({
    h: 96,
    w: 40,
    look: turn || 1,
    turn,
    arms,
    mood: mood === 'happy' ? 'smile' : 'worried',
    blink,
    ...CUSTOMERS[i % CUSTOMERS.length],
  });
  const made = { img: cv(b.s), hand: b.handL };
  if (custCache.size > 160) custCache.clear();
  custCache.set(k, made);
  return made;
}

// Shelf size: the same drawing halved by majority colour per 2x2 block, then outlined. Dust is a
// dithered grey veil in five steps, from fresh (0) to five minutes on the shelf (4).
const minis = new Map<string, HTMLCanvasElement>();
export function mini(rarity: string, dust = 0) {
  const k = rarity + dust;
  const cached = minis.get(k);
  if (cached) return cached;
  const r = rarityOf(rarity),
    acc = accentOf(r);
  const src = pawnedCore(r),
    s = new Sprite(18, 18);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const cnt = new Map<string, number>();
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const c = src.get(x * 2 + dx, y * 2 + dy);
        if (c) cnt.set(c, (cnt.get(c) || 0) + 1 + (c === R.paper[3] || c === acc[2] ? 0.6 : 0));
      }
      let best: string | null = null,
        n = 0;
      for (const [c, m] of cnt)
        if (m > n) {
          best = c;
          n = m;
        }
      if (best && n >= 1.5) s.set(x + 1, y + 1, best);
    }
  s.outline();
  if (dust)
    s.each((x, y, c) => {
      if (c && bayer(x * 3 + 1, y * 2) < dust * 0.13) s.set(x, y, mix(c, '#a49c90', 0.55));
    });
  const img = cv(s);
  if (minis.size > 160) minis.clear();
  minis.set(k, img);
  return img;
}

// ===== the side-view bodies =====
// Every walker is a side view: torso and head are baked per look and mood, legs and arms are drawn
// live each frame by drawWalker.
const darks = new WeakMap<Ramp, Ramp>();
const dark = (r: Ramp): Ramp => {
  const known = darks.get(r);
  if (known) return known;
  const made = [r[0], r[0], r[1], r[2]];
  darks.set(r, made);
  return made;
};
const flipCanvas = (c: HTMLCanvasElement) => {
  const o = document.createElement('canvas');
  o.width = c.width;
  o.height = c.height;
  const g = o.getContext('2d')!;
  g.translate(c.width, 0);
  g.scale(-1, 1);
  g.drawImage(c, 0, 0);
  return o;
};

function sideBuddy(key: CrewKey, mood: string) {
  const o = LOOK[key],
    sd = SIDE[key],
    s = new Sprite(KB.w, KB.h),
    sk = o.skin,
    lean = GAIT[key].lean,
    hem = sd.hem;
  const lx = (j: number) => Math.round((lean * Math.max(0, hem - j)) / (hem - 31));
  const bulge = (j: number) => sd.belly * Math.max(0, 1 - ((j - 54) / 11) ** 2);
  const frontX = (j: number) => CX + lx(j) + sd.front + Math.round(bulge(j));
  shape(s, ell(CX + 0.5, 64, sd.back + 1, 6), o.pants, { band: 1 });
  const torso = (i: number, j: number) => {
    if (j < 30 || j > hem) return false;
    const x = i + 0.5 - CX - lx(j),
      cut = j < 35 ? (35 - j) * 1.5 : 0;
    return x >= -sd.back - 0.5 + cut * 0.8 && x <= sd.front + 0.5 + bulge(j) - cut;
  };
  shape(s, torso, o.over || o.top, { band: 1 });
  const shirtTo = o.plaid ? 52 : 44;
  if (o.over && !o.track)
    for (let j = 33; j < shirtTo; j++)
      for (let i = frontX(j) - 2; i <= frontX(j); i++)
        if (torso(i, j)) s.set(i, j, i === frontX(j) ? o.top[1] : o.top[2]);
  if (o.plaid)
    s.each((x, y, c) => {
      if (!c || !torso(x, y) || (y < shirtTo && x >= frontX(y) - 2)) return;
      if ((x + 40) % 5 === 0) s.set(x, y, o.over![0]);
      else if (y % 5 === 0) s.set(x, y, mix(c, R.black[1], 0.5));
    });
  if (o.track) {
    for (let j = 33; j < hem; j++) s.set(frontX(j) - 1, j, R.white[2]);
    s.set(frontX(33) - 1, 33, R.gold[3]);
    s.hline(CX - sd.back + 1, hem - 1, sd.back + sd.front + 2, R.white[3]);
  }
  if (o.cardigan) for (let j = 38; j < 64; j += 5) s.set(frontX(j) - 1, j, R.gold[2]);
  if (o.velvet) {
    s.each((x, y, c) => {
      if (c === o.over![2] && bayer(x * 3, y) < 0.08) s.set(x, y, '#a89d8a');
    });
    s.line(frontX(34) - 2, 34, frontX(46) - 4, 46, o.over![1]);
    s.line(frontX(51) - 5, 51, frontX(54) - 1, 54, R.gold[3]);
    s.set(frontX(54) - 1, 55, R.gold[2]);
  }
  if (o.fanny) {
    s.line(CX - 6, 33, frontX(50) - 2, 50, R.black[1]);
    box(s, frontX(50) - 3, 46, 7, 7, R.black, { band: 1 });
    s.hline(frontX(50) - 2, 48, 4, R.gold[2]);
  }
  const nx = CX + lx(28);
  s.rect(nx - 2, 24, 6, 9, sk[1]);
  s.vline(nx - 2, 24, 9, sk[0]);
  const hx = CX + 1 + lean;
  const jaw = (i: number, j: number) =>
    j >= EYE - 2 && j <= EYE + 9 && i >= hx - 2 && i <= hx + 9 - Math.max(0, j - EYE - 6) * 1.4;
  const headU = (i: number, j: number) => ell(hx + 0.5, EYE, 9.2, 10.8)(i, j) || jaw(i, j);
  if (o.hat === 'bun') {
    shape(s, ell(hx - 7, 6, 4.2, 3.6), o.hair, { band: 1 });
    s.set(hx - 8, 4, o.hair[3]);
  }
  shape(s, headU, sk);
  shape(s, ell(hx - 2, EYE + 1.5, 2.2, 3.2), sk);
  s.set(hx - 2, EYE + 1, sk[0]);
  s.set(hx - 2, EYE + 2, sk[1]);
  const br = (o.hair === R.white ? R.grey : o.hair)[1],
    ex = hx + 4;
  sideEye(s, ex, sk, mood);
  s.hline(ex - 1, mood === 'wow' ? EYE - 4 : EYE - 3, 4, br);
  s.rect(hx + 9, EYE + 1, 1, 2, sk[2]);
  s.rect(hx + 10, EYE + 2, 1, 3, sk[2]);
  s.set(hx + 10, EYE + 2, sk[3]);
  s.set(hx + 11, EYE + 4, sk[2]);
  s.set(hx + 10, EYE + 5, sk[1]);
  s.set(hx + 9, EYE + 5, sk[0]);
  s.set(hx + 3, EYE + 4, blushOf(sk));
  s.set(hx + 4, EYE + 4, blushOf(sk));
  const my = o.mustache ? EYE + 8 : EYE + 7;
  if (o.mustache) {
    s.hline(hx + 3, EYE + 6, 7, o.hair[3]);
    s.hline(hx + 2, EYE + 7, 4, o.hair[2]);
    s.set(hx + 10, EYE + 5, o.hair[3]);
    s.set(hx + 10, EYE + 4, o.hair[2]);
  }
  sideMouth(s, hx + 5, my, sk, mood);
  if (o.hat === 'beanie') {
    shape(s, (i, j) => headU(i, j) && i < hx - 3 && j >= EYE - 4 && j < EYE + 5, o.hair);
    shape(
      s,
      (i, j) =>
        (ell(hx + 0.5, 8, 10.4, 8.4)(i, j) && j < 12) ||
        (j >= 9 && j < 12 && i >= hx - 10 && i <= hx + 9),
      o.hatRamp!,
      { band: 1 },
    );
    for (let i = hx - 10; i <= hx + 9; i += 2) s.set(i, 10, o.hatRamp![1]);
    shape(s, ell(hx - 9.5, 4, 3.6, 2.8), o.hatRamp!);
  } else if (o.hat === 'bun') {
    shape(s, (i, j) => headU(i, j) && (j < EYE - 4 || (i < hx - 1 && j < EYE + 4)), o.hair);
    s.set(hx - 3, 8, o.hair[3]);
    s.set(hx + 2, 7, o.hair[3]);
  } else if (o.hat === 'cap') {
    shape(s, (i, j) => headU(i, j) && (j < EYE - 4 || (i < hx - 2 && j < EYE + 3)), o.hair);
    shape(s, (i, j) => ell(hx + 0.5, 8, 10, 6.4)(i, j) && j < 11, o.capRamp!, { band: 1 });
    s.rect(hx - 13, 9, 4, 2, o.capRamp![1]);
    s.hline(hx - 13, 9, 4, o.capRamp![2]);
    s.rect(hx - 1, 2, 2, 2, o.capRamp![3]);
  } else if (o.hat === 'bowler') {
    shape(s, (i, j) => headU(i, j) && i < hx - 3 && j >= EYE - 5 && j < EYE + 2, o.hair);
    shape(s, (i, j) => ell(hx + 0.5, 6, 8.4, 6)(i, j) && j < 9, R.black, { band: 1 });
    s.rect(hx - 10, 8, 21, 2, R.black[2]);
    s.hline(hx - 10, 8, 21, R.black[3]);
    s.set(hx - 11, 7, R.black[2]);
    s.set(hx + 11, 7, R.black[2]);
    s.hline(hx - 7, 7, 15, '#6e2a40');
  }
  if (o.glasses) {
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      s.set(
        Math.round(ex + 1 + Math.cos(t) * 3.2),
        Math.round(EYE + 1.5 + Math.sin(t) * 3),
        R.gold[1],
      );
    }
    s.line(ex - 3, EYE, hx - 1, EYE, R.gold[1]);
    s.line(hx - 1, EYE + 2, frontX(40) - 1, 40, R.gold[2]);
    disc(s, frontX(42), 42, 2.2, R.black[2]);
    s.set(frontX(42), 42, '#8db0b0');
  }
  if (o.chain) {
    s.line(nx + 3, 30, frontX(38) - 1, 38, R.gold[3]);
    s.line(nx + 2, 31, frontX(38) - 2, 38, R.gold[2]);
  }
  s.outline();
  return s;
}
function sideEye(s: Sprite, ex: number, sk: Ramp, mood: string) {
  if (mood === 'blink' || mood === 'sneeze') {
    s.hline(ex, EYE + 1, 3, sk[0]);
    s.set(ex + 3, EYE + 2, sk[0]);
    return;
  }
  if (mood === 'laugh') {
    s.hline(ex, EYE + 1, 3, INK);
    s.set(ex + 1, EYE, INK);
    return;
  }
  const wide = mood === 'wow' ? 1 : 0;
  s.rect(ex, EYE - wide, 3, 3 + wide, R.white[3]);
  s.rect(ex + 1, EYE - wide, 2, 3 + wide, INK);
  s.set(ex + 1, EYE - wide, '#ffffff');
  s.hline(ex, EYE + 3, 3, sk[1]);
  if (mood === 'half') {
    s.hline(ex, EYE, 3, sk[1]);
    s.hline(ex, EYE + 1, 3, sk[0]);
  }
}
function sideMouth(s: Sprite, x: number, y: number, sk: Ramp, mood: string) {
  if (mood === 'laugh' || mood === 'sneeze') {
    s.rect(x, y - 1, 4, 3, '#3a0c18');
    s.hline(x, y - 1, 4, R.white[3]);
    s.set(x + 1, y + 1, '#d8606a');
    return;
  }
  if (mood === 'wow') {
    s.rect(x + 1, y - 1, 2, 3, '#3a0c18');
    return;
  }
  s.hline(x, y, 3, R.white[3]);
  s.hline(x, y + 1, 3, sk[0]);
  s.set(x - 1, y - 1, sk[0]);
  s.set(x - 1, y, sk[0]);
}

// Customers and the player, on the 40x96 stander.
interface SideOpts {
  skin: Ramp;
  hair?: string;
  hairRamp?: Ramp;
  hatRamp?: Ramp;
  cap?: Ramp;
  top: Ramp;
  tee?: boolean;
  coat?: Ramp;
  coatLen?: number;
  pants: Ramp;
  shoes?: Ramp;
  scarfNeck?: Ramp;
  stubble?: boolean;
  lip?: string;
}
function sideStander(o: SideOpts, mood: string) {
  const s = new Sprite(KS.w, KS.h),
    cx = KS.cx,
    sk = o.skin,
    lean = 1;
  const hem = o.coat ? o.coatLen || 78 : 58,
    back = o.coat ? 6 : 5,
    front = 5;
  const lx = (j: number) => Math.round((lean * Math.max(0, 56 - j)) / 32);
  shape(s, ell(cx + 0.5, 57, 6, 5), o.pants, { band: 1 });
  const torso = (i: number, j: number) => {
    if (j < 23 || j > hem) return false;
    const x = i + 0.5 - cx - lx(j),
      cut = j < 27 ? (27 - j) * 1.5 : 0,
      flare = j > 56 ? (j - 56) * 0.18 : 0;
    return x >= -back - 0.5 - flare + cut * 0.8 && x <= front + 0.5 + flare - cut;
  };
  const top = o.coat || o.top;
  shape(s, torso, top, { band: 1 });
  const fx = (j: number) => cx + lx(j) + front;
  if (o.coat && o.top)
    for (let j = 26; j < (o.tee ? 52 : 38); j++) {
      s.set(fx(j) - 1, j, o.top[2]);
      s.set(fx(j), j, o.top[1]);
    }
  if (o.coat) {
    s.hline(cx - back, hem, back + front + 1, o.coat[1]);
    for (let j = 40; j < 54; j += 6) s.set(fx(j) - 2, j, R.gold[1]);
  }
  if (o.scarfNeck)
    shape(
      s,
      (i, j) => j >= 21 && j <= 26 && i >= cx - 4 + lx(j) && i <= cx + 5 + lx(j),
      o.scarfNeck,
    );
  const nx = cx + lx(20);
  s.rect(nx - 2, 17, 5, 8, sk[1]);
  s.vline(nx - 2, 17, 8, sk[0]);
  const hx = cx + 1 + lean,
    eyeY = 10;
  const jaw = (i: number, j: number) =>
    j >= 8 && j <= 18 && i >= hx - 1 && i <= hx + 7 - Math.max(0, j - 15) * 1.4;
  const headT = ell(hx + 0.5, 11, 7, 9),
    headU = (i: number, j: number) => headT(i, j) || jaw(i, j);
  const hood = ell(hx - 1.5, 10, 9, 10.5);
  if (o.hair === 'hood') shape(s, hood, o.hatRamp!, { band: 1 });
  if (o.hair === 'long')
    shape(
      s,
      (i, j) =>
        ell(hx - 0.5, 10, 8, 9.4)(i, j) || (j >= 10 && j < 27 && i >= hx - 8 && i <= hx - 2),
      o.hairRamp!,
    );
  if (o.hair === 'bun') shape(s, ell(hx - 6, 3, 3.4, 3), o.hairRamp!, { band: 1 });
  shape(s, headU, sk);
  shape(s, ell(hx - 1, 11.5, 1.6, 2.4), sk);
  s.set(hx - 1, 11, sk[0]);
  s.set(hx - 1, 12, sk[1]);
  const ex = hx + 3,
    brow = o.hairRamp ? o.hairRamp[1] : sk[0];
  if (mood === 'blink') s.hline(ex, eyeY + 1, 2, sk[0]);
  else {
    s.rect(ex, eyeY, 2, 2, INK);
    s.set(ex, eyeY, '#e8e0cf');
    if (mood === 'half') s.hline(ex, eyeY, 2, sk[0]);
  }
  if (mood === 'worried') {
    s.set(ex - 1, eyeY - 2, brow);
    s.hline(ex, eyeY - 3, 2, brow);
  } else s.hline(ex - 1, eyeY - 2, 3, brow);
  s.set(hx + 7, eyeY + 1, sk[2]);
  s.rect(hx + 8, eyeY + 2, 1, 2, sk[2]);
  s.set(hx + 8, eyeY + 2, sk[3]);
  s.set(hx + 7, eyeY + 4, sk[0]);
  const lip = o.lip || sk[0];
  if (mood === 'worried') {
    s.hline(hx + 4, eyeY + 6, 3, lip);
    s.set(hx + 3, eyeY + 7, lip);
  } else {
    s.hline(hx + 4, eyeY + 6, 3, lip);
    s.set(hx + 3, eyeY + 5, lip);
  }
  if (o.stubble)
    for (let j = eyeY + 4; j <= eyeY + 9; j++)
      for (let i = hx; i <= hx + 8; i++) {
        const c = s.get(i, j);
        if ((c === sk[2] || c === sk[1]) && bayer(i, j) < 0.3) s.set(i, j, mix(c, '#2a2026', 0.45));
      }
  switch (o.hair) {
    case 'beanie':
      shape(s, (i, j) => headU(i, j) && i < hx - 2 && j >= 5 && j < 14, o.hairRamp!);
      shape(
        s,
        (i, j) =>
          (ell(hx + 0.5, 6, 8.4, 6.4)(i, j) && j < 8) ||
          (j >= 5 && j < 8 && i >= hx - 8 && i <= hx + 7),
        o.hatRamp!,
        { band: 1 },
      );
      for (let i = hx - 8; i <= hx + 7; i += 2) s.set(i, 6, o.hatRamp![1]);
      break;
    case 'hood':
      shape(s, (i, j) => headU(i, j) && j < 5, o.hairRamp!);
      shape(s, (i, j) => hood(i, j) && (j < 3 || i < hx - 2), o.hatRamp!, { band: 1 });
      break;
    case 'long':
      shape(s, (i, j) => headU(i, j) && (j < 5 || i < hx - 2), o.hairRamp!);
      break;
    case 'bun':
      shape(s, (i, j) => headU(i, j) && (j < 5 || (i < hx - 1 && j < 14)), o.hairRamp!);
      break;
    default:
      shape(s, (i, j) => headU(i, j) && (j < 5 || (i < hx - 1 && j < 12)), o.hairRamp || R.hair);
      break;
  }
  if (o.cap) {
    shape(s, (i, j) => ell(hx + 0.5, 5.5, 8.2, 5)(i, j) && j < 7, o.cap, { band: 1 });
    s.rect(hx + 6, 6, 7, 2, o.cap[1]);
    s.hline(hx + 6, 6, 7, o.cap[2]);
    s.set(hx + 1, 1, o.cap[3]);
  }
  s.outline();
  return s;
}

// ----- who is who: the bodies, the limb ramps and the size -----
interface Spec {
  id: WalkerId;
  pants: Ramp;
  shoes: Ramp;
  sleeve: Ramp;
  skin: Ramp;
  stripe: boolean;
  make: (mood: string) => Sprite;
  bodies: Map<string, HTMLCanvasElement>;
}
const specs = new Map<string, Spec>();
function spec(id: WalkerId): Spec {
  const known = specs.get(id);
  if (known) return known;
  let sp: Omit<Spec, 'bodies'>;
  if (id in LOOK) {
    const key = id as CrewKey,
      o = LOOK[key];
    sp = {
      id,
      pants: o.pants,
      shoes: o.shoes,
      sleeve: o.over || o.top,
      skin: o.skin,
      stripe: !!o.track,
      make: (mood) => sideBuddy(key, mood),
    };
  } else if (id === 'you') {
    const o: SideOpts = {
      skin: YOU.skin,
      hair: 'short',
      hairRamp: R.hair,
      cap: YOU.cap,
      top: YOU.tee,
      tee: true,
      coat: YOU.jacket,
      coatLen: 58,
      pants: YOU.jeans,
      shoes: YOU.shoes,
    };
    sp = {
      id,
      pants: o.pants,
      shoes: YOU.shoes,
      sleeve: YOU.jacket,
      skin: o.skin,
      stripe: false,
      make: (mood) => sideStander(o, mood),
    };
  } else {
    const o: SideOpts = CUSTOMERS[Number(id.slice(4)) % CUSTOMERS.length];
    sp = {
      id,
      pants: o.pants,
      shoes: o.shoes || R.black,
      sleeve: (o.coat || o.top) as Ramp,
      skin: o.skin,
      stripe: false,
      make: (mood) => sideStander(o, mood),
    };
  }
  const made: Spec = { ...sp, bodies: new Map() };
  specs.set(id, made);
  return made;
}
function body(sp: Spec, mood: string, dir: number) {
  const k = mood + dir;
  if (!sp.bodies.has(k)) {
    if (!sp.bodies.has(mood + 1)) sp.bodies.set(mood + 1, cv(sp.make(mood)));
    if (dir < 0) sp.bodies.set(k, flipCanvas(sp.bodies.get(mood + 1)!));
  }
  return sp.bodies.get(k)!;
}

// ----- shoes: one base shape per size, tilted about the heel (strike) or the ball (roll-off) -----
interface ShoeBase {
  rows: [number, number, number][];
  heel: Pt;
  ball: Pt;
}
const SHOE: Record<string, ShoeBase> = {
  big: {
    rows: [
      [-1, -2, 2],
      [0, -3, 3],
      [1, -3, 5],
      [2, -3, 6],
      [3, -3, 6],
    ],
    heel: [-3, 3],
    ball: [4, 3],
  },
  small: {
    rows: [
      [-1, -2, 1],
      [0, -3, 2],
      [1, -3, 4],
      [2, -3, 5],
      [3, -3, 5],
    ],
    heel: [-3, 3],
    ball: [3, 3],
  },
};
const TILT: Record<Foot['v'], ['heel' | 'ball', number]> = {
  flat: ['heel', 0],
  toe: ['heel', -0.3],
  heel1: ['ball', 0.28],
  heel2: ['ball', 0.55],
};
const SO = 8,
  SW = 20;
const shoeCache = new Map<string, { img: HTMLCanvasElement; ax: number; ay: number }>();
function rot([x, y]: Pt, [px, py]: Pt, a: number): Pt {
  const c = Math.cos(a),
    s = Math.sin(a),
    dx = x - px,
    dy = y - py;
  return [px + dx * c - dy * s, py + dx * s + dy * c];
}
function shoe(size: string, ramp: Ramp, v: Foot['v'], dir: number) {
  const k = size + ramp[2] + v + dir;
  const known = shoeCache.get(k);
  if (known) return known;
  const base = SHOE[size],
    [pv, a] = TILT[v],
    piv = base[pv];
  const inBase = (x: number, y: number) =>
    base.rows.some(([ry, x0, x1]) => ry === y && x >= x0 && x <= x1);
  const test = (i: number, j: number) => {
    const [x, y] = rot([i - SO, j - SO], piv, -a);
    return inBase(Math.round(x), Math.round(y));
  };
  const s = new Sprite(SW, 16);
  shape(s, test, ramp);
  s.each((x, y, c) => {
    if (c && !test(x, y + 1)) s.set(x, y, ramp[1]);
  });
  s.outline();
  const img = dir < 0 ? flipCanvas(cv(s)) : cv(s);
  const ank = rot([0, 0], piv, a);
  const out = { img, ax: ank[0], ay: ank[1] };
  shoeCache.set(k, out);
  return out;
}
const handCache = new Map<Ramp, HTMLCanvasElement>();
function handImg(ramp: Ramp) {
  const known = handCache.get(ramp);
  if (known) return known;
  const s = new Sprite(5, 5);
  s.rect(1, 1, 3, 3, ramp[2]);
  s.set(1, 1, ramp[3]);
  s.set(3, 3, ramp[1]);
  s.set(2, 0, ramp[2]);
  s.set(0, 2, ramp[2]);
  s.set(4, 2, ramp[1]);
  s.set(2, 4, ramp[1]);
  s.outline({ selective: false });
  const img = cv(s);
  handCache.set(ramp, img);
  return img;
}
const pendant = (() => {
  const s = new Sprite(5, 6);
  s.rect(1, 1, 3, 4, R.gold[2]);
  s.set(1, 1, R.gold[3]);
  s.set(3, 4, R.gold[1]);
  s.outline({ selective: false });
  return cv(s);
})();
const caneTop = (() => {
  const s = new Sprite(8, 8);
  sphere(s, 4, 4, 3.6, R.gold);
  s.outline();
  return cv(s);
})();

// ===== drawing on a target =====
export interface DrawTarget {
  readonly ctx: CanvasRenderingContext2D;
  readonly s: number;
}
export const imgF = (t: DrawTarget, c: HTMLCanvasElement, x: number, y: number) =>
  t.ctx.drawImage(c, Math.round(x * t.s), Math.round(y * t.s), c.width * t.s, c.height * t.s);
// A limb as overlapping squares on the device grid, ink first, then three tones of its ramp.
function limb(t: DrawTarget, pts: readonly Pt[], ramp: Ramp, w: number) {
  const { ctx, s: S } = t;
  const pass = (col: string, ww: number, off: number) => {
    ctx.fillStyle = col;
    const d = Math.round(ww * S);
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k],
        [x1, y1] = pts[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
      for (let m = 0; m <= n; m++)
        ctx.fillRect(
          Math.round((x0 + ((x1 - x0) * m) / n - ww / 2 + off) * S),
          Math.round((y0 + ((y1 - y0) * m) / n - ww / 2 + off) * S),
          d,
          d,
        );
    }
  };
  pass(INK, w + 2, 0);
  pass(ramp[1], w, 0);
  pass(ramp[2], w - 1, -0.5);
  if (w > 4) pass(ramp[3], w - 4, -1);
}

// Draws one walker or stander in side view. o: { mood, hold (image in the near hand), carry (bool) }.
export function drawWalker(
  t: DrawTarget,
  a: Walker,
  now: number,
  o: { mood?: string; hold?: HTMLCanvasElement | null; carry?: boolean } = {},
): { hand: Pt; top: number } {
  const p = walkPose(a, now),
    sp = spec(idOf(a)),
    { K, gt, dir } = p,
    mood = o.mood || 'smile';
  const shake = shakeOf(a, now);
  const sway = 'sway' in gt && p.g ? Math.round(stepSign(p.j) * Math.sin(Math.PI * p.u) * 0.9) : 0;
  const bx = a.x + shake + sway + (dir < 0 ? 1 : 0),
    top = p.hy - K.hip;
  const hip: Pt = [p.hx + 0.5, p.hy];
  const shX = p.hx + 0.5 + shake + sway + dir * gt.lean;
  const sh: Pt = [shX, top + K.sh];
  let near: readonly [number, number], far: readonly [number, number];
  if (o.carry) {
    near = ARM.carry;
    far = ARM.carry;
  } else if (p.g && !a.armHold) {
    const amp = gt.arm * Math.min(1, p.g.v / p.g.vmax + 0.3);
    const tn = -amp * p.fN,
      tf = amp * p.fN;
    near = [tn, gt.elbow + Math.max(0, tn) * 0.45];
    far = [tf, gt.elbow + Math.max(0, tf) * 0.45];
  } else {
    near = armAngles(a, now, 'n');
    far = armAngles(a, now, 'f');
  }
  const sleeve = sp.sleeve,
    skin = sp.skin,
    hand = handImg(skin),
    handD = handImg(dark(skin));
  let caneTip: Pt | null = null;
  if ('cane' in gt && !a.armHold) {
    const ff = p.feet[1];
    caneTip = [ff.x + 0.5 + dir * 7, ff.y - 1];
    if (!ff.planted && p.g) caneTip[1] = Math.min(caneTip[1], ff.y - 1 - 1);
    near = ARM.cane;
  }
  // far arm, far leg, near leg, body, near arm
  const farPts = armPoints([sh[0] - dir, sh[1]], far, K, dir);
  limb(t, farPts, dark(sleeve), K.armW);
  imgF(t, handD, farPts[2][0] - 2.5, farPts[2][1] - 2.5);
  for (const k of [1, 0]) {
    const f = p.feet[k],
      sz = shoe(K.shoe, k ? dark(sp.shoes) : sp.shoes, f.v, dir);
    const ank: Pt = [f.x + 0.5 + dir * sz.ax, f.y - 4 + sz.ay];
    const kn = knee(hip, ank, K.thigh, K.shin, dir);
    const ramp = k ? dark(sp.pants) : sp.pants;
    limb(t, [hip, kn], ramp, K.legW);
    limb(t, [kn, ank], ramp, K.legW - 1);
    if (sp.stripe) {
      t.ctx.fillStyle = k ? R.white[1] : R.white[3];
      for (const [p0, p1] of [
        [hip, kn],
        [kn, ank],
      ])
        for (let m = 0; m <= 8; m++)
          t.ctx.fillRect(
            Math.round((p0[0] + ((p1[0] - p0[0]) * m) / 8 - dir * 2) * t.s),
            Math.round((p0[1] + ((p1[1] - p0[1]) * m) / 8) * t.s),
            t.s,
            t.s,
          );
    }
    imgF(t, sz.img, f.x - (dir > 0 ? SO : SW - 1 - SO), f.y - 4 - SO);
  }
  imgF(t, body(sp, mood, dir), bx, top);
  if ('chain' in gt) {
    const sw = p.g ? Math.round(stepSign(p.j) * Math.sin(Math.PI * p.u) * 1.5) : 0;
    imgF(t, pendant, shX + dir * (SIDE.dealer.front + 2) + sw - 2.5, top + 37);
  }
  const nearPts = armPoints(sh, near, K, dir);
  if (caneTip) limb(t, [nearPts[2], caneTip], [INK, R.black[2], R.black[3], R.black[3]], 2);
  if (o.hold)
    imgF(t, o.hold, nearPts[2][0] - o.hold.width / 2 + dir * 2, nearPts[2][1] - o.hold.height / 2);
  limb(t, nearPts, sleeve, K.armW);
  if (sp.stripe) {
    t.ctx.fillStyle = R.white[3];
    for (const [p0, p1] of [
      [nearPts[0], nearPts[1]],
      [nearPts[1], nearPts[2]],
    ])
      for (let m = 0; m <= 8; m++)
        t.ctx.fillRect(
          Math.round((p0[0] + ((p1[0] - p0[0]) * m) / 8 + 2) * t.s),
          Math.round((p0[1] + ((p1[1] - p0[1]) * m) / 8) * t.s),
          t.s,
          t.s,
        );
  }
  imgF(t, hand, nearPts[2][0] - 2.5, nearPts[2][1] - 2.5);
  if (caneTip) imgF(t, caneTop, nearPts[2][0] - 4, nearPts[2][1] - 7);
  return { hand: nearPts[2], top };
}

// Props that ride on the front-view hands.
export function frontProps(
  t: DrawTarget,
  key: CrewKey,
  pose: string,
  x: number,
  y: number,
  kind: string | null,
) {
  const h = hands(key, pose),
    base = pose.split('>')[0],
    to = pose.includes('>') ? pose.split('>')[1].split(':')[0] : base;
  const has = (n: string) => base === n || to === n;
  if (key === 'clerk' && (has('dustA') || has('dustB') || has('dustC')))
    imgF(t, duster, x + h.R[0] - 5, y + h.R[1] - 13);
  if (key === 'appraiser' && (has('loupe') || kind === 'hold'))
    imgF(t, loupe, x + h.R[0] - 4, y + h.R[1] - 5);
  if (key === 'magnate') {
    if (has('lean')) imgF(t, cane, x + h.R[0] - 4, y + h.R[1] - 4);
    else if (base === 'down' || base === 'twirl' || base === 'nose')
      imgF(t, cane, x + CX + 13, y + 52);
  }
}

// Bake the side bodies and shoes up front, so the first walk does not stall a frame.
export function prewarm() {
  const ids: WalkerId[] = [
    'clerk',
    'appraiser',
    'dealer',
    'magnate',
    'you',
    'cust0',
    'cust1',
    'cust2',
    'cust3',
  ];
  for (const id of ids) {
    const sp = spec(id),
      size = sizeOf(id).K.shoe;
    for (const m of ['smile', 'blink', 'half', 'laugh']) for (const d of [1, -1]) body(sp, m, d);
    if (id.startsWith('cust')) for (const d of [1, -1]) body(sp, 'worried', d);
    for (const v of Object.keys(TILT) as Foot['v'][])
      for (const d of [1, -1]) {
        shoe(size, sp.shoes, v, d);
        shoe(size, dark(sp.shoes), v, d);
      }
  }
}
