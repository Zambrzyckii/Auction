import { Pipe, PipeTransform } from '@angular/core';
import { RARITIES, rarityOf } from '../items/rarity';
import type { ShelfItem } from './shelf-item';

export type ShelfKey = 'rarity' | 'price' | 'name' | 'status';
export type SortDir = 'asc' | 'desc';

export const NATURAL_DIR: Readonly<Record<ShelfKey, SortDir>> = {
  rarity: 'desc',
  price: 'desc',
  name: 'asc',
  status: 'asc',
};

function statusRank(status: string): number {
  switch (status) {
    case 'Available':
      return 0;
    case 'LockedForAuction':
      return 1;
    default:
      return 2;
  }
}

function compareName(a: ShelfItem, b: ShelfItem): number {
  return a.name.localeCompare(b.name, 'en');
}

function compareKey(a: ShelfItem, b: ShelfItem, key: ShelfKey): number {
  switch (key) {
    case 'rarity':
      return RARITIES.indexOf(rarityOf(a.rarity)) - RARITIES.indexOf(rarityOf(b.rarity));
    case 'price':
      return a.officialPrice - b.officialPrice;
    case 'name':
      return compareName(a, b);
    case 'status':
      return statusRank(a.status) - statusRank(b.status);
  }
}

function compareId(a: ShelfItem, b: ShelfItem): number {
  if (a.publicItemId < b.publicItemId) return -1;
  if (a.publicItemId > b.publicItemId) return 1;
  return 0;
}

export function sortShelf<T extends ShelfItem>(
  items: readonly T[],
  key: ShelfKey,
  dir: SortDir,
): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort(
    (a, b) => sign * compareKey(a, b, key) || compareName(a, b) || compareId(a, b),
  );
}

@Pipe({ name: 'sortItems' })
export class SortItemsPipe implements PipeTransform {
  transform<T extends ShelfItem>(items: readonly T[], key: ShelfKey, dir: SortDir): T[] {
    return sortShelf(items, key, dir);
  }
}
