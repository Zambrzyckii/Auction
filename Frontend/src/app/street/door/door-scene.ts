import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { fontsReady } from '../fonts';
import { bootStreet, canRunScene, StreetBootDeps } from '../street-boot';
import type { DoorHandle, DoorViewOptions } from './door-view';
import { bouncerState, DoorMode } from './door-rules';

export function doorDeps(): StreetBootDeps<DoorViewOptions, DoorHandle> {
  return {
    canRun: (canvas) => typeof ResizeObserver === 'function' && canRunScene(window, canvas),
    fontsReady: () => fontsReady(document.fonts),
    loadScene: () =>
      import('./door-view').then((m) => (canvas, opts) => new m.DoorView(canvas, opts)),
  };
}

@Component({
  selector: 'app-door-scene',
  templateUrl: './door-scene.html',
  styleUrl: './door-scene.scss',
})
export class DoorScene {
  readonly mode = input.required<DoorMode>();
  readonly pending = input(false);
  readonly refused = input(false);
  readonly strip = output<number>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly view = signal<DoorHandle | null>(null);

  private alive = true;
  private observer: ResizeObserver | undefined;
  private frame = 0;
  private readonly listeners = new AbortController();

  constructor() {
    afterNextRender(() => void this.start());
    effect(() => {
      this.view()?.update(this.mode(), bouncerState(this.pending(), this.refused()));
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private async start(): Promise<void> {
    const opts: DoorViewOptions = {
      mode: this.mode(),
      hostWidth: () => this.host.clientWidth,
      viewportWidth: () => window.innerWidth,
      onStrip: (cssHeight) => this.strip.emit(cssHeight),
    };
    const handle = await bootStreet(
      this.canvas().nativeElement,
      opts,
      doorDeps(),
      () => this.alive,
    );
    if (!handle) return;
    if (!this.alive) {
      handle.destroy();
      return;
    }
    const schedule = () => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => handle.resize());
    };
    this.observer = new ResizeObserver(schedule);
    this.observer.observe(this.host);
    window.addEventListener('resize', schedule, { signal: this.listeners.signal });
    this.view.set(handle);
  }

  private stop(): void {
    this.alive = false;
    this.observer?.disconnect();
    this.listeners.abort();
    cancelAnimationFrame(this.frame);
    this.view()?.destroy();
    this.view.set(null);
  }
}
