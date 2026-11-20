import type { Sprite } from '../../street/pix';
import type { Rarity } from '../rarity';
import { AUDIO } from './audio';
import { CAR } from './car';
import { COLLECTIBLES } from './collectibles';
import { COMPUTERS } from './computers';
import { FAMILY_ART, STARTERS, craftedItem, mystery, pawnedGood, warehouseFind } from './families';
import { KITCHEN } from './kitchen';
import { MUSIC } from './music';
import { PHONES } from './phones';
import { SPORTS } from './sports';
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
  ...KITCHEN,
  ...SPORTS,
  ...STARTERS,
};

export const FAMILIES: readonly (readonly [RegExp, (rarity: Rarity) => Sprite])[] = [
  [/^Warehouse \w+ Find$/, warehouseFind],
  [/^Pawned \w+ Good$/, pawnedGood],
  [/^Crafted \w+ Item$/, craftedItem],
];

export { FAMILY_ART, mystery };
