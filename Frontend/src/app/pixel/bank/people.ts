// People of the bank at one human scale: an adult stands 96 art px, so the shark behind the
// counter shows about 56 px from his hair to the counter top. Every body is a baked sprite
// shaded with the casino ramps and finished with the selective outline. Forearms that have
// to follow a tray, a stamp or a bat are drawn live with `limb` from the casino floor.
import type { Ramp } from '../street/pix';
import { INK, R, Sprite, bayer, box, disc, measure, mix, shape, text } from '../street/pix';

type Pt = readonly [number, number];
export type SharkMood = 'smirk' | 'blink' | 'grin' | 'laugh' | 'sad' | 'loupe';
export type Mood = 'plain' | 'worried' | 'sleepy' | 'smile';
export type Arms = 'down' | 'chest' | 'cart' | 'none' | 'up' | 'stub';
export interface FaceOpts {
  cx: number;
  eyeY: number;
  skin: Ramp;
  hair?: Ramp;
  look?: number;
  blink?: boolean;
  mood?: Mood;
  stubble?: boolean;
  lip?: string;
}
export interface StanderOpts {
  h?: number;
  w?: number;
  kid?: boolean;
  skin: Ramp;
  hair?: 'beanie' | 'scarf' | 'bun' | 'hood' | 'short' | 'pom' | 'long';
  hairRamp: Ramp;
  hatRamp?: Ramp;
  top: Ramp;
  coat?: Ramp;
  coatLen?: number;
  pants: Ramp;
  shoes?: Ramp;
  look?: number;
  blink?: boolean;
  mood?: Mood;
  stubble?: boolean;
  holes?: [number, number][];
  hunch?: number;
  arms?: Arms;
  shHalf?: number;
  waistHalf?: number;
  scarfNeck?: Ramp;
  lip?: string;
}
export interface SharkInfo {
  w: number;
  h: number;
  cx: number;
  mouth: Pt;
  tooth: Pt;
  elbows: [Pt, Pt];
  sleeve: Ramp;
  skin: Ramp;
  eyeL: Pt;
  eyeR: Pt;
}
export interface BruteInfo {
  w: number;
  h: number;
  cx: number;
  mouth: Pt;
  elbows: [Pt, Pt];
  sleeve: Ramp;
  skin: Ramp;
}
export interface EnforcerOpts {
  chew?: boolean;
  walk?: boolean;
  step?: number;
}
interface BlinkPair {
  open: HTMLCanvasElement;
  blink: HTMLCanvasElement;
  cx: number;
  w: number;
  h: number;
}
export interface QueuePeople {
  man: BlinkPair;
  granny: BlinkPair;
  cart: HTMLCanvasElement;
  signGuy: BlinkPair;
  cardboard: HTMLCanvasElement;
  mom: BlinkPair;
  kid: { a: HTMLCanvasElement; b: HTMLCanvasElement; cx: number; w: number; h: number };
}

const cv = (s: Sprite) => s.canvas();
export const ell = (cx: number, cy: number, rx: number, ry: number) => (i: number, j: number) =>
  ((i + 0.5 - cx) / rx) ** 2 + ((j + 0.5 - cy) / ry) ** 2 <= 1;
const SKIN_LIP = '#7a3a34';

// Thick shaded stroke baked into a sprite, used for arms and legs.
export function stroke(s: Sprite, pts: readonly Pt[], w: number, ramp: Ramp) {
  const pass = (col: string, ww: number, off: number) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k],
        [x1, y1] = pts[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
      for (let m = 0; m <= n; m++) {
        const x = Math.round(x0 + ((x1 - x0) * m) / n - ww / 2 + off),
          y = Math.round(y0 + ((y1 - y0) * m) / n - ww / 2 + off);
        s.rect(x, y, ww, ww, col);
      }
    }
  };
  pass(ramp[1], w, 0);
  pass(ramp[2], w - 1, -0.5);
  if (w > 3) pass(ramp[3], Math.max(1, w - 4), -1);
}
export const fist = (s: Sprite, x: number, y: number, ramp: Ramp, r = 2) => {
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) s.set(x + i, y + j, ramp[2]);
  s.set(x - r + 1, y - r + 1, ramp[3]);
  s.set(x + r - 1, y + r - 1, ramp[1]);
  s.hline(x - r + 1, y + r, 2 * r - 1, ramp[1]);
};

// ----- generic face, front view -----
// f: { cx, eyeY, skin, hair, look, blink, mood: 'plain'|'worried'|'sleepy'|'smile', stubble, lip }
export function face(s: Sprite, f: FaceOpts) {
  const { cx, eyeY, skin } = f,
    lk = f.look || 0;
  if (f.blink || f.mood === 'sleepy') {
    s.hline(cx - 4, eyeY + 1, 2, skin[0]);
    s.hline(cx + 2, eyeY + 1, 2, skin[0]);
  } else {
    s.rect(cx - 4 + lk, eyeY, 2, 2, INK);
    s.rect(cx + 2 + lk, eyeY, 2, 2, INK);
    s.set(cx - 4 + lk + (lk > 0 ? 0 : 1), eyeY, '#e8e0cf');
    s.set(cx + 2 + lk + (lk > 0 ? 0 : 1), eyeY, '#e8e0cf');
  }
  const brow = f.hair ? f.hair[1] : skin[0];
  if (f.mood === 'worried') {
    s.set(cx - 5, eyeY - 2, brow);
    s.hline(cx - 4, eyeY - 3, 2, brow);
    s.hline(cx + 2, eyeY - 3, 2, brow);
    s.set(cx + 4, eyeY - 2, brow);
  } else {
    s.hline(cx - 5, eyeY - 2, 3, brow);
    s.hline(cx + 2, eyeY - 2, 3, brow);
  }
  s.set(cx, eyeY + 2, skin[1]);
  s.set(cx, eyeY + 3, skin[1]);
  s.set(cx + 1, eyeY + 4, skin[0]);
  s.set(cx - 1, eyeY + 3, skin[3]);
  const lip = f.lip || skin[0];
  if (f.mood === 'worried') {
    s.hline(cx - 1, eyeY + 6, 3, lip);
    s.set(cx - 2, eyeY + 7, lip);
    s.set(cx + 2, eyeY + 7, lip);
  } else if (f.mood === 'smile') {
    s.hline(cx - 1, eyeY + 7, 3, lip);
    s.set(cx - 2, eyeY + 6, lip);
    s.set(cx + 2, eyeY + 6, lip);
  } else s.hline(cx - 2, eyeY + 6, 4, lip);
  if (f.stubble)
    for (let j = eyeY + 4; j <= eyeY + 9; j++)
      for (let i = cx - 6; i <= cx + 6; i++) {
        const c = s.get(i, j);
        if ((c === skin[2] || c === skin[1]) && bayer(i, j) < 0.3)
          s.set(i, j, mix(c, '#2a2026', 0.45));
      }
  s.set(cx - 7, eyeY + 1, skin[1]);
  s.set(cx + 7, eyeY + 1, skin[1]);
}

