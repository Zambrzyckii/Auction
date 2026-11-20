import { R, Sprite, box, cylH, disc, shape } from '../../street/pix';
import { bezier, ell, flat, poly, sweep, thick } from './helpers';

export function disposableCamera(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 3, 12, 26, 17, R.taxi, { band: 1 });
  box(s, 6, 9, 6, 4, R.taxi);
  s.rect(7, 10, 4, 2, R.white[3]);
  s.rect(21, 9, 6, 3, R.black[0]);
  for (const x of [22, 24, 26]) s.vline(x, 9, 2, R.taxi[1]);
  s.rect(22, 14, 4, 2, R.black[0]);
  s.rect(18, 19, 9, 7, R.red[2]);
  s.hline(19, 21, 7, R.white[3]);
  s.hline(19, 23, 5, R.white[3]);
  disc(s, 11, 21, 5.5, R.black[0]);
  disc(s, 11, 21, 3.8, R.glass[2]);
  s.set(9, 19, R.white[3]);
  s.set(10, 19, R.white[3]);
  s.hline(4, 26, 24, R.taxi[1]);
  return s.outline();
}

export function crackedInstantCamera(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 3, 8, 26, 17, R.white, { band: 1 });
  s.rect(19, 4, 8, 5, R.black[0]);
  s.rect(20, 5, 6, 3, R.taxi[3]);
  s.rect(8, 24, 14, 5, R.white[2]);
  s.rect(10, 26, 10, 2, R.denim[2]);
  for (const [i, c] of [R.red[2], R.taxi[3], R.denim[2]].entries()) s.hline(19, 14 + i, 9, c);
  disc(s, 12, 17, 6.5, R.black[0]);
  disc(s, 12, 17, 5, R.white[0]);
  disc(s, 12, 17, 3.6, R.glass[2]);
  s.set(10, 15, R.white[3]);
  s.set(11, 15, R.white[3]);
  s.line(6, 10, 8, 14, R.black[0]);
  s.line(8, 14, 5, 17, R.black[0]);
  s.line(13, 15, 11, 19, R.white[3]);
  return s.outline();
}

export function slideProjector(): Sprite {
  const s = new Sprite(32, 32);
  poly(
    s,
    [
      [26, 17],
      [29, 12],
      [29, 27],
      [26, 24],
    ],
    R.lit[2],
  );
  box(s, 2, 15, 18, 11, R.grey, { band: 1 });
  s.rect(4, 26, 3, 2, R.black[1]);
  s.rect(15, 26, 3, 2, R.black[1]);
  cylH(s, 20, 17, 6, 7, R.black);
  flat(s, ell(10.5, 11, 8, 3.5), R.black[1]);
  for (let x = 5; x <= 15; x += 2) s.rect(x, 11, 1, 3, R.lit[2]);
  s.rect(5, 19, 3, 3, R.red[2]);
  return s.outline();
}

export function reelOfHomeMovies(): Sprite {
  const s = new Sprite(32, 32);
  const film = bezier([21, 19], [29, 17], [31, 26], [24, 28], 14);
  shape(s, sweep(film, 1.8), R.black, {});
  film.forEach(([x, y], i) => {
    if (i % 3 === 1) s.set(x, y, R.paper[3]);
  });
  shape(s, ell(13, 13, 11, 11), R.grey, { band: 1 });
  for (let k = 0; k < 5; k++) {
    const a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
    flat(s, ell(13 + 6.5 * Math.cos(a), 13 + 6.5 * Math.sin(a), 2.3, 2.3), R.black[1]);
  }
  disc(s, 13, 13, 2.5, R.black[0]);
  s.set(12, 12, R.grey[3]);
  return s.outline();
}

export function vhsRewinder(): Sprite {
  const s = new Sprite(32, 32);
  shape(
    s,
    (x, y) => y >= 8 && y <= 15 && x >= 11 - (y - 8) * 0.55 && x <= 23 + (y - 8) * 0.45,
    R.red,
    { band: 1 },
  );
  box(s, 2, 15, 28, 10, R.red, { band: 1 });
  s.rect(11, 10, 4, 4, R.glass[2]);
  s.rect(17, 10, 4, 4, R.glass[2]);
  s.rect(6, 17, 15, 5, R.black[0]);
  s.rect(8, 18, 11, 3, R.black[2]);
  for (const x of [10, 16]) disc(s, x, 19, 1.4, R.paper[3]);
  s.rect(26, 17, 3, 2, R.taxi[3]);
  s.rect(3, 17, 2, 2, R.red[3]);
  s.hline(23, 22, 4, R.taxi[3]);
  for (const x of [8, 23]) {
    disc(s, x, 26, 3.4, R.black[0]);
    disc(s, x, 26, 1.4, R.grey[2]);
  }
  return s.outline();
}

