// The cashier's cage: the teller who counts chips, the bartender, the two players at the
// slots and the regular with his beer. The numbers come only from set(), the moves from playMove().
import type { Ramp } from '../street/pix';
import { R } from '../street/pix';
import type { CageMove } from './cage-watch';
import * as FL from './floor';
import type { Slot } from './floor';
import { GOLD, GREEN, PAPER, Room, clamp, faceOf, fmt } from './room';
import type { RoomOpts } from './room';
import { cage } from './rooms';
import * as SP from './sprites';

const PLATE_AT = [196, 108] as const;
const COMPLETED: Ramp = ['#173328', '#2a5a3c', '#4a8a4a', '#8cc063'];
const REJECTED: Ramp = ['#43142a', '#7a2034', '#b0383a', '#ff8a6a'];

export interface CageState {
  chips: number | null;
  cash: number | null;
  pending: boolean;
}

type Pt = [number, number];
interface Pose {
  l: Pt;
  r: Pt;
  shaker?: Pt;
  pour?: boolean;
  rag?: Pt;
}
interface Patron {
  body: ReturnType<typeof FL.seatedBack>;
  stool: { x: number; y: number };
  slot: Slot;
  x: number;
  y: number;
}
interface CageStamp {
  img: HTMLCanvasElement;
  at: number;
}

const ease = (shown: number, target: number, dt: number): number => {
  const next = shown + (target - shown) * clamp(dt * 6, 0, 1);
  return Math.abs(next - target) < 1 ? target : next;
};

// An eased LED shows whole numbers on the way and the server's exact decimals once it lands.
const ledNumber = (shown: number, target: number): string =>
  fmt(shown === target ? target : Math.round(shown));

const startFrom = (before: number | null, after: number | null, shown: number): number => {
  if (before === null && after !== null) return after;
  return shown;
};

function bartenderPose(T: number, reduced: boolean): Pose {
  const u = reduced ? 4 : T % 10;
  if (u < 2.2) {
    const o = Math.round(Math.sin(u * 28) * 3);
    return { l: [408, 101 + o], r: [418, 101 + o], shaker: [413, 93 + o] };
  }
  if (u < 3.4) return { l: [403, 116], r: [432, 104], shaker: [435, 97], pour: true };
  if (u >= 5 && u < 8) {
    const w = Math.round(Math.sin((u - 5) * 5) * 8);
    return { l: [399 + w, 119], r: [427, 116], rag: [396 + w, 120] };
  }
  return { l: [403, 116], r: [424, 116] };
}

export class CageRoom extends Room {
  readonly focusX = 240;

  private readonly layer = cage();
  private readonly teller = FL.person({
    skin: R.skinB,
    hair: 'slick',
    hairRamp: R.hair,
    top: R.white,
    neck: 'tie',
    tieRamp: R.sign,
    collar: true,
    garters: true,
    visor: true,
  });
  private readonly bartender = FL.person({
    skin: R.skinA,
    hair: 'pomp',
    hairRamp: R.hair,
    top: R.white,
    over: R.red,
    overKind: 'vest',
    neck: 'bow',
    tieRamp: R.black,
    collar: true,
  });
  private readonly patrons: Patron[];
  private readonly barGuy: {
    body: ReturnType<typeof FL.seatedBack>;
    stool: { x: number; y: number };
    x: number;
    y: number;
  };

  private chipsTarget: number | null = null;
  private cashTarget: number | null = null;
  private shownChips = 0;
  private shownCash = 0;
  private chipsHold: number | null = null;
  private flights = 0;
  private cagePending = false;
  private cageStamp: CageStamp | null = null;
  private stampSweep: ReturnType<typeof setTimeout> | undefined;
  private tellerBusy = -9;