// ----- full-body stander, front view (queue people) -----
// o: h, skin, hair ('beanie' | 'scarf' | 'bun' | 'hood' | 'short' | 'pom'), hairRamp, hatRamp,
//    top, coat, coatLen, pants, shoes, look, blink, mood, stubble, holes, hunch, arms ('down' | 'chest' | 'cart' | 'none' | 'up')
export function stander(o: StanderOpts) {
  const H = o.h || 96,
    k = H / 96,
    W = o.w || 40,
    cx = Math.floor(W / 2);
  const s = new Sprite(W, H);
  const hunch = o.hunch || 0;
  const hy = Math.round(11 * k) + hunch,
    rx = o.kid ? 7 : 7.5,
    ry = o.kid ? 8 : 9;
  const shY = Math.round(24 * k) + Math.round(hunch * 0.6),
    waistY = Math.round(50 * k),
    hipY = Math.round(56 * k);
  const footY = H - 1,
    shHalf = o.kid ? 8 : o.shHalf || 11,
    waistHalf = o.kid ? 7 : o.waistHalf || 9;
  const legW = o.kid ? 5 : 7,
    legGap = 1;
  const coatLen = o.coat ? Math.round((o.coatLen || 78) * k) : 0;
  const top = o.coat || o.top;
  const hat = o.hatRamp!;
  // legs and shoes
  const legTop = hipY - 2;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? cx - legGap - legW : cx + legGap;
    shape(s, (i, j) => i >= x0 && i < x0 + legW && j >= legTop && j < footY - 2, o.pants, {
      band: 1,
    });
    shape(
      s,
      (i, j) =>
        j >= footY - 3 &&
        j <= footY &&
        i >= x0 - (side < 0 ? 2 : 0) &&
        i < x0 + legW + (side > 0 ? 2 : 0),
      o.shoes || R.black,
      { band: 1 },
    );
  }
  // body: torso tapers to the waist, then hips; a coat flares down to coatLen
  const torso = (i: number, j: number) => {
    if (j < shY) return false;
    const dx = Math.abs(i + 0.5 - cx);
    if (j < shY + 3) return dx <= shHalf - (shY + 3 - j) * 1.6;
    if (j <= waistY)
      return dx <= shHalf - ((j - shY - 3) * (shHalf - waistHalf)) / Math.max(1, waistY - shY - 3);
    if (j <= hipY) return dx <= waistHalf + 1;
    if (coatLen && j <= coatLen) return dx <= waistHalf + 1 + (j - hipY) * 0.18;
    return false;
  };
  shape(s, torso, top, { band: 1 });
  if (o.coat && o.top)
    shape(
      s,
      (i, j) => torso(i, j) && j < shY + 14 * k && Math.abs(i + 0.5 - cx) < (j - shY) * 0.35 + 1,
      o.top,
    );
  if (o.coat) {
    s.vline(cx, shY + Math.round(14 * k), coatLen - shY - Math.round(14 * k), o.coat[0]);
    for (let j = shY + 16; j < waistY; j += 6) s.set(cx + 2, j, R.gold[1]);
  }
  if (o.holes) {
    for (const [hx, hy2] of o.holes) {
      s.rect(hx, hy2, 2, 2, o.coat ? o.coat[0] : INK);
      s.set(hx + 2, hy2, o.coat ? o.coat[3] : INK);
    }
    if (o.coat) {
      s.vline(cx - 6, coatLen + 1, 2, o.coat[1]);
      s.set(cx + 5, coatLen + 1, o.coat[1]);
    }
  }
  // arms
  const sl = o.coat || o.top,
    skin = o.skin;
  const lS: Pt = [cx - shHalf + 2, shY + 3],
    rS: Pt = [cx + shHalf - 2, shY + 3];
  const handL: number[] = [],
    handR: number[] = [];
  const armMode = o.arms || 'down';
  if (armMode === 'down') {
    const hl: Pt = [cx - shHalf - 1, Math.round(54 * k)],
      hr: Pt = [cx + shHalf + 1, Math.round(54 * k)];
    stroke(s, [lS, [lS[0] - 2, shY + 14 * k], hl], o.kid ? 4 : 5, sl);
    stroke(s, [rS, [rS[0] + 2, shY + 14 * k], hr], o.kid ? 4 : 5, sl);
    fist(s, hl[0], hl[1] + 2, skin);
    fist(s, hr[0], hr[1] + 2, skin);
    handL.push(hl[0], hl[1] + 2);
    handR.push(hr[0], hr[1] + 2);
  } else if (armMode === 'chest') {
    const hl: Pt = [cx - 5, shY + 16],
      hr: Pt = [cx + 5, shY + 16];
    stroke(s, [lS, [lS[0] - 2, shY + 13], hl], 5, sl);
    stroke(s, [rS, [rS[0] + 2, shY + 13], hr], 5, sl);
    handL.push(...hl);
    handR.push(...hr);
  } else if (armMode === 'cart') {
    const hl: Pt = [cx + 2, waistY - 2],
      hr: Pt = [cx + 10, waistY - 2];
    stroke(s, [lS, [lS[0] - 1, shY + 14], hl], 5, sl);
    stroke(s, [rS, [rS[0] + 3, shY + 13], hr], 5, sl);
    fist(s, hl[0], hl[1], skin);
    fist(s, hr[0], hr[1], skin);
    handL.push(...hl);
    handR.push(...hr);
  } else if (armMode === 'stub') {
    const hl: Pt = [cx - shHalf - 1, Math.round(54 * k)],
      hr: Pt = [cx + 3, shY + 17];
    stroke(s, [lS, [lS[0] - 2, shY + 14 * k], hl], 5, sl);
    stroke(s, [rS, [rS[0] + 3, shY + 15], hr], 5, sl);
    fist(s, hl[0], hl[1] + 2, skin);
    fist(s, hr[0], hr[1], skin);
    handL.push(hl[0], hl[1] + 2);
    handR.push(...hr);
  }
  // neck and head
  s.rect(cx - 2, hy + ry - 2, 5, shY - (hy + ry - 2) + 1, skin[1]);
  if (o.hair === 'long' || o.hair === 'bun')
    shape(
      s,
      (i, j) =>
        ell(cx + 0.5, hy, rx + 1.4, ry + 0.6)(i, j) ||
        (o.hair === 'long' && j >= hy && j < hy + 14 && Math.abs(i + 0.5 - cx - 0.5) <= rx + 1.4),
      o.hairRamp,
    );
  if (o.hair === 'hood') shape(s, ell(cx + 0.5, hy, rx + 2.6, ry + 2.2), hat);
  shape(s, ell(cx + 0.5, hy, rx, ry), skin);
  const eyeY = hy - 1;
  face(s, {
    cx,
    eyeY,
    skin,
    hair: o.hairRamp,
    look: o.look,
    blink: o.blink,
    mood: o.mood,
    stubble: o.stubble,
    lip: o.lip,
  });
  const headT = ell(cx + 0.5, hy, rx, ry);
  switch (o.hair) {
    case 'beanie':
    case 'pom':
      shape(
        s,
        (i, j) =>
          (headT(i, j) && j < eyeY - 3) ||
          (j >= eyeY - 6 && j < eyeY - 3 && Math.abs(i + 0.5 - cx - 0.5) <= rx + 0.8),
        hat,
        { band: 1 },
      );
      for (let i = cx - 7; i <= cx + 7; i += 2) s.set(i, eyeY - 5, hat[1]);
      if (o.hair === 'pom') disc(s, cx, hy - ry - 1, 2.6, R.white[2]);
      break;
    case 'scarf':
      shape(
        s,
        (i, j) =>
          (ell(cx + 0.5, hy - 1, rx + 1.6, ry + 0.8)(i, j) &&
            !(j > eyeY - 4 && Math.abs(i + 0.5 - cx - 0.5) < rx - 1.2 && j < hy + ry - 1)) ||
          (j >= hy + ry - 3 && j < hy + ry + 3 && Math.abs(i + 0.5 - cx - 0.5) < rx + 1),
        hat,
        { band: 1 },
      );
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++)
          if (s.get(i, j) === hat[2] && (i + j) % 5 === 0) s.set(i, j, hat[3]);
      break;
    case 'bun':
      shape(s, (i, j) => headT(i, j) && j < eyeY - 3, o.hairRamp);
      shape(s, ell(cx + 0.5, hy - ry - 1, 4, 3.2), o.hairRamp);
      break;
    case 'long':
      shape(
        s,
        (i, j) => headT(i, j) && (j < eyeY - 3 || Math.abs(i + 0.5 - cx - 0.5) > rx - 2),
        o.hairRamp,
      );
      break;
    case 'hood':
      shape(s, (i, j) => headT(i, j) && j < eyeY - 3, o.hairRamp);
      break;
    case 'short':
      shape(
        s,
        (i, j) =>
          headT(i, j) && (j < eyeY - 3 || (j < eyeY && Math.abs(i + 0.5 - cx - 0.5) > rx - 1.5)),
        o.hairRamp,
      );
      break;
    default:
      break;
  }
  if (o.scarfNeck)
    shape(s, (i, j) => j >= shY - 2 && j <= shY + 3 && Math.abs(i + 0.5 - cx) <= 6, o.scarfNeck);
  s.outline();
  return { s, w: W, h: H, cx, handL, handR, shY };
}

