import { R, Sprite, box, disc, shape, text } from '../../street/pix';
import { blit, ell, poly } from './helpers';

// Flat paper: lit top left, a darker edge on the bottom and right, no tone 3 on the silhouette.
function sheet(
  s: Sprite,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  shade: string,
): void {
  s.rect(x, y, w, h, fill);
  s.hline(x, y + h - 1, w, shade);
  s.vline(x + w - 1, y, h, shade);
}

type Pt = readonly [number, number];

function starPoints(cx: number, cy: number, ro: number, ri: number): Pt[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? ri : ro;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  });
}

export function bentTradingCard(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 8, 3, 16, 26, R.red, { band: 1 });
  s.rect(10, 5, 12, 12, R.denim[0]);
  disc(s, 16, 10, 3.2, R.taxi[2]);
  s.hline(13, 7, 7, R.red[2]);
  s.set(13, 8, R.red[2]);
  poly(
    s,
    [
      [11, 16],
      [12, 13],
      [20, 13],
      [21, 16],
    ],
    R.taxi[1],
  );
  s.rect(10, 18, 12, 4, R.paper[2]);
  s.hline(11, 19, 8, R.paper[1]);
  s.hline(11, 21, 5, R.paper[1]);
  s.rect(10, 23, 12, 4, R.paper[1]);
  for (const x of [11, 14, 17, 20]) s.set(x, 25, R.red[0]);
  s.line(9, 23, 22, 10, R.paper[3]);
  s.set(8, 22, null);
  s.set(23, 10, null);
  for (const [x, y] of [
    [8, 25],
    [8, 26],
    [9, 28],
    [12, 28],
  ])
    s.set(x, y, R.paper[3]);
  return s.outline();
}

export function stapledZineStack(): Sprite {
  const s = new Sprite(32, 32);
  sheet(s, 11, 3, 17, 20, R.paper[1], R.paper[0]);
  sheet(s, 8, 6, 17, 20, R.paper[2], R.paper[1]);
  s.hline(8, 6, 17, R.paper[0]);
  s.vline(8, 6, 20, R.paper[0]);
  sheet(s, 5, 9, 17, 20, R.paper[2], R.paper[1]);
  s.hline(5, 9, 17, R.paper[0]);
  s.vline(5, 9, 20, R.paper[0]);
  s.vline(7, 10, 18, R.paper[1]);
  s.rect(9, 12, 12, 4, R.black[1]);
  for (const [x, w, y, h] of [
    [10, 3, 13, 2],
    [14, 2, 13, 2],
    [17, 3, 13, 2],
  ])
    s.rect(x, y, w, h, R.paper[2]);
  disc(s, 13, 21, 3, R.red[2]);
  s.rect(17, 19, 4, 5, R.black[1]);
  s.hline(9, 26, 10, R.paper[0]);
  for (const y of [12, 23]) {
    s.vline(7, y, 4, R.steel[1]);
    s.set(7, y, R.steel[3]);
    s.set(6, y, R.steel[1]);
  }
  return s.outline();
}

export function laminatedBackstagePass(): Sprite {
  const s = new Sprite(32, 32);
  for (let y = 2; y <= 11; y++) {
    const x = 7 + Math.round(((y - 2) * 7) / 9);
    s.hline(x, y, 2, R.red[2]);
    s.set(x + 2, y, R.red[1]);
    const m = 31 - x;
    s.set(m, y, R.red[1]);
    s.hline(m - 2, y, 2, R.red[2]);
  }
  s.rect(14, 10, 4, 3, R.white[2]);
  s.set(15, 10, R.white[1]);
  sheet(s, 8, 12, 16, 17, R.white[2], R.white[1]);
  s.rect(10, 15, 12, 12, R.black[1]);
  s.hline(14, 13, 4, R.black[1]);
  text(s, 'VIP', 12, 25, R.gold[2], 'micro');
  s.line(11, 18, 14, 15, R.white[3]);
  s.line(11, 20, 16, 15, R.white[3]);
  return s.outline();
}

export function dogEaredComic(): Sprite {
  const s = new Sprite(32, 32);
  sheet(s, 8, 4, 17, 25, R.denim[2], R.denim[1]);
  s.vline(8, 4, 25, R.denim[3]);
  s.rect(9, 5, 15, 5, R.red[2]);
  s.hline(11, 7, 9, R.paper[2]);
  const burst = Array.from({ length: 14 }, (_, i) => {
    const a = (i * Math.PI) / 7;
    const r = i % 2 ? 4.6 : 7.4;
    return [16.5 + Math.cos(a) * r, 17 + Math.sin(a) * r] as const;
  });
  poly(s, burst, R.taxi[2]);
  blit(
    s,
    ['111 111 101', '101 101 101', '111 101 101', '100 101 111', '100 111 101'],
    11,
    15,
    R.red[1],
  );
  for (const y of [11, 23]) s.set(8, y, R.steel[3]);
  for (let y = 4; y <= 6; y++) for (let x = 21; x <= 24; x++) if (x - y > 17) s.set(x, y, null);
  for (let y = 4; y <= 7; y++)
    for (let x = 21; x <= 24; x++)
      if (x - y <= 17) s.set(x, y, x - y === 17 ? R.paper[0] : R.paper[2]);
  for (const x of [9, 10, 12]) s.set(x, 28, R.paper[2]);
  for (let y = 22; y <= 28; y++) for (let x = 18; x <= 24; x++) if (x + y > 46) s.set(x, y, null);
  for (let y = 22; y <= 28; y++)
    for (let x = 18; x <= 24; x++)
      if (x + y <= 46) s.set(x, y, x + y === 46 ? R.paper[0] : R.paper[2]);
  return s.outline();
}