export function bootlegMovieTape(): Sprite {
  const s = new Sprite(32, 32);
  box(s, 3, 3, 26, 16, R.black, { band: 1 });
  s.rect(5, 5, 22, 5, R.paper[2]);
  s.hline(6, 7, 6, R.red[2]);
  s.hline(14, 8, 9, R.black[0]);
  s.rect(8, 12, 16, 4, R.black[0]);
  for (const x of [11, 20]) {
    disc(s, x, 14, 1.8, R.paper[2]);
    s.set(x, 14, R.black[0]);
  }
  box(s, 5, 17, 22, 12, R.tan, { band: 1 });
  s.rect(8, 19, 16, 8, R.paper[3]);
  s.line(9, 24, 12, 20, R.red[2]);
  s.line(12, 20, 15, 25, R.red[2]);
  s.line(15, 25, 18, 21, R.red[2]);
  s.hline(19, 25, 4, R.black[0]);
  s.hline(19, 21, 3, R.black[0]);
  return s.outline();
}

function inLetterR(x: number, y: number): boolean {
  const lx = x - 6;
  const ly = y - 2;
  const stem = lx >= 0 && lx <= 5 && ly >= 0 && ly <= 25;
  const bowl = ell(11, 7.5, 9, 7.5)(lx, ly) && !ell(11, 7.5, 4.2, 3.2)(lx, ly);
  return stem || bowl || thick(8, 14, 17.5, 25, 2.4, 3)(lx, ly);
}

export function marqueeLetterR(): Sprite {
  const s = new Sprite(32, 32);
  shape(s, inLetterR, R.red, { band: 1 });
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const deep =
        inLetterR(x, y) &&
        inLetterR(x - 1, y) &&
        inLetterR(x + 1, y) &&
        inLetterR(x, y - 1) &&
        inLetterR(x, y + 1);
      const rim =
        !inLetterR(x - 2, y) ||
        !inLetterR(x + 2, y) ||
        !inLetterR(x, y - 2) ||
        !inLetterR(x, y + 2);
      if (deep && rim && (x + y) % 2 === 0) s.set(x, y, R.taxi[3]);
    }
  return s.outline();
}

const hull = (pts: readonly (readonly [number, number])[]) => {
  const mask = new Sprite(32, 32);
  poly(mask, pts, R.red[0]);
  return (x: number, y: number) => mask.get(x, y) !== null;
};

export function directorsMegaphone(): Sprite {
  const s = new Sprite(32, 32);
  const cone = hull([
    [7, 27],
    [4, 24],
    [20, 4],
    [29, 14],
  ]);
  shape(s, cone, R.purple, { band: 1 });
  s.line(25, 16, 17, 7, R.white[2]);
  s.line(24, 17, 16, 8, R.white[2]);
  shape(s, thick(5.5, 25.5, 9.5, 21.5, 2.3), R.white, {});
  flat(s, thick(20.6, 4.2, 28.4, 13.2, 2.9), R.purple[3]);
  flat(s, thick(21.2, 4.9, 27.8, 12.5, 1.7), R.purple[0]);
  s.rect(14, 22, 3, 5, R.black[1]);
  const strap = bezier([14, 24], [8, 29], [20, 29], [17, 25], 12);
  for (const [x, y] of strap) s.set(x, y, R.black[1]);
  return s.outline();
}

export const PHOTO: Readonly<Record<string, () => Sprite>> = {
  'Disposable Camera': disposableCamera,
  'Cracked Instant Camera': crackedInstantCamera,
  'Slide Projector': slideProjector,
  'Reel of Home Movies': reelOfHomeMovies,
  'VHS Rewinder': vhsRewinder,
  'Bootleg Movie Tape': bootlegMovieTape,
  'Marquee Letter R': marqueeLetterR,
  "Director's Megaphone": directorsMegaphone,
};