// ----- the player: taxi cap and denim jacket, like the warehouse war figure -----
export const YOU = {
  skin: R.skinB,
  cap: R.taxi,
  jacket: R.denim,
  tee: R.white,
  jeans: ['#16182a', '#232842', '#33395c', '#4a5280'],
  shoes: R.white,
};
export function youFront(blink: boolean, look: number) {
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
    look,
    blink,
  });
  const s = b.s,
    cx = b.cx;
  // the cap: a low taxi crown, a curved bill across the forehead and its shadow
  shape(s, (i, j) => ell(cx + 0.5, 5.5, 8.2, 5)(i, j) && j < 7, YOU.cap, { band: 1 });
  for (let i = -10; i <= 10; i++) {
    const y = 7 + (Math.abs(i) > 7 ? 1 : 0);
    s.set(cx + i, y, YOU.cap[3]);
    s.set(cx + i, y + 1, YOU.cap[2]);
  }
  for (let i = -7; i <= 7; i++) {
    const c = s.get(cx + i, 9);
    if (c) s.set(cx + i, 9, YOU.skin[0]);
  }
  s.set(cx, 1, YOU.cap[3]);
  s.outline();
  return cv(s);
}
export function youBack() {
  const W = 40,
    H = 96,
    cx = 20,
    s = new Sprite(W, H);
  const shY = 24,
    waistY = 50,
    hipY = 56;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? cx - 8 : cx + 1;
    shape(s, (i, j) => i >= x0 && i < x0 + 7 && j >= hipY - 2 && j < H - 3, YOU.jeans, { band: 1 });
    shape(s, (i, j) => j >= H - 4 && i >= x0 - 1 && i < x0 + 8, R.white);
    s.hline(x0 - 1, H - 1, 9, R.grey[1]);
  }
  const torso = (i: number, j: number) => {
    if (j < shY) return false;
    const dx = Math.abs(i + 0.5 - cx);
    if (j < shY + 3) return dx <= 12 - (shY + 3 - j) * 1.6;
    if (j <= waistY) return dx <= 12 - ((j - shY - 3) * 3) / (waistY - shY - 3);
    return j <= 59 && dx <= 10;
  };
  shape(s, torso, YOU.jacket, { band: 1 });
  s.vline(cx, shY + 4, 30, YOU.jacket[1]);
  s.hline(cx - 10, 50, 21, YOU.jacket[1]);
  for (let i = cx - 9; i <= cx + 9; i += 3) s.set(i, 54, YOU.jacket[3]);
  s.rect(cx - 5, shY - 1, 11, 3, YOU.jacket[3]);
  stroke(
    s,
    [
      [cx - 10, shY + 3],
      [cx - 13, shY + 15],
      [cx - 12, 54],
    ],
    5,
    YOU.jacket,
  );
  fist(s, cx - 12, 56, YOU.skin);
  s.rect(cx - 2, 16, 5, 9, YOU.skin[1]);
  shape(s, ell(cx + 0.5, 11, 7.6, 9), R.hair);
  s.set(cx - 8, 12, YOU.skin[2]);
  s.set(cx + 8, 12, YOU.skin[2]);
  s.set(cx - 8, 13, YOU.skin[1]);
  s.set(cx + 8, 13, YOU.skin[1]);
  shape(s, (i, j) => ell(cx + 0.5, 6, 8.4, 6)(i, j) && j < 9, YOU.cap, { band: 1 });
  s.hline(cx - 8, 8, 17, YOU.cap[1]);
  s.rect(cx - 2, 6, 5, 2, YOU.cap[0]);
  s.hline(cx - 3, 8, 7, YOU.cap[0]);
  s.outline();
  return {
    img: cv(s),
    w: W,
    h: H,
    cx,
    shoulderR: [cx + 10, shY + 4] as Pt,
    sleeve: YOU.jacket,
    skin: YOU.skin,
  };
}
// Side view walking right, four frames: contact, passing, contact, passing.
export function youWalk() {
  const frames: HTMLCanvasElement[] = [];
  const swings = [6, 0, -6, 0];
  for (let f = 0; f < 4; f++) {
    const W = 34,
      H = 98,
      s = new Sprite(W, H),
      cx = 16,
      bob = f % 2 ? -1 : 0,
      sw = swings[f];
    const hip: Pt = [cx, 56 + bob];
    const leg = (dx: number, ramp: Ramp, back: boolean) => {
      const knee: Pt = [cx + dx * 0.55 + (dx < 0 ? -1 : 2), 75 + bob],
        foot: Pt = [cx + dx, 92];
      stroke(s, [hip, knee, foot], 7, ramp);
      s.rect(foot[0] - 3, 92, 9, 4, back ? R.white[1] : R.white[2]);
      s.hline(foot[0] - 3, 95, 9, R.grey[1]);
      s.set(foot[0] + 5, 93, R.white[3]);
    };
    leg(-sw, ['#121424', '#1c2036', '#282e4a', '#363e64'], true);
    leg(sw, YOU.jeans, false);
    const torso = (i: number, j: number) =>
      j >= 23 + bob &&
      j <= 58 + bob &&
      Math.abs(i + 0.5 - cx - 1) <= (j < 27 + bob ? 5 + (j - 23 - bob) : 8.5);
    shape(s, torso, YOU.jacket, { band: 1 });
    s.vline(cx + 7, 30 + bob, 24, YOU.tee[2]);
    s.hline(cx - 6, 54 + bob, 15, YOU.jacket[1]);
    const sh: Pt = [cx, 28 + bob],
      hand: Pt = [cx - sw * 0.9, 53 + bob];
    stroke(s, [sh, [cx - sw * 0.5, 42 + bob], hand], 5, YOU.jacket);
    fist(s, Math.round(hand[0]), Math.round(hand[1]) + 2, YOU.skin);
    s.rect(cx - 1, 18 + bob, 5, 6, YOU.skin[1]);
    shape(s, ell(cx + 1.5, 12 + bob, 7, 8.8), YOU.skin);
    shape(
      s,
      (i, j) => ell(cx + 1.5, 12 + bob, 7, 8.8)(i, j) && (i < cx - 1 || j < 9 + bob),
      R.hair,
    );
    s.set(cx + 8, 12 + bob, YOU.skin[2]);
    s.set(cx + 9, 13 + bob, YOU.skin[1]);
    s.rect(cx + 5, 10 + bob, 2, 2, INK);
    s.set(cx + 4, 9 + bob, R.hair[1]);
    s.set(cx + 5, 9 + bob, R.hair[1]);
    s.hline(cx + 4, 16 + bob, 3, YOU.skin[0]);
    s.set(cx - 2, 12 + bob, YOU.skin[2]);
    s.set(cx - 2, 13 + bob, YOU.skin[1]);
    shape(s, (i, j) => ell(cx + 1.5, 7 + bob, 8.2, 5.6)(i, j) && j < 9 + bob, YOU.cap, { band: 1 });
    s.rect(cx + 6, 7 + bob, 7, 2, YOU.cap[1]);
    s.hline(cx + 6, 7 + bob, 7, YOU.cap[2]);
    s.outline();
    frames.push(cv(s));
  }
  return frames;
}
// Sitting on the curb, elbows on the knees and the face in the hands.
export function youSit(sigh: boolean) {
  // Drawn back to front: torso, bowed head, knees pulled up in front, forearms on the knees.
  const W = 44,
    H = 66,
    cx = 22,
    s = new Sprite(W, H),
    dy = sigh ? 1 : 0;
  const torso = (i: number, j: number) =>
    j >= 20 + dy && j <= 50 && Math.abs(i + 0.5 - cx) <= (j < 24 ? 8 + (j - 20) * 1.1 : 12);
  shape(s, torso, YOU.jacket, { band: 1 });
  s.rect(cx - 3, 22 + dy, 7, 6, YOU.tee[2]);
  shape(s, ell(cx + 0.5, 18 + dy, 7.2, 8), YOU.skin);
  shape(s, (i, j) => ell(cx + 0.5, 13 + dy, 8.6, 6.4)(i, j) && j < 18 + dy, YOU.cap, { band: 1 });
  for (let i = -9; i <= 9; i++) {
    s.set(cx + i, 18 + dy, YOU.cap[3]);
    s.set(cx + i, 19 + dy, YOU.cap[1]);
  }
  s.set(cx, 8 + dy, YOU.cap[3]);
  for (const side of [-1, 1]) {
    const kx = cx + side * 7;
    shape(s, ell(kx + 0.5, 38, 6.2, 6), YOU.jeans, { band: 1 });
    shape(s, (i, j) => j >= 40 && j < 61 && Math.abs(i + 0.5 - kx - side * 1.5) <= 4.4, YOU.jeans, {
      band: 1,
    });
    shape(s, (i, j) => j >= 60 && j <= 64 && Math.abs(i + 0.5 - kx - side * 2) <= 5, R.white);
    s.hline(kx + side * 2 - 5, 65, 11, R.grey[1]);
  }
  for (const side of [-1, 1])
    stroke(
      s,
      [
        [cx + side * 11, 26 + dy],
        [cx + side * 9, 34],
        [cx + side * 3, 28 + dy],
      ],
      5,
      YOU.jacket,
    );
  fist(s, cx - 3, 25 + dy, YOU.skin);
  fist(s, cx + 3, 25 + dy, YOU.skin);
  s.outline();
  return cv(s);
}

