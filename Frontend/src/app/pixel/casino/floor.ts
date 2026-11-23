// The casino floor around the tables: people, slot machines, the bar with its bottles,
// stools and glasses. Bodies are baked sprites. Forearms are drawn live as limbs, so a
// pose can follow a lever, the shoe or a cocktail. Slots run as small ambient actors.
import type { Ramp } from '../street/pix';
import {
  INK,
  R,
  Sprite,
  bayer,
  box,
  cylH,
  cylV,
  measure,
  mix,
  ri,
  shape,
  sphere,
  srand,
  text,
} from '../street/pix';

export interface Painter {
  readonly ctx: CanvasRenderingContext2D;
  readonly s: number;
  img(c: CanvasImageSource & { width: number; height: number }, x: number, y: number): void;
  imgF(c: CanvasImageSource & { width: number; height: number }, x: number, y: number): void;
}

export interface PersonOpts {
  skin: Ramp;
  hair?: 'big' | 'long' | 'slick' | 'bald' | 'pomp';
  hairRamp: Ramp;
  top: Ramp;
  over?: Ramp;
  overKind?: 'vest' | 'jacket';
  arms?: boolean;
  neck?: 'bow' | 'tie' | 'dress' | 'chain' | 'open';
  tieRamp?: Ramp;
  collar?: boolean;
  garters?: boolean;
  tag?: boolean;
  visor?: boolean;
  mustache?: boolean;
  shades?: boolean;
  earrings?: boolean;
  lips?: string;
  sleeve?: Ramp;
}
export interface SeatedOpts {
  skin: Ramp;
  hair?: 'big' | 'bald' | 'cap';
  hairRamp: Ramp;
  top: Ramp;
  bottom: Ramp;
  capRamp?: Ramp;
  collar?: string;
}
export type BottleKind = 'wine' | 'whisky' | 'round' | 'tall' | 'champ';

const cv = (s: Sprite) => s.canvas();
const ell = (cx: number, cy: number, rx: number, ry: number) => (i: number, j: number) =>
  ((i + 0.5 - cx) / rx) ** 2 + ((j + 0.5 - cy) / ry) ** 2 <= 1;

