import type { Sprite } from '../../street/pix';
import type { Rarity } from '../rarity';
import { AUDIO } from './audio';
import { CAR } from './car';
import { COLLECTIBLES } from './collectibles';
import { COMPUTERS } from './computers';
import { FAMILY_ART, STARTERS, mystery } from './families';
import { MUSIC } from './music';
import { PHONES } from './phones';
import { STREET } from './street';
import { TOOLS } from './tools';
import { TOYS } from './toys';
import { WEAR } from './wear';

export const EXACT: Readonly<Record<string, () => Sprite>> = {
  ...AUDIO,
  ...PHONES,
  ...COMPUTERS,
  ...WEAR,
  ...COLLECTIBLES,
  ...CAR,
  ...TOYS,
  ...STREET,
  ...TOOLS,
  ...MUSIC,
  ...STARTERS,
};

export const FAMILIES: readonly (readonly [RegExp, (rarity: Rarity) => Sprite])[] = [];

export { FAMILY_ART, mystery };
