// The canvas loop of the door pages: lays the door art out for the current widths, animates the bouncer
// and the neon and draws only when something visible changed. It stays free of Angular on purpose.
import type { SceneHandle } from '../street-boot';
import { compose, bouncer, bubble } from './door-art';
import type { DoorPlacement } from './door-art';
import { BOUNCER_FRAMES, DOOR_LINES, bouncerFrame, doorLayout } from './door-rules';
import type { BouncerState, DoorLayout, DoorMode } from './door-rules';

export interface DoorViewOptions {
  mode: DoorMode;
  hostWidth: () => number;
  viewportWidth: () => number;
  onStrip: (cssHeight: number) => void;
}

export interface DoorHandle extends SceneHandle {
  update(mode: DoorMode, state: BouncerState): void;
}

interface Layers {
  bg: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  neon: HTMLCanvasElement;
}

interface CachedBubble {
  cv: HTMLCanvasElement;
  tip: { x: number; y: number };
}

type BouncerSheets = Record<BouncerState, HTMLCanvasElement[]>;

const FIRST_FLICKER_MS = 3000;
const FIRST_FLICKER_SPREAD_MS = 4000;
const NEXT_FLICKER_MS = 5000;
const NEXT_FLICKER_SPREAD_MS = 5000;
const FLICKER_OFFSETS = [0, 70, 150, 260] as const;

let sheets: BouncerSheets | null = null;

function bouncerSheets(): BouncerSheets {
  if (sheets) return sheets;
  const make = (state: BouncerState) =>
    Array.from({ length: BOUNCER_FRAMES[state] }, (_, frame) => bouncer(state, frame).canvas());
  sheets = { idle: make('idle'), check: make('check'), refuse: make('refuse') };
  return sheets;
}

function inFlicker(flicker: readonly number[], now: number): boolean {
  if (!flicker.length) return false;
  return (now >= flicker[0] && now < flicker[1]) || (now >= flicker[2] && now < flicker[3]);
}

export class DoorView implements DoorHandle {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: IntersectionObserver;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly bubbles = new Map<string, CachedBubble>();
  private mode: DoorMode;
  private state: BouncerState = 'idle';
  private since = performance.now();
  private layout: DoorLayout | null = null;
  private layers: Layers | null = null;
  private placement: DoorPlacement | null = null;
  private k = 1;
  private lastHost = 0;
  private lastViewport = 0;
  private lastDpr = 0;
  private visible = false;
  private destroyed = false;
  private frame = 0;
  private key = '';
  private neonOn = true;
  private flicker: readonly number[] = [];
  private nextFlicker =
    performance.now() + FIRST_FLICKER_MS + Math.random() * FIRST_FLICKER_SPREAD_MS;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: DoorViewOptions,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.mode = opts.mode;
    this.resize();
    this.observer = new IntersectionObserver((entries) => {
      this.visible = entries[entries.length - 1].isIntersecting;
      if (this.visible) this.start();
      else this.stop();
    });
    this.observer.observe(canvas);
  }

  update(mode: DoorMode, state: BouncerState): void {
    if (this.destroyed) return;
    if (mode === this.mode && state === this.state) return;
    if (state !== this.state) this.since = performance.now();
    this.mode = mode;
    this.state = state;
    this.key = '';
  }

  resize(): void {
    if (this.destroyed) return;
    const hostWidth = this.opts.hostWidth();
    const viewportWidth = this.opts.viewportWidth();
    const dpr = window.devicePixelRatio || 1;
    if (!hostWidth) return;
    if (
      hostWidth === this.lastHost &&
      viewportWidth === this.lastViewport &&
      dpr === this.lastDpr
    ) {
      return;
    }
    this.lastHost = hostWidth;
    this.lastViewport = viewportWidth;
    this.lastDpr = dpr;

    const layout = doorLayout(viewportWidth, hostWidth, dpr);
    const art = compose(layout.cols, layout.center, { bare: layout.stacked });
    this.layout = layout;
    this.placement = art.P;
    this.layers = { bg: art.bg.canvas(), glow: art.glow.canvas(), neon: art.neon.canvas() };
    this.k = layout.k;
    this.canvas.width = layout.cols * this.k;
    this.canvas.height = layout.rows * this.k;
    this.canvas.style.width = `${(layout.cols * this.k) / dpr}px`;
    this.canvas.style.height = `${(layout.rows * this.k) / dpr}px`;
    this.opts.onStrip((layout.rows * this.k) / dpr);
    this.key = '';
    this.draw(performance.now());
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    this.observer.disconnect();
  }

  private start(): void {
    if (this.destroyed || this.frame) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (!this.frame) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly tick = (now: number): void => {
    this.frame = 0;
    if (this.destroyed || !this.visible) return;
    this.draw(now);
    this.frame = requestAnimationFrame(this.tick);
  };

  private tickNeon(now: number): void {
    if (this.reduced) {
      this.neonOn = true;
      return;
    }
    if (now >= this.nextFlicker) {
      this.flicker = FLICKER_OFFSETS.map((offset) => now + offset);
      this.nextFlicker = now + NEXT_FLICKER_MS + Math.random() * NEXT_FLICKER_SPREAD_MS;
    }
    this.neonOn = !inFlicker(this.flicker, now);
  }

  private bubbleFor(stacked: boolean): CachedBubble {
    const side = stacked ? 'right' : 'down';
    const id = `${this.mode}-${this.state}-${side}`;
    const cached = this.bubbles.get(id);
    if (cached) return cached;
    const made = bubble(DOOR_LINES[this.mode][this.state], side);
    const entry = { cv: made.s.canvas(), tip: made.tip };
    this.bubbles.set(id, entry);
    return entry;
  }

  private draw(now: number): void {
    const { layout, layers, placement } = this;
    if (!layout || !layers || !placement) return;
    this.tickNeon(now);
    const frame = bouncerFrame(this.state, this.since, now, this.reduced);
    const key = `${this.state}${frame}${this.neonOn}${this.mode}`;
    if (key === this.key) return;
    this.key = key;

    const { ctx, k } = this;
    const { cols, rows, top, stacked } = layout;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layers.bg, 0, top, cols, rows, 0, 0, cols * k, rows * k);
    if (this.neonOn) {
      ctx.drawImage(layers.glow, 0, top, cols, rows, 0, 0, cols * k, rows * k);
      ctx.drawImage(layers.neon, 0, top, cols, rows, 0, 0, cols * k, rows * k);
    }
    const { x, y } = placement.bouncer;
    const sprite = bouncerSheets()[this.state][frame];
    ctx.drawImage(sprite, x * k, (y - top) * k, sprite.width * k, sprite.height * k);

    const bb = this.bubbleFor(stacked);
    const tipX = stacked ? x + 10 : x + 16;
    const tipY = stacked ? y + 7 : y;
    ctx.drawImage(
      bb.cv,
      (tipX - bb.tip.x) * k,
      (tipY - bb.tip.y - top) * k,
      bb.cv.width * k,
      bb.cv.height * k,
    );
  }
}