// ----- the loan shark: cream sport coat, purple silk shirt open to the chest, gold -----
// A sun-bed tan, oily black hair combed straight back, heavy lids and a pencil mustache.
export const SHARK = {
  skin: ['#5a2a1c', '#93503a', '#c47c56', '#e6a87c'],
  hair: ['#0a0812', '#181424', '#2a2640', '#56628c'],
  coat: R.cream,
  shirt: ['#2a1240', '#4a1e6a', '#7a32a0', '#b468d8'],
};
export function shark(mode: SharkMood) {
  const W = 64,
    H = 62,
    cx = 32,
    s = new Sprite(W, H),
    sk = SHARK.skin,
    hr = SHARK.hair;
  const hy = 15,
    eyeY = 15;
  // jacket: padded shoulders, sleeves split from the body by a crease
  const torso = (i: number, j: number) => {
    if (j < 30) return false;
    const dx = Math.abs(i + 0.5 - cx);
    if (j < 36) return dx <= 25 - (36 - j) * 1.7;
    return dx <= 25 - Math.max(0, j - 50) * 0.3;
  };
  shape(s, torso, SHARK.coat, { band: 1 });
  for (const side of [-1, 1]) {
    for (let j = 37; j < 62; j++) s.set(cx + side * 16 - (side > 0 ? 1 : 0), j, SHARK.coat[1]);
    s.set(cx + side * 16, 36, SHARK.coat[1]);
  }
  // the open V: purple silk shirt, then skin with chest hair, two chains and a medallion
  const vee = (i: number, j: number) =>
    j >= 29 && j < 54 && Math.abs(i + 0.5 - cx) <= Math.max(0, 9 - (j - 29) * 0.36);
  shape(s, vee, SHARK.shirt);
  for (let j = 30; j < 54; j++)
    for (let i = 0; i < W; i++)
      if (s.get(i, j) === SHARK.shirt[2] && (i * 3 + j * 5) % 9 === 0) s.set(i, j, SHARK.shirt[3]);
  shape(
    s,
    (i, j) => j >= 29 && j < 47 && Math.abs(i + 0.5 - cx) <= Math.max(0, 5.6 - (j - 29) * 0.3),
    sk,
  );
  for (const [x, y] of [
    [cx - 3, 33],
    [cx + 1, 33],
    [cx - 1, 35],
    [cx + 3, 36],
    [cx - 2, 38],
    [cx + 1, 39],
    [cx, 42],
  ])
    s.set(x, y, sk[0]);
  // wide lapels with dark edges, and the collar points spread over them
  for (const side of [-1, 1]) {
    const lap = (i: number, j: number) => {
      const dx = (i + 0.5 - cx) * side;
      return j >= 31 && j < 56 && dx >= 9 - (j - 29) * 0.36 && dx <= 15 - (j - 31) * 0.35 && dx > 0;
    };
    shape(s, lap, SHARK.coat);
    for (let j = 31; j < 56; j++) {
      const e = cx + side * Math.round(9 - (j - 29) * 0.36);
      if (Math.abs(e - cx) > 0) s.set(e, j, SHARK.coat[0]);
    }
    for (let j = 31; j < 52; j++)
      s.set(cx + side * Math.round(15 - (j - 31) * 0.35), j, SHARK.coat[1]);
    for (let k = 0; k < 11; k++) {
      const x = cx + side * (6 + k),
        y = 28 + Math.round(k * 0.9);
      s.set(x, y, SHARK.shirt[3]);
      s.set(x, y + 1, SHARK.shirt[2]);
      s.set(x, y + 2, SHARK.shirt[2]);
      s.set(x, y + 3, SHARK.shirt[1]);
    }
    s.set(cx + side * 17, 38, SHARK.shirt[1]);
    s.set(cx + side * 17, 39, SHARK.shirt[0]);
  }
  for (let i = -5; i <= 5; i++) s.set(cx + i, 31 + Math.round((25 - i * i) * 0.16), R.gold[3]);
  for (let i = -6; i <= 6; i++) {
    const y = 32 + Math.round((36 - i * i) * 0.24);
    s.set(cx + i, y, R.gold[2]);
    if (i % 2 === 0) s.set(cx + i, y + 1, R.gold[1]);
  }
  box(s, cx - 3, 41, 7, 8, R.gold, { band: 1 });
  s.vline(cx, 42, 6, R.gold[0]);
  s.hline(cx - 1, 43, 3, R.gold[0]);
  s.hline(cx - 1, 46, 3, R.gold[0]);
  s.set(cx - 2, 42, '#ffffff');
  // pocket square, buttons
  shape(
    s,
    (i, j) => j >= 40 && j <= 42 && i >= cx + 16 && i <= cx + 21 && (j > 40 || i % 2 === 0),
    R.gum,
  );
  s.hline(cx + 15, 43, 8, SHARK.coat[1]);
  s.set(cx - 1, 55, R.gold[2]);
  s.set(cx - 1, 60, R.gold[2]);
  // thick neck and a double chin
  shape(s, (i, j) => j >= 24 && j <= 31 && Math.abs(i + 0.5 - cx - 0.5) <= 7.5, sk);
  s.hline(cx - 6, 30, 14, sk[1]);
  // the head: wide jowly jaw
  const headT = (i: number, j: number) => {
    const dx = Math.abs(i + 0.5 - cx - 0.5);
    if (j < hy) return ell(cx + 0.5, hy, 10.5, 12)(i, j);
    return j <= hy + 13 && dx <= 10.6 - Math.max(0, j - hy - 7) * 0.9;
  };
  shape(s, headT, sk);
  for (const side of [-1, 1]) shape(s, ell(cx + 0.5 + side * 11, eyeY + 2, 2.2, 3.4), sk);
  s.set(cx - 11, eyeY + 5, R.gold[3]);
  s.set(cx - 11, eyeY + 6, R.gold[2]);
  for (let j = hy + 8; j <= hy + 12; j++) {
    s.set(cx - 9 + (j - hy - 8), j, sk[1]);
    s.set(cx + 10 - (j - hy - 8), j, sk[1]);
  }
  s.hline(cx - 3, hy + 13, 8, sk[1]);
  // oily hair combed straight back, receding at the temples, a shine line
  const hairT = (i: number, j: number) =>
    headT(i, j) &&
    (j < 6 ||
      (j < 9 && Math.abs(i + 0.5 - cx - 0.5) > 5 && Math.abs(i + 0.5 - cx - 0.5) < 8.5) ||
      j < 7 + Math.max(0, 3 - Math.abs(i + 0.5 - cx - 0.5)) * 0.7 ||
      (j < eyeY + 3 && Math.abs(i + 0.5 - cx - 0.5) > 9.4));
  shape(s, (i, j) => hairT(i, j) || ell(cx + 0.5, 4, 10, 4)(i, j), hr, { band: 1 });
  for (let k = -7; k <= 7; k += 3)
    for (let j = 2; j < 7; j++)
      if (s.get(cx + k + Math.round((j - 2) * 0.4), j) === hr[2])
        s.set(cx + k + Math.round((j - 2) * 0.4), j, hr[1]);
  for (let i = cx - 6; i <= cx + 5; i++) s.set(i, 2 + Math.round(Math.abs(i - cx) * 0.2), hr[3]);
  // face by mood: heavy lids, bags under the eyes, a big nose
  const brow = hr[1];
  const eye = (x: number, open: boolean, look = -1, wide = false) => {
    if (!open) {
      s.hline(x, eyeY + 1, 4, sk[0]);
      return;
    }
    s.hline(x, eyeY - (wide ? 1 : 0), 4, sk[0]);
    s.rect(x, eyeY + 1, 4, wide ? 2 : 1, '#efe6d4');
    s.rect(x + 1 + look, eyeY + 1, 2, wide ? 2 : 1, INK);
    s.hline(x, eyeY + (wide ? 3 : 2), 4, sk[1]);
  };
  if (mode === 'sad') {
    s.set(cx - 7, eyeY - 2, brow);
    s.hline(cx - 6, eyeY - 3, 3, brow);
    s.set(cx - 3, eyeY - 4, brow);
    s.set(cx + 4, eyeY - 4, brow);
    s.hline(cx + 5, eyeY - 3, 3, brow);
    s.set(cx + 8, eyeY - 2, brow);
    eye(cx - 6, true, 0, true);
    eye(cx + 3, true, 0, true);
    s.set(cx + 9, eyeY - 4, '#cfefff');
    s.rect(cx + 8, eyeY - 3, 2, 2, '#8ec8f0');
    s.set(cx + 9, eyeY - 1, '#5a9ad0');
  } else if (mode === 'laugh') {
    s.hline(cx - 7, eyeY - 4, 5, brow);
    s.hline(cx + 3, eyeY - 4, 5, brow);
    for (const ex of [cx - 6, cx + 3]) {
      s.set(ex, eyeY + 1, sk[0]);
      s.hline(ex + 1, eyeY, 2, sk[0]);
      s.set(ex + 3, eyeY + 1, sk[0]);
    }
  } else {
    // one brow cocked high, the other low: the sly look
    s.hline(cx - 7, eyeY - 3, 2, brow);
    s.hline(cx - 5, eyeY - 4, 3, brow);
    s.set(cx - 2, eyeY - 3, brow);
    s.hline(cx + 3, eyeY - 2, 5, brow);
    s.set(cx + 8, eyeY - 3, brow);
    if (mode === 'loupe') {
      eye(cx - 6, true, -1, true);
      s.hline(cx + 3, eyeY + 1, 4, sk[0]);
    } else if (mode === 'blink') {
      eye(cx - 6, false);
      eye(cx + 3, false);
    } else {
      eye(cx - 6, true, -1);
      eye(cx + 3, true, -1);
    }
  }
  // nose
  s.rect(cx, eyeY + 1, 2, 5, sk[3]);
  s.vline(cx + 2, eyeY + 2, 4, sk[1]);
  s.hline(cx - 1, eyeY + 6, 4, sk[1]);
  s.set(cx - 1, eyeY + 6, sk[0]);
  s.set(cx + 2, eyeY + 6, sk[0]);
  s.set(cx - 2, eyeY + 5, sk[2]);
  s.set(cx + 3, eyeY + 5, sk[2]);
  // oily cheek and forehead shine
  s.set(cx - 7, eyeY + 4, sk[3]);
  s.set(cx - 6, eyeY + 4, sk[3]);
  s.set(cx - 2, 8, sk[3]);
  s.set(cx - 1, 8, sk[3]);
  // pencil mustache
  s.hline(cx - 4, eyeY + 8, 4, hr[1]);
  s.hline(cx + 2, eyeY + 8, 4, hr[1]);
  s.set(cx - 5, eyeY + 9, hr[1]);
  s.set(cx + 6, eyeY + 9, hr[1]);
  const my = eyeY + 10;
  if (mode === 'grin') {
    s.rect(cx - 5, my - 1, 12, 3, INK);
    s.hline(cx - 4, my - 1, 10, R.white[3]);
    s.hline(cx - 4, my, 10, R.white[2]);
    s.rect(cx + 2, my - 1, 2, 2, R.gold[3]);
    s.set(cx + 3, my, R.gold[2]);
    s.set(cx - 6, my - 2, sk[0]);
    s.set(cx + 7, my - 2, sk[0]);
  } else if (mode === 'laugh') {
    shape(
      s,
      (i, j) =>
        j >= my - 1 &&
        j <= my + 4 &&
        Math.abs(i + 0.5 - cx - 1) <= 6 - Math.max(0, j - my - 2) * 1.3,
      ['#3a0c18', '#3a0c18', '#5a1222', '#5a1222'],
    );
    s.hline(cx - 4, my - 1, 10, R.white[3]);
    s.rect(cx + 2, my - 1, 2, 1, R.gold[3]);
    s.hline(cx - 2, my + 3, 6, '#c8505a');
  } else if (mode === 'sad') {
    s.hline(cx - 3, my + 1, 8, SKIN_LIP);
    s.set(cx - 4, my + 2, SKIN_LIP);
    s.set(cx + 5, my + 2, SKIN_LIP);
  } else {
    s.hline(cx - 4, my + 1, 7, SKIN_LIP);
    s.set(cx + 3, my, SKIN_LIP);
    s.set(cx + 4, my, SKIN_LIP);
    s.set(cx + 5, my - 1, SKIN_LIP);
    s.set(cx + 3, my + 1, R.gold[3]);
  }
  s.outline();
  return cv(s);
}
export const sharkInfo: SharkInfo = {
  w: 64,
  h: 62,
  cx: 32,
  mouth: [39, 25],
  tooth: [34, 24],
  elbows: [
    [10, 52],
    [54, 52],
  ],
  sleeve: SHARK.coat,
  skin: SHARK.skin,
  eyeL: [27, 16],
  eyeR: [36, 16],
};
// A heavy hand with a gold pinky ring for the shark.
export const ringHand = (() => {
  const s = new Sprite(7, 7),
    sk = SHARK.skin;
  s.rect(1, 1, 5, 5, sk[2]);
  s.hline(1, 1, 5, sk[3]);
  s.hline(1, 5, 5, sk[1]);
  s.vline(5, 1, 5, sk[1]);
  s.set(1, 4, R.gold[3]);
  s.set(1, 5, R.gold[2]);
  s.set(3, 2, sk[1]);
  s.outline({ selective: false });
  return cv(s);
})();

