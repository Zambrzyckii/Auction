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
import type { CageRoom, CageState } from './cage-room';
import { CageCasino, CageSnap, cageMove, cageSnap } from './cage-watch';
import { prefersReducedMotion, RoomDeps, RoomHost, roomDeps } from './room-host';
import type { RoomOpts } from './room';

export function cageRoomDeps(): RoomDeps<RoomOpts, CageRoom> {
  return roomDeps<RoomOpts, CageRoom>(() =>
    import('./cage-room').then((m) => (canvas, opts) => new m.CageRoom(canvas, opts)),
  );
}

function cageState(casino: CageCasino | null, cash: number | null): CageState {
  return {
    chips: casino?.balance ?? null,
    cash,
    pending: casino?.latestPurchase?.status === 'Pending',
  };
}

@Component({
  selector: 'app-cage-scene',
  templateUrl: './cage-scene.html',
})
export class CageScene {
  readonly casino = input<CageCasino | null>(null);
  readonly cash = input<number | null>(null);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly room = signal<CageRoom | null>(null);
  private readonly host = new RoomHost<RoomOpts, CageRoom>({
    frame: () => this.frame().nativeElement,
    canvas: () => this.canvas().nativeElement,
    deps: cageRoomDeps(),
  });

  private snap: CageSnap | null = null;
  private fed: CageRoom | null = null;

  constructor() {
    effect(() => {
      const casino = this.casino();
      const cash = this.cash();
      const room = this.room();
      untracked(() => this.follow(casino, cash, room));
    });
    afterNextRender(() => void this.boot());
    inject(DestroyRef).onDestroy(() => {
      this.host.stop();
      this.room.set(null);
    });
  }

  private async boot(): Promise<void> {
    const room = await this.host.start({ reduced: prefersReducedMotion() });
    if (room) this.room.set(room);
  }

  private follow(casino: CageCasino | null, cash: number | null, room: CageRoom | null): void {
    const before = this.snap;
    const now = casino ? cageSnap(casino) : null;
    this.snap = now;
    if (!room) return;
    const move = room === this.fed && now ? cageMove(before, now) : null;
    this.fed = room;
    if (move) room.play(move);
    room.set(cageState(casino, cash));
  }
}
