// The blackjack room: the dealer behind the half-moon table, the shoe, the discard holder, the
// chip tray, the pit boss and the bar corner. The server deals and pays. The room only plays the
// steps it is given, one after another, and never computes a total or a payout.
import { INK, R } from '../street/pix';
import type { BjStep, TableHand } from './blackjack-watch';
import * as FL from './floor';
import {
  ART_H,
  ART_W,
  GOLD,
  GREEN,
  PAPER,
  REDL,
  Room,
  clamp,
  easeOut,
  faceOf,
  flipX,
  fmt,
  walkerAt,
} from './room';
import type { RoomOpts } from './room';
import { blackjack } from './rooms';
import * as SP from './sprites';
import type { PlateLine } from './sprites';

const STEP_X = 18;
const { CW, CH } = SP;
const CARD_GAP = 0.34;
const DEALER_GAP = 0.45;
const SETTLE_HOLD = 1.4;
const PLATE_AT = [392, 174] as const;

export interface BlackjackRoomOpts extends RoomOpts {
  onIdle?: () => void;
}

type Row = 'player' | 'dealer';
type Phase = 'slide' | 'flip' | 'fly' | 'land' | 'rest' | 'reveal' | 'sweep';
type Pt = [number, number];
type Settle = Extract<BjStep, { kind: 'settle' }>;

interface BjCard {
  code: number;
  hidden: boolean;
  row: Row;
  x: number;
  y: number;
  vx: number;
  vy: number;
  h: number;
  w: number;
  deg: number;
  vdeg: number;
  tdeg: number;
  tx: number;
  ty: number;
  i: number;
  fx: number;
  fy: number;
  face: boolean;
  phase: Phase;
  t0: number;
  landed: boolean;
  seed: number;
  hover: boolean;
  shake: number;
  gone: boolean;
  onLand: (() => void) | null;
}
interface Reach {
  at: Pt;
  until: number;
}

function headline(step: Settle): string {
  if (step.outcome === 'Blackjack') return 'BLACKJACK';
  if (step.outcome === 'Win') return 'WIN';
  if (step.outcome === 'Push') return 'PUSH';
  return step.bust ? 'BUST' : 'DEALER WINS';
}

function toneOf(net: number, natural: boolean): string {
  if (net > 0) return natural ? GOLD : GREEN;
  if (net < 0) return REDL;
  return PAPER;
}

function netLine(net: number): string {
  if (net === 0) return 'STAKE BACK';
  if (net > 0) return '+' + fmt(net);
  return '-' + fmt(-net);
}

function plateOf(step: Settle, net: number): PlateLine[] {
  const lines: PlateLine[] = [
    [headline(step), 'jersey', toneOf(net, step.outcome === 'Blackjack')],
    [netLine(net), 'tiny', PAPER],
  ];
  if (step.autoStood) lines.push(['AUTO-STOOD', 'tiny', PAPER]);
  return lines;
}

const isMoving = (c: BjCard): boolean => c.phase !== 'rest';

export class BlackjackRoom extends Room {
  readonly focusX = 240;

  private readonly layer = blackjack();
  private readonly dealer = FL.person({
    skin: R.skinA,
    hair: 'slick',
    hairRamp: R.hair,
    top: R.white,
    over: R.black,
    overKind: 'vest',
    neck: 'bow',
    collar: true,
    garters: true,
    tag: true,
  });
  private readonly boss = FL.person({
    skin: R.skinB,
    hair: 'bald',
    hairRamp: R.hair,
    top: R.white,
    over: R.black,
    overKind: 'jacket',
    neck: 'tie',
    tieRamp: R.red,
    collar: true,
    mustache: true,
  });
  private readonly waitL = FL.waitress().map(flipX);
  private readonly onIdle: (() => void) | undefined;
  private readonly onMove = (ev: MouseEvent): void => this.hoverAt(ev);
  private readonly onLeave = (): void => {
    for (const c of this.cards) c.hover = false;
  };