// ----- people, front view, waist up -----
// o: skin, hair, hairRamp, top, over, overKind ('vest' | 'jacket'), arms (false = limbs only),
//    neck ('bow' | 'tie' | 'dress' | 'chain' | 'open'), tieRamp, collar, garters, tag,
//    visor, mustache, shades, earrings, lips
export function person(o: PersonOpts) {
  const W = 40,
    H = 64,
    cx = 20,
    eyeY = 12;
  const armsOn = o.arms !== false;
  const headT = ell(cx, 12, 6.6, 7.6);
  const torso = (i: number, j: number) => {
    if (j < 21) return false;
    const dx = Math.abs(i + 0.5 - cx);
    const half = armsOn ? Math.min(15.5, 8.5 + (j - 21) * 2.4) : Math.min(11, 7 + (j - 21) * 1.5);
    if (dx > half) return false;
    if (armsOn && dx > 10.5 && j > 46) return false;
    return true;
  };
  const make = (blink: boolean, look: number) => {
    const s = new Sprite(W, H),
      skin = o.skin,
      hr = o.hairRamp;
    if (o.hair === 'big') shape(s, ell(cx, 11, 10.6, 10.4), hr);
    if (o.hair === 'long')
      shape(
        s,
        (i, j) =>
          ell(cx, 11, 9.2, 8.8)(i, j) || (j >= 11 && j < 31 && Math.abs(i + 0.5 - cx) <= 9.2),
        hr,
      );
    shape(s, torso, o.top, { band: 1 });
    if (o.over) {
      const over = (i: number, j: number) => {
        if (!torso(i, j)) return false;
        const dx = Math.abs(i + 0.5 - cx);
        if (o.overKind === 'vest' && dx > 10.5) return false;
        if (j < 37 && dx < (j - 21) * 0.42 + 1.2) return false;
        return true;
      };
      shape(s, over, o.over, { band: 1 });
    }
    if (armsOn) {
      const crease = o.over && o.overKind === 'jacket' ? o.over[0] : o.top[1];
      s.vline(cx - 11, 26, 20, crease);
      s.vline(cx + 10, 26, 20, crease);
    }
    if (o.neck === 'dress')
      shape(s, (i, j) => j >= 20 && j <= 26 && Math.abs(i + 0.5 - cx) <= 6 - (j - 20) * 0.7, skin);
    s.rect(cx - 3, 18, 6, 4, skin[1]);
    shape(s, headT, skin);
    if (o.shades) {
      s.rect(cx - 5, eyeY - 1, 10, 2, INK);
      s.set(cx - 4, eyeY - 1, '#5a7b8a');
      s.set(cx + 2, eyeY - 1, '#5a7b8a');
    } else if (blink) {
      s.hline(cx - 4, eyeY, 2, skin[1]);
      s.hline(cx + 2, eyeY, 2, skin[1]);
    } else {
      s.vline(cx - 3 + look, eyeY - 1, 2, INK);
      s.vline(cx + 2 + look, eyeY - 1, 2, INK);
    }
    if (!o.shades) {
      s.hline(cx - 4, eyeY - 3, 2, hr[1]);
      s.hline(cx + 2, eyeY - 3, 2, hr[1]);
    }
    s.set(cx, eyeY + 2, skin[1]);
    s.set(cx, eyeY + 3, skin[1]);
    s.set(cx - 1, eyeY + 2, skin[3]);
    s.hline(cx - 2, eyeY + 5, 4, o.lips || skin[0]);
    if (o.mustache) s.hline(cx - 3, eyeY + 4, 6, hr[1]);
    s.set(cx - 8, eyeY, skin[2]);
    s.set(cx - 8, eyeY + 1, skin[1]);
    s.set(cx + 7, eyeY, skin[2]);
    s.set(cx + 7, eyeY + 1, skin[1]);
    switch (o.hair) {
      case 'slick':
        shape(s, (i, j) => headT(i, j) && (j < 7 || (j < 11 && Math.abs(i + 0.5 - cx) > 5.4)), hr);
        s.set(cx - 3, 5, hr[0]);
        s.set(cx - 3, 6, hr[0]);
        break;
      case 'big':
        shape(s, (i, j) => headT(i, j) && j < 8 - (Math.abs(i + 0.5 - cx) < 3 ? 1 : 0), hr);
        s.each((x, y, c) => {
          if (c === hr[2] && bayer(x, y) < 0.16) s.set(x, y, hr[3]);
        });
        break;
      case 'long':
        shape(s, (i, j) => headT(i, j) && (j < 8 || Math.abs(i + 0.5 - cx) > 5.4), hr);
        break;
      case 'bald':
        shape(s, (i, j) => headT(i, j) && j >= 9 && j <= 14 && Math.abs(i + 0.5 - cx) > 5.6, hr);
        s.set(cx - 3, 6, skin[3]);
        s.set(cx - 2, 6, skin[3]);
        break;
      case 'pomp':
        shape(
          s,
          (i, j) =>
            (ell(cx + 1, 5, 7.6, 4.6)(i, j) && j < 8) ||
            (headT(i, j) && (j < 7 || (j < 10 && Math.abs(i + 0.5 - cx) > 5.6))),
          hr,
        );
        break;
      default:
        break;
    }
    if (o.visor) {
      box(s, cx - 9, 5, 18, 3, R.sign, { band: 1 });
      s.hline(cx - 9, 8, 18, R.sign[0]);
    }
    if (o.collar) {
      s.set(cx - 4, 20, R.white[3]);
      s.set(cx - 4, 21, R.white[3]);
      s.set(cx - 3, 21, R.white[2]);
      s.set(cx + 3, 20, R.white[3]);
      s.set(cx + 3, 21, R.white[3]);
      s.set(cx + 2, 21, R.white[2]);
    }
    const tie = o.tieRamp || R.red;
    if (o.neck === 'bow') {
      s.rect(cx - 4, 20, 3, 3, tie[2]);
      s.rect(cx + 1, 20, 3, 3, tie[2]);
      s.rect(cx - 1, 21, 2, 1, tie[1]);
      s.set(cx - 4, 20, tie[3]);
      s.set(cx + 3, 22, tie[1]);
    }
    if (o.neck === 'tie') {
      s.rect(cx - 1, 20, 2, 2, tie[1]);
      s.rect(cx - 2, 22, 4, 12, tie[2]);
      s.vline(cx - 2, 22, 12, tie[3]);
      s.set(cx - 2, 33, tie[1]);
      s.set(cx + 1, 33, tie[1]);
    }
    if (o.neck === 'chain') {
      for (let i = -4; i <= 4; i++)
        s.set(cx + i - (i < 0 ? 1 : 0), 23 + Math.round(Math.abs(i) * -0.5 + 2), R.gold[3]);
      s.set(cx - 1, 26, R.gold[2]);
    }
    if (o.neck === 'open') {
      shape(s, (i, j) => j >= 20 && j <= 25 && Math.abs(i + 0.5 - cx) <= 3 - (j - 20) * 0.5, skin);
    }
    if (o.tag) {
      s.rect(cx + 5, 29, 4, 2, R.gold[2]);
      s.set(cx + 5, 29, R.gold[3]);
    }
    if (o.over && o.overKind === 'vest') {
      s.set(cx - 1, 38, R.gold[2]);
      s.set(cx - 1, 43, R.gold[2]);
    }
    if (o.garters && armsOn) {
      s.hline(cx - 15, 33, 5, R.red[2]);
      s.hline(cx - 15, 34, 5, R.red[1]);
      s.hline(cx + 11, 33, 5, R.red[2]);
      s.hline(cx + 11, 34, 5, R.red[1]);
    }
    if (o.earrings) {
      s.set(cx - 8, eyeY + 3, R.gold[3]);
      s.set(cx + 7, eyeY + 3, R.gold[3]);
    }
    s.outline();
    return cv(s);
  };
  return {
    open: make(false, 0),
    blink: make(true, 0),
    left: make(false, -1),
    right: make(false, 1),
    w: W,
    h: H,
    cx,
    elbows: [
      [cx - 13, 45],
      [cx + 13, 45],
    ] as [number, number][],
    shoulders: [
      [cx - 9, 24],
      [cx + 9, 24],
    ] as [number, number][],
    sleeve: o.sleeve || (o.over && o.overKind === 'jacket' ? o.over : o.top),
    skin: o.skin,
  };
}