// ----- the enforcer: buzz cut, shades at night, leather over a white tank, a bat -----
export const BRUTE = {
  skin: R.skinC,
  jacket: R.leather,
  tank: R.white,
  pants: ['#141218', '#221e28', '#322c3a', '#463e50'],
};
export function enforcer(o: EnforcerOpts = {}) {
  const W = 64,
    H = 106,
    cx = 32,
    s = new Sprite(W, H),
    sk = BRUTE.skin;
  const step = o.step || 0;
  const legs: [number, number][] = [
    [-1, step < 0 ? -2 : 0],
    [1, step > 0 ? -2 : 0],
  ];
  for (const [side, lift] of legs) {
    const x0 = side < 0 ? cx - 13 : cx + 2;
    shape(s, (i, j) => i >= x0 && i < x0 + 11 && j >= 60 && j < H - 5 + lift, BRUTE.pants, {
      band: 1,
    });
    shape(
      s,
      (i, j) =>
        j >= H - 6 + lift &&
        j <= H - 1 + lift &&
        i >= x0 - (side < 0 ? 2 : 0) &&
        i < x0 + 11 + (side > 0 ? 2 : 0),
      R.black,
      { band: 1 },
    );
    s.hline(x0 - (side < 0 ? 2 : 0), H - 1 + lift, 13, INK);
  }
  shape(s, (i, j) => j >= 56 && j <= 62 && Math.abs(i + 0.5 - cx) <= 16, BRUTE.pants, { band: 1 });
  s.rect(cx - 2, 57, 5, 3, R.gold[2]);
  s.set(cx - 2, 57, R.gold[3]);
  const torso = (i: number, j: number) => {
    if (j < 24) return false;
    const dx = Math.abs(i + 0.5 - cx);
    if (j < 30) return dx <= 27 - (30 - j) * 2.4;
    return j <= 58 && dx <= 27 - (j - 30) * 0.36;
  };
  shape(s, torso, BRUTE.jacket, { band: 1 });
  shape(
    s,
    (i, j) => torso(i, j) && Math.abs(i + 0.5 - cx) <= 8 - Math.max(0, j - 50) * 0.4 && j >= 24,
    BRUTE.tank,
    { band: 1 },
  );
  for (let j = 26; j < 56; j++) {
    s.set(cx - 9, j, BRUTE.jacket[3]);
    s.set(cx + 8, j, BRUTE.jacket[0]);
  }
  for (let i = -4; i <= 4; i++) s.set(cx + i, 26 + Math.round((16 - i * i) * 0.25), R.gold[2]);
  s.vline(cx - 19, 32, 22, BRUTE.jacket[3]);
  s.vline(cx + 18, 32, 22, BRUTE.jacket[0]);
  for (let j = 34; j < 54; j += 5) s.set(cx - 22, j, BRUTE.jacket[3]);
  // bull neck, small head, buzz cut, shades
  shape(s, (i, j) => j >= 15 && j <= 27 && Math.abs(i + 0.5 - cx - 0.5) <= 8.5, sk);
  s.hline(cx - 7, 24, 16, sk[1]);
  const headT = (i: number, j: number) =>
    ell(cx + 0.5, 10, 8.6, 9.8)(i, j) &&
    (j < 12 || Math.abs(i + 0.5 - cx - 0.5) < 8.6 - (j - 12) * 0.2);
  shape(s, headT, sk);
  shape(s, ell(cx - 8, 12, 2.2, 3), sk);
  shape(s, ell(cx + 9, 12, 2.2, 3), sk);
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < W; i++)
      if (headT(i, j) && (j < 5 || bayer(i, j) < 0.5))
        s.set(i, j, (i + j) % 5 === 0 ? '#4a3a40' : '#2a2026');
  s.hline(cx - 7, 9, 16, sk[1]);
  s.rect(cx - 7, 10, 15, 3, INK);
  s.set(cx - 7, 13, INK);
  s.set(cx + 7, 13, INK);
  s.hline(cx - 6, 13, 5, INK);
  s.hline(cx + 2, 13, 5, INK);
  s.set(cx - 5, 11, '#5a7b8a');
  s.set(cx + 2, 11, '#5a7b8a');
  s.set(cx - 4, 11, '#8db0b0');
  s.hline(cx - 8, 9, 17, sk[0]);
  s.hline(cx - 7, 8, 15, sk[3]);
  s.vline(cx, 13, 3, sk[1]);
  s.set(cx + 1, 15, sk[0]);
  const jaw = o.chew ? 1 : 0;
  s.hline(cx - 3, 18 + jaw, 7, sk[0]);
  s.set(cx + 4, 17 + jaw, sk[0]);
  if (o.chew) {
    s.set(cx - 7, 17, sk[1]);
    s.set(cx + 7, 17, sk[1]);
  }
  s.set(cx + 5, 8, sk[3]);
  s.vline(cx + 5, 14, 3, '#c88a7a');
  for (let j = 15; j <= 20; j++)
    for (let i = cx - 7; i <= cx + 7; i++) {
      const c = s.get(i, j);
      if ((c === sk[2] || c === sk[1]) && bayer(i, j) < 0.25) s.set(i, j, mix(c, '#2a2026', 0.35));
    }
  // upper arms baked down to the elbows
  stroke(
    s,
    [
      [cx - 22, 30],
      [cx - 25, 44],
      [cx - 24, 52],
    ],
    9,
    BRUTE.jacket,
  );
  stroke(
    s,
    [
      [cx + 22, 30],
      [cx + 25, 44],
      [cx + 24, 52],
    ],
    9,
    BRUTE.jacket,
  );
  if (o.walk) {
    stroke(
      s,
      [
        [cx - 24, 50],
        [cx - 25 + step * 2, 62],
      ],
      7,
      BRUTE.jacket,
    );
    fist(s, cx - 25 + step * 2, 65, sk, 3);
    stroke(
      s,
      [
        [cx + 24, 50],
        [cx + 25 - step * 2, 62],
      ],
      7,
      BRUTE.jacket,
    );
    fist(s, cx + 25 - step * 2, 65, sk, 3);
  }
  s.outline();
  return cv(s);
}
export const bruteInfo: BruteInfo = {
  w: 64,
  h: 106,
  cx: 32,
  mouth: [35, 18],
  elbows: [
    [8, 52],
    [56, 52],
  ],
  sleeve: BRUTE.jacket,
  skin: BRUTE.skin,
};
export const fistSprite = (() => {
  const s = new Sprite(9, 9),
    sk = BRUTE.skin;
  s.rect(1, 2, 7, 6, sk[2]);
  s.hline(1, 2, 7, sk[3]);
  s.hline(1, 7, 7, sk[1]);
  s.vline(7, 2, 6, sk[1]);
  for (let i = 2; i < 7; i += 2) s.set(i, 3, sk[1]);
  s.outline({ selective: false });
  return cv(s);
})();