  private cards: BjCard[] = [];
  private queue: BjStep[] = [];
  private busy = false;
  private timers = 0;
  private flights = 0;
  private flightWaiter: (() => void) | null = null;
  private restWaiter: (() => void) | null = null;
  private gen = 0;
  private pendingRun = false;
  private dead = false;
  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private circle = 0;
  private circleClosed = false;
  private dealerOpen = false;
  private seedN = 0;
  private reach: Reach | null = null;
  private handR = { x: 257, y: 103 };
  private handL = { x: 223, y: 103 };
  private hand: TableHand | null = null;
  private chipsNow: number | null = null;
  private chipsShown: number | null = null;

  constructor(cv: HTMLCanvasElement, opts: BlackjackRoomOpts = {}) {
    super(cv, opts);
    this.onIdle = opts.onIdle;
    this.useRoom(this.layer);
    if (!this.reduced) for (let d = -18; d <= 18; d += 1) SP.card(-1, d);
    if (!this.reduced) {
      cv.addEventListener('mousemove', this.onMove);
      cv.addEventListener('mouseleave', this.onLeave);
    }
  }

  get idle(): boolean {
    return (
      !this.busy &&
      this.queue.length === 0 &&
      this.timers === 0 &&
      this.flights === 0 &&
      !this.cards.some(isMoving)
    );
  }

  get felt(): { player: number[]; dealer: number[]; hole: boolean; circle: number } {
    const on = this.cards.filter((c) => c.phase !== 'sweep' && !c.gone);
    const codes = (row: Row) =>
      on.filter((c) => c.row === row).map((c) => (c.hidden ? -1 : c.code));
    return {
      player: codes('player'),
      dealer: codes('dealer'),
      hole: on.some((c) => c.row === 'dealer' && c.hidden),
      circle: this.circle,
    };
  }

  protected get instant(): boolean {
    return this.reduced || this.paused;
  }

  protected get chipsLed(): string {
    if (this.chipsShown === null) return 'CHIPS -';
    return 'CHIPS ' + fmt(this.chipsShown);
  }

  protected get autoStandLed(): string | null {
    const h = this.hand;
    if (!h || h.status !== 'InProgress' || h.autoStandOn === null || !this.idle) return null;
    const until = Date.parse(h.autoStandOn);
    if (Number.isNaN(until)) return null;
    const left = Math.max(0, until - Date.now());
    const mm = Math.floor(left / 60000),
      ss = Math.floor((left % 60000) / 1000);
    return `AUTO-STAND ${mm}:${String(ss).padStart(2, '0')}`;
  }

  protected get totals(): { player: string | null; dealer: string | null } {
    const h = this.hand;
    if (!h) return { player: null, dealer: null };
    return { player: this.playerLabel(h), dealer: this.dealerLabel(h) };
  }

  protected get hovered(): number[] {
    return this.cards.filter((c) => c.hover).map((c) => c.code);
  }

  run(steps: readonly BjStep[]): void {
    if (this.dead || steps.length === 0) return;
    this.pendingRun = true;
    this.queue.push(...steps);
    this.pump();
    this.kickDraw();
    this.checkIdle();
  }

  place(hand: TableHand | null): void {
    if (this.dead) return;
    this.gen++;
    this.queue = [];
    this.busy = false;
    this.timers = 0;
    this.flights = 0;
    this.flightWaiter = null;
    this.restWaiter = null;
    this.pendingRun = false;
    this.cards = [];
    this.reach = null;
    this.circle = 0;
    this.circleClosed = false;
    this.dealerOpen = false;
    if (hand) this.lay(hand);
    this.chipsShown = this.chipsNow;
    this.kickDraw();
  }

  setChips(chips: number | null): void {
    if (this.dead) return;
    this.chipsNow = chips;
    if (this.chipsShown === null) this.chipsShown = chips;
    this.kickDraw();
  }

