import { Pipe, PipeTransform } from '@angular/core';
import type { ShelfItem } from './shelf-item';

export function benchFit(item: ShelfItem, belt: readonly ShelfItem[]): string | null {
  if (belt.some((b) => b.publicItemId === item.publicItemId)) return null;
  if (item.status !== 'Available') return 'On auction';
  if (item.rarity === 'Legendary') return 'Top rarity';
  if (belt.length > 0 && belt[0].rarity !== item.rarity) return `Needs ${belt[0].rarity}`;
  if (belt.length >= 3) return 'Belt is full';
  return null;
}

@Pipe({ name: 'benchFit' })
export class BenchFitPipe implements PipeTransform {
  transform(item: ShelfItem, belt: readonly ShelfItem[]): string | null {
    return benchFit(item, belt);
  }
}
