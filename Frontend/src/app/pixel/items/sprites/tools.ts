import { R, Sprite, box, shape, sphere, type Ramp } from '../../street/pix';
import { digits, ell } from './helpers';

// One chain link at (cx, cy). Round links face the viewer, flat ones are turned edge-on along the tangent.
function link(s: Sprite, cx: number, cy: number, angle: number, flat: boolean): void {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const test = (x: number, y: number): boolean => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    if (!flat) return Math.hypot(dx, dy) <= 2.9 && Math.hypot(dx, dy) >= 1.2;
    const u = dx * ux + dy * uy;
    const v = -dx * uy + dy * ux;
    return (u / 3.5) ** 2 + (v / 1.9) ** 2 <= 1;
  };
  shape(s, test, R.gold, {
    x0: Math.floor(cx - 5),
    x1: Math.ceil(cx + 5),
    y0: Math.floor(cy - 5),
    y1: Math.ceil(cy + 5),
  });
  for (let y = Math.floor(cy - 6); y <= Math.ceil(cy + 6); y++)
    for (let x = Math.floor(cx - 6); x <= Math.ceil(cx + 6); x++) {
      const touches = test(x - 1, y) || test(x + 1, y) || test(x, y - 1) || test(x, y + 1);
      if (!test(x, y) && touches && s.get(x, y)) s.set(x, y, R.gold[0]);
    }
}

export function knockoffGoldChain(): Sprite {
  const s = new Sprite(32, 32);
  const rx = 11.8;
  const ry = 7.4;
  const count = 10;
  for (let i = 0; i < count; i++) {
    const t = Math.PI / 2 + (2 * Math.PI * i) / count;
    const tangent = Math.atan2(ry * Math.cos(t), -rx * Math.sin(t));
    link(s, 16 + rx * Math.cos(t), 5 + ry + ry * Math.sin(t), tangent, i % 2 === 1);
  }
  sphere(s, 16, 25, 4.6, R.gold);
  for (const [x, y] of [
    [14, 24],
    [15, 23],
    [18, 24],
    [18, 27],
  ])
    s.set(x, y, R.green[2]);
  s.set(15, 24, R.green[3]);
  for (const [x, y] of [
    [5, 11],
    [8, 16],
    [26, 8],
    [22, 15],
  ])
    s.set(x, y, R.green[2]);
  return s.outline();
}

// Membership test for an ellipse turned by `tilt` radians, so the stone sits at an angle.
const tilted =
  (cx: number, cy: number, rx: number, ry: number, tilt: number) =>
  (x: number, y: number): boolean => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const u = dx * Math.cos(tilt) + dy * Math.sin(tilt);
    const v = -dx * Math.sin(tilt) + dy * Math.cos(tilt);
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
  };

function stoneRamp(shift: number): Ramp {
  if (shift < 21) return R.purple;
  if (shift < 25) return R.denim;
  return R.sign;
}

export function moodRing(): Sprite {
  const s = new Sprite(32, 32);
  const outer = ell(16, 20, 10.5, 10);
  const hole = ell(16, 21, 6.2, 6);
  shape(s, (i, j) => outer(i, j) && !hole(i, j), R.gold, { band: 1 });
  shape(s, tilted(16, 10, 9.6, 7.6, -0.35), R.gold);
  const stone = tilted(16, 10, 7.6, 5.3, -0.35);
  for (let y = 2; y < 18; y++)
    for (let x = 5; x < 27; x++) {
      if (!stone(x, y)) continue;
      const shift = x + y * 0.5;
      const ramp = stoneRamp(shift);
      const dark = !stone(x + 1, y) || !stone(x, y + 1);
      s.set(x, y, ramp[dark ? 1 : 2]);
    }
  for (const [x, y] of [
    [11, 9],
    [12, 8],
    [11, 10],
  ])
    s.set(x, y, R.white[3]);
  return s.outline();
}