  setHand(hand: TableHand | null): void {
    if (this.dead) return;
    this.hand = hand;
    this.kickDraw();
  }

  protected override kickDraw(): void {
    super.kickDraw();
    this.syncClock();
  }

  private syncClock(): void {
    if (!this.reduced || this.dead || this.autoStandLed === null) {
      clearInterval(this.clockTimer);
      this.clockTimer = undefined;
      return;
    }
    this.clockTimer ??= setInterval(() => {
      if (!this.paused) this.draw();
    }, 1000);
  }

  override destroy(): void {
    this.dead = true;
    clearInterval(this.clockTimer);
    this.clockTimer = undefined;
    this.cv.removeEventListener('mousemove', this.onMove);
    this.cv.removeEventListener('mouseleave', this.onLeave);
    super.destroy();
  }

  // ----- queue -----
  private pump(): void {
    if (this.busy) return;
    const step = this.queue.shift();
    if (!step) return;
    this.busy = true;
    this.exec(step);
  }

  private next(wait: number): void {
    if (wait <= 0) {
      this.busy = false;
      this.pump();
      return;
    }
    this.later(wait, () => {
      this.busy = false;
      this.pump();
    });
  }

  private later(delay: number, fn: () => void): void {
    const gen = this.gen;
    this.timers++;
    this.schedule(delay, () => {
      if (gen !== this.gen) return;
      this.timers--;
      fn();
    });
  }

  private checkIdle(): void {
    if (!this.pendingRun || !this.idle) return;
    this.pendingRun = false;
    this.onIdle?.();
  }

  private exec(step: BjStep): void {
    if (step.kind === 'sweep') return this.sweep();
    if (step.kind === 'stake') return this.stake(step.amount);
    if (step.kind === 'card') return this.dealCard(step.row, step.code, false);
    if (step.kind === 'hole') return this.dealCard('dealer', -1, true);
    if (step.kind === 'reveal') return this.whenResting(() => this.reveal(step.code));
    return this.whenResting(() => this.settle(step));
  }

  private stake(amount: number): void {
    this.clearPlate();
    this.circle = amount;
    this.next(0);
  }

  private dealCard(row: Row, code: number, hidden: boolean): void {
    this.spawnCard(code, hidden, row);
    this.next(row === 'dealer' && this.dealerOpen ? DEALER_GAP : CARD_GAP);
  }

  private sweep(): void {
    this.clearPlate();
    this.dealerOpen = false;
    const list = this.cards.filter((c) => c.phase !== 'sweep');
    if (this.instant || list.length === 0) {
      this.cards = [];
      this.next(0);
      return;
    }
    list.forEach((c, i) =>
      this.later(i * 0.05, () => {
        c.phase = 'sweep';
        c.t0 = this.t;
        c.fx = c.x;
        c.fy = c.y;
        c.tdeg = 0;
      }),
    );
    this.next(0.5 + list.length * 0.05);
  }

  private reveal(code: number): void {
    const hole = this.cards.find((c) => c.row === 'dealer' && c.hidden);
    this.dealerOpen = true;
    if (!hole) {
      this.next(0);
      return;
    }
    hole.code = code;
    const go = () => {
      if (this.instant) {
        hole.hidden = false;
        hole.face = true;
        hole.phase = 'rest';
        this.next(0);
        return;
      }
      this.reach = { at: [Math.round(hole.x) - 4, Math.round(hole.y) - 8], until: this.t + 0.45 };
      this.later(0.15, () => {
        hole.phase = 'reveal';
        hole.t0 = this.t;
      });
      this.later(0.5, () => {
        hole.hidden = false;
      });
      this.next(0.5);
    };
    if (hole.landed || this.instant) go();
    else hole.onLand = go;
  }

  // ----- settle -----
  private settle(step: Settle): void {
    const net = step.payout - step.stake;
    this.circleClosed = false;
    this.setPlate(plateOf(step, net), PLATE_AT[0], PLATE_AT[1], 2.6);
    if (net > 0) this.payWin(step, net);
    if (net < 0) this.takeLoss(step);
    this.later(SETTLE_HOLD, () => {
      this.emptyCircle();
      this.whenFlightsDone(() => this.next(0));
    });
  }