  constructor(cv: HTMLCanvasElement, opts: RoomOpts = {}) {
    super(cv, opts);
    this.useRoom(this.layer);
    const st = this.layer.stools;
    this.patrons = [
      {
        body: FL.seatedBack({
          skin: R.skinC,
          hair: 'big',
          hairRamp: R.rust,
          top: SP.NEON,
          bottom: R.denim,
        }),
        stool: st[0],
        slot: this.slots[1],
        x: 0,
        y: 0,
      },
      {
        body: FL.seatedBack({
          skin: R.skinA,
          hair: 'cap',
          hairRamp: R.hair,
          capRamp: R.red,
          top: R.tan,
          bottom: R.denim,
        }),
        stool: st[1],
        slot: this.slots[2],
        x: 0,
        y: 0,
      },
    ];
    for (const p of this.patrons) {
      p.x = p.stool.x + 8 - p.body.cx;
      p.y = p.stool.y + 2 - 41;
    }
    const body = FL.seatedBack({
      skin: R.skinB,
      hair: 'bald',
      hairRamp: R.hair,
      top: R.olive,
      bottom: R.black,
      collar: R.white[2],
    });
    this.barGuy = {
      body,
      stool: st[3],
      x: st[3].x + 8 - body.cx,
      y: st[3].y + 2 - 41,
    };
  }

  protected get chipsLed(): string {
    if (this.chipsHold !== null) return 'CHIPS ' + fmt(this.chipsHold);
    if (this.chipsTarget === null) return 'CHIPS -';
    return 'CHIPS ' + ledNumber(this.shownChips, this.chipsTarget);
  }

  protected get cashLed(): string {
    if (this.cashTarget === null) return 'CASH -';
    return 'CASH $' + ledNumber(this.shownCash, this.cashTarget);
  }

  set(state: CageState): void {
    this.shownChips = startFrom(this.chipsTarget, state.chips, this.shownChips);
    this.shownCash = startFrom(this.cashTarget, state.cash, this.shownCash);
    this.chipsTarget = state.chips;
    this.cashTarget = state.cash;
    this.cagePending = state.pending;
    this.kickDraw();
  }

  playMove(move: Exclude<CageMove, null>): void {
    if (move.kind === 'pending') this.pending(move.amount);
    else if (move.kind === 'bought') this.bought();
    else if (move.kind === 'rejected') this.refused('REJECTED', REJECTED, move.amount);
    else if (move.kind === 'expired') this.refused('EXPIRED', SP.AMBER, move.amount);
    else this.cashout(move.amount);
  }

  override destroy(): void {
    clearTimeout(this.stampSweep);
    super.destroy();
  }

  private pending(amount: number): void {
    this.setPlate(
      [
        ['PENDING...', 'jersey', GOLD],
        ['Purchase of ' + fmt(amount) + ' chips', 'tiny', PAPER],
      ],
      PLATE_AT[0],
      PLATE_AT[1],
      1.7,
    );
  }

  private bought(): void {
    this.holdChips();
    this.tellerBusy = this.t;
    this.stampCage('COMPLETED', COMPLETED);
    for (let i = 0; i < 4; i++)
      this.fly(
        'p',
        240,
        114,
        44 + i * 3,
        186 - i * 2,
        0.45 + i * 0.1,
        i === 3
          ? () => {
              this.releaseChips();
              this.burst(60, 176, 10, 22);
            }
          : undefined,
      );
  }

  private refused(word: string, ramp: Ramp, amount: number): void {
    this.stampCage(word, ramp);
    this.setPlate(
      [['Purchase of ' + fmt(amount) + ' chips', 'tiny', PAPER]],
      PLATE_AT[0],
      PLATE_AT[1],
    );
  }

  private cashout(amount: number): void {
    this.tellerBusy = this.t;
    for (let i = 0; i < 3; i++)
      this.fly(i < 2 ? 'k' : 'g', 44 + i * 4, 186, 240, 114, 0.45 + i * 0.08);
    this.setPlate(
      [
        ['CASH OUT', 'tiny', PAPER],
        ['+$' + fmt(amount), 'jersey', GREEN],
      ],
      PLATE_AT[0],
      PLATE_AT[1],
    );
  }

