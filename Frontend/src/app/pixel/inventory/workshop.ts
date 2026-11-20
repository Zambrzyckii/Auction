import { DecimalPipe } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Rarity, rarityOf } from '../items/rarity';
import { fontsReady } from '../street/fonts';
import { bootStreet, canRunScene, StreetBootDeps } from '../street/street-boot';
import { CraftSnapshot, craftOutcome, landedId, nextRarity } from './craft-watch';
import type { ShelfItem } from './shelf-item';
import type { BenchItem, SceneOpts, SceneRect, WorkshopScene } from './workshop-scene';

export function workshopDeps(): StreetBootDeps<SceneOpts, WorkshopScene> {
  return {
    canRun: (canvas) => typeof ResizeObserver === 'function' && canRunScene(window, canvas),
    fontsReady: () => fontsReady(document.fonts),
    loadScene: () =>
      import('./workshop-scene').then((m) => (canvas, opts) => new m.WorkshopScene(canvas, opts)),
  };
}

interface Run {
  readonly ids: readonly string[];
  readonly spent: readonly string[];
  readonly expected: Rarity;
  readonly viaScene: boolean;
}

interface Result {
  readonly name: string;
  readonly rarity: Rarity;
}

interface Layout {
  readonly scale: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
  readonly crateX: number;
  readonly rects: readonly SceneRect[];
}

interface Burst {
  readonly n: number;
  readonly x: number;
  readonly y: number;
}

interface Why {
  readonly text: string;
  readonly price?: number;
}

const ROLL_UP = [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }];
const ROLL_DOWN = [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }];
const ROLL_OPTS: KeyframeAnimationOptions = {
  duration: 520,
  easing: 'steps(9, end)',
  fill: 'forwards',
};

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function explain(picks: readonly ShelfItem[]): string {
  if (picks.length === 0) return 'Pick three items of one rarity from the shelf below.';
  if (picks.some((i) => i.status !== 'Available')) return 'Locked items stay off the belt.';
  if (picks.some((i) => rarityOf(i.rarity) === 'Legendary')) {
    return 'Legendary is the top, it cannot go in.';
  }
  const rarity = rarityOf(picks[0].rarity);
  if (!picks.every((i) => rarityOf(i.rarity) === rarity)) {
    return 'Mixed rarities. The press takes one rarity at a time.';
  }
  if (picks.length > 3) return `${picks.length} picked, the belt takes three. Take one off.`;
  if (picks.length < 3) {
    return `${3 - picks.length} more ${rarity} item${picks.length === 2 ? '' : 's'} to go.`;
  }
  return `Ready. Three ${rarity} in, one ${nextRarity(rarity)} out.`;
}

@Component({
  selector: 'app-workshop',
  templateUrl: './workshop.html',
  imports: [DecimalPipe],
  host: { '[attr.data-open]': 'open()' },
})
export class Workshop {
  readonly items = input.required<readonly ShelfItem[]>();
  readonly picked = input.required<readonly string[]>();
  readonly pending = input.required<boolean>();
  readonly ready = input.required<boolean>();
  readonly takeOff = output<string>();

  private readonly openSignal = signal(false);
  readonly open = this.openSignal.asReadonly();

  private readonly picks = computed(() => {
    const items = this.items();
    return this.picked()
      .map((id) => items.find((i) => i.publicItemId === id))
      .filter((i): i is ShelfItem => i !== undefined);
  });
  readonly belt = computed<readonly ShelfItem[]>(() => this.picks().slice(0, 3));

  private readonly run = signal<Run | null>(null);
  protected readonly result = signal<Result | null>(null);
  protected readonly revealed = signal(false);
  private readonly crafting = computed(
    () => this.pending() || (this.result() !== null && !this.revealed()),
  );
  private readonly landed = computed(() => {
    const run = this.run();
    return run ? landedId(run.ids, this.items(), run.expected) : null;
  });

  readonly hidden = computed<readonly string[]>(() => {
    const run = this.run();
    if (!run) return [];
    const spent = this.result() ? run.spent : [];
    const landed = this.landed();
    return landed && !this.revealed() ? [...spent, landed] : spent;
  });
  readonly fresh = computed(() => (this.revealed() && this.result() ? this.landed() : null));

  protected readonly why = computed<Why>(() => {
    const result = this.result();
    if (this.pending() || (result && !this.revealed())) return { text: 'Pressing…' };
    if (!result) return { text: explain(this.picks()) };
    const landed = this.items().find((i) => i.publicItemId === this.landed());
    if (!landed) return { text: `You made a ${result.name}. Appraising…` };
    return { text: `You made a ${result.name}.`, price: landed.officialPrice };
  });

  protected readonly layout = signal<Layout | null>(null);
  protected readonly burst = signal<readonly Burst[]>([]);
  protected readonly shutterHidden = signal(true);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly shutter = viewChild.required<ElementRef<HTMLElement>>('shutter');
  private readonly reveal = viewChild.required<ElementRef<HTMLElement>>('reveal');
  private readonly scene = signal<WorkshopScene | null>(null);

  private snap: CraftSnapshot = { pending: false, picked: [] };
  private burstCount = 0;
  private booted = false;
  private rolling = false;
  private visible = true;
  private alive = true;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private readonly onWindowResize = () => this.fitIfOpen();

