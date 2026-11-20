import { R, Sprite, box, cylV, disc, shape } from '../../street/pix';
import { ell, poly } from './helpers';

export function graffitiMarkerSet(): Sprite {
  const s = new Sprite(32, 32);
  const caps = [R.red[2], R.taxi[2], R.sign[2], R.denim[2]];
  caps.forEach((cap, k) => {
    const x = k % 2 ? 4 : 2;
    const y = 6 + k * 6;
    s.rect(x, y, 8, 5, cap);
    s.rect(x + 8, y, 13, 5, R.black[2]);
    s.rect(x + 11, y + 1, 6, 3, R.white[3]);
    s.rect(x + 21, y + 1, 2, 3, cap);
    s.rect(x + 23, y + 2, 3, 1, cap);
    s.vline(x + 7, y, 5, R.black[0]);
  });
  return s.outline();
}

export function halfFullSprayCan(): Sprite {
  const s = new Sprite(32, 32);
  cylV(s, 9, 10, 14, 19, R.red);
  for (const [y, cut] of [
    [10, 3],
    [11, 2],
    [12, 1],
  ])
    for (let x = 9; x < 23; x++) if (x < 9 + cut || x >= 23 - cut) s.set(x, y, null);
  s.rect(10, 4, 12, 7, R.black[2]);
  s.rect(19, 4, 3, 7, R.black[1]);
  s.hline(10, 4, 12, R.black[1]);
  s.rect(14, 1, 4, 3, R.black[2]);
  s.set(13, 2, R.black[1]);
  s.rect(10, 16, 12, 8, R.white[2]);
  s.vline(20, 16, 8, R.white[1]);
  s.vline(21, 16, 8, R.white[1]);
  s.rect(16, 13, 4, 15, R.glass[0]);
  s.rect(17, 20, 2, 7, R.taxi[2]);
  s.hline(14, 20, 2, R.glass[0]);
  return s.outline();
}

export function stickerBombedLunchbox(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, (x, y) => ell(16, 12, 8, 8)(x, y) && !ell(16, 12, 5.5, 5.5)(x, y) && y < 12, R.denim);
  box(s, 3, 12, 26, 17, R.denim, { band: 1 });
  s.hline(4, 18, 24, R.denim[0]);
  s.rect(14, 17, 4, 4, R.taxi[2]);
  s.set(15, 19, R.denim[0]);
  s.set(16, 19, R.denim[0]);
  s.rect(5, 13, 6, 4, R.white[3]);
  s.hline(6, 15, 3, R.red[2]);
  disc(s, 22, 15, 2.5, R.red[2]);
  s.set(21, 14, R.white[3]);
  disc(s, 9, 24, 3, R.sign[2]);
  s.set(8, 23, R.white[3]);
  s.rect(13, 22, 7, 6, R.paper[2]);
  s.hline(14, 25, 5, R.red[2]);
  disc(s, 24, 24, 2.5, R.taxi[2]);
  poly(
    s,
    [
      [4, 19],
      [8, 19],
      [8, 22],
      [4, 22],
    ],
    R.purple[2],
  );
  s.set(7, 19, R.denim[0]);
  s.set(26, 20, R.denim[0]);
  return s.outline();
}

export function tapedUpSkateboard(): Sprite {
  const s = new Sprite(32, 32);
  const deck = (x: number, y: number): boolean => {
    if (x < 11 || x > 20 || y < 3 || y > 28) return false;
    if (y === 3 || y === 28) return x >= 13 && x <= 18;
    if (y === 4 || y === 27) return x >= 12 && x <= 19;
    return true;
  };
  for (const y of [8, 23]) {
    s.rect(6, y, 20, 2, R.steel[1]);
    for (const x of [5, 24]) s.rect(x, y - 2, 3, 6, R.red[2]);
    for (const x of [5, 24]) s.vline(x, y + 1, 3, R.red[1]);
  }
  shape(s, deck, R.wood, { band: 1 });
  for (const y of [8, 23]) s.rect(13, y, 6, 2, R.steel[1]);
  for (const [x0, y0, x1, y1] of [
    [12, 12, 19, 14],
    [12, 16, 19, 17],
    [12, 19, 19, 21],
  ]) {
    s.line(x0, y0, x1, y1, R.paper[2]);
    s.line(x0, y0 + 1, x1, y1 + 1, R.paper[1]);
  }
  return s.outline();
}