// ----- people, back view, sitting on a stool -----
export function seatedBack(o: SeatedOpts) {
  const W = 26,
    H = 44,
    cx = 13,
    s = new Sprite(W, H),
    skin = o.skin,
    hr = o.hairRamp;
  const torso = (i: number, j: number) => {
    if (j < 16 || j > 37) return false;
    const dx = Math.abs(i + 0.5 - cx);
    const half = j < 19 ? 7 + (j - 16) * 1.5 : 10.5 - Math.max(0, j - 31) * 0.2;
    return dx <= half;
  };
  shape(s, (i, j) => j >= 34 && j <= 41 && Math.abs(i + 0.5 - cx) <= 10.5, o.bottom, { band: 1 });
  shape(s, torso, o.top, { band: 1 });
  s.vline(cx, 21, 13, o.top[1]);
  s.rect(cx - 2, 13, 4, 4, skin[1]);
  const headT = ell(cx, 8, 5.6, 6.6);
  if (o.hair === 'big') shape(s, (i, j) => ell(cx, 8, 8.6, 8.6)(i, j) && j < 18, hr);
  shape(s, headT, skin);
  s.set(cx - 6, 8, skin[2]);
  s.set(cx + 5, 8, skin[2]);
  if (o.hair === 'big') {
    shape(s, (i, j) => ell(cx, 8, 8.6, 8.6)(i, j) && j < 18, hr);
    s.each((x, y, c) => {
      if (c === hr[2] && bayer(x, y) < 0.2) s.set(x, y, hr[3]);
      if (c === hr[1] && bayer(x, y) < 0.12) s.set(x, y, hr[0]);
    });
  }
  if (o.hair === 'bald') {
    shape(s, (i, j) => headT(i, j) && j >= 7, hr);
    s.set(cx - 2, 3, skin[3]);
    s.set(cx - 1, 3, skin[3]);
  }
  if (o.hair === 'cap') {
    shape(s, (i, j) => headT(i, j) && j >= 7, hr);
    shape(s, (i, j) => headT(i, j) && j < 7, o.capRamp || R.red);
    s.hline(cx - 2, 6, 4, R.white[2]);
  }
  if (o.collar) {
    s.rect(cx - 4, 16, 8, 2, o.collar);
  }
  s.outline();
  return {
    img: cv(s),
    w: W,
    h: H,
    cx,
    shoulders: [
      [cx - 8, 19],
      [cx + 8, 19],
    ] as [number, number][],
    sleeve: o.top,
    skin,
  };
}

// ----- the cocktail waitress, side view walking right, four frames -----
export function waitress(): HTMLCanvasElement[] {
  const frames: HTMLCanvasElement[] = [];
  const hair = R.blond,
    skin = R.skinC;
  for (let f = 0; f < 4; f++) {
    const s = new Sprite(26, 48),
      bob = f % 2;
    const swing = [3, 0, -3, 0][f];
    const leg = (dx: number, col: string) => {
      s.line(10, 31 + bob, 10 + dx, 44, col);
      s.line(11, 31 + bob, 11 + dx, 44, col);
      s.rect(10 + dx, 44, 3, 2, INK);
      s.set(12 + dx, 45, R.black[2]);
    };
    leg(-swing, '#3a3446');
    leg(swing, '#5a5266');
    shape(
      s,
      (i, j) =>
        j >= 15 + bob &&
        j <= 32 + bob &&
        Math.abs(i + 0.5 - 11) <= (j < 26 + bob ? 4.2 : 4.2 + (j - 26 - bob) * 0.75),
      R.black,
      { band: 1 },
    );
    s.rect(13, 24 + bob, 3, 7, R.white[3]);
    s.vline(15, 24 + bob, 7, R.white[2]);
    s.rect(10, 13 + bob, 3, 3, skin[1]);
    shape(s, ell(12, 8 + bob, 4.6, 5.6), skin);
    shape(s, (i, j) => ell(12, 8 + bob, 4.6, 5.6)(i, j) && (j < 5 + bob || i < 11), hair);
    const tail = Math.round(swing * 0.4);
    s.line(7, 6 + bob, 4 - tail, 12 + bob, hair[2]);
    s.line(6, 6 + bob, 3 - tail, 12 + bob, hair[1]);
    s.set(4 - tail, 13 + bob, hair[1]);
    s.rect(7, 5 + bob, 2, 2, R.red[2]);
    s.set(14, 8 + bob, INK);
    s.set(16, 9 + bob, skin[2]);
    s.set(15, 11 + bob, R.red[2]);
    s.line(10, 17 + bob, 8 - swing, 25 + bob, skin[2]);
    s.line(12, 17 + bob, 15, 21 + bob, skin[2]);
    s.line(15, 21 + bob, 18, 14 + bob, skin[2]);
    s.rect(17, 13 + bob, 2, 2, skin[3]);
    s.rect(12, 12 + bob, 13, 1, R.white[2]);
    s.hline(13, 11 + bob, 11, R.white[3]);
    s.line(15, 6 + bob, 17, 8 + bob, '#dedae2');
    s.line(19, 6 + bob, 17, 8 + bob, '#dedae2');
    s.hline(16, 7 + bob, 3, '#ff7fd2');
    s.vline(17, 9 + bob, 2, '#dedae2');
    s.hline(16, 10 + bob, 3, '#dedae2');
    s.rect(21, 7 + bob, 3, 4, '#f2c66d');
    s.hline(21, 7 + bob, 3, '#fff3c4');
    s.line(23, 7 + bob, 24, 3 + bob, R.sign[3]);
    s.hline(22, 3 + bob, 3, '#ff7fd2');
    s.outline();
    frames.push(cv(s));
  }
  return frames;
}