  private payWin(step: Settle, net: number): void {
    const L = this.layer,
      natural = step.outcome === 'Blackjack';
    for (let i = 0; i < Math.min(5, Math.ceil(net / 25)); i++)
      this.chipFlight(
        SP.chipKeyFor(net),
        L.tray.x,
        L.tray.y,
        L.circle.x + i * 2,
        L.circle.y,
        0.42 + i * 0.07,
        i === 0 ? () => this.fillCircle(step.payout) : undefined,
      );
    this.burst(L.playerRow.cx, L.playerRow.y - 6, natural ? 16 : 8, natural ? 40 : 24);
  }

  private takeLoss(step: Settle): void {
    const L = this.layer;
    if (step.bust) for (const c of this.cards) if (c.row === 'player') c.shake = this.t;
    for (let i = 0; i < Math.min(4, Math.ceil(step.stake / 25)); i++)
      this.chipFlight(
        SP.chipKeyFor(step.stake),
        L.circle.x,
        L.circle.y,
        L.tray.x,
        L.tray.y,
        0.42 + i * 0.07,
      );
    this.circle = 0;
  }

  private fillCircle(amount: number): void {
    if (!this.circleClosed) this.circle = amount;
  }

  private emptyCircle(): void {
    this.circleClosed = true;
    if (this.circle <= 0) return;
    const L = this.layer;
    for (let i = 0; i < 3; i++)
      this.chipFlight(SP.chipKeyFor(this.circle), L.circle.x, L.circle.y, 40, 190, 0.45 + i * 0.08);
    this.circle = 0;
  }

  private chipFlight(
    key: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    dur: number,
    onEnd?: () => void,
  ): void {
    const gen = this.gen;
    this.flights++;
    this.fly(key, x0, y0, x1, y1, dur, () => {
      if (gen !== this.gen) return;
      this.flights--;
      onEnd?.();
      if (this.flights === 0) this.releaseWaiter();
    });
  }

  private whenResting(fn: () => void): void {
    if (this.cards.some(isMoving)) this.restWaiter = fn;
    else fn();
  }

  private releaseRest(): void {
    const fn = this.restWaiter;
    if (!fn || this.cards.some(isMoving)) return;
    this.restWaiter = null;
    fn();
  }

  private whenFlightsDone(fn: () => void): void {
    if (this.flights === 0) fn();
    else this.flightWaiter = fn;
  }

  private releaseWaiter(): void {
    const fn = this.flightWaiter;
    this.flightWaiter = null;
    fn?.();
  }

  // ----- cards -----
  private newCard(code: number, hidden: boolean, row: Row): BjCard {
    const c: BjCard = {
      code,
      hidden,
      row,
      x: this.layer.shoe.x + 6,
      y: this.layer.shoe.y,
      vx: 0,
      vy: 0,
      h: 0,
      w: CW,
      deg: 0,
      vdeg: 0,
      tdeg: 0,
      tx: 0,
      ty: 0,
      i: 0,
      fx: 0,
      fy: 0,
      face: false,
      phase: 'slide',
      t0: this.t,
      landed: false,
      seed: (this.seedN += 1.7),
      hover: false,
      shake: -9,
      gone: false,
      onLand: null,
    };
    this.cards.push(c);
    return c;
  }

  private spawnCard(code: number, hidden: boolean, row: Row): void {
    const c = this.newCard(code, hidden, row);
    this.relayout();
    if (!this.instant) return;
    this.settleCard(c);
    this.snapAll();
  }

