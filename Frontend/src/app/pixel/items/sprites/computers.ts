import { R, Sprite, box, cylV, disc, shape, sphere } from '../../street/pix';
import { bezier, digits, ell, poly } from './helpers';

type Pt = readonly [number, number];

const barTone = (f: number): 1 | 2 | 3 => {
  if (f > 0.34) return 3;
  if (f < -0.34) return 1;
  return 2;
};

// Flat-capped bar from a to b, shaded across its width with the lit side toward the top left.
function bar(s: Sprite, a: Pt, b: Pt, w: number, ramp: readonly string[]): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / len;
  const dy = (b[1] - a[1]) / len;
  const flip = -dy - dx < 0 ? -1 : 1;
  const lx = -dy * flip;
  const ly = dx * flip;
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const px = x + 0.5 - a[0];
      const py = y + 0.5 - a[1];
      const t = (px * dx + py * dy) / len;
      const f = (px * lx + py * ly) / (w / 2);
      if (t < 0 || t > 1 || Math.abs(f) > 1) continue;
      s.set(x, y, ramp[barTone(f)]);
    }
}

export function crackedGameCartridge(): Sprite {
  const s = new Sprite(32, 32);
  const body = (i: number, j: number) =>
    ((i >= 6 && i <= 25 && j >= 3 && j <= 24) || (i >= 8 && i <= 23 && j >= 25 && j <= 29)) &&
    !(i >= 24 && j <= 4 && i + (4 - j) >= 25);
  shape(s, body, R.grey, { band: 1 });
  for (const y of [5, 7]) s.hline(9, y, 14, R.grey[1]);
  s.rect(9, 10, 14, 11, R.black[0]);
  s.rect(10, 11, 12, 9, R.paper[2]);
  s.rect(10, 11, 12, 3, R.red[2]);
  s.hline(11, 16, 8, R.paper[0]);
  s.hline(11, 18, 6, R.paper[0]);
  s.rect(9, 26, 14, 3, R.black[0]);
  for (let x = 10; x <= 21; x += 2) s.vline(x, 27, 2, R.gold[2]);
  const crack: Pt[] = [
    [21, 3],
    [20, 5],
    [21, 7],
    [19, 9],
    [20, 12],
    [17, 14],
    [18, 16],
    [15, 18],
    [16, 21],
    [13, 23],
  ];
  crack.forEach((p, i) => {
    if (i > 0) s.line(crack[i - 1][0], crack[i - 1][1], p[0], p[1], R.black[0]);
  });
  return s.outline();
}

export function vintageSolderingIron(): Sprite {
  const s = new Sprite(32, 32);
  const cord = bezier([5, 27], [0, 30], [10, 33], [20, 29], 24);
  cord.forEach(([x, y]) => s.set(x, y, R.steel[1]));
  s.rect(20, 28, 4, 2, R.steel[1]);
  bar(s, [5, 27], [14, 18], 5, R.wood);
  bar(s, [14, 18], [16, 16], 7, R.steel);
  bar(s, [16, 16], [22, 10], 3, R.steel);
  s.line(22, 9, 26, 5, R.rust[2]);
  s.line(22, 10, 27, 5, R.rust[2]);
  s.line(23, 10, 27, 6, R.rust[2]);
  s.line(24, 7, 26, 5, R.rust[3]);
  s.set(27, 4, R.rust[3]);
  return s.outline();
}