// ----- limbs and hands, drawn live on the art grid -----
export function limb(
  tb: Painter,
  pts: readonly (readonly number[])[],
  ramp: Ramp,
  width = 4,
): void {
  const ctx = tb.ctx,
    S = tb.s;
  const pass = (col: string, w: number, off: number) => {
    ctx.fillStyle = col;
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k],
        [x1, y1] = pts[k + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
      for (let m = 0; m <= n; m++) {
        const x = Math.round(x0 + ((x1 - x0) * m) / n - w / 2 + off),
          y = Math.round(y0 + ((y1 - y0) * m) / n - w / 2 + off);
        ctx.fillRect(x * S, y * S, w * S, w * S);
      }
    }
  };
  pass(INK, width + 2, 0);
  pass(ramp[1], width, 0);
  pass(ramp[2], width - 1, -0.5);
  pass(ramp[3], Math.max(1, width - 3), -1);
}
const hands = new Map<Ramp, HTMLCanvasElement>();
export function handSprite(ramp: Ramp): HTMLCanvasElement {
  const cached = hands.get(ramp);
  if (cached) return cached;
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
  hands.set(ramp, img);
  return img;
}
export function hand(tb: Painter, x: number, y: number, ramp: Ramp): void {
  tb.img(handSprite(ramp), Math.round(x) - 3, Math.round(y) - 3);
}

// ----- small props -----
const prop = (w: number, h: number, fn: (s: Sprite) => void) => {
  const s = new Sprite(w, h);
  fn(s);
  s.outline();
  return cv(s);
};
export const martini = prop(7, 8, (s) => {
  s.hline(1, 1, 5, R.white[3]);
  s.rect(2, 2, 3, 1, '#ff7fd2');
  s.set(1, 2, R.white[2]);
  s.set(5, 2, R.white[2]);
  s.set(2, 3, R.white[2]);
  s.set(3, 3, '#ff7fd2');
  s.set(4, 3, R.white[2]);
  s.set(3, 2, R.sign[3]);
  s.vline(3, 4, 2, R.white[2]);
  s.hline(2, 6, 3, R.white[3]);
});
export const beer = prop(6, 8, (s) => {
  s.rect(1, 2, 4, 5, '#d98a1c');
  s.vline(1, 2, 5, '#ffd166');
  s.hline(1, 1, 4, R.white[3]);
  s.set(2, 0, R.white[3]);
  s.vline(4, 2, 5, '#a0600f');
});
export const coin = prop(4, 4, (s) => {
  s.rect(1, 1, 2, 2, R.gold[3]);
  s.set(2, 2, R.gold[2]);
});
export const shaker = prop(5, 9, (s) => {
  cylV(s, 1, 2, 3, 6, R.white);
  s.rect(2, 1, 1, 1, R.white[3]);
  s.hline(1, 2, 3, R.grey[1]);
});
export const sparkle = (() => {
  const s = new Sprite(5, 5);
  s.set(2, 0, '#fff3c4');
  s.set(2, 4, '#fff3c4');
  s.set(0, 2, '#fff3c4');
  s.set(4, 2, '#fff3c4');
  s.set(2, 1, '#ffffff');
  s.set(2, 3, '#ffffff');
  s.set(1, 2, '#ffffff');
  s.set(3, 2, '#ffffff');
  s.set(2, 2, '#ffffff');
  return cv(s);
})();
export const stool = prop(16, 32, (s) => {
  s.rect(2, 0, 12, 2, R.red[3]);
  s.hline(3, 0, 10, '#e98a7a');
  cylH(s, 1, 2, 14, 3, R.red);
  s.rect(7, 5, 2, 21, R.white[2]);
  s.vline(7, 5, 21, R.white[3]);
  s.vline(8, 5, 21, R.white[1]);
  s.hline(4, 16, 8, R.gold[2]);
  s.hline(4, 17, 8, R.gold[1]);
  s.rect(4, 26, 8, 2, R.grey[2]);
  s.rect(3, 28, 10, 2, R.grey[1]);
});
export const tap = prop(16, 20, (s) => {
  cylV(s, 6, 4, 4, 12, R.white);
  s.rect(4, 3, 8, 2, R.grey[2]);
  s.rect(3, 0, 2, 5, R.gold[2]);
  s.set(3, 0, R.gold[3]);
  s.rect(11, 0, 2, 5, R.red[2]);
  s.set(11, 0, R.red[3]);
  s.rect(2, 16, 12, 2, R.grey[1]);
  s.hline(2, 16, 12, R.grey[2]);
});