  private lay(hand: TableHand): void {
    for (const code of hand.playerCards) this.newCard(code, false, 'player');
    for (const code of hand.dealerCards.slice(0, 1)) this.newCard(code, false, 'dealer');
    if (hand.dealerHidden) this.newCard(-1, true, 'dealer');
    else for (const code of hand.dealerCards.slice(1)) this.newCard(code, false, 'dealer');
    this.relayout();
    for (const c of this.cards) this.settleCard(c);
    this.snapAll();
    this.dealerOpen = !hand.dealerHidden;
    this.circle = hand.status === 'Completed' ? 0 : hand.stake;
  }

  private settleCard(c: BjCard): void {
    if (c.phase === 'sweep') {
      c.gone = true;
      return;
    }
    c.phase = 'rest';
    c.w = CW;
    c.h = 0;
    c.face = !c.hidden;
    c.landed = true;
    const f = c.onLand;
    c.onLand = null;
    f?.();
  }

  private snapAll(): void {
    for (const c of this.cards) {
      if (c.phase === 'sweep') continue;
      c.x = c.tx;
      c.y = c.ty;
      c.deg = c.tdeg;
      c.vx = c.vy = c.vdeg = 0;
    }
  }

  private relayout(): void {
    for (const row of ['dealer', 'player'] as const) {
      const list = this.cards.filter((c) => c.row === row && c.phase !== 'sweep');
      const n = list.length,
        anchor = row === 'dealer' ? this.layer.dealerRow : this.layer.playerRow;
      const x0 = anchor.cx - (CW + (n - 1) * STEP_X) / 2 + CW / 2;
      list.forEach((c, i) => {
        c.i = i;
        c.tx = x0 + i * STEP_X;
        const mid = i - (n - 1) / 2;
        c.ty = anchor.y + (row === 'player' ? Math.round(mid * mid * 0.8) : 0);
        c.tdeg = row === 'player' ? Math.round(mid * 4) : 0;
      });
    }
  }

  private spring(c: BjCard, dt: number, kx: number, cxD: number, kd: number, cd: number): void {
    for (let t = 0; t < dt; t += 1 / 240) {
      const h = Math.min(1 / 240, dt - t);
      if (kx) {
        c.vx += (kx * (c.tx - c.x) - cxD * c.vx) * h;
        c.vy += (kx * (c.ty - c.y) - cxD * c.vy) * h;
        c.x += c.vx * h;
        c.y += c.vy * h;
      }
      const tgt = c.tdeg + (c.hover ? 3 : 0);
      c.vdeg += (kd * (tgt - c.deg) - cd * c.vdeg) * h;
      c.deg += c.vdeg * h;
    }
  }

  private jiggle(row: Row, except: BjCard): void {
    for (const o of this.cards)
      if (o !== except && o.row === row && o.phase === 'rest')
        o.vdeg += (Math.random() < 0.5 ? -1 : 1) * 55;
  }

