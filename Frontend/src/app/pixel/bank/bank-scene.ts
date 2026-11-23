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
import type { BankRoom, BankRoomOpts } from './bank-room';
import { BankStage } from './bank-stage';
import type { BankLoan, BankOffer, BankWallet, DueFormat, WireRow } from './bank-watch';
import { prefersReducedMotion, RoomHost, roomDeps } from '../casino/room-host';
import type { StreetBootDeps } from '../street/street-boot';

export function bankRoomDeps(): StreetBootDeps<BankRoomOpts, BankRoom> {
  return roomDeps<BankRoomOpts, BankRoom>(() =>
    import('./bank-room').then((m) => (canvas, opts) => new m.BankRoom(canvas, opts)),
  );
}

@Component({
  selector: 'app-bank-scene',
  templateUrl: './bank-scene.html',
  host: { '[class.staging]': 'staging()' },
})
export class BankScene {
  readonly focus = input<'loans' | 'wires'>('loans');
  readonly loans = input<readonly BankLoan[] | null>(null);
  readonly wallet = input<BankWallet | null>(null);
  readonly offers = input<readonly BankOffer[] | null>(null);
  readonly asked = input(false);
  readonly format = input<DueFormat | null>(null);
  readonly wires = input<readonly WireRow[] | null>(null);
  readonly me = input<string | null>(null);

  protected readonly staging = signal(false);

  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly room = signal<BankRoom | null>(null);
  private readonly stage = new BankStage((on) => this.staging.set(on));
  private readonly host = new RoomHost<BankRoomOpts, BankRoom>({
    frame: () => this.frame().nativeElement,
    canvas: () => this.canvas().nativeElement,
    deps: bankRoomDeps(),
    onVisible: (visible) => {
      if (!visible) this.stage.hidden();
    },
  });

  constructor() {
    effect(() => {
      const loans = this.loans();
      untracked(() => this.stage.seeLoans(loans, this.host.visible));
    });
    effect(() => {
      const wires = this.wires();
      const me = this.me();
      untracked(() => this.stage.seeWires(wires, me, this.host.visible));
    });
    effect(() => {
      const asked = this.asked();
      untracked(() => this.stage.ask(asked));
    });
    effect(() => {
      const wallet = this.wallet();
      this.room()?.setWallet(wallet);
    });
    effect(() => {
      const offers = this.offers();
      this.room()?.setOffers(offers);
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
      focus: this.focus(),
      format: this.format(),
      onReveal: () => this.stage.revealed(),
      onIdle: () => this.stage.idle(),
    });
    if (!room) return;
    this.stage.attach(room, reduced);
    this.room.set(room);
  }
}
