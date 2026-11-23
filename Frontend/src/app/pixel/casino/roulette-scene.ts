import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { RouletteRoom, RouletteRoomOpts } from './roulette-room';
import { SpinStage } from './roulette-stage';
import { FeltBet, SpinView, ToteSpin } from './roulette-watch';
import { prefersReducedMotion, RoomHost, roomDeps } from './room-host';
import type { StreetBootDeps } from '../street/street-boot';

export function rouletteRoomDeps(): StreetBootDeps<RouletteRoomOpts, RouletteRoom> {
  return roomDeps<RouletteRoomOpts, RouletteRoom>(() =>
    import('./roulette-room').then((m) => (canvas, opts) => new m.RouletteRoom(canvas, opts)),
  );
}

@Component({
  selector: 'app-roulette-scene',
  templateUrl: './roulette-scene.html',
  host: { '[class.rolling]': 'rolling()' },
})
export class RouletteScene {
  readonly bets = input<readonly FeltBet[]>([]);
  readonly spin = input<SpinView | null>(null);
  readonly history = input<readonly ToteSpin[] | null>(null);
  readonly chips = input<number | null>(null);

  protected readonly rolling = signal(false);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly room = signal<RouletteRoom | null>(null);
  private readonly stage = new SpinStage((on) => this.rolling.set(on));
  private readonly host = new RoomHost<RouletteRoomOpts, RouletteRoom>({
    frame: () => this.frame().nativeElement,
    canvas: () => this.canvas().nativeElement,
    deps: rouletteRoomDeps(),
    onVisible: (visible) => {
      if (!visible) this.stage.hidden();
    },
  });

  constructor() {
    effect(() => {
      const spin = this.spin();
      untracked(() => this.stage.see(spin, this.host.visible));
    });
    effect(() => {
      const bets = this.bets();
      this.room()?.setBets(bets);
    });
    effect(() => {
      const chips = this.chips();
      this.room()?.setChips(chips);
    });
    effect(() => {
      const pockets = this.history()?.map((s) => s.pocket) ?? [];
      this.room()?.setHistory(pockets);
    });
    afterNextRender(() => void this.boot());
    inject(DestroyRef).onDestroy(() => {
      this.stage.stop();
      this.host.stop();
      this.room.set(null);
    });
  }

  private async boot(): Promise<void> {
    const reduced = prefersReducedMotion();
    const room = await this.host.start({ reduced, onSettled: () => this.stage.settled() });
    if (!room) return;
    this.stage.attach(room, this.spin(), reduced);
    this.room.set(room);
  }
}