  private stepCard(c: BjCard, dt: number): void {
    const T = this.t,
      age = T - c.t0,
      shoe = this.layer.shoe;
    switch (c.phase) {
      case 'slide': {
        const u = clamp(age / 0.09, 0, 1);
        c.x = shoe.x + 6 - 12 * easeOut(u);
        if (u >= 1) {
          c.phase = c.hidden ? 'fly' : 'flip';
          c.t0 = T;
          c.fx = c.x;
          c.fy = c.y;
          if (c.hidden) {
            c.deg = -16;
            c.vdeg = 30;
          }
        }
        break;
      }
      case 'flip': {
        const u = clamp(age / 0.14, 0, 1);
        c.w = Math.max(2, Math.round(CW * Math.abs(1 - 2 * u)));
        c.face = u >= 0.5;
        c.x = c.fx - 6 * easeOut(u);
        if (u >= 1) {
          c.w = CW;
          c.phase = 'fly';
          c.t0 = T;
          c.fx = c.x;
          c.fy = c.y;
          c.deg = -16;
          c.vdeg = 30;
        }
        break;
      }
      case 'fly': {
        const u = clamp(age / 0.36, 0, 1),
          e = 1 - (1 - u) * (1 - u);
        const mx = (c.fx + c.tx) / 2,
          my = Math.min(c.fy, c.ty) - 22;
        c.x = (1 - e) * (1 - e) * c.fx + 2 * (1 - e) * e * mx + e * e * c.tx;
        c.y = (1 - e) * (1 - e) * c.fy + 2 * (1 - e) * e * my + e * e * c.ty;
        c.h = Math.sin(Math.PI * u) * 7;
        this.spring(c, dt, 0, 0, 170, 12);
        if (u >= 1) {
          c.phase = 'land';
          c.t0 = T;
          c.vx = 0;
          c.vy = 0;
          this.jiggle(c.row, c);
        }
        break;
      }
      case 'land': {
        const v = clamp(age / 0.24, 0, 1);
        c.h = -2.2 * Math.sin(Math.PI * v) * (1 - v);
        this.spring(c, dt, 260, 30, 170, 12);
        if (v >= 1) {
          c.phase = 'rest';
          c.h = 0;
          c.landed = true;
          const f = c.onLand;
          c.onLand = null;
          f?.();
        }
        break;
      }
      case 'rest': {
        this.spring(c, dt, 220, 26, 200, 14);
        c.h += ((c.hover ? 3 : 0) - c.h) * clamp(dt * 14, 0, 1);
        break;
      }
      case 'reveal': {
        const u = clamp(age / 0.3, 0, 1);
        c.w = Math.max(2, Math.round(CW * Math.abs(1 - 2 * u)));
        c.face = u >= 0.5;
        c.h = Math.sin(Math.PI * u) * 5;
        if (u >= 1) {
          c.w = CW;
          c.h = 0;
          c.phase = 'rest';
          c.hidden = false;
          c.vdeg = 40;
        }
        break;
      }
      case 'sweep': {
        const u = clamp(age / 0.32, 0, 1),
          e = easeOut(u);
        c.x = c.fx + (this.layer.discard.x - c.fx) * e;
        c.y = c.fy + (this.layer.discard.y - c.fy) * e;
        c.face = false;
        c.h = Math.sin(Math.PI * u) * 4;
        this.spring(c, dt, 0, 0, 120, 10);
        if (u >= 1) c.gone = true;
        break;
      }
    }
  }

  private dealerHands(): void {
    const T = this.t,
      shoe = this.layer.shoe;
    let target: Pt | null = null;
    for (const c of this.cards) {
      if (c.phase === 'slide' || c.phase === 'flip') target = [shoe.x - 2, shoe.y + 1];
      else if (c.phase === 'fly' && T - c.t0 < 0.14) target = [shoe.x - 10, shoe.y + 6];
    }
    const rr = target ?? [257, 103];
    const ll = this.reach && T < this.reach.until ? this.reach.at : [223, 103];
    const k = this.reduced ? 1 : 0.35;
    this.handR.x += (rr[0] - this.handR.x) * k;
    this.handR.y += (rr[1] - this.handR.y) * k;
    this.handL.x += (ll[0] - this.handL.x) * k;
    this.handL.y += (ll[1] - this.handL.y) * k;
  }

  private hoverAt(ev: MouseEvent): void {
    const r = this.cv.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const x = ((ev.clientX - r.left) / r.width) * ART_W,
      y = ((ev.clientY - r.top) / r.height) * ART_H;
    let hit: BjCard | null = null;
    for (const c of this.cards)
      if (
        c.row === 'player' &&
        c.phase === 'rest' &&
        Math.abs(x - c.x) < CW / 2 &&
        Math.abs(y - c.y) < CH / 2
      )
        hit = c;
    for (const c of this.cards) c.hover = c === hit;
  }

  // ----- labels and LEDs -----
  private rowCards(row: Row, codes: readonly number[]): BjCard[] | null {
    const list = this.cards.filter((c) => c.row === row && c.phase !== 'sweep');
    if (codes.length === 0 || list.length !== codes.length || list.some(isMoving)) return null;
    if (list.some((c, i) => c.code !== codes[i])) return null;
    return list;
  }

