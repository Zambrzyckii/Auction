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
import type { PawnshopRoom, PawnshopRoomOpts } from './pawnshop-room';
import { PawnshopStage } from './pawnshop-stage';
import type { PawnOffers, PawnState, PawnTier } from './pawnshop-watch';
import { prefersReducedMotion, RoomHost, roomDeps } from '../casino/room-host';
import type { StreetBootDeps } from '../street/street-boot';

export function pawnshopRoomDeps(): StreetBootDeps<PawnshopRoomOpts, PawnshopRoom> {
  return roomDeps<PawnshopRoomOpts, PawnshopRoom>(() =>
    import('./pawnshop-room').then((m) => (canvas, opts) => new m.PawnshopRoom(canvas, opts)),
  );
}

@Component({
  selector: 'app-pawnshop-scene',
  templateUrl: './pawnshop-scene.html',
  host: { '[class.staging]': 'staging()' },
})
export class PawnshopScene {
  readonly shop = input<PawnState | null>(null);
  readonly offers = input<PawnOffers | null>(null);
  readonly upgrades = input<readonly PawnTier[]>([]);
  readonly canBuy = input(false);

  protected readonly staging = signal(false);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly room = signal<PawnshopRoom | null>(null);
  private readonly stage = new PawnshopStage((on) => this.staging.set(on));
  private readonly host = new RoomHost<PawnshopRoomOpts, PawnshopRoom>({
    frame: () => this.frame().nativeElement,
    canvas: () => this.canvas().nativeElement,
    deps: pawnshopRoomDeps(),
    onVisible: (visible) => {
      if (!visible) this.stage.hidden();
    },
  });

  constructor() {
    effect(() => {
      const shop = this.shop();
      untracked(() => this.stage.see(shop, this.host.visible));
    });
    effect(() => {
      const offers = this.offers();
      this.room()?.setOffers(offers);
    });
    effect(() => {
      const upgrades = this.upgrades();
      this.room()?.setUpgrades(upgrades);
    });
    effect(() => {
      const canBuy = this.canBuy();
      this.room()?.setCanBuy(canBuy);
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
    const room = await this.host.start({
      reduced,
      onReveal: () => this.stage.revealed(),
      onIdle: () => this.stage.idle(),
    });
    if (!room) return;
    room.setOffers(this.offers());
    room.setUpgrades(this.upgrades());
    room.setCanBuy(this.canBuy());
    this.stage.attach(room, reduced);
    this.room.set(room);
  }
}
