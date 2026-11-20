import { Component, computed, input, signal } from '@angular/core';
import type { ShelfItem } from './shelf-item';
import { NATURAL_DIR, type ShelfKey, type SortDir } from './sort-items';

const KEYS: readonly { readonly key: ShelfKey; readonly text: string }[] = [
  { key: 'rarity', text: 'Rarity' },
  { key: 'price', text: 'Price' },
  { key: 'name', text: 'Name' },
  { key: 'status', text: 'Status' },
];

const DIR_LABELS: Readonly<Record<ShelfKey, readonly [string, string]>> = {
  rarity: ['Best first', 'Worst first'],
  price: ['Priciest first', 'Cheapest first'],
  name: ['A to Z', 'Z to A'],
  status: ['Available first', 'Locked first'],
};

@Component({
  selector: 'app-shelf-sort',
  templateUrl: './shelf-sort.html',
})
export class ShelfSort {
  readonly items = input.required<readonly ShelfItem[]>();

  private readonly keySignal = signal<ShelfKey>('rarity');
  private readonly dirSignal = signal<SortDir>('desc');
  readonly key = this.keySignal.asReadonly();
  readonly dir = this.dirSignal.asReadonly();

  protected readonly keys = KEYS;
  protected readonly noun = computed(() => (this.items().length === 1 ? 'item' : 'items'));
  protected readonly lockedCount = computed(
    () => this.items().filter((i) => i.status !== 'Available').length,
  );
  protected readonly dirLabel = computed(() => {
    const [natural, reverse] = DIR_LABELS[this.key()];
    return this.dir() === NATURAL_DIR[this.key()] ? natural : reverse;
  });

  protected pick(key: ShelfKey): void {
    if (key === this.key()) {
      this.flip();
      return;
    }
    this.keySignal.set(key);
    this.dirSignal.set(NATURAL_DIR[key]);
  }

  protected flip(): void {
    this.dirSignal.update((d) => (d === 'asc' ? 'desc' : 'asc'));
  }
}
