import { R, Sprite, box, cylH, shape, sphere, text } from '../../street/pix';
import { ell, flat, lightTone } from './helpers';

export function overdueLibraryBook(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 8, 7, 20, 22, R.paper);
  s.hline(7, 27, 20, R.paper[1]);
  s.vline(26, 8, 19, R.paper[1]);
  box(s, 5, 4, 20, 22, R.green, { band: 1 });
  s.rect(6, 5, 3, 20, R.green[1]);
  s.vline(9, 5, 20, R.green[0]);
  box(s, 11, 8, 11, 8, R.paper);
  s.hline(12, 10, 9, R.black[0]);
  s.hline(12, 13, 6, R.black[0]);
  s.rect(13, 19, 9, 5, R.paper[3]);
  for (const x of [14, 16, 17, 19, 21]) s.vline(x, 20, 3, R.black[0]);
  s.rect(17, 1, 6, 7, R.paper[3]);
  s.hline(18, 3, 4, R.red[2]);
  s.hline(18, 5, 3, R.red[2]);
  s.hline(10, 22, 3, R.green[3]);
  s.set(5, 4, R.paper[1]);
  s.set(24, 25, R.paper[1]);
  s.set(6, 25, R.paper[1]);
  s.rect(6, 11, 3, 7, R.green[2]);
  s.hline(23, 4, 2, R.paper[1]);
  s.set(24, 5, R.paper[1]);
  s.hline(12, 25, 2, R.green[3]);
  s.set(16, 25, R.green[3]);
  return s.outline();
}

export function jammedStapler(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(3, 23, 26, 6, R.black[1]);
  s.hline(3, 23, 26, R.black[2]);
  s.vline(28, 23, 6, R.black[0]);
  s.hline(3, 28, 26, R.black[0]);
  const top = (x: number) => 18 - ((x - 3) * 8) / 23;
  shape(s, (x, y) => x >= 3 && x <= 26 && y >= top(x) && y <= top(x) + 5, R.red, { band: 1 });
  s.hline(5, 25, 20, R.red[0]);
  s.set(5, 20, R.red[3]);
  shape(
    s,
    (x, y) => ell(23, 19, 5, 5.5)(x, y) || ell(27, 20, 3.5, 4.5)(x, y) || ell(21, 22, 4, 3)(x, y),
    R.paper,
    { band: 1 },
  );
  s.line(21, 16, 24, 19, R.paper[0]);
  s.line(26, 16, 25, 21, R.paper[0]);
  s.line(21, 23, 27, 23, R.paper[0]);
  return s.outline();
}

export function dotMatrixPrinter(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 4, 17, 24, 11, R.concrete, { band: 1 });
  box(s, 6, 13, 20, 5, R.concrete, { band: 1 });
  s.rect(9, 12, 14, 2, R.concrete[0]);
  s.rect(10, 2, 12, 11, R.paper[3]);
  s.vline(12, 2, 11, R.paper[1]);
  s.vline(19, 2, 11, R.paper[1]);
  for (let y = 3; y < 12; y += 3) {
    s.set(11, y, R.concrete[0]);
    s.set(20, y, R.concrete[0]);
  }
  s.hline(14, 4, 4, R.concrete[0]);
  s.hline(14, 6, 5, R.concrete[0]);
  s.hline(14, 8, 3, R.concrete[0]);
  s.hline(14, 10, 4, R.concrete[0]);
  s.rect(7, 21, 18, 4, R.concrete[1]);
  s.hline(14, 23, 9, R.concrete[0]);
  s.set(8, 22, R.sign[3]);
  s.set(10, 22, R.red[2]);
  s.set(12, 22, R.red[2]);
  s.rect(6, 28, 3, 1, R.concrete[0]);
  s.rect(23, 28, 3, 1, R.concrete[0]);
  return s.outline();
}

const cardTop = (x: number): number => 17 - Math.round(5 * (1 - ((x - 15.5) / 9.5) ** 2)) + (x % 2);

export function rolodexOfStrangers(): Sprite {
  const s = new Sprite(32, 32);
  for (let x = 6; x <= 25; x++)
    s.vline(x, cardTop(x), 25 - cardTop(x), x % 2 === 0 ? R.paper[2] : R.paper[1]);
  s.rect(19, cardTop(19) - 2, 2, 2, R.red[2]);
  s.rect(23, cardTop(23) - 2, 2, 2, R.denim[2]);
  box(s, 7, 6, 7, 9, R.paper, { band: 1 });
  s.hline(9, 9, 4, R.black[1]);
  s.rect(4, 18, 2, 7, R.black[1]);
  s.set(4, 18, R.black[2]);
  s.set(5, 18, R.black[2]);
  s.rect(5, 25, 22, 4, R.black[1]);
  s.hline(5, 25, 22, R.black[2]);
  flat(s, ell(28, 19, 1.7, 1.7), R.red[2]);
  return s.outline();
}