// ----- bottles -----
export const GLASS: string[][] = [
  ['#3a1e08', '#7a4210', '#c27a1c', '#ffd166'],
  ['#14301c', '#245a30', '#3f8a48', '#8fd07a'],
  ['#4a4752', '#8a8794', '#c9c5d0', '#f6f3f6'],
  ['#14204a', '#24407a', '#3f68b0', '#8fb0f0'],
  ['#3a0c18', '#7a1a2c', '#b8303e', '#ff7a7a'],
  ['#24183a', '#46307a', '#7050b0', '#b090f0'],
];
function capColor(kind: BottleKind, i: number): string {
  if (kind !== 'champ') return INK;
  return i === 1 ? R.gold[3] : R.gold[2];
}
export function bottle(kind: BottleKind, glass: Ramp, label: string): Sprite {
  const shapes: Record<
    BottleKind,
    {
      w: number;
      h: number;
      test: (i: number, j: number) => boolean;
      label: [number, number];
      cap: number;
    }
  > = {
    wine: {
      w: 4,
      h: 15,
      test: (i, j) => (j < 5 && i >= 1 && i <= 2) || (j === 5 && i >= 0 && i <= 3) || j >= 6,
      label: [9, 3],
      cap: 2,
    },
    whisky: {
      w: 6,
      h: 12,
      test: (i, j) => (j < 4 && i >= 2 && i <= 3) || j >= 4,
      label: [6, 3],
      cap: 1,
    },
    round: {
      w: 6,
      h: 11,
      test: (i, j) => (j < 4 && i >= 2 && i <= 3) || ell(3, 7.5, 3, 3.6)(i, j),
      label: [7, 2],
      cap: 1,
    },
    tall: {
      w: 4,
      h: 17,
      test: (i, j) => (j < 4 && i >= 1 && i <= 2) || j >= 4,
      label: [8, 4],
      cap: 2,
    },
    champ: {
      w: 5,
      h: 15,
      test: (i, j) => (j < 5 && i >= 1 && i <= 3) || j >= 5,
      label: [9, 3],
      cap: 4,
    },
  };
  const k = shapes[kind],
    s = new Sprite(k.w, k.h);
  for (let j = 0; j < k.h; j++)
    for (let i = 0; i < k.w; i++) {
      if (!k.test(i, j)) continue;
      let c = glass[2];
      if (i === 0 || !k.test(i - 1, j)) c = glass[3];
      else if (i === k.w - 1 || !k.test(i + 1, j) || j === k.h - 1) c = glass[1];
      s.set(i, j, c);
    }
  const [ly, lh] = k.label;
  for (let j = ly; j < ly + lh; j++)
    for (let i = 1; i < k.w - 1; i++)
      if (k.test(i, j)) s.set(i, j, j === ly ? mix(label, '#ffffff', 0.3) : label);
  for (let j = 0; j < k.cap; j++)
    for (let i = 0; i < k.w; i++) if (k.test(i, j)) s.set(i, j, capColor(kind, i));
  s.outline();
  return s;
}
export function barBack(s: Sprite, x: number, y: number, w: number, h: number, seed: number) {
  srand(seed);
  s.rect(x, y, w, h, '#141522');
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const d = (i + j * 2) % 37;
      if (d < 2) s.set(x + i, y + j, '#232842');
      else if (d === 2) s.set(x + i, y + j, '#1b1f33');
    }
  box(s, x - 3, y - 4, w + 6, 5, R.wood, { band: 1 });
  box(s, x - 3, y, 4, h, R.wood, { band: 1 });
  box(s, x + w - 1, y, 4, h, R.wood, { band: 1 });
  const shelves: number[] = [];
  const kinds: BottleKind[] = ['wine', 'whisky', 'round', 'tall', 'champ'];
  const labels = [R.paper[3], R.white[3], R.gold[2], INK, R.red[2], R.paper[2]];
  for (let sy = y + 20; sy < y + h - 4; sy += 22) {
    shelves.push(sy);
    let bx = x + 3;
    while (bx < x + w - 6) {
      const b = bottle(
        kinds[ri(0, kinds.length - 1)],
        GLASS[ri(0, GLASS.length - 1)],
        labels[ri(0, labels.length - 1)],
      );
      if (bx + b.w > x + w - 2) break;
      s.stamp(b, bx, sy - b.h);
      bx += b.w + ri(1, 3);
    }
    for (let i = 0; i < w; i++) {
      for (let k = 1; k <= 4; k++) {
        const px = x + i,
          py = sy + 1 + k,
          c = s.get(px, py);
        if (c && bayer(px, py) < 0.55 - k * 0.12) s.set(px, py, mix(c, '#ff7fd2', 0.35 - k * 0.05));
      }
    }
    box(s, x, sy, w, 2, R.wood, { band: 1 });
    s.hline(x, sy + 2, w, '#ff7fd2');
  }
  return shelves;
}
export function counter(s: Sprite, x: number, y: number, w: number, h: number) {
  box(s, x, y, w, 6, R.wood, { band: 1 });
  s.hline(x, y, w, R.wood[3]);
  s.rect(x, y + 6, w, h - 6, R.red[1]);
  for (let j = 0; j < h - 14; j++)
    for (let i = 0; i < w; i++) {
      const u = i % 10,
        v = (j + (Math.floor(i / 10) % 2) * 5) % 10;
      if (u === 5 && v === 5) s.set(x + i, y + 9 + j, R.red[0]);
      else if (Math.abs(u - 5) + Math.abs(v - 5) === 5) s.set(x + i, y + 9 + j, '#5e1828');
      else if (u < 5 && v < 5 && bayer(i, j) < 0.1) s.set(x + i, y + 9 + j, R.red[2]);
    }
  s.hline(x, y + 6, w, R.red[2]);
  cylH(s, x, y + h - 7, w, 3, R.gold);
  s.rect(x, y + h - 4, w, 4, R.black[1]);
}