// ----- queue: four people who stay sympathetic -----
export function queuePeople(): QueuePeople {
  // a man in a torn coat with a crumpled pay stub
  const man = (blink: boolean) => {
    const b = stander({
      h: 96,
      w: 40,
      skin: R.skinA,
      hair: 'beanie',
      hatRamp: R.moss,
      hairRamp: R.hair,
      top: R.grey,
      coat: R.coat,
      coatLen: 80,
      pants: R.olive,
      shoes: R.black,
      stubble: true,
      mood: 'worried',
      look: 1,
      blink,
      arms: 'stub',
      holes: [
        [12, 40],
        [25, 58],
        [14, 66],
      ],
    });
    const s = b.s;
    const [hx, hy] = b.handR;
    s.rect(hx - 4, hy - 7, 8, 6, R.paper[3]);
    s.set(hx - 4, hy - 7, R.paper[2]);
    s.set(hx + 3, hy - 2, R.paper[1]);
    s.hline(hx - 3, hy - 5, 5, R.paper[0]);
    s.hline(hx - 3, hy - 3, 4, R.paper[1]);
    s.set(hx + 2, hy - 6, '#3a7a4a');
    fist(s, hx, hy, R.skinA);
    s.outline();
    return { img: cv(s), b };
  };
  // an old woman, hunched, headscarf, holding a shopping cart full of cans
  const granny = (blink: boolean) => {
    const b = stander({
      h: 88,
      w: 40,
      skin: R.skinC,
      hair: 'scarf',
      hatRamp: R.red,
      hairRamp: R.grey,
      top: R.paper,
      coat: R.plum,
      coatLen: 84,
      pants: R.grey,
      shoes: R.coat,
      mood: 'worried',
      look: 1,
      blink,
      hunch: 3,
      arms: 'chest',
    });
    return cv(b.s);
  };
  const cart = (() => {
    const s = new Sprite(30, 40);
    for (let y = 6; y < 30; y++)
      for (let x = 2; x < 28; x++) {
        const edge = x === 2 || x === 27 || y === 6 || y === 29;
        if (edge) s.set(x, y, R.steel[3]);
        else if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) s.set(x, y, R.steel[1]);
      }
    const cans: [number, number][] = [
      [5, 1],
      [10, 0],
      [15, 2],
      [20, 1],
      [7, 4],
      [13, 5],
      [18, 4],
      [23, 6],
      [4, 9],
      [11, 10],
      [17, 9],
      [22, 10],
    ];
    for (const [x, y] of cans) {
      s.rect(x, y + 2, 4, 6, R.white[2]);
      s.vline(x, y + 2, 6, R.white[3]);
      s.vline(x + 3, y + 2, 6, R.white[0]);
      s.hline(x, y + 4, 4, (x + y) % 3 ? R.red[2] : R.sign[2]);
      s.hline(x, y + 2, 4, R.grey[2]);
    }
    s.hline(1, 30, 28, R.steel[2]);
    s.vline(27, 0, 8, R.steel[2]);
    s.hline(26, 0, 4, INK);
    for (const x of [5, 23]) {
      disc(s, x, 35, 3, INK);
      s.set(x, 35, R.grey[2]);
    }
    s.vline(5, 30, 3, R.steel[2]);
    s.vline(23, 30, 3, R.steel[2]);
    s.outline();
    return cv(s);
  })();
  // a young guy in a hoodie with a cardboard sign
  const kidSign = (blink: boolean) => {
    const b = stander({
      h: 94,
      w: 40,
      skin: R.skinB,
      hair: 'hood',
      hatRamp: R.hoodie,
      hairRamp: R.hair,
      top: R.hoodie,
      pants: R.denim,
      shoes: R.white,
      look: 0,
      blink,
      mood: 'plain',
      arms: 'chest',
    });
    const s = b.s;
    return cv(s);
  };
  const cardboard = (() => {
    const w = 48,
      h = 22,
      s = new Sprite(w, h);
    shape(s, (i, j) => i >= 1 && i < w - 1 && j >= 1 && j < h - 1 && !(i > w - 6 && j < 4), R.tan, {
      band: 1,
    });
    for (let i = 4; i < w - 4; i += 7) s.set(i, h - 3, R.tan[1]);
    const l1 = 'WILL WORK',
      l2 = 'FOR FOOD';
    text(s, l1, Math.floor((w - measure(l1)) / 2), 3, INK, 'tiny', { alignTop: true });
    text(s, l2, Math.floor((w - measure(l2)) / 2), 12, INK, 'tiny', { alignTop: true });
    fist(s, 3, 11, R.skinB);
    fist(s, w - 4, 11, R.skinB);
    s.outline();
    return cv(s);
  })();
  // a mother in a long coat, and her kid tugging it
  const mom = (blink: boolean) =>
    cv(
      stander({
        h: 92,
        w: 40,
        skin: R.skinC,
        hair: 'bun',
        hairRamp: R.rust,
        top: R.white,
        coat: R.teal,
        coatLen: 82,
        pants: R.black,
        shoes: R.black,
        look: 1,
        blink,
        mood: 'worried',
        scarfNeck: R.gum,
      }).s,
    );
  const kid = (tug: boolean) => {
    const b = stander({
      h: 58,
      w: 30,
      kid: true,
      skin: R.skinC,
      hair: 'pom',
      hatRamp: R.sign,
      hairRamp: R.rust,
      top: R.red,
      pants: R.denim,
      shoes: R.white,
      look: -1,
      mood: 'plain',
      arms: 'none',
    });
    const s = b.s,
      cx = b.cx,
      shY = b.shY;
    stroke(
      s,
      [
        [cx - 6, shY + 3],
        [cx - 8, shY + 12],
        [cx - 7, shY + 20],
      ],
      4,
      R.red,
    );
    fist(s, cx - 7, shY + 21, R.skinC);
    const hy = tug ? shY - 6 : shY - 2;
    stroke(
      s,
      [
        [cx + 6, shY + 3],
        [cx + 10, shY + 4],
        [cx + 13, hy],
      ],
      4,
      R.red,
    );
    fist(s, cx + 13, hy, R.skinC);
    s.outline();
    return cv(s);
  };
  return {
    man: { open: man(false).img, blink: man(true).img, cx: 20, w: 40, h: 96 },
    granny: { open: granny(false), blink: granny(true), cx: 20, w: 40, h: 88 },
    cart,
    signGuy: { open: kidSign(false), blink: kidSign(true), cx: 20, w: 40, h: 94 },
    cardboard,
    mom: { open: mom(false), blink: mom(true), cx: 20, w: 40, h: 92 },
    kid: { a: kid(false), b: kid(true), cx: 15, w: 30, h: 58 },
  };
}