  private playerLabel(h: TableHand): string | null {
    if (!this.rowCards('player', h.playerCards)) return null;
    const soft = h.playerIsSoft && h.status === 'InProgress';
    return String(h.playerTotal) + (soft ? ' soft' : '');
  }

  private dealerLabel(h: TableHand): string | null {
    if (h.dealerHidden || h.dealerTotal === null) return null;
    const list = this.rowCards('dealer', h.dealerCards);
    if (!list || list.some((c) => c.hidden)) return null;
    return String(h.dealerTotal);
  }

  private followChips(): void {
    if (this.idle || this.chipsShown === null) this.chipsShown = this.chipsNow;
  }

  // ----- loop -----
  protected override stepRoom(dt: number): void {
    for (const c of this.cards) this.stepCard(c, dt);
    if (this.cards.some((c) => c.gone)) this.cards = this.cards.filter((c) => !c.gone);
    this.releaseRest();
    this.dealerHands();
    this.followChips();
    this.checkIdle();
  }

  protected override finishAll(): void {
    for (const c of [...this.cards]) if (isMoving(c)) this.settleCard(c);
    this.cards = this.cards.filter((c) => !c.gone);
    this.relayout();
    this.snapAll();
    this.releaseRest();
    this.reach = null;
    this.handR = { x: 257, y: 103 };
    this.handL = { x: 223, y: 103 };
    this.followChips();
    this.checkIdle();
  }

  // ----- drawing -----
  private drawCard(c: BjCard, T: number): void {
    const deg = Math.round(clamp(c.deg, -24, 24));
    const narrow = c.w !== CW;
    const img = SP.card(c.face ? c.code : -1, narrow ? 0 : deg, c.w);
    const sx = T - c.shake < 0.4 ? Math.sin((T - c.shake) * 70) * 1.5 : 0;
    const bob = c.phase === 'rest' && !this.reduced ? Math.sin(T * 1.7 + c.seed) * 0.34 : 0;
    if (!this.reduced && !narrow) {
      const lift = Math.max(0, c.h);
      this.ctx.globalAlpha = 0.38;
      this.imgF(SP.cardShadow, c.x - CW / 2 + 1 + lift * 0.5 + sx, c.y - CH / 2 + 2 + lift * 0.8);
      this.ctx.globalAlpha = 1;
    }
    this.imgF(img, c.x - img.width / 2 + sx, c.y - img.height / 2 - c.h + bob);
  }

  private drawCircle(): void {
    const L = this.layer;
    if (this.circle > 0) {
      const key = SP.chipKeyFor(this.circle);
      for (let n = 0; n < Math.min(6, Math.ceil(this.circle / 25)); n++)
        this.img(SP.chips.side[key], L.circle.x - 4, L.circle.y + 1 - n * 2);
      this.text('x' + fmt(this.circle), L.circle.x + 12, L.circle.y - 6, PAPER);
      return;
    }
    if (!this.hand) this.text('PLACE A BET AND DEAL', L.circle.x + 22, L.circle.y - 4, SP.FELT[3]);
  }

  private drawCards(T: number): void {
    const front = (c: BjCard) => (c.phase === 'rest' || c.phase === 'reveal' ? 0 : 1);
    const order = [...this.cards].sort((a, b) => {
      if (front(a) !== front(b)) return front(a) - front(b);
      if (a.row !== b.row) return a.row === 'dealer' ? -1 : 1;
      if (a.hover !== b.hover) return a.hover ? 1 : -1;
      return a.i - b.i;
    });
    for (const c of order) this.drawCard(c, T);
  }

  private drawTotals(): void {
    const L = this.layer,
      label = this.totals;
    for (const row of ['player', 'dealer'] as const) {
      const str = label[row];
      if (str === null) continue;
      const list = this.cards.filter((c) => c.row === row && c.phase !== 'sweep');
      const lastX = Math.max(...list.map((c) => c.tx));
      const y = (row === 'player' ? L.playerRow.y : L.dealerRow.y) - 4;
      this.text(str, lastX + CW / 2 + 6, y, PAPER);
    }
  }

