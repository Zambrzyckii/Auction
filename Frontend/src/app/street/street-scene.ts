import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  viewChild,
} from '@angular/core';
import type { Building, BuildingId } from './city';
import type { SceneOptions } from './scene';
import { bootStreet, browserDeps, SceneHandle } from './street-boot';

const RESIZE_DEBOUNCE_MS = 150;

@Component({
  selector: 'app-street-scene',
  templateUrl: './street-scene.html',
  styleUrl: './street-scene.scss',
})
export class StreetScene {
  readonly picked = output<BuildingId>();

  private readonly wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly tip = viewChild.required<ElementRef<HTMLElement>>('tip');
  private readonly tipName = viewChild.required<ElementRef<HTMLElement>>('tipName');
  private readonly tipRoute = viewChild.required<ElementRef<HTMLElement>>('tipRoute');

  private alive = true;
  private handle: SceneHandle | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners = new AbortController();

  constructor() {
    afterNextRender(() => void this.start());
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private async start(): Promise<void> {
    const wrap = this.wrap().nativeElement;
    const canvas = this.canvas().nativeElement;
    const opts: SceneOptions = {
      interactive: true,
      cssWidth: () => wrap.clientWidth,
      onHover: (building, event) => this.showTip(building, event),
      onPick: (building) => this.picked.emit(building.id),
    };
    const handle = await bootStreet(canvas, opts, browserDeps(), () => this.alive);
    if (!handle) return;
    if (!this.alive) {
      handle.destroy();
      return;
    }
    this.handle = handle;
    const center = () => {
      wrap.scrollLeft = Math.max(0, (canvas.offsetWidth - wrap.clientWidth) / 2);
    };
    center();
    window.addEventListener(
      'resize',
      () => {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          handle.resize();
          center();
        }, RESIZE_DEBOUNCE_MS);
      },
      { signal: this.listeners.signal },
    );
  }

  private showTip(building: Building | null, event?: PointerEvent): void {
    const tip = this.tip().nativeElement;
    if (!building || !event) {
      tip.hidden = true;
      return;
    }
    this.tipName().nativeElement.textContent = building.name;
    this.tipRoute().nativeElement.textContent = 'Opens ' + building.route;
    tip.hidden = false;
    const wrap = this.wrap().nativeElement;
    const rect = wrap.getBoundingClientRect();
    const x = Math.min(
      event.clientX - rect.left + wrap.scrollLeft + 14,
      wrap.scrollLeft + wrap.clientWidth - tip.offsetWidth - 6,
    );
    const y = Math.min(event.clientY - rect.top + 14, wrap.clientHeight - tip.offsetHeight - 6);
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  private stop(): void {
    this.alive = false;
    this.listeners.abort();
    clearTimeout(this.resizeTimer);
    this.handle?.destroy();
    this.handle = null;
  }
}