// ----- small things -----
const prop = (w: number, h: number, fn: (s: Sprite) => void, outline = true) => {
  const s = new Sprite(w, h);
  fn(s);
  if (outline) s.outline();
  return cv(s);
};
const bundleImgs = new Map<string, HTMLCanvasElement>();
// A cash bundle with a paper band showing the amount.
export function bundle(label: string): HTMLCanvasElement {
  const cached = bundleImgs.get(label);
  if (cached) return cached;
  const tw = measure(label, 'tiny'),
    w = Math.max(22, tw + 8),
    h = 12;
  const img = prop(w, h, (s) => {
    for (let k = 0; k < 3; k++) {
      s.rect(1, 2 + k, w - 2, h - 4, k === 2 ? '#5a8a4a' : '#3f6a3a');
    }
    s.rect(1, 1, w - 2, h - 3, '#7ab062');
    s.hline(1, 1, w - 2, '#a8d880');
    for (let i = 3; i < w - 3; i += 4) s.set(i, 3, '#5a8a4a');
    s.rect(Math.floor((w - tw) / 2) - 2, 2, tw + 4, h - 5, R.paper[3]);
    s.hline(Math.floor((w - tw) / 2) - 2, h - 4, tw + 4, R.paper[1]);
    text(s, label, Math.floor((w - tw) / 2), 3, INK, 'tiny', { alignTop: true });
  });
  if (bundleImgs.size > 160) bundleImgs.clear();
  bundleImgs.set(label, img);
  return img;
}
export const paper = prop(12, 14, (s) => {
  s.rect(1, 1, 10, 12, R.paper[3]);
  s.hline(1, 12, 10, R.paper[1]);
  for (let j = 3; j < 11; j += 2) s.hline(2, j, j === 3 ? 6 : 8, R.paper[0]);
  s.hline(2, 10, 4, R.red[2]);
});
export const calc = prop(16, 12, (s) => {
  box(s, 0, 0, 16, 12, R.black, { band: 1 });
  s.rect(2, 1, 12, 4, '#2a3a2c');
  for (let j = 6; j < 11; j += 2)
    for (let i = 2; i < 14; i += 3) s.rect(i, j, 2, 1, j === 6 && i === 11 ? R.red[2] : R.grey[2]);
});
const stampTool = (ramp: Ramp) =>
  prop(9, 13, (s) => {
    s.rect(2, 0, 5, 7, ramp[2]);
    s.hline(2, 0, 5, ramp[3]);
    s.rect(3, 7, 3, 2, R.wood[2]);
    s.rect(0, 9, 9, 3, R.black[2]);
    s.hline(0, 12, 9, ramp[1]);
  });
