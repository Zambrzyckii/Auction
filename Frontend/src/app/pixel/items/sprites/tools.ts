import { R, Sprite, box, shape, sphere } from '../../street/pix';
import { digits, ell, poly } from './helpers';

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
      const ramp = shift < 21 ? R.purple : shift < 25 ? R.denim : R.sign;
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

// A tiny wristwatch seen from above: two strap stubs and a gold square dial.
function miniWatch(s: Sprite, x: number, y: number): void {
  s.rect(x + 1, y, 2, 6, R.black[2]);
  s.rect(x, y + 1, 4, 4, R.gold[2]);
  s.hline(x, y + 1, 4, R.gold[3]);
  s.rect(x + 1, y + 2, 2, 2, R.white[3]);
}

export function streetCornerWatchCase(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 4, 2, 24, 11, R.tan, { band: 1 });
  s.rect(6, 4, 20, 7, R.red[1]);
  box(s, 3, 13, 26, 17, R.tan, { band: 1 });
  s.rect(5, 15, 22, 13, R.red[1]);
  for (let col = 0; col < 4; col++) {
    miniWatch(s, 7 + col * 5, 4);
    if (col !== 2) miniWatch(s, 7 + col * 5, 15);
    miniWatch(s, 7 + col * 5, 22);
  }
  s.rect(2, 11, 2, 5, R.gold[2]);
  s.rect(28, 11, 2, 5, R.gold[2]);
  s.rect(26, 23, 3, 7, R.paper[2]);
  s.line(4, 23, 6, 21, R.tan[3]);
  s.line(24, 5, 26, 3, R.tan[3]);
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

// Pole, windscreen and grip all run along this diagonal: up and to the right.
const MIC_DX = Math.SQRT1_2;
const MIC_DY = -Math.SQRT1_2;

export function beatUpBoomMic(): Sprite {
  const s = new Sprite(32, 32);
  s.line(13, 19, 6, 26, R.steel[2]);
  s.line(14, 19, 7, 26, R.steel[2]);
  s.line(13, 20, 6, 27, R.steel[1]);
  poly(
    s,
    [
      [8, 22],
      [10, 24],
      [5, 29],
      [3, 27],
    ],
    R.black[2],
  );
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const dx = x + 0.5 - 14.5;
      const dy = y + 0.5 - 17.5;
      const along = Math.min(Math.max(dx * MIC_DX + dy * MIC_DY, 0), 14.1);
      const px = dx - along * MIC_DX;
      const py = dy - along * MIC_DY;
      const edge = ((x * 7 + y * 3) % 4) * 0.12;
      if (Math.hypot(px, py) > 5.2 + edge) continue;
      const across = (px + py) * MIC_DX;
      let tone = across < -1.8 ? 3 : across < 1.8 ? 2 : 1;
      if ((x * 5 + y * 3) % 7 === 0) tone = Math.max(tone - 1, 0);
      const band = Math.abs(along - 2) < 0.9 || Math.abs(along - 12) < 0.9;
      s.set(x, y, band ? R.black[1] : R.grey[tone]);
    }
  s.rect(19, 12, 2, 2, R.steel[1]);
  s.rect(21, 7, 2, 1, R.steel[1]);
  s.line(9, 25, 7, 27, R.paper[2]);
  s.line(10, 24, 8, 26, R.paper[2]);
  s.line(6, 27, 5, 28, R.grey[2]);
  return s.outline();
}

export function dentedHarmonica(): Sprite {
  const s = new Sprite(32, 32);
  // The top edge is pressed in by up to three rows around x = 20..26.
  const dent = (x: number): number => [1, 2, 3, 3, 3, 2, 1][x - 20] ?? 0;
  const body = (x: number, y: number) =>
    x >= 2 && x <= 29 && y >= 13 + dent(x) && y <= 29 && !((x < 4 || x > 27) && (y < 15 || y > 27));
  shape(s, body, R.steel, { band: 1 });
  s.rect(4, 18, 24, 8, R.wood[2]);
  s.hline(4, 18, 24, R.wood[3]);
  s.hline(4, 25, 24, R.wood[1]);
  for (let n = 0; n < 8; n++) s.rect(5 + n * 3, 19, 2, 6, R.black[0]);
  s.hline(21, 17, 5, R.steel[0]);
  s.hline(22, 18, 3, R.steel[1]);
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