export function wobblyRollerblades(): Sprite {
  const s = new Sprite(32, 32);
  const boot = (x: number, y: number): boolean => {
    if (x >= 5 && x <= 15 && y >= 3 && y <= 15) return true;
    return x >= 4 && x <= 28 && y >= 14 + Math.max(0, (x - 17) * 0.6) && y <= 21;
  };
  shape(s, boot, R.purple, { band: 1 });
  s.hline(6, 5, 9, R.paper[2]);
  for (const [x, y] of [
    [11, 8],
    [11, 11],
    [13, 14],
    [17, 16],
  ])
    s.hline(x, y, 3, R.paper[2]);
  s.rect(5, 22, 23, 2, R.steel[1]);
  for (const cx of [8, 14, 26]) {
    shape(s, ell(cx, 26, 3, 3), R.taxi, { band: 1 });
    s.set(cx - 1, 25, R.steel[1]);
  }
  const tilted = (x: number, y: number): boolean => ell(20, 27, 2, 3)(x + (y - 27) * 0.5, y);
  s.line(20, 24, 20, 25, R.steel[1]);
  shape(s, tilted, R.taxi, { band: 1 });
  s.set(20, 26, R.steel[1]);
  return s.outline();
}

export function milkCrateNightstand(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 4, 14, 24, 15, R.denim, { band: 1 });
  s.rect(9, 19, 14, 8, R.denim[0]);
  s.hline(9, 26, 14, R.denim[1]);
  for (const x of [6, 11, 16, 21]) s.rect(x, 15, 3, 2, R.denim[0]);
  for (const y of [20, 24]) for (const x of [5, 24]) s.rect(x, y, 3, 2, R.denim[0]);
  s.rect(11, 22, 10, 4, R.paper[2]);
  s.hline(11, 24, 10, R.denim[0]);
  s.rect(15, 8, 2, 5, R.lit[1]);
  s.rect(12, 12, 8, 2, R.lit[1]);
  poly(
    s,
    [
      [10, 8],
      [22, 8],
      [19, 2],
      [13, 2],
    ],
    R.lit[2],
  );
  s.vline(13, 3, 4, R.lit[3]);
  s.hline(14, 2, 4, R.lit[3]);
  return s.outline();
}

export function flickeringLavaLamp(): Sprite {
  const s = new Sprite(32, 32);
  const half = (y: number): number => 3 + Math.round(((y - 6) * 3) / 16);
  for (let y = 6; y <= 22; y++) {
    const h = half(y);
    s.hline(16 - h, y, 2 * h, R.purple[1]);
    s.set(17 - h, y, R.purple[2]);
  }
  for (let y = 2; y <= 5; y++) {
    const h = 2 + Math.floor((y - 2) / 2) + 1;
    s.hline(16 - h, y, 2 * h, R.grey[2]);
    s.set(15 + h, y, R.grey[1]);
  }
  for (let y = 23; y <= 28; y++) {
    const h = 5 + Math.floor((y - 23) * 0.9) + 1;
    s.hline(16 - h, y, 2 * h, R.grey[2]);
    s.set(15 + h, y, R.grey[1]);
    s.set(14 + h, y, R.grey[1]);
  }
  for (let y = 16; y < 22; y++)
    for (let x = 10; x < 22; x++) if (ell(16, 19, 4, 3)(x, y)) s.set(x, y, R.red[2]);
  disc(s, 15, 13, 2.5, R.red[2]);
  disc(s, 17, 9, 1.6, R.red[2]);
  s.set(14, 18, R.red[3]);
  s.set(14, 12, R.red[3]);
  s.rect(14, 25, 4, 3, R.lit[2]);
  s.rect(14, 25, 2, 1, R.lit[3]);
  for (const [cx, cy] of [
    [5, 8],
    [26, 14],
  ]) {
    s.vline(cx, cy - 2, 5, R.lit[3]);
    s.hline(cx - 2, cy, 5, R.lit[3]);
  }
  s.set(6, 20, R.lit[3]);
  return s.outline();
}

export function brassPaperweight(): Sprite {
  const s = new Sprite(32, 32);
  poly(
    s,
    [
      [16, 3],
      [4, 22],
      [14, 22],
    ],
    R.gold[2],
  );
  poly(
    s,
    [
      [16, 3],
      [14, 22],
      [28, 22],
    ],
    R.gold[1],
  );
  s.line(16, 6, 8, 20, R.gold[3]);
  s.line(16, 6, 14, 21, R.gold[3]);
  box(s, 4, 22, 24, 7, R.gold, { band: 1 });
  s.hline(7, 25, 6, R.gold[0]);
  s.hline(7, 26, 4, R.gold[0]);
  return s.outline();
}

export const STREET: Readonly<Record<string, () => Sprite>> = {
  'Graffiti Marker Set': graffitiMarkerSet,
  'Half-Full Spray Can': halfFullSprayCan,
  'Sticker-Bombed Lunchbox': stickerBombedLunchbox,
  'Taped-Up Skateboard': tapedUpSkateboard,
  'Wobbly Rollerblades': wobblyRollerblades,
  'Milk Crate Nightstand': milkCrateNightstand,
  'Flickering Lava Lamp': flickeringLavaLamp,
  'Brass Paperweight': brassPaperweight,
};