export const stampOk = stampTool(R.sign),
  stampNo = stampTool(R.red);
export const loupe = prop(7, 7, (s) => {
  disc(s, 3, 3, 3.2, R.black[2]);
  disc(s, 3, 3, 2, '#5a7b8a');
  s.set(2, 2, '#ffffff');
});
export const cigar = prop(9, 4, (s) => {
  s.hline(0, 1, 8, R.wood[1]);
  s.hline(0, 2, 8, R.wood[0]);
  s.hline(1, 1, 5, R.wood[2]);
  s.set(4, 1, R.gold[2]);
  s.set(4, 2, R.gold[1]);
  s.rect(7, 1, 2, 2, '#ff7a3a');
  s.set(8, 1, '#ffd166');
});
const batWidth = (j: number) => {
  if (j < 14) return 4;
  if (j < 30) return 3;
  return 2;
};
export const bat = prop(6, 40, (s) => {
  for (let j = 0; j < 40; j++) {
    const w = batWidth(j);
    const x0 = Math.floor((6 - w) / 2);
    s.hline(x0, j, w, R.wood[2]);
    s.set(x0, j, R.wood[3]);
    s.set(x0 + w - 1, j, R.wood[1]);
  }
  s.rect(1, 37, 4, 3, R.black[2]);
  s.hline(2, 20, 2, R.wood[0]);
  s.set(3, 8, R.wood[0]);
});
export const batFlat = new Sprite(6, 40);
export const bubble = [3, 5, 7].map((r) =>
  prop(r * 2 + 2, r * 2 + 2, (s) => {
    disc(s, r + 1, r + 1, r, R.gum[2]);
    s.set(r - 1, r - 1, R.gum[3]);
    s.set(r, r - 1, '#ffffff');
  }),
);
export const polaroid = prop(12, 14, (s) => {
  s.rect(0, 0, 12, 14, R.white[3]);
  s.rect(1, 1, 10, 9, '#3a3446');
  disc(s, 6, 6, 2.6, R.skinB[2]);
  s.rect(3, 2, 7, 2, R.taxi[2]);
  s.rect(3, 8, 7, 2, R.denim[2]);
  s.hline(1, 11, 7, R.grey[1]);
});
export const canister = prop(7, 12, (s) => {
  s.rect(1, 1, 5, 10, R.steel[2]);
  s.vline(1, 1, 10, R.steel[3]);
  s.vline(5, 1, 10, R.steel[1]);
  s.hline(1, 1, 5, R.grey[3]);
  s.hline(1, 10, 5, R.grey[1]);
  s.hline(1, 5, 5, R.red[2]);
});
const envImgs = new Map<string, HTMLCanvasElement>();
export function envelope(label: string): HTMLCanvasElement {
  const cached = envImgs.get(label);
  if (cached) return cached;
  const tw = measure(label, 'tiny'),
    w = Math.max(24, tw + 8),
    h = 14;
  const img = prop(w, h, (s) => {
    s.rect(1, 1, w - 2, h - 2, R.paper[2]);
    s.hline(1, 1, w - 2, R.paper[3]);
    for (let i = 1; i < w - 1; i++) {
      const y = 1 + Math.round(Math.min(i, w - 1 - i) * 0.35);
      if (y < 6) s.set(i, y, R.paper[1]);
    }
    text(s, label, Math.floor((w - tw) / 2), 6, '#1f4a2c', 'tiny', { alignTop: true });
  });
  if (envImgs.size > 160) envImgs.clear();
  envImgs.set(label, img);
  return img;
}
const slipImgs = new Map<string, HTMLCanvasElement>();
export function slip(label: string, inbound: boolean): HTMLCanvasElement {
  const key = label + inbound;
  const cached = slipImgs.get(key);
  if (cached) return cached;
  const tw = measure(label, 'tiny'),
    w = Math.max(18, tw + 6),
    h = 10;
  const img = prop(
    w,
    h,
    (s) => {
      s.rect(0, 0, w, h, R.paper[3]);
      s.hline(0, h - 1, w, R.paper[1]);
      for (let i = 0; i < w; i += 2) s.set(i, 0, R.paper[1]);
      text(s, label, Math.floor((w - tw) / 2), 2, inbound ? '#1f6a2c' : '#8a1c26', 'tiny', {
        alignTop: true,
      });
    },
    false,
  );
  if (slipImgs.size > 160) slipImgs.clear();
  slipImgs.set(key, img);
  return img;
}
export const coinBig = [0, 1, 2, 3].map((f) =>
  prop(7, 7, (s) => {
    const w = [5, 3, 1, 3][f];
    for (let j = 1; j < 6; j++)
      for (let i = 0; i < 7; i++)
        if (Math.abs(i - 3) <= w / 2 + (j === 1 || j === 5 ? -0.6 : 0))
          s.set(i, j, f === 2 ? R.gold[1] : R.gold[2]);
    if (f === 0) {
      s.set(2, 2, R.gold[3]);
      s.set(3, 3, R.gold[1]);
    }
  }),
);
export const rat = [0, 1].map((f) =>
  prop(16, 7, (s) => {
    shape(s, (i, j) => ell(7, 3.5, 5.2, 2.8)(i, j), R.grey);
    shape(s, ell(12.5, 3, 2.6, 2), R.grey);
    s.set(14, 2, INK);
    s.set(15, 3, R.gum[2]);
    s.set(11, 1, R.gum[2]);
    for (let i = 0; i < 3; i++) s.set(i, 3 + (i === 1 ? 1 : 0), R.gum[1]);
    s.set(4 + f * 2, 6, R.grey[1]);
    s.set(9 - f * 2, 6, R.grey[1]);
  }),
);