export function clickyTypewriter(): Sprite {
  const s = new Sprite(32, 32);
  s.rect(11, 2, 10, 10, R.paper[3]);
  for (const y of [4, 6, 8]) s.hline(12, y, y === 8 ? 5 : 8, R.paper[1]);
  box(s, 3, 10, 3, 6, R.paper, { band: 1 });
  box(s, 26, 10, 3, 6, R.paper, { band: 1 });
  cylH(s, 6, 11, 20, 4, R.black);
  s.line(2, 8, 5, 11, R.red[2]);
  shape(
    s,
    (x, y) => y >= 15 && y <= 28 && Math.abs(x + 0.5 - 16) <= 10.5 + ((y - 15) * 2) / 13,
    R.black,
    { band: 1 },
  );
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 7 - (r === 0 ? 1 : 0); i++) {
      const x = (r === 0 ? 9 : 7 - r + 1) + 3 * i;
      s.rect(x, 18 + 3 * r, 2, 2, R.paper[3]);
      s.set(x + 1, 19 + 3 * r, R.paper[1]);
    }
  s.hline(10, 27, 12, R.paper[2]);
  return s.outline();
}

export function crackedWorldGlobe(): Sprite {
  const s = new Sprite(32, 32);
  const cx = 16;
  const cy = 13.5;
  const r = 10.5;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d >= 11.3 && d <= 12.4 && x + 0.5 <= cx + 1) s.set(x, y, R.wood[2]);
    }
  sphere(s, cx, cy, r, R.denim);
  const land = [
    ell(12, 10, 4.5, 3),
    ell(20, 17, 4.5, 4),
    ell(10, 18, 2.5, 2.5),
    ell(21, 8, 2.5, 2),
  ];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (Math.hypot(dx, dy) > r - 1 || !land.some((f) => f(x, y))) continue;
      s.set(x, y, R.green[Math.max(1, lightTone(dx, dy, r))]);
    }
  const path = [
    [21, 6],
    [19, 9],
    [20, 11],
    [17, 14],
    [18, 17],
    [15, 20],
  ];
  for (let i = 1; i < path.length; i++)
    s.line(...(path[i - 1] as [number, number]), ...(path[i] as [number, number]), R.white[3]);
  s.line(19, 9, 23, 10, R.white[3]);
  s.line(17, 14, 13, 15, R.white[3]);
  s.rect(15, 25, 2, 2, R.wood[1]);
  s.rect(11, 27, 10, 2, R.wood[2]);
  s.hline(11, 27, 10, R.wood[1]);
  return s.outline();
}

const bladeTone = (a: number): number => {
  if (a < -0.2) return 3;
  if (a < 0.3) return 2;
  return 1;
};

const blade = (dx: number, dy: number): number => {
  const r = Math.hypot(dx, dy);
  if (r < 2.5 || r > 10) return -1;
  for (let k = 0; k < 3; k++) {
    let a = Math.atan2(dy, dx) - (k * 2 * Math.PI) / 3 + 0.5 - (r - 2.5) * 0.1;
    a -= 2 * Math.PI * Math.round(a / (2 * Math.PI));
    if (Math.abs(a) < 0.55) return bladeTone(a);
  }
  return -1;
};

export function vintageDeskFan(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 14, 22, 4, 5, R.green, { band: 1 });
  box(s, 9, 26, 14, 3, R.green, { band: 1 });
  flat(s, ell(16, 12.5, 11.5, 11.5), R.green[0]);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const dx = x + 0.5 - 16;
      const dy = y + 0.5 - 12.5;
      const tone = blade(dx, dy);
      if (tone > 0) s.set(x, y, R.taxi[tone]);
      const r = Math.hypot(dx, dy);
      const ring = r >= 10.4 || (r >= 6.2 && r <= 7.1);
      const a = (Math.atan2(dy, dx) * 4) / Math.PI;
      const spoke =
        r > 3 && r < 11.5 && Math.abs(Math.sin(((a - Math.round(a)) * Math.PI) / 4)) * r < 0.6;
      if (r <= 11.5 && (ring || spoke)) s.set(x, y, R.steel[3]);
    }
  sphere(s, 16, 12.5, 3, R.steel);
  return s.outline();
}

export function executiveNameplate(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, (x, y) => y >= 7 && y <= 21 && Math.abs(x + 0.5 - 16) <= 8.5 + (y - 7) * 0.3, R.steel, {
    band: 1,
  });
  text(s, 'CEO', 11, 11, R.black[0], 'micro', { alignTop: true });
  s.hline(9, 17, 14, R.steel[0]);
  s.set(10, 9, R.steel[3]);
  box(s, 2, 21, 28, 8, R.wood, { band: 1 });
  s.hline(4, 25, 24, R.wood[1]);
  return s.outline();
}

export const OFFICE: Readonly<Record<string, () => Sprite>> = {
  'Overdue Library Book': overdueLibraryBook,
  'Jammed Stapler': jammedStapler,
  'Dot-Matrix Printer': dotMatrixPrinter,
  'Rolodex of Strangers': rolodexOfStrangers,
  'Clicky Typewriter': clickyTypewriter,
  'Cracked World Globe': crackedWorldGlobe,
  'Vintage Desk Fan': vintageDeskFan,
  'Executive Nameplate': executiveNameplate,
};
