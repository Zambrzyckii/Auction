import { R, Sprite, box, cylH, cylV, shape } from '../../street/pix';
import { ell } from './helpers';

// Coordinates along (u, towards the upper right) and across (v, towards the lower right) a diagonal instrument.
const axis =
  (ox: number, oy: number) =>
  (x: number, y: number): [number, number] => {
    const dx = x + 0.5 - ox;
    const dy = y + 0.5 - oy;
    return [(dx - dy) * Math.SQRT1_2, (dx + dy) * Math.SQRT1_2];
  };

export function pawnTicketGuitar(): Sprite {
  const s = new Sprite(32, 32);
  const at = axis(6, 25);
  const inside = (test: (u: number, v: number) => boolean) => (x: number, y: number) =>
    test(...at(x, y));
  const body = inside(
    (u, v) =>
      ((u - 4.5) ** 2 + v * v <= 7 ** 2 || (u - 11.5) ** 2 + v * v <= 5.4 ** 2) &&
      (u - 8.3) ** 2 + (Math.abs(v) - 8.3) ** 2 > 4 ** 2,
  );
  const neck = inside((u, v) => u >= 14 && u <= 28 && Math.abs(v) <= 2);
  const head = inside((u, v) => u >= 27 && u <= 31.5 && Math.abs(v) <= 2.6);
  shape(s, (x, y) => neck(x, y) || head(x, y), R.wood, { band: 1 });
  shape(s, body, R.wood, { band: 1 });
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const [u, v] = at(x, y);
      if (neck(x, y) && u < 27 && Math.abs(v) <= 1.4) s.set(x, y, R.wood[0]);
      const spread = neck(x, y) ? 0 : 0.7;
      const string = Math.abs(Math.abs(v) - spread) < 0.35 && u >= 1.5 && u <= 27;
      if (string && (neck(x, y) || body(x, y))) s.set(x, y, R.paper[3]);
      if ((u - 7.5) ** 2 + v * v <= 1.9 ** 2) s.set(x, y, R.black[0]);
      if (Math.abs(u - 1.5) < 0.6 && Math.abs(v) <= 2.6) s.set(x, y, R.black[0]);
      const peg = Math.abs(u - 29) < 0.6 || Math.abs(u - 31) < 0.6;
      if (head(x, y) && peg && Math.abs(v) > 1.6) s.set(x, y, R.paper[3]);
    }
  s.line(25, 6, 27, 9, R.paper[0]);
  s.rect(26, 9, 4, 7, R.paper[3]);
  s.hline(26, 15, 4, R.paper[2]);
  s.vline(29, 9, 7, R.paper[2]);
  s.set(27, 9, R.paper[0]);
  s.hline(27, 12, 2, R.red[2]);
  s.hline(27, 14, 2, R.red[2]);
  return s.outline();
}

export function threeStringBanjo(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (x, y) => x >= 12 && x <= 20 && y >= 2 && y <= 8 && !((x === 12 || x === 20) && y === 2),
    R.wood,
    { band: 1 },
  );
  s.rect(10, 3, 2, 1, R.paper[3]);
  s.rect(10, 6, 2, 1, R.paper[3]);
  s.rect(21, 4, 2, 1, R.paper[3]);
  shape(s, ell(16.5, 21.5, 8, 8), R.wood, { band: 1 });
  const head = ell(16.5, 21.5, 6.2, 6.2);
  shape(s, head, R.paper, { band: 1 });
  s.rect(13, 9, 7, 6, R.wood[2]);
  s.vline(13, 9, 6, R.wood[3]);
  s.vline(19, 9, 6, R.wood[1]);
  s.rect(14, 9, 5, 6, R.black[0]);
  s.rect(14, 23, 5, 1, R.wood[1]);
  s.rect(15, 26, 3, 1, R.paper[3]);
  for (const x of [14, 16, 18])
    for (let y = 10; y <= 26; y++) s.set(x, y, head(x, y) ? R.black[0] : R.paper[3]);
  return s.outline();
}

export function rustyTrumpet(): Sprite {
  const s = new Sprite(32, 32);
  const outer = (x: number, y: number) => x >= 8 && x <= 24 && y >= 20 && y <= 28;
  const inner = (x: number, y: number) => x >= 10 && x <= 22 && y >= 22 && y <= 26;
  shape(s, (x, y) => outer(x, y) && !inner(x, y), R.gold, { band: 1 });
  const bell = (x: number, y: number) =>
    x >= 21 && x <= 27 && Math.abs(y + 0.5 - 13.5) <= 1.6 + 0.38 * (x - 21) ** 1.75;
  shape(s, bell, R.gold);
  cylV(s, 27, 5, 2, 17, R.gold);
  cylH(s, 7, 12, 15, 3, R.gold);
  box(s, 3, 10, 4, 6, R.steel);
  for (const x of [10, 14, 18]) {
    cylV(s, x, 8, 3, 10, R.gold);
    box(s, x, 6, 3, 2, R.steel);
    box(s, x, 18, 3, 2, R.steel);
    s.vline(x + 1, 3, 3, R.steel[2]);
    s.hline(x, 2, 3, R.steel[3]);
  }
  for (const [x, y, w] of [
    [9, 27, 3],
    [15, 28, 2],
    [25, 10, 2],
    [8, 12, 2],
    [10, 14, 3],
  ])
    s.hline(x, y, w, R.rust[1]);
  for (const [x, y] of [
    [10, 27],
    [26, 10],
    [11, 14],
  ])
    s.set(x, y, R.rust[2]);
  return s.outline();
}

export function buskersAccordion(): Sprite {
  const s = new Sprite(32, 32);
  for (let k = 0; k < 6; k++) {
    const x = 10 + 2 * k;
    const top = 9 + (k % 2);
    const bottom = 25 - (k % 2);
    s.rect(x, top, 2, bottom - top + 1, R.red[1]);
    s.vline(x, top, bottom - top + 1, R.red[3]);
  }
  box(s, 2, 7, 8, 21, R.black, { band: 1 });
  for (const y of [9, 12, 15, 18, 21, 24]) for (const x of [3, 6]) s.rect(x, y, 2, 2, R.paper[2]);
  box(s, 22, 7, 8, 21, R.black, { band: 1 });
  for (const y of [9, 12, 15, 18, 21, 24]) {
    s.rect(24, y, 5, 2, R.paper[3]);
    s.hline(24, y + 2, 3, R.black[0]);
  }
  s.rect(13, 14, 2, 4, R.paper[2]);
  s.line(17, 11, 18, 13, R.paper[3]);
  s.line(19, 19, 20, 22, R.paper[3]);
  return s.outline();
}

export const MUSIC: Readonly<Record<string, () => Sprite>> = {
  'Pawn-Ticket Guitar': pawnTicketGuitar,
  'Three-String Banjo': threeStringBanjo,
  'Rusty Trumpet': rustyTrumpet,
  "Busker's Accordion": buskersAccordion,
};