export function holographicStickerSheet(): Sprite {
  const s = new Sprite(32, 32);
  sheet(s, 4, 5, 21, 24, R.white[2], R.white[1]);
  poly(s, starPoints(10.5, 11.5, 6, 2.8), R.gold[2]);
  disc(s, 16.5, 11, 2.5, R.red[2]);
  disc(s, 20.5, 11, 2.5, R.red[2]);
  poly(
    s,
    [
      [14.2, 12],
      [22.8, 12],
      [18.5, 18],
    ],
    R.red[2],
  );
  disc(s, 10, 22.5, 4.4, R.denim[2]);
  disc(s, 19, 23, 4.4, R.sign[2]);
  s.each((x, y, c) => {
    if (!c || c === R.white[2] || c === R.white[1] || x + y < 22 || x + y > 25) return;
    s.set(x, y, x + y < 24 ? R.sign[3] : R.purple[3]);
  });
  for (let y = 23; y <= 27; y++)
    for (let x = 18; x <= 23; x++)
      if (x + y > 42) s.set(x, y, x + y === 43 ? R.white[0] : R.white[3]);
  return s.outline();
}

export function shoeboxOfBaseballCards(): Sprite {
  const s = new Sprite(32, 32);
  const faces = [R.red[2], R.denim[2], R.taxi[2], R.red[2], R.denim[2]];
  const tops = [8, 5, 3, 4, 6];
  for (let i = 4; i >= 0; i--) {
    const x = 2 + i * 5;
    sheet(s, x, tops[i], 7, 20, R.paper[2], R.paper[1]);
    s.hline(x, tops[i], 7, R.paper[2]);
    s.rect(x + 1, tops[i] + 1, 5, 5, faces[i]);
    s.hline(x + 1, tops[i] + 7, 5, R.paper[1]);
    s.hline(x + 1, tops[i] + 9, 3, R.paper[1]);
  }
  box(s, 2, 17, 28, 12, R.tan, { band: 1 });
  s.rect(11, 21, 10, 5, R.paper[2]);
  s.hline(12, 22, 8, R.red[2]);
  s.hline(12, 24, 6, R.paper[1]);
  s.line(4, 25, 7, 27, R.tan[0]);
  s.line(24, 20, 27, 21, R.tan[0]);
  s.set(5, 20, R.tan[0]);
  return s.outline();
}

export function blacklightVelvetPoster(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 8, 3, 16, 26, R.plum, { band: 1 });
  s.rect(10, 5, 12, 22, R.black[0]);
  for (let y = 5; y <= 21; y++)
    for (let x = 10; x <= 21; x++) {
      const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 11.5);
      const bite = Math.hypot(x + 0.5 - 18, y + 0.5 - 10);
      if (d <= 5 && bite > 4.2) s.set(x, y, R.sign[3]);
      else if (d > 5 && d <= 7.5 && (x + y) % 2) s.set(x, y, R.sign[1]);
    }
  poly(
    s,
    [
      [10, 24],
      [10, 21],
      [13, 17],
      [16, 21],
      [19, 16],
      [22, 21],
      [22, 24],
    ],
    R.plum[3],
  );
  s.line(10, 21, 13, 17, R.red[3]);
  s.line(13, 17, 16, 21, R.red[3]);
  s.line(16, 21, 19, 16, R.red[3]);
  s.line(19, 16, 21, 20, R.red[3]);
  for (const [x, y] of [
    [11, 7],
    [21, 8],
    [20, 25],
    [12, 25],
  ])
    s.set(x, y, R.purple[3]);
  for (const [x, y] of [
    [9, 4],
    [22, 4],
    [9, 27],
    [22, 27],
  ])
    s.set(x, y, R.steel[3]);
  return s.outline();
}

export function foamFinger(): Sprite {
  const s = new Sprite(32, 32);
  const index = (x: number, y: number) => x >= 12 && x <= 18 && y >= 6 && y <= 18;
  const tip = ell(15.5, 6.5, 3.5, 3.5);
  const palm = (x: number, y: number) => x >= 6 && x <= 25 && y >= 14 && y <= 27;
  const thumb = ell(6, 20, 3.5, 4);
  const curled = (x: number, y: number) =>
    [ell(22, 15.5, 4, 2.2), ell(22.5, 19, 4, 2.2), ell(22, 22.5, 4, 2.2)].some((f) => f(x, y));
  shape(
    s,
    (x, y) => index(x, y) || tip(x, y) || palm(x, y) || thumb(x, y) || curled(x, y),
    R.taxi,
    { band: 1 },
  );
  box(s, 7, 26, 18, 3, R.red);
  text(s, '#1', 10, 24, R.red[2], 'micro');
  return s.outline();
}

export const COLLECTIBLES: Readonly<Record<string, () => Sprite>> = {
  'Bent Trading Card': bentTradingCard,
  'Stapled Zine Stack': stapledZineStack,
  'Laminated Backstage Pass': laminatedBackstagePass,
  'Dog-Eared Comic': dogEaredComic,
  'Holographic Sticker Sheet': holographicStickerSheet,
  'Shoebox of Baseball Cards': shoeboxOfBaseballCards,
  'Blacklight Velvet Poster': blacklightVelvetPoster,
  'Foam Finger': foamFinger,
};