// ----- slot machines -----
const SYMBOLS: Record<string, string[]> = {
  seven: ['kkkkkkk', 'kRRRRRk', 'kkkkRRk', '..kRRk.', '.kRRk..', '.kRRk..', '.kkkk..'],
  cherry: ['....g..', '...g.g.', '..g..g.', '.g...g.', 'rRr.rRr', 'RwR.RwR', 'rRr.rRr'],
  bell: ['...d...', '..yYy..', '.yYYYy.', '.yYYYy.', 'yYYYYYy', 'ddddddd', '...d...'],
  bar: ['kkkkkkk', 'kwwwwwk', 'kkkkkkk', '.......', 'kkkkkkk', 'kwwwwwk', 'kkkkkkk'],
  lemon: ['.......', '..yyy..', '.yYYYy.', 'yYwYYYy', '.yYYYy.', '..yyy..', '.......'],
  gem: ['..ccc..', '.cCCCc.', 'cCwCCCc', '.cCCCc.', '..cCc..', '...c...', '.......'],
};
const SYM_PAL: Record<string, string> = {
  k: INK,
  R: '#ff4a4e',
  r: '#a82230',
  w: '#ffffff',
  g: '#3f8a48',
  y: '#d9a520',
  Y: '#ffd166',
  d: '#a06a14',
  c: '#2a8ea3',
  C: '#8ef0ff',
};
const STRIP = ['seven', 'cherry', 'bar', 'bell', 'lemon', 'gem', 'cherry', 'bell'];
const PITCH = 8,
  PERIOD = STRIP.length * PITCH,
  WIN_H = 15;
const strip = (() => {
  const s = new Sprite(7, PERIOD * 2);
  s.rect(0, 0, 7, PERIOD * 2, R.white[3]);
  for (let rep = 0; rep < 2; rep++)
    STRIP.forEach((key, k) => {
      SYMBOLS[key].forEach((row, j) =>
        [...row].forEach((ch, i) => {
          if (SYM_PAL[ch]) s.set(i, rep * PERIOD + k * PITCH + j, SYM_PAL[ch]);
        }),
      );
    });
  return cv(s);
})();
const aligned = (k: number) => (((k * PITCH + 3.5 - WIN_H / 2) % PERIOD) + PERIOD) % PERIOD;

function slotCabinet(ramp: Ramp, label: string) {
  const s = new Sprite(38, 72);
  box(s, 1, 6, 32, 16, ramp, { band: 1 });
  s.rect(4, 9, 26, 10, '#120d1c');
  const lw = measure(label, 'micro');
  text(s, label, 17 - Math.floor(lw / 2), 10, R.gold[3], 'micro', {
    alignTop: true,
    shadow: R.red[1],
  });
  cylH(s, 0, 22, 34, 3, R.white);
  box(s, 1, 25, 32, 44, ramp, { band: 2 });
  s.rect(4, 27, 26, 19, R.grey[1]);
  s.hline(4, 27, 26, R.grey[2]);
  s.rect(5, 28, 24, 17, '#0c0810');
  for (const rx of [6, 14, 22]) s.rect(rx, 29, 7, WIN_H, R.white[3]);
  s.set(4, 36, R.red[3]);
  s.set(29, 36, R.red[3]);
  box(s, 2, 47, 30, 5, R.grey, { band: 1 });
  for (const [bx, col] of [
    [6, R.red[1]],
    [12, R.gold[1]],
    [18, R.sign[1]],
    [24, R.white[1]],
  ] as [number, string][])
    s.rect(bx, 48, 4, 2, col);
  box(s, 3, 53, 28, 11, ramp, { band: 1 });
  for (let j = 54; j < 63; j++)
    for (let i = 4; i < 30; i++) {
      const a = Math.atan2(63 - j, i + 0.5 - 17);
      if (Math.floor(a / 0.26) % 2 === 0) s.set(i, j, mix(ramp[2], R.gold[3], 0.35));
    }
  text(s, '$', 15, 55, R.gold[3], 'tiny', { alignTop: true, shadow: ramp[0] });
  box(s, 6, 64, 22, 5, R.grey, { band: 1 });
  s.rect(8, 65, 18, 2, INK);
  s.rect(0, 69, 34, 3, R.black[1]);
  box(s, 33, 32, 4, 10, R.grey, { band: 1 });
  s.outline();
  const bulbs: [number, number][] = [];
  for (let i = 2; i <= 32; i += 3) {
    bulbs.push([i, 7]);
    bulbs.push([i, 20]);
  }
  for (let j = 10; j <= 17; j += 3) {
    bulbs.push([2, j]);
    bulbs.push([32, j]);
  }
  return { img: cv(s), bulbs };
}