  private holdChips(): void {
    if (this.chipsHold === null && this.chipsTarget !== null) {
      this.chipsHold = this.chipsTarget;
      this.shownChips = this.chipsTarget;
    }
    this.flights++;
  }

  private releaseChips(): void {
    this.flights--;
    if (this.flights === 0) this.chipsHold = null;
  }

  private stampCage(word: string, ramp: Ramp): void {
    this.cageStamp = { img: SP.stamp(word, ramp), at: this.t };
    if (this.reduced) {
      clearTimeout(this.stampSweep);
      this.stampSweep = setTimeout(() => {
        this.cageStamp = null;
        this.draw();
      }, 2800);
    }
    this.kickDraw();
  }

  protected override stepRoom(dt: number): void {
    if (this.chipsTarget !== null && this.chipsHold === null)
      this.shownChips = ease(this.shownChips, this.chipsTarget, dt);
    if (this.cashTarget !== null) this.shownCash = ease(this.shownCash, this.cashTarget, dt);
  }

  protected override finishAll(): void {
    this.snapLeds();
  }

  private snapLeds(): void {
    if (this.chipsTarget !== null) this.shownChips = this.chipsTarget;
    if (this.cashTarget !== null) this.shownCash = this.cashTarget;
  }

  private drawBartender(T: number): void {
    const b = this.layer.bartender,
      [[ex0, ey0], [ex1, ey1]] = this.bartender.elbows,
      p = bartenderPose(T, this.reduced),
      S = this.s,
      c = this.ctx;
    if (p.rag) {
      c.fillStyle = '#f6f3f6';
      c.fillRect(p.rag[0] * S, p.rag[1] * S, 6 * S, 2 * S);
    }
    FL.limb(this, [[b.x + ex0, b.y + ey0], p.l], this.bartender.sleeve);
    FL.hand(this, p.l[0], p.l[1], this.bartender.skin);
    FL.limb(this, [[b.x + ex1, b.y + ey1], p.r], this.bartender.sleeve);
    if (p.shaker) this.img(FL.shaker, p.shaker[0] - 2, p.shaker[1] - 4);
    FL.hand(this, p.r[0], p.r[1], this.bartender.skin);
    if (p.pour && !this.reduced) {
      c.fillStyle = '#ff7fd2';
      c.fillRect(437 * S, 101 * S, S, 13 * S);
    }
  }

  private drawPatron(p: Patron, T: number): void {
    this.img(FL.stool, p.stool.x, p.stool.y);
    this.img(p.body.img, p.x, p.y);
    const [[sx0, sy0], [sx1, sy1]] = p.body.shoulders,
      L = [p.x + sx0, p.y + sy0],
      Rr = [p.x + sx1, p.y + sy1];
    const sl = p.slot;
    if (!this.reduced && sl.winning()) {
      const up = Math.round(Math.sin(T * 9) * 2);
      FL.limb(this, [L, [L[0] - 4, L[1] - 10], [L[0] - 2, L[1] - 21 + up]], p.body.sleeve);
      FL.hand(this, L[0] - 2, L[1] - 22 + up, p.body.skin);
      FL.limb(this, [Rr, [Rr[0] + 4, Rr[1] - 10], [Rr[0] + 2, Rr[1] - 21 - up]], p.body.sleeve);
      FL.hand(this, Rr[0] + 2, Rr[1] - 22 - up, p.body.skin);
      return;
    }
    if (!this.reduced && sl.armOut()) {
      const [kx, ky] = sl.knob();
      const ex = (Rr[0] + kx) / 2 + 3,
        ey = (Rr[1] + ky) / 2 - 4;
      FL.limb(this, [Rr, [ex, ey], [kx, ky + 1]], p.body.sleeve);
      FL.hand(this, kx, ky + 1, p.body.skin);
    }
  }

