import { INK, R, Sprite, shape } from '../../street/pix';
import type { Rarity } from '../rarity';
import { accentOf } from './helpers';

const GLYPH_Q = [
  '.00000.',
  '0000000',
  '00...00',
  '00...00',
  '.....00',
  '....00.',
  '...00..',
  '...00..',
  '.......',
  '...00..',
  '...00..',
];

export function mystery(rarity: Rarity): Sprite {
  const s = new Sprite(32, 32);
  const acc = accentOf(rarity);
  shape(s, (i, j) => i >= 5 && i <= 26 && j >= 8 && j <= 29, R.tan, { band: 2 });
  for (let j = 9; j < 29; j++) {
    s.set(22, j, R.tan[1]);
    s.set(23, j, R.tan[1]);
  }
  s.rect(24, 9, 2, 20, R.tan[0]);
  shape(s, (i, j) => i >= 4 && i <= 27 && j >= 4 && j <= 10, R.tan, { band: 1 });
  s.hline(5, 9, 22, R.tan[1]);
  for (let i = 4; i <= 27; i += 4) s.set(i, 4, null);
  const gx = 10;
  const gy = 13;
  const glyph = (dx: number, dy: number, col: string) =>
    GLYPH_Q.forEach((row, j) =>
      [...row].forEach((v, i) => {
        if (v === '0') s.set(gx + i + dx, gy + j + dy, col);
      }),
    );
  glyph(1, 1, INK);
  glyph(1, 0, INK);
  glyph(0, 1, INK);
  GLYPH_Q.forEach((row, j) =>
    [...row].forEach((v, i) => {
      if (v === '0') s.set(gx + i, gy + j, acc[i < 3 ? 3 : 2]);
    }),
  );
  return s.outline();
}

export const STARTERS: Readonly<Record<string, () => Sprite>> = {};

export const FAMILY_ART: Readonly<Record<string, (rarity: Rarity) => Sprite>> = {
  Mystery: mystery,
};