export const bulbMini = (() => {
  const s = new Sprite(3, 3);
  s.set(1, 0, '#f2c66d');
  s.set(0, 1, '#f2c66d');
  s.set(2, 1, '#f2c66d');
  s.set(1, 2, '#f2c66d');
  s.set(1, 1, '#ffffff');
  return cv(s);
})();
const beaconOff = prop(9, 6, (s) => {
  sphere(s, 4.5, 4.5, 4, R.red);
  s.rect(0, 5, 9, 1, R.grey[1]);
});
const beaconOn = [0, 1].map((side) =>
  prop(9, 6, (s) => {
    sphere(s, 4.5, 4.5, 4, ['#7a1a2c', '#d02a3a', '#ff6b6b', '#ffd6d6']);
    s.rect(side ? 5 : 1, 2, 3, 2, '#ffffff');
    s.rect(0, 5, 9, 1, R.grey[1]);
  }),
);

interface Reel {
  pos: number;
  mode: 'idle' | 'spin' | 'stop';
  t0: number;
  from: number;
  delta: number;
  stopAt: number;
  dur: number;
  v?: number;
  target?: number;
}
interface SlotCoin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  rest: boolean;
}

export class Slot {
  x: number;
  y: number;
  img: HTMLCanvasElement;
  bulbs: [number, number][];
  seed: number;
  reels: Reel[];
  lever: number;
  leverT: number;
  next: number;
  player: boolean;
  win: number;
  coins: SlotCoin[];
  t: number;
  wins: number;
  pending?: boolean;

