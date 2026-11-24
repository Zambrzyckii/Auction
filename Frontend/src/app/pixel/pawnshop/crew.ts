// The crew and the customers. A buddy is one full-body sprite, 56x104, with a head 21 px wide
// so the face reads at scale 2. Behind the counter the front layer hides him from the waist
// down, on the floor he walks whole.
import type { Ramp } from '../street/pix';
import type { CrewKey } from './gait';
import { INK, R, Sprite, bayer, box, disc, mix, shape, sphere, text } from '../street/pix';
import type { Arms, StanderOpts } from '../bank/people';
import { ell, fist, prop, stander, stroke } from '../bank/people';
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
