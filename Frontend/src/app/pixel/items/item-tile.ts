import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { fontsReady } from '../street/fonts';
import { bootStreet, canRunScene, StreetBootDeps } from '../street/street-boot';
import type { ItemView, ItemViewOptions } from './item-view';
import { rarityOf } from './rarity';

export function itemDeps(): StreetBootDeps<ItemViewOptions, ItemView> {
  return {
    canRun: (canvas) => typeof ResizeObserver === 'function' && canRunScene(window, canvas),
    fontsReady: () => fontsReady(document.fonts),
    loadScene: () =>
      import('./item-view').then((m) => (canvas, opts) => new m.ItemView(canvas, opts)),
  };
}

@Component({
  selector: 'app-item-tile',
  templateUrl: './item-tile.html',
  styleUrl: './item-tile.scss',
  host: {
    '[attr.data-rarity]': 'ground()',
    '[class.lot]': "size() === 'lot'",
  },
})
export class ItemTile {
  readonly name = input.required<string | null>();
  readonly rarity = input<string | null>(null);
  readonly size = input<'row' | 'lot'>('row');

  protected readonly ground = computed(() => rarityOf(this.rarity()));

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly view = signal<ItemView | null>(null);
  private alive = true;

  constructor() {
    afterNextRender(() => void this.start());
    effect(() => {
      this.view()?.update(this.name(), this.ground());
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private async start(): Promise<void> {
    const opts: ItemViewOptions = { name: this.name(), rarity: this.ground() };
    const handle = await bootStreet(
      this.canvas().nativeElement,
      opts,
      itemDeps(),
      () => this.alive,
    );
    if (!handle) return;
    if (!this.alive) {
      handle.destroy();
      return;
    }
    this.view.set(handle);
  }

  private stop(): void {
    this.alive = false;
    this.view()?.destroy();
    this.view.set(null);
  }
}
