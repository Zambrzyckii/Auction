import { DecimalPipe } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { fontsReady } from '../street/fonts';
import { bootStreet, canRunScene, StreetBootDeps } from '../street/street-boot';
import { WarMove, WarSnap, warLeader, warMove, warPhase } from './war-watch';
import type { WarLot, WarYard, WarYardOpts, WarYardState } from './war-yard';

export function warYardDeps(): StreetBootDeps<WarYardOpts, WarYard> {
  return {
    canRun: (canvas) => typeof ResizeObserver === 'function' && canRunScene(window, canvas),
    fontsReady: () => fontsReady(document.fonts),
    loadScene: () =>
      import('./war-yard').then((m) => (canvas, opts) => new m.WarYard(canvas, opts)),
  };
}

const LIT_WATCHDOG_MS = 4000;
const WIDE_FROM_PX = 1200;
const WIDE_HEIGHT_SHARE = 0.62;
const NARROW_HEIGHT_SHARE = 0.42;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isWide(): boolean {
  return window.innerWidth >= WIDE_FROM_PX;
}

function yardState(snap: WarSnap, items: readonly WarLot[]): WarYardState {
  return {
    phase: warPhase(snap.status, snap.isLeader),
    players: snap.players,
    leader: warLeader(snap),
    items,
  };
}

function stateKey(state: WarYardState): string {
  const items = (state.items ?? []).map((i) => `${i.name}:${i.rarity}`);
  return [state.phase, state.players, state.leader, ...items].join('|');
}

@Component({
  selector: 'app-war-scene',
  templateUrl: './war-scene.html',
  imports: [DecimalPipe],
  host: {
    '[class.lit]': 'lit()',
    '[attr.data-wide]': 'wide() ? "true" : null',
  },
})
export class WarScene {
  readonly status = input.required<string>();
  readonly players = input.required<number>();
  readonly isLeader = input.required<boolean>();
  readonly currentPrice = input.required<number>();
  readonly manifest = input<readonly WarLot[] | null>(null);

  protected readonly lit = signal(false);
  protected readonly wide = signal(isWide());
  protected readonly shout = signal<number | null>(null);
  protected readonly verdictText = computed(() => {
    if (!this.lit() || this.status() !== 'Settled') return '';
    return this.isLeader() ? 'YOU WON' : 'SOLD';
  });

  private readonly yard = viewChild.required<ElementRef<HTMLElement>>('yard');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly call = viewChild.required<ElementRef<HTMLElement>>('call');
  private readonly verdict = viewChild.required<ElementRef<HTMLElement>>('verdict');
  private readonly scene = signal<WarYard | null>(null);

  private snap: WarSnap | null = null;
  private applied = '';
  private visible = true;
  private alive = true;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private readonly onWindowResize = () => this.refit();

  constructor() {
    effect(() => {
      const now: WarSnap = {
        status: this.status(),
        isLeader: this.isLeader(),
        currentPrice: this.currentPrice(),
        players: this.players(),
      };
      const items = this.manifest() ?? [];
      const scene = this.scene();
      untracked(() => this.follow(now, items, scene));
    });
    afterRenderEffect(() => {
      const scene = this.scene();
      if (!scene || this.verdictText() === '') return;
      untracked(() => this.placeVerdict(scene));
    });
    window.addEventListener('resize', this.onWindowResize);
    afterNextRender(() => void this.boot());
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private follow(now: WarSnap, items: readonly WarLot[], scene: WarYard | null): void {
    const before = this.snap;
    this.snap = now;
    const move = warMove(before, now);
    if (before === null && now.status === 'Settled') this.lit.set(true);
    if (!scene) {
      if (move?.kind === 'settle') this.lit.set(true);
      return;
    }
    const state = yardState(now, items);
    if (!move && stateKey(state) === this.applied) return;
    this.drive(scene, state, move);
    this.applied = stateKey(state);
    this.syncLoop(scene);
  }

  private drive(scene: WarYard, state: WarYardState, move: WarMove): void {
    if (move?.kind === 'raise') {
      scene.raise(move.by);
      this.callOut(scene, move.delta);
      return;
    }
    if (move?.kind === 'settle') {
      scene.settle(move.won, state.items ?? []);
      this.watchdog = setTimeout(() => this.lit.set(true), LIT_WATCHDOG_MS);
      return;
    }
    scene.set(state);
  }

  private callOut(scene: WarYard, delta: number): void {
    const call = this.call().nativeElement;
    const canvas = this.canvas().nativeElement;
    const at = scene.anchor('barker');
    this.shout.set(delta);
    call.style.left = `${canvas.offsetLeft + at.x}px`;
    call.style.top = `${canvas.offsetTop + at.y}px`;
    call.classList.remove('on');
    void call.offsetWidth;
    call.classList.add('on');
  }

  private placeVerdict(scene: WarYard): void {
    const verdict = this.verdict().nativeElement;
    const canvas = this.canvas().nativeElement;
    const at = scene.anchor('door');
    verdict.style.top = `${canvas.offsetTop + at.y}px`;
    verdict.style.left = `${Math.max(4, canvas.offsetLeft + at.x - verdict.offsetWidth / 2)}px`;
  }

  private async boot(): Promise<void> {
    this.wide.set(isWide());
    const opts: WarYardOpts = {
      reduced: prefersReducedMotion(),
      onDoorOpen: () => this.open(),
    };
    const handle = await bootStreet(
      this.canvas().nativeElement,
      opts,
      warYardDeps(),
      () => this.alive,
    );
    if (!handle) return;
    if (!this.alive) {
      handle.destroy();
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.fit(handle));
    this.resizeObserver.observe(this.yard().nativeElement);
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      this.visible = entry.isIntersecting;
      this.syncLoop(handle);
    });
    this.intersectionObserver.observe(this.canvas().nativeElement);
    this.fit(handle);
    this.applied = '';
    this.scene.set(handle);
  }

  private open(): void {
    clearTimeout(this.watchdog);
    this.lit.set(true);
  }

  private refit(): void {
    this.wide.set(isWide());
    const scene = this.scene();
    if (scene) this.fit(scene);
  }

  private fit(scene: WarYard): void {
    const share = this.wide() ? WIDE_HEIGHT_SHARE : NARROW_HEIGHT_SHARE;
    scene.resize(this.yard().nativeElement.clientWidth, Math.round(innerHeight * share));
    if (this.verdictText() !== '') this.placeVerdict(scene);
  }

  private syncLoop(scene: WarYard): void {
    if (this.visible) scene.resume();
    else scene.pause();
  }

  private stop(): void {
    this.alive = false;
    clearTimeout(this.watchdog);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    this.scene()?.destroy();
    this.scene.set(null);
  }
}