export function calculatorWatch(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 10, 2, 12, 7, R.black);
  box(s, 10, 24, 12, 6, R.black);
  s.set(15, 27, R.black[0]);
  s.set(16, 27, R.black[0]);
  s.rect(3, 12, 2, 3, R.steel[2]);
  s.rect(27, 15, 2, 3, R.steel[2]);
  box(s, 4, 7, 24, 19, R.steel, { band: 1 });
  s.rect(6, 9, 20, 9, R.black[0]);
  s.rect(7, 10, 18, 7, R.sign[3]);
  digits(s, '1999', 8, 11, R.sign[0]);
  s.rect(6, 18, 20, 7, R.black[1]);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++) {
      const equals = row === 1 && col === 3;
      s.hline(7 + col * 5, 19 + row * 3, 3, equals ? R.taxi[2] : R.steel[3]);
      s.hline(7 + col * 5, 20 + row * 3, 3, equals ? R.taxi[2] : R.steel[1]);
    }
  return s.outline();
}

// A wristwatch seen from above, lying on its strap: an oval gold dial with a white face.
function caseWatch(s: Sprite, x: number, y: number): void {
  s.rect(x + 1, y, 4, 8, R.black[2]);
  shape(s, ell(x + 3, y + 4, 3, 2.2), R.gold, { x0: x, x1: x + 6, y0: y + 1, y1: y + 7 });
  s.rect(x + 2, y + 3, 2, 2, R.white[3]);
}

export function streetCornerWatchCase(): Sprite {
  const s = new Sprite(32, 32);
  const lidLeft = (y: number) => Math.round(8 - ((y - 2) * 4) / 10);
  const lidRight = (y: number) => Math.round(23 + ((y - 2) * 4) / 10);
  const baseLeft = (y: number) => Math.round(4 - ((y - 13) * 2) / 16);
  const baseRight = (y: number) => Math.round(27 + ((y - 13) * 2) / 16);
  const lid = (x: number, y: number) => y >= 2 && y <= 12 && x >= lidLeft(y) && x <= lidRight(y);
  const base = (x: number, y: number) =>
    y >= 13 && y <= 29 && x >= baseLeft(y) && x <= baseRight(y);
  shape(s, lid, R.tan, { band: 1 });
  shape(s, base, R.tan, { band: 1 });
  for (let y = 4; y <= 11; y++) s.hline(lidLeft(y) + 2, y, lidRight(y) - lidLeft(y) - 3, R.red[1]);
  for (let y = 15; y <= 27; y++)
    s.hline(baseLeft(y) + 2, y, baseRight(y) - baseLeft(y) - 3, R.red[1]);
  for (const x of [9, 16]) caseWatch(s, x, 4);
  for (const x of [6, 13, 20]) caseWatch(s, x, 16);
  s.rect(12, 25, 6, 3, R.paper[2]);
  s.rect(26, 25, 3, 5, R.paper[2]);
  s.line(3, 25, 4, 22, R.tan[3]);
  return s.outline();
}

export function goldToothCap(): Sprite {
  const s = new Sprite(32, 32);
  const rootL = (x: number, y: number) =>
    y >= 18 && y <= 29 && x >= 8 + (y - 18) * 0.3 && x <= 14 - (y - 18) * 0.25;
  const rootR = (x: number, y: number) =>
    y >= 18 && y <= 29 && x >= 18 + (y - 18) * 0.25 && x <= 24 - (y - 18) * 0.3;
  shape(s, (x, y) => rootL(x, y) || rootR(x, y), R.paper, { band: 1 });
  const cusps = [ell(9.5, 11, 4, 6), ell(16, 10, 4, 6), ell(22.5, 11, 4, 6)];
  const crown = (x: number, y: number) =>
    cusps.some((c) => c(x, y)) ||
    (x >= 5 + Math.floor((y - 10) / 4) && x <= 26 - Math.floor((y - 10) / 4) && y >= 10 && y <= 20);
  shape(s, crown, R.gold, { band: 1 });
  s.hline(7, 19, 18, R.gold[1]);
  for (const [x, y] of [
    [8, 8],
    [9, 7],
    [8, 9],
  ])
    s.set(x, y, R.white[3]);
  return s.outline();
}