  constructor() {
    effect(() => {
      const now: CraftSnapshot = { pending: this.pending(), picked: this.picked() };
      untracked(() => this.follow(now));
    });
    effect(() => {
      const scene = this.scene();
      const belt = this.belt();
      if (!scene || this.crafting()) return;
      scene.setBench(belt.map((i) => ({ id: i.publicItemId, name: i.name, rarity: i.rarity })));
    });
    effect(() => {
      this.scene()?.setReady(this.ready() && !this.pending());
    });
    afterRenderEffect(() => {
      const scene = this.scene();
      if (!scene) return;
      if (!this.open()) {
        scene.pause();
        return;
      }
      untracked(() => {
        this.fit(scene);
        scene.setBench(this.benchItems());
        scene.setReady(this.ready() && !this.pending());
        this.syncLoop(scene);
      });
    });
    afterRenderEffect(() => {
      const crateX = this.layout()?.crateX;
      if (crateX === undefined || !this.revealed()) return;
      const stamp = this.reveal().nativeElement;
      const room = this.stage().nativeElement.clientWidth;
      const width = stamp.offsetWidth;
      stamp.style.left = `${Math.max(4, Math.min(room - width - 4, crateX - width / 2))}px`;
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected toggle(): void {
    if (this.rolling) return;
    if (this.open()) this.rollDown();
    else this.rollUp();
  }

  protected takeOffItem(id: string): void {
    this.takeOff.emit(id);
  }

  private rollUp(): void {
    this.openSignal.set(true);
    if (!this.booted) {
      this.booted = true;
      void this.boot();
    }
    this.roll(ROLL_UP, () => this.shutterHidden.set(true));
  }

  private rollDown(): void {
    this.revealNow();
    this.roll(ROLL_DOWN, () => this.openSignal.set(false));
  }

  private roll(frames: Keyframe[], done: () => void): void {
    const shutter = this.shutter().nativeElement;
    if (typeof shutter.animate !== 'function' || prefersReducedMotion()) {
      done();
      return;
    }
    this.rolling = true;
    this.shutterHidden.set(false);
    shutter.animate(frames, ROLL_OPTS).finished.then(() => {
      this.rolling = false;
      done();
    });
  }

  private revealNow(): void {
    if (this.result() && !this.revealed()) this.revealed.set(true);
  }

  private benchItems(): BenchItem[] {
    return this.belt().map((i) => ({ id: i.publicItemId, name: i.name, rarity: i.rarity }));
  }

  private follow(now: CraftSnapshot): void {
    const before = this.snap;
    this.snap = now.pending && before.pending ? before : now;
    if (now.pending && !before.pending) {
      this.begin(now.picked);
      return;
    }
    const outcome = craftOutcome(before, now);
    if (outcome === 'ok') {
      this.succeed();
      return;
    }
    if (outcome === 'fail') {
      this.fail();
      return;
    }
    if (!now.pending && this.result() && !sameIds(before.picked, now.picked)) this.clearResult();
  }

  private begin(picked: readonly string[]): void {
    const expected = nextRarity(this.belt()[0]?.rarity ?? 'Common');
    const scene = this.scene();
    const viaScene = scene !== null && this.open();
    this.clearResult();
    this.run.set({
      ids: this.items().map((i) => i.publicItemId),
      spent: picked,
      expected,
      viaScene,
    });
    if (viaScene) scene.start();
  }

  private succeed(): void {
    const run = this.run();
    if (!run) return;
    const result = { name: `Crafted ${run.expected} Item`, rarity: run.expected };
    this.result.set(result);
    this.revealed.set(false);
    const scene = this.scene();
    if (run.viaScene && scene) {
      scene.setBench([]);
      scene.succeed({ id: 'crafted', name: result.name, rarity: result.rarity });
    }
    if (!run.viaScene || !scene || !this.open()) this.revealed.set(true);
  }

  private fail(): void {
    const run = this.run();
    this.run.set(null);
    if (run?.viaScene) this.scene()?.fail();
  }

  private clearResult(): void {
    this.result.set(null);
    this.revealed.set(false);
    this.run.set(null);
  }

  private async boot(): Promise<void> {
    const opts: SceneOpts = {
      reduced: prefersReducedMotion(),
      onImpact: () => this.bam(),
      onReveal: () => this.revealNow(),
    };
    const handle = await bootStreet(
      this.canvas().nativeElement,
      opts,
      workshopDeps(),
      () => this.alive,
    );
    if (!handle) return;
    if (!this.alive) {
      handle.destroy();
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.fitIfOpen());
    this.resizeObserver.observe(this.stage().nativeElement);
    window.addEventListener('resize', this.onWindowResize);
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      this.visible = entry.isIntersecting;
      this.syncLoop(handle);
    });
    this.intersectionObserver.observe(this.canvas().nativeElement);
    this.scene.set(handle);
  }

  private fitIfOpen(): void {
    const scene = this.scene();
    if (scene && this.open()) this.fit(scene);
  }

  private fit(scene: WorkshopScene): void {
    const canvas = this.canvas().nativeElement;
    scene.resize(this.stage().nativeElement.clientWidth, Math.round(innerHeight * 0.3));
    const left = canvas.offsetLeft;
    this.layout.set({
      scale: scene.size.scale,
      left,
      width: scene.size.width,
      height: scene.size.height,
      crateX: scene.anchor('crate').x + left,
      rects: [0, 1, 2].map((i) => scene.slot(i)),
    });
  }

  private syncLoop(scene: WorkshopScene): void {
    if (this.visible && this.open()) scene.resume();
    else scene.pause();
  }

  private bam(): void {
    const scene = this.scene();
    if (!scene) return;
    const at = scene.anchor('press');
    this.burst.set([
      { n: ++this.burstCount, x: at.x + this.canvas().nativeElement.offsetLeft, y: at.y },
    ]);
  }

  private stop(): void {
    this.alive = false;
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    this.scene()?.destroy();
    this.scene.set(null);
  }
}