  private drawDealerArms(): void {
    const [[ex0, ey0], [ex1, ey1]] = this.dealer.elbows,
      dp = this.layer.dealer;
    const hl: Pt = [Math.round(this.handL.x), Math.round(this.handL.y)];
    FL.limb(this, [[dp.x + ex0, dp.y + ey0], hl], this.dealer.sleeve);
    FL.hand(this, this.handL.x, this.handL.y, this.dealer.skin);
    FL.limb(
      this,
      [
        [dp.x + ex1, dp.y + ey1],
        [Math.round(this.handR.x), Math.round(this.handR.y)],
      ],
      this.dealer.sleeve,
    );
    FL.hand(this, this.handR.x, this.handR.y, this.dealer.skin);
  }

  private drawBoss(T: number): void {
    const c = this.ctx,
      S = this.s,
      boss = this.boss,
      bp = this.layer.boss,
      bcx = bp.x + boss.cx;
    c.fillStyle = INK;
    c.fillRect((bcx - 9) * S, (bp.y + 50) * S, 18 * S, 28 * S);
    c.fillStyle = R.black[1];
    c.fillRect((bcx - 8) * S, (bp.y + 50) * S, 7 * S, 26 * S);
    c.fillRect((bcx + 1) * S, (bp.y + 50) * S, 7 * S, 26 * S);
    c.fillStyle = R.black[2];
    c.fillRect((bcx - 7) * S, (bp.y + 50) * S, S, 26 * S);
    c.fillRect((bcx + 2) * S, (bp.y + 50) * S, S, 26 * S);
    c.fillStyle = INK;
    c.fillRect((bcx - 10) * S, (bp.y + 75) * S, 9 * S, 3 * S);
    c.fillRect((bcx + 1) * S, (bp.y + 75) * S, 9 * S, 3 * S);
    c.drawImage(
      faceOf(boss, T + 0.7, 9, this.reduced),
      0,
      0,
      boss.w,
      52,
      bp.x * S,
      bp.y * S,
      boss.w * S,
      52 * S,
    );
    const [[bx0, by0], [bx1, by1]] = boss.elbows;
    FL.limb(
      this,
      [
        [bp.x + bx0, bp.y + by0 - 6],
        [bcx + 7, bp.y + 38],
      ],
      boss.sleeve,
    );
    FL.hand(this, bcx + 8, bp.y + 38, boss.skin);
    FL.limb(
      this,
      [
        [bp.x + bx1, bp.y + by1 - 6],
        [bcx - 7, bp.y + 41],
      ],
      boss.sleeve,
    );
    FL.hand(this, bcx - 8, bp.y + 41, boss.skin);
  }

  protected draw(): void {
    const c = this.ctx,
      T = this.t,
      L = this.layer;
    if (this.instant) this.followChips();
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    this.img(L.back, 0, 0);
    this.drawNeon();
    this.drawRings();
    this.drawSlots();
    if (!this.reduced) {
      const w = walkerAt(T, -1, 98, 40, 22);
      if (w) this.imgF(this.waitL[w.frame], w.x, w.y);
    }
    this.img(faceOf(this.dealer, T, 8, this.reduced), L.dealer.x, L.dealer.y);
    this.img(L.front, 0, 0);
    this.img(SP.led(this.chipsLed), L.ledChips.x, L.ledChips.y);
    const clock = this.autoStandLed;
    if (clock) this.img(SP.led(clock), L.ledClock.x, L.ledClock.y);
    this.drawCircle();
    this.drawCards(T);
    this.drawTotals();
    this.drawDealerArms();
    this.drawBoss(T);
    this.drawFliers();
    this.drawSparkles();
    this.drawPlate();
  }
}