  // x, y: top left of the cabinet in scene art pixels.
  constructor(
    x: number,
    y: number,
    ramp: Ramp,
    label: string,
    seed: number,
    opts: { player?: boolean } = {},
  ) {
    this.x = x;
    this.y = y;
    const cab = slotCabinet(ramp, label);
    this.img = cab.img;
    this.bulbs = cab.bulbs;
    this.seed = seed;
    this.reels = [0, 1, 2].map(() => ({
      pos: aligned(this.rnd(0, STRIP.length - 1)),
      mode: 'idle',
      t0: 0,
      from: 0,
      delta: 0,
      stopAt: 0,
      dur: 0.42,
    }));
    this.lever = 0;
    this.leverT = -9;
    this.next = opts.player ? 1.5 + this.rnd(0, 30) / 10 : Infinity;
    this.player = !!opts.player;
    this.win = -9;
    this.coins = [];
    this.t = 0;
    this.wins = 0;
  }
  rnd(a: number, b: number): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return a + (this.seed % (b - a + 1));
  }
  knob(): [number, number] {
    const k = this.lever;
    return [this.x + 35.5, this.y + 18 + 36 * k];
  }
  buttons(): [number, number] {
    return [this.x + 14, this.y + 49];
  }
  pull() {
    this.leverT = this.t;
    const win = this.rnd(0, 3) === 0;
    const first = this.rnd(0, STRIP.length - 1);
    this.reels.forEach((r, i) => {
      r.mode = 'spin';
      r.v = 230 + i * 20;
      r.stopAt = this.t + 0.75 + i * 0.32;
      r.target = win ? first : this.rnd(0, STRIP.length - 1);
    });
    if (
      !win &&
      this.reels[0].target === this.reels[1].target &&
      this.reels[1].target === this.reels[2].target
    )
      this.reels[2].target = (this.reels[2].target! + 1) % STRIP.length;
    this.pending = win;
  }
  step(dt: number) {
    this.t += dt;
    const lt = this.t - this.leverT;
    if (lt < 0.12) this.lever = lt / 0.12;
    else if (lt < 0.42) this.lever = 1 - (lt - 0.12) / 0.3;
    else this.lever = 0;
    for (const r of this.reels) {
      if (r.mode === 'spin') {
        r.pos = (((r.pos - r.v! * dt) % PERIOD) + PERIOD) % PERIOD;
        if (this.t >= r.stopAt) {
          r.mode = 'stop';
          r.t0 = this.t;
          r.from = r.pos;
          r.delta = ((((r.pos - aligned(r.target!)) % PERIOD) + PERIOD) % PERIOD) + PERIOD;
        }
      } else if (r.mode === 'stop') {
        const u = Math.min(1, (this.t - r.t0) / r.dur),
          c1 = 1.9,
          e = 1 + (c1 + 1) * (u - 1) ** 3 + c1 * (u - 1) ** 2;
        r.pos = (((r.from - r.delta * e) % PERIOD) + PERIOD) % PERIOD;
        if (u >= 1) {
          r.mode = 'idle';
          r.pos = aligned(r.target!);
        }
      }
    }
    if (this.pending !== undefined && this.reels.every((r) => r.mode === 'idle')) {
      if (this.pending) {
        this.win = this.t;
        this.wins += 1;
        for (let i = 0; i < 14; i++)
          this.coins.push({
            x: 17 + this.rnd(-6, 6),
            y: 63,
            vx: this.rnd(-30, 30),
            vy: -this.rnd(10, 46),
            t: this.t + i * 0.06,
            rest: false,
          });
      }
      this.pending = undefined;
      this.next = this.t + (this.player ? 2.4 + this.rnd(0, 30) / 10 : Infinity);
    }
    if (this.t >= this.next && this.reels.every((r) => r.mode === 'idle')) {
      this.next = Infinity;
      this.pull();
    }
    for (const c of this.coins) {
      if (this.t < c.t || c.rest) continue;
      c.vy += 220 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.y > 66) {
        c.y = 66;
        c.vy *= -0.35;
        c.vx *= 0.6;
        if (Math.abs(c.vy) < 8) {
          c.rest = true;
          c.vy = 0;
        }
      }
      c.x = Math.max(8, Math.min(26, c.x));
    }
    if (this.t - this.win > 3.2) this.coins = [];
  }
  winning(): boolean {
    return this.t - this.win < 3.2;
  }
  armOut(): boolean {
    if (this.next !== Infinity && this.t > this.next - 0.35) return true;
    return this.t - this.leverT < 0.6;
  }
  draw(tb: Painter) {
    const { ctx, s } = tb,
      x = this.x,
      y = this.y;
    tb.img(this.img, x, y);
    ctx.save();
    for (const [i, rx] of [6, 14, 22].entries()) {
      ctx.beginPath();
      ctx.rect((x + rx) * s, (y + 29) * s, 7 * s, WIN_H * s);
      ctx.save();
      ctx.clip();
      ctx.drawImage(
        strip,
        (x + rx) * s,
        Math.round((y + 29 - this.reels[i].pos) * s),
        7 * s,
        PERIOD * 2 * s,
      );
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(12,8,16,0.35)';
    for (const rx of [6, 14, 22]) {
      ctx.fillRect((x + rx) * s, (y + 29) * s, 7 * s, s);
      ctx.fillRect((x + rx) * s, (y + 29 + WIN_H - 1) * s, 7 * s, s);
    }
    const win = this.winning(),
      t = this.t;
    if (win && Math.floor(t * 6) % 2 === 0) {
      ctx.fillStyle = '#ff4a4e';
      ctx.fillRect((x + 5) * s, (y + 36) * s, 24 * s, s);
    }
    const lit = Math.floor(t * (win ? 6 : 5));
    this.bulbs.forEach(([bx, by], i) => {
      if (win ? lit % 2 === 0 : (i + lit) % 3 === 0) tb.img(bulbMini, x + bx - 1, y + by - 1);
    });
    const bl = Math.floor(t * 2.5) % 4;
    const btns: [number, string][] = [
      [6, '#ff6b6b'],
      [12, '#ffd166'],
      [18, '#8cc063'],
      [24, '#ffffff'],
    ];
    btns.forEach(([bx, col], i) => {
      if (i === bl || win) {
        ctx.fillStyle = col;
        ctx.fillRect((x + bx) * s, (y + 48) * s, 4 * s, 2 * s);
      }
    });
    tb.img(win ? beaconOn[Math.floor(t * 6) % 2] : beaconOff, x + 12.5, y);
    if (win && Math.floor(t * 6) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,214,102,0.22)';
      ctx.beginPath();
      ctx.moveTo((x + 17) * s, (y + 3) * s);
      ctx.lineTo((x - 6) * s, (y - 6) * s);
      ctx.lineTo((x - 6) * s, (y + 10) * s);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo((x + 17) * s, (y + 3) * s);
      ctx.lineTo((x + 40) * s, (y - 6) * s);
      ctx.lineTo((x + 40) * s, (y + 10) * s);
      ctx.fill();
    }
    const [kx, ky] = this.knob(),
      pivotY = y + 37;
    ctx.fillStyle = INK;
    ctx.fillRect((x + 34) * s, Math.min(ky, pivotY) * s, 3 * s, Math.abs(pivotY - ky) * s);
    ctx.fillStyle = R.white[2];
    ctx.fillRect((x + 35) * s, Math.min(ky, pivotY) * s, s, Math.abs(pivotY - ky) * s);
    tb.img(knobImg, kx - 2.5, ky - 2.5);
    for (const c of this.coins) if (t >= c.t) tb.imgF(coin, x + c.x - 2, y + c.y - 2);
  }
}
const knobImg = prop(5, 5, (s) => sphere(s, 2.5, 2.5, 2.2, R.red, '#ffd6d6'));
