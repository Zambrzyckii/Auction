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
import type { BlackjackRoom, BlackjackRoomOpts } from './blackjack-room';
import { DealStage } from './blackjack-stage';
import type { TableHand } from './blackjack-watch';
import { prefersReducedMotion, RoomHost, roomDeps } from './room-host';
import type { StreetBootDeps } from '../street/street-boot';

export function blackjackRoomDeps(): StreetBootDeps<BlackjackRoomOpts, BlackjackRoom> {
  return roomDeps<BlackjackRoomOpts, BlackjackRoom>(() =>
    import('./blackjack-room').then((m) => (canvas, opts) => new m.BlackjackRoom(canvas, opts)),
  );
}

@Component({
  selector: 'app-blackjack-scene',
  templateUrl: './blackjack-scene.html',
  host: { '[class.dealing]': 'dealing()' },
})
export class BlackjackScene {
  readonly hand = input<TableHand | null>(null);
  readonly chips = input<number | null>(null);

  protected readonly dealing = signal(false);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly room = signal<BlackjackRoom | null>(null);
  private readonly stage = new DealStage((on) => this.dealing.set(on));
  private readonly host = new RoomHost<BlackjackRoomOpts, BlackjackRoom>({
    frame: () => this.frame().nativeElement,
    canvas: () => this.canvas().nativeElement,
    deps: blackjackRoomDeps(),
    onVisible: (visible) => {
      if (!visible) this.stage.hidden();
    },
  });

  constructor() {
    effect(() => {
      const hand = this.hand();
      untracked(() => this.stage.see(hand, this.host.visible));
    });
    effect(() => {
      const hand = this.hand();
      this.room()?.setHand(hand);
    });
    effect(() => {
      const chips = this.chips();
      this.room()?.setChips(chips);
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
    const room = await this.host.start({ reduced, onIdle: () => this.stage.idle() });
    if (!room) return;
    this.stage.attach(room, this.hand(), reduced);
    this.room.set(room);
  }
}
