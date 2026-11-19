import type { SceneHandle } from '../street/street-boot';
import { iconFor } from './item-icon';
import type { Rarity } from './rarity';

export interface ItemViewOptions {
  name: string | null;
  rarity: Rarity;
}

export class ItemView implements SceneHandle {
  private readonly ctx: CanvasRenderingContext2D | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: ItemViewOptions,
  ) {
    this.ctx = canvas.getContext('2d');
    this.update(opts.name, opts.rarity);
  }

  update(name: string | null, rarity: Rarity): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, 32, 32);
    this.ctx.drawImage(iconFor(name, rarity).canvas(), 0, 0);
  }

  resize(): void {}

  destroy(): void {}
}