  private drawBarGuy(T: number): void {
    const g = this.barGuy,
      sip = !this.reduced && T % 8 > 5.6 && T % 8 < 7.4;
    this.img(FL.stool, g.stool.x, g.stool.y);
    if (!sip) this.img(FL.beer, 452, 113);
    this.img(g.body.img, g.x, g.y);
    if (sip) {
      const [, [sx1, sy1]] = g.body.shoulders,
        sh = [g.x + sx1, g.y + sy1];
      FL.limb(this, [sh, [sh[0] + 6, sh[1] - 7], [sh[0] - 1, sh[1] - 12]], g.body.sleeve);
      this.img(FL.beer, sh[0] - 4, sh[1] - 18);
      FL.hand(this, sh[0] - 1, sh[1] - 12, g.body.skin);
    }
  }

  private drawStamp(T: number): void {
    if (!this.cageStamp) return;
    const age = T - this.cageStamp.at;
    if (!this.reduced && age > 2.4) {
      this.cageStamp = null;
      return;
    }
    const S = this.s,
      img = this.cageStamp.img;
    const k = this.reduced ? 1 : clamp(age / 0.14, 0, 1);
    const w = img.width * (1.6 - 0.6 * k),
      h = img.height * (1.6 - 0.6 * k);
    this.ctx.drawImage(
      img,
      Math.round(286 - w / 2) * S,
      Math.round(86 - h / 2) * S,
      Math.round(w) * S,
      Math.round(h) * S,
    );
  }

  protected draw(): void {
    const c = this.ctx,
      T = this.t,
      CAGE = this.layer;
    if (this.reduced || this.paused) this.snapLeds();
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    this.img(CAGE.back, 0, 0);
    this.drawNeon();
    this.drawRings();
    this.drawSlots();
    this.img(SP.led(this.chipsLed), CAGE.ledLeft.x, CAGE.ledLeft.y);
    this.img(SP.led(this.cashLed, SP.AMBER), CAGE.ledRight.x, CAGE.ledRight.y);
    if (this.cagePending && Math.floor(T * 3) % 2 === 0) this.text('COUNTING...', 212, 100, GOLD);
    const tp = CAGE.teller,
      [[ex0, ey0], [ex1, ey1]] = this.teller.elbows;
    this.img(faceOf(this.teller, T, 7, this.reduced), tp.x, tp.y);
    const counting = !this.reduced && (this.cagePending || T - this.tellerBusy < 0.7);
    const bob = counting ? Math.sin(T * 20) : 0;
    const lh = [tp.x + ex0 + 3, tp.y + ey0 + 7 - Math.round(Math.max(0, bob) * 3)];
    const rh = [tp.x + ex1 - 3, tp.y + ey1 + 7 - Math.round(Math.max(0, -bob) * 3)];
    FL.limb(this, [[tp.x + ex0, tp.y + ey0], lh], this.teller.sleeve);
    FL.hand(this, lh[0], lh[1], this.teller.skin);
    FL.limb(this, [[tp.x + ex1, tp.y + ey1], rh], this.teller.sleeve);
    FL.hand(this, rh[0], rh[1], this.teller.skin);
    this.img(faceOf(this.bartender, T, 5, this.reduced), CAGE.bartender.x, CAGE.bartender.y);
    this.img(CAGE.front, 0, 0);
    this.drawBartender(T);
    this.img(FL.stool, CAGE.stools[2].x, CAGE.stools[2].y);
    for (const p of this.patrons) this.drawPatron(p, T);
    this.drawBarGuy(T);
    this.img(CAGE.ledge, 0, 0);
    this.stacks(this.chipsHold ?? this.chipsTarget ?? 0, CAGE.stacks.x, CAGE.stacks.y);
    this.drawFliers();
    this.drawStamp(T);
    this.drawSparkles();
    this.drawPlate();
  }
}