export function hummingCrtMonitor(): Sprite {
  const s = new Sprite(32, 32);
  poly(
    s,
    [
      [5, 9],
      [10, 4],
      [26, 4],
      [21, 9],
    ],
    R.paper[3],
  );
  poly(
    s,
    [
      [21, 9],
      [26, 4],
      [26, 20],
      [21, 25],
    ],
    R.paper[1],
  );
  box(s, 5, 9, 17, 16, R.paper, { flatTop: true });
  s.rect(7, 11, 13, 11, R.black[0]);
  s.rect(8, 12, 11, 9, R.sign[3]);
  for (let y = 14; y < 21; y += 2) s.hline(8, y, 11, R.sign[2]);
  for (const [x, y] of [
    [8, 12],
    [18, 12],
    [8, 20],
    [18, 20],
  ])
    s.set(x, y, R.black[0]);
  s.rect(9, 13, 2, 1, R.white[3]);
  s.set(9, 14, R.white[3]);
  s.rect(7, 23, 3, 1, R.paper[0]);
  s.set(18, 23, R.red[2]);
  box(s, 8, 25, 12, 5, R.paper);
  for (const [x, y] of [
    [3, 12],
    [2, 13],
    [2, 14],
    [3, 15],
  ]) {
    s.set(x, y, R.steel[3]);
    s.set(31 - x, y, R.steel[3]);
  }
  return s.outline();
}

export function keyboardMissingEscape(): Sprite {
  const s = new Sprite(32, 32);
  const cable = bezier([22, 10], [22, 3], [27, 6], [29, 2], 20);
  cable.forEach(([x, y]) => s.set(x, y, R.black[1]));
  shape(
    s,
    (i, j) =>
      i >= 2 && i <= 29 && j >= 10 && j <= 29 && !((i === 2 || i === 29) && (j === 10 || j === 29)),
    R.concrete,
    { band: 1 },
  );
  s.rect(3, 27, 26, 2, R.concrete[1]);
  const key = (x: number, y: number, w: number) => {
    s.rect(x, y, w, 1, R.paper[3]);
    s.rect(x, y + 1, w, 1, R.paper[2]);
  };
  for (let r = 0; r < 3; r++)
    for (let k = 0; k < 8; k++) if (r > 0 || k > 0) key(4 + 3 * k, 13 + 3 * r, 2);
  for (const x of [4, 7, 23, 26]) key(x, 22, 2);
  key(10, 22, 12);
  s.rect(3, 12, 4, 4, R.black[0]);
  s.set(4, 13, R.concrete[1]);
  return s.outline();
}

export function mouseWithABall(): Sprite {
  const s = new Sprite(32, 32);
  const dome = ell(17, 22, 12.5, 13);
  const cable = bezier([6, 18], [0, 18], [0, 6], [8, 4], 24);
  cable.forEach(([x, y]) => s.set(x, y, R.black[1]));
  s.rect(7, 1, 3, 4, R.black[3]);
  shape(s, (i, j) => j <= 22 && dome(i, j), R.paper, { band: 1 });
  s.vline(14, 12, 10, R.paper[0]);
  s.hline(7, 16, 7, R.paper[0]);
  box(s, 5, 22, 25, 3, R.paper);
  s.rect(7, 25, 3, 2, R.paper[1]);
  s.rect(24, 25, 3, 2, R.paper[1]);
  disc(s, 17, 25, 5.4, R.paper[0]);
  sphere(s, 17, 25, 4.6, R.black, R.black[3]);
  return s.outline();
}

export function floppyDiskWallet(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(14, 2, 13, 18, R.taxi[2]);
  s.vline(26, 2, 18, R.taxi[0]);
  s.rect(17, 2, 6, 4, R.denim[3]);
  s.rect(19, 3, 1, 2, R.denim[0]);
  s.rect(19, 8, 7, 5, R.paper[2]);
  s.rect(5, 5, 13, 18, R.red[2]);
  s.vline(17, 5, 18, R.red[1]);
  s.rect(8, 5, 6, 4, R.denim[3]);
  s.rect(12, 6, 1, 2, R.denim[0]);
  s.rect(7, 11, 9, 5, R.paper[2]);
  s.hline(8, 13, 6, R.red[1]);
  s.set(5, 5, null);
  s.set(6, 5, null);
  s.set(5, 6, null);
  shape(
    s,
    (i, j) =>
      i >= 3 && i <= 28 && j >= 15 && j <= 29 && !((i === 3 || i === 28) && (j === 15 || j === 29)),
    R.denim,
    { band: 1 },
  );
  for (let x = 6; x < 26; x += 4) s.hline(x, 18, 2, R.taxi[2]);
  s.rect(22, 21, 5, 4, R.denim[3]);
  s.set(24, 22, R.taxi[2]);
  return s.outline();
}

