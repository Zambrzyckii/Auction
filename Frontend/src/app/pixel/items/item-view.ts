import type { SceneHandle } from '../street/street-boot';
import type { Sprite } from '../street/pix';
import { iconFor } from './item-icon';
import type { Rarity } from './rarity';

export interface ItemViewOptions {
  name: string | null;
  rarity: Rarity;
}

const canvases = new WeakMap<Sprite, HTMLCanvasElement>();

function canvasOf(sprite: Sprite): HTMLCanvasElement {
  let canvas = canvases.get(sprite);
  if (!canvas) {
    canvas = sprite.canvas();
    canvases.set(sprite, canvas);
  }
  return canvas;
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
    this.ctx.drawImage(canvasOf(iconFor(name, rarity)), 0, 0);
  }

  resize(): void {}

  destroy(): void {}
}
