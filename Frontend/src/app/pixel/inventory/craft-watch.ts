import { RARITIES, Rarity, rarityOf } from '../items/rarity';
import type { ShelfItem } from './shelf-item';

export type CraftOutcome = 'ok' | 'fail' | 'none';

export interface CraftSnapshot {
  readonly pending: boolean;
  readonly picked: readonly string[];
}

export function craftOutcome(before: CraftSnapshot, after: CraftSnapshot): CraftOutcome {
  if (!(before.pending && !after.pending)) return 'none';
  return before.picked.length > 0 && after.picked.length === 0 ? 'ok' : 'fail';
}

export function landedId(
  beforeIds: readonly string[],
  items: readonly ShelfItem[],
  rarity: Rarity,
): string | null {
  const landed = items.find(
    (i) => !beforeIds.includes(i.publicItemId) && rarityOf(i.rarity) === rarity,
  );
  return landed?.publicItemId ?? null;
}

export function nextRarity(rarity: string): Rarity {
  const next = RARITIES.indexOf(rarityOf(rarity)) + 1;
  return RARITIES[Math.min(next, RARITIES.length - 1)];
}