export function stickyButtonJoystick(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (i, j) =>
      i >= 2 && i <= 29 && j >= 17 && j <= 29 && !((i === 2 || i === 29) && (j === 17 || j === 29)),
    R.black,
    { band: 1 },
  );
  s.rect(3, 27, 26, 2, R.black[1]);
  s.rect(8, 15, 8, 3, R.black[1]);
  cylV(s, 10, 8, 3, 8, R.black);
  sphere(s, 11.5, 7, 5, R.red);
  sphere(s, 20, 22, 3, R.red);
  disc(s, 26, 22, 3, R.black[0]);
  disc(s, 26, 22, 2, R.red[1]);
  s.set(27, 25, R.taxi[3]);
  s.set(27, 26, R.taxi[3]);
  s.set(25, 24, R.taxi[3]);
  return s.outline();
}

export function handheldLcdGame(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (i, j) =>
      i >= 2 && i <= 29 && j >= 9 && j <= 29 && !((i === 2 || i === 29) && (j === 9 || j === 29)),
    R.red,
    { band: 1 },
  );
  s.rect(5, 11, 22, 11, R.black[0]);
  s.rect(6, 12, 20, 9, R.sign[3]);
  digits(s, '120', 8, 13, R.sign[0]);
  s.rect(21, 16, 2, 2, R.sign[0]);
  s.vline(21, 18, 2, R.sign[0]);
  s.vline(22, 18, 2, R.sign[1]);
  s.hline(6, 20, 20, R.sign[1]);
  s.rect(6, 23, 3, 5, R.black[1]);
  s.rect(5, 24, 5, 3, R.black[1]);
  s.set(6, 24, R.black[3]);
  s.set(5, 24, R.black[3]);
  s.set(7, 25, R.black[0]);
  for (const x of [13, 15, 17]) s.vline(x, 24, 4, R.red[1]);
  for (const [x, y] of [
    [22, 26],
    [26, 24],
  ]) {
    disc(s, x, y, 2, R.black[1]);
    s.set(x - 1, y - 1, R.black[3]);
  }
  return s.outline();
}

export function hungryVirtualPet(): Sprite {
  const s = new Sprite(32, 32);
  const egg = (i: number, j: number) => {
    const t = (j + 0.5 - 17.5) / 11.6;
    const rx = 10 * (1 + 0.16 * t);
    return ((i + 0.5 - 15.5) / rx) ** 2 + t * t <= 1;
  };
  disc(s, 15.5, 3.5, 3, R.steel[2]);
  disc(s, 15.5, 3.5, 1, null);
  shape(s, egg, R.purple, { band: 1 });
  s.rect(9, 9, 14, 11, R.black[0]);
  s.rect(10, 10, 12, 9, R.sign[3]);
  s.rect(11, 11, 7, 7, R.sign[0]);
  s.rect(12, 12, 5, 5, R.sign[3]);
  s.set(13, 13, R.sign[0]);
  s.set(15, 13, R.sign[0]);
  s.rect(13, 15, 3, 2, R.sign[0]);
  s.hline(19, 17, 3, R.sign[0]);
  s.set(19, 16, R.sign[0]);
  s.set(21, 16, R.sign[0]);
  for (const x of [10, 15, 20]) {
    disc(s, x + 0.5, 24, 1.8, R.taxi[2]);
    s.set(x - 1, 23, R.taxi[3]);
  }
  return s.outline();
}

export const COMPUTERS: Readonly<Record<string, () => Sprite>> = {
  'Cracked Game Cartridge': crackedGameCartridge,
  'Vintage Soldering Iron': vintageSolderingIron,
  'Humming CRT Monitor': hummingCrtMonitor,
  'Keyboard Missing Escape': keyboardMissingEscape,
  'Mouse with a Ball': mouseWithABall,
  'Floppy Disk Wallet': floppyDiskWallet,
  'Sticky-Button Joystick': stickyButtonJoystick,
  'Handheld LCD Game': handheldLcdGame,
  'Hungry Virtual Pet': hungryVirtualPet,
};