export function garageAmp(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(9, 2, 14, 2, R.black[3]);
  s.rect(9, 4, 2, 2, R.black[3]);
  s.rect(21, 4, 2, 2, R.black[3]);
  box(s, 2, 6, 28, 24, R.black, { band: 1 });
  box(s, 4, 8, 24, 7, R.steel, { band: 1 });
  [7, 12, 17, 22].forEach((x, n) => {
    sphere(s, x, 11, 1.8, R.black);
    s.set(x - 1 + (n % 2), 10, R.steel[3]);
  });
  s.rect(25, 10, 2, 2, R.red[2]);
  box(s, 4, 17, 24, 11, R.tan, { band: 1 });
  for (let y = 18; y < 27; y += 2)
    for (let x = 5; x < 27; x += 2) s.set(x + ((y >> 1) % 2), y, R.tan[1]);
  s.rect(22, 19, 5, 5, R.steel[3]);
  s.rect(24, 21, 1, 1, R.red[2]);
  s.line(3, 27, 5, 29, R.steel[2]);
  return s.outline();
}

type Pt = readonly [number, number];

function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const k = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby);
  const t = Math.min(Math.max(k, 0), 1);
  return Math.hypot(p[0] - a[0] - t * abx, p[1] - a[1] - t * aby);
}

// across is the signed distance from the axis, positive towards the lower right, so the far side goes dark.
function furTone(across: number): number {
  if (across < -1.6) return 3;
  if (across < 1.6) return 2;
  return 1;
}

function poleTone(across: number): number {
  return across < -0.3 ? 2 : 1;
}

export function beatUpBoomMic(): Sprite {
  const s = new Sprite(32, 32);
  const head: Pt = [23.5, 8.5];
  const neck: Pt = [20.4, 11.6];
  const pole: Pt = [17, 15];
  const grip: Pt = [8.5, 23.5];
  const end: Pt = [4.3, 27.7];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const p: Pt = [x + 0.5, y + 0.5];
      const across = (p[0] - head[0] + p[1] - head[1]) * Math.SQRT1_2;
      const along = (head[0] - p[0] + p[1] - head[1]) * Math.SQRT1_2;
      const edge = ((x * 7 + y * 3) % 4) * 0.12;
      if (segmentDistance(p, head, neck) <= 4.8 + edge) {
        const clamp = Math.abs(along - 5.2) < 0.8;
        s.set(x, y, clamp ? R.black[1] : R.grey[furTone(across)]);
      } else if (segmentDistance(p, grip, end) <= 1.9) {
        s.set(x, y, R.black[across < 0 ? 2 : 1]);
      } else if (segmentDistance(p, pole, grip) <= 1.1) {
        const tape = along > 12.2 && along < 13.6;
        s.set(x, y, tape ? R.grey[3] : R.steel[poleTone(across)]);
      }
    }
  s.rect(19, 10, 2, 2, R.steel[1]);
  s.rect(22, 6, 2, 1, R.steel[1]);
  s.line(7, 25, 6, 26, R.grey[2]);
  return s.outline();
}

export function dentedHarmonica(): Sprite {
  const s = new Sprite(32, 32);
  const body = (x: number, y: number) =>
    x >= 2 && x <= 29 && y >= 13 && y <= 29 && !((x < 4 || x > 27) && (y < 15 || y > 27));
  shape(s, body, R.steel, { band: 1 });
  s.rect(4, 18, 24, 8, R.wood[2]);
  s.hline(4, 18, 24, R.wood[3]);
  s.hline(4, 25, 24, R.wood[1]);
  for (let n = 0; n < 8; n++) s.rect(5 + n * 3, 19, 2, 6, R.black[0]);
  const dent = ell(23, 16, 3.6, 1.9);
  for (let y = 13; y < 18; y++)
    for (let x = 18; x < 29; x++) {
      if (!dent(x, y)) continue;
      if (!dent(x - 1, y) || !dent(x, y - 1)) s.set(x, y, R.steel[0]);
      else if (!dent(x + 1, y) || !dent(x, y + 1)) s.set(x, y, R.steel[3]);
      else s.set(x, y, R.steel[1]);
    }
  s.line(7, 28, 12, 28, R.steel[3]);
  s.line(14, 14, 15, 15, R.steel[3]);
  return s.outline();
}

export const TOOLS: Readonly<Record<string, () => Sprite>> = {
  'Knockoff Gold Chain': knockoffGoldChain,
  'Mood Ring': moodRing,
  'Calculator Watch': calculatorWatch,
  'Street-Corner Watch Case': streetCornerWatchCase,
  'Gold Tooth Cap': goldToothCap,
  'Garage Amp': garageAmp,
  'Beat-Up Boom Mic': beatUpBoomMic,
  'Dented Harmonica': dentedHarmonica,
};
