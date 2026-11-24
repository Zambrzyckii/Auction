// The pawnshop room: the shuttered shop on the street, the attic behind it and the counter with
// its crew. The room draws what it is told to show and computes no pawnshop rule. Its ambient
// life (motes in the light, the spider, the mouse, the breath, the blinks and the habits) steps
// on the room clock and keeps no timer of its own. Only the LED clock under reduced motion uses
// a real interval.
import { R, Sprite, box, measure, rand, srand, text, INK } from '../street/pix';
import { sparkle } from '../casino/floor';
import { GOLD, PAPER, REDL, Room, clamp, flipX, fmt } from '../casino/room';
import type { RoomOpts } from '../casino/room';
import { plate as plateSprite } from '../casino/sprites';
import type { PlateLine } from '../casino/sprites';
import { AMBER, bulbOff, ledPanel } from '../bank/sprites';
import * as PP from '../bank/people';
import { accentOf } from '../items/sprites/helpers';
import { rarityOf } from '../items/rarity';
import * as CR from './crew';
import type { CrewKey, Face, Walker } from './gait';
import * as WK from './gait';
import { CLUMP_ALPHA, clumpFrames, stepParts } from './dust';
import type { Part } from './dust';
import {
  OPEN_BEATS,
  PULL_BACK,
  beatAge,
  bulbLevel,
  facadeState,
  plankFall,
  runBeats,
  youPose,
} from './pawnshop-opening';
import type { BeatHost, BeatId, FacadeState, Stamps, YouAction } from './pawnshop-opening';
import { boardRows, dustLevel, ledRows, tierRarity } from './pawnshop-watch';
import type {
  BoardRow,
  PawnItem,
  PawnOffers,
  PawnShop,
  PawnState,
  PawnStep,
  PawnTier,
} from './pawnshop-watch';
import { placePose } from './player-actions';
import { A, H, L, W, build } from './rooms';

export const FOCUS_X = 238;

export interface PawnshopRoomOpts extends RoomOpts {
  onReveal?: () => void;
  onIdle?: () => void;
}
export interface PawnPainted {
  readonly open: boolean;
  readonly you: {
    readonly x: number;
    readonly face: string;
    readonly action: string | null;
    readonly pose: string | null;
    readonly carry: string | null;
  };
  readonly buddy: {
    readonly key: string;
    readonly x: number;
    readonly top: number;
    readonly behind: boolean;
  } | null;
  readonly cand: { readonly key: string; readonly x: number } | null;
  readonly old: boolean;
  readonly cust: boolean;
  readonly note: string | null;
  readonly lockRattle: boolean;
  readonly led: readonly string[] | null;
  readonly board: readonly {
    readonly name: string;
    readonly tag: string;
    readonly state: 'on' | 'live' | 'locked';
  }[];
  readonly shelf: readonly {
    readonly id: string;
    readonly slot: number;
    readonly dust: number;
    readonly tag: string;
  }[];
  readonly plate: readonly string[] | null;
  readonly drawer: boolean;
  readonly flap: boolean;
  readonly help: boolean;
  readonly facade: FacadeState;
  readonly prints: number;
  readonly stamps: Stamps | null;
}

type Pt = readonly [number, number];
type Img = HTMLCanvasElement;
type Beat = (done: () => void) => void;
type SpiderPhase = 'up' | 'down' | 'hang' | 'climb';
interface You extends Walker {
  feet: number;
  carry: 'keys' | null;
  action: YouAction | null;
}
interface Crew extends Walker {
  key: CrewKey;
  top: number;
  behind: boolean;
  pose: string;
  mood: string | null;
  carry?: boolean;
  hold?: Img | null;
  pFrom?: string;
  pTo?: string;
  pT0?: number;
}
interface Cust extends Walker {
  i: number;
  feet: number;
  mood: string;
  carry: string | null;
}
interface Flier {
  img: Img;
  pts: readonly Pt[];
  dur: number;
  t0: number;
  arc: number;
  done: () => void;
}
interface Plate {
  img: Img;
  x: number;
  y: number;
  at: number;
  life: number;
  lines: readonly string[];
}
interface Mouse {
  x: number;
  dir: number;
  stop: number;
  paused: number;
  fast?: boolean;
}
interface Mote {
  src: 'cold' | 'warm';
  x: number;
  y: number;
}
interface Entry {
  item: PawnItem;
  slot: number;
}

const BEAM_A = [0.07, 0.07, 0.09, 0.1];
const CONE_A = [0.05, 0.06, 0.08, 0.1];
const MOTE_COLD = ['#6e7488', '#a8b0c8', '#e4eaf6'];
const MOTE_WARM = ['#8a7458', '#d8bc8c', '#fff0c8'];
const STAIR_X = L.flap.x - 10;
const RISE = (L.floorY - (A.buddy.y + CR.BH)) / 3;
const CUST_X = L.flap.x - 18 - 20;
const GIVE_X = L.flap.x + 6;
const SWEEP_MS = 2800;

function stairY(x: number): number {
  if (x >= L.flap.x + L.flap.w) return A.buddy.y + CR.BH;
  if (x >= L.flap.x) return L.floorY - 2 * RISE;
  if (x >= STAIR_X) return L.floorY - RISE;
  return L.floorY;
}

const STAIRS: WK.Stairs = {
  plants: [
    { x: STAIR_X - 5, y: L.floorY },
    { x: STAIR_X + 5, y: L.floorY - RISE },
    { x: L.flap.x + 5, y: L.floorY - 2 * RISE },
    { x: L.flap.x + L.flap.w + 6, y: A.buddy.y + CR.BH },
  ],
  at: stairY,
};

const PRINTS: [number, number][] = [];
for (let x = L.inside + 4, k = 0; x < A.youBulb + 16; x += 11, k++) {
  PRINTS.push([x, k % 2 ? 189 : 191]);
}

const easeInOut = (k: number): number =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const slotXY = (i: number): Pt => [
  L.shelf.x + (i % 6) * L.shelf.pitch + 4,
  L.shelf.rows[Math.floor(i / 6)],
];
const breathing = (a: Crew, T: number): boolean => (T + a.key.length * 0.7) % 3.6 > 2.4;
const settled = (a: Walker, T: number): number => {
  const s = T - (a.settleT ?? -9);
  return s > 0.02 && s < 0.14 ? 1 : 0;
};

function boardState(row: BoardRow): 'on' | 'live' | 'locked' {
  if (row.on) return 'on';
  if (row.live) return 'live';
  return 'locked';
}

function youSpot(shop: PawnShop | null): { x: number; face: Face; carry: 'keys' | null } {
  if (shop?.status === 'Active') return { x: A.youOwner, face: 'front', carry: null };
  if (shop?.status === 'PendingPayment') return { x: A.youDoor, face: 'right', carry: 'keys' };
  if (shop?.status === 'Rejected') return { x: 2, face: 'front', carry: null };
  return { x: A.you, face: 'front', carry: null };
}

function newBuddy(key: CrewKey): Crew {
  return {
    key,
    wk: key,
    x: A.buddy.x,
    top: A.buddy.y,
    behind: true,
    walking: false,
    pose: 'down',
    mood: null,
    face: 'front',
  };
}

function newCandidate(key: CrewKey, x: number): Crew {
  return {
    key,
    x,
    top: L.floorY - CR.BH,
    behind: false,
    walking: false,
    pose: 'down',
    mood: null,
    face: 'front',
    carry: true,
  };
}

function wrap(str: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of str.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(t) <= maxW || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

const notes = new Map<string, Img>();
function noteImg(str: string, maxW: number, ink = '#3a1a1a'): Img {
  const key = str + maxW;
  const cached = notes.get(key);
  if (cached) return cached;
  const lines = wrap(str, maxW),
    w = Math.max(...lines.map((l) => measure(l))) + 6,
    h = lines.length * 7 + 6;
  const s = new Sprite(w + 1, h + 1);
  s.rect(0, 0, w, h, R.paper[3]);
  s.hline(0, h - 1, w, R.paper[1]);
  s.vline(w - 1, 1, h - 1, R.paper[2]);
  lines.forEach((l, i) => text(s, l, 3, 4 + i * 7, ink, 'tiny', { alignTop: true }));
  s.set(Math.floor(w / 2), 1, R.red[2]);
  s.set(Math.floor(w / 2), 2, R.red[1]);
  const img = s.canvas();
  if (notes.size > 160) notes.clear();
  notes.set(key, img);
  return img;
}

function stepsSprite(): Img {
  const s = new Sprite(20, 21);
  box(s, 0, 10, 10, 10, R.wood, { band: 1 });
  box(s, 10, 0, 10, 20, R.wood, { band: 1 });
  s.hline(0, 10, 10, R.wood[3]);
  s.hline(10, 0, 10, R.wood[3]);
  s.hline(0, 11, 10, '#e2c08a');
  s.hline(10, 1, 10, '#e2c08a');
  for (const [x, y] of [
    [2, 12],
    [7, 12],
    [12, 2],
    [17, 2],
    [11, 9],
    [14, 15],
  ])
    s.set(x, y, R.wood[1]);
  s.outline();
  return s.canvas();
}

function buildSprites() {
  const spider = (() => {
    const s = new Sprite(9, 6);
    s.rect(3, 1, 3, 3, R.black[2]);
    s.set(4, 1, R.black[3]);
    for (const [x, y] of [
      [1, 0],
      [0, 2],
      [1, 4],
      [7, 0],
      [8, 2],
      [7, 4],
    ])
      s.set(x, y, R.black[1]);
    s.set(2, 1, R.black[1]);
    s.set(6, 1, R.black[1]);
    s.set(2, 3, R.black[1]);
    s.set(6, 3, R.black[1]);
    s.set(4, 4, R.gum[2]);
    return s.canvas();
  })();
  return {
    puff: [3, 5, 8].map(clumpFrames),
    spider,
    steps: stepsSprite(),
    youFront: [PP.youFront(false, 1), PP.youFront(true, 1)],
    mouse: PP.rat,
    mouseL: PP.rat.map(flipX),
  };
}

export class PawnshopRoom extends Room {
  readonly focusX = FOCUS_X;
  private readonly art = build();
  private readonly spr = buildSprites();
  private readonly geo = {
    planks: this.art.planks,
    links: this.art.chainPts.length,
    staple: L.staple,
    heap: L.heap,
  };
  private dead = false;
  private busy = false;
  private gen = 0;
  private queue: PawnStep[] = [];
  private pendingRun = false;
  private footWas: boolean[] | null = null;
  private readonly onReveal: (() => void) | undefined;
  private readonly onIdle: (() => void) | undefined;
  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private shown: PawnState | null = null;
  private offers: PawnOffers | null = null;
  private upgrades: readonly PawnTier[] = [];
  private heldUpgrades: readonly PawnTier[] | null = null;
  private canBuy = false;
  private stamps: Stamps | null = null;
  private openNow = false;
  private you: You = {
    x: A.you,
    feet: L.floorY,
    face: 'front',
    walking: false,
    carry: null,
    action: null,
  };
  private buddy: Crew | null = null;
  private cand: Crew | null = null;
  private old: Crew | null = null;
  private cust: Cust | null = null;
  private note: string | null = null;
  private noteT = -9;
  private lockRattle = false;
  private lockSnap = -9;
  private shrugT = -9;
  private appraise = -9;
  private flap = { open: false, t: -9 };
  private hidden = new Set<string>();
  private ghosts: PawnItem[] = [];
  private slotOfId = new Map<string, number>();
  private fliers: Flier[] = [];
  private plates: Plate[] = [];
  private plateSweep: ReturnType<typeof setTimeout> | undefined;
  private custN = 0;
  private parts: Part[] = [];
  private register: { amount: number; at: number } | null = null;
  private onCounter: { img: Img; x: number; y: number } | null = null;
  private spider = { y: L.tie + 4, phase: 'up' as SpiderPhase, next: 3, fast: false };
  private mouse: Mouse | null = null;
  private nextMouse = 5;
  private nextMote = 0;
  private habit: { next: number; kind: string | null; t0: number } = { next: 3, kind: null, t0: 0 };
  private blinkUntil = -9;
  private nextBlink = 2;
  private stillMotes: { cold: Mote[]; warm: Mote[] } | null = null;
  private youTurn = new Map<number, Img>();

  constructor(cv: HTMLCanvasElement, opts: PawnshopRoomOpts = {}) {
    super(cv, opts);
    this.onReveal = opts.onReveal;
    this.onIdle = opts.onIdle;
    if (!this.reduced) CR.prewarm();
  }

  get painted(): PawnPainted {
    const you = this.you,
      b = this.buddy,
      c = this.cand;
    const open = this.isOpen();
    const facade = this.facade();
    const upTo = this.printsUpTo();
    return {
      open,
      you: {
        x: you.x,
        face: you.face,
        action: you.action,
        pose: this.youPoseName(),
        carry: you.carry,
      },
      buddy: b === null ? null : { key: b.key, x: b.x, top: b.top, behind: b.behind },
      cand: c === null ? null : { key: c.key, x: c.x },
      old: this.old !== null,
      cust: this.cust !== null,
      note: this.visibleNote(),
      lockRattle: this.lockRattle,
      led: this.ledNow(),
      board: this.boardNow().map((r) => ({
        name: r.name,
        tag: r.on ? 'ON SHIFT' : fmt(r.price),
        state: boardState(r),
      })),
      shelf: this.shelfNow().map(({ item, slot }) => ({
        id: item.publicStockItemId,
        slot,
        dust: dustLevel(item, Date.now()),
        tag: fmt(item.price),
      })),
      plate: this.plates[0]?.lines ?? null,
      drawer: this.drawerOpen(this.t),
      flap: this.flap.open,
      help: this.helpShown(facade),
      facade,
      prints: PRINTS.filter(([x]) => x < upTo).length,
      stamps: this.stamps,
    };
  }

  place(shop: PawnState | null): void {
    if (this.dead) return;
    this.cancelRun();
    this.seat(shop);
    this.kickDraw();
  }

  private seat(shop: PawnState | null): void {
    this.shown = shop;
    this.stamps = null;
    this.fliers = [];
    this.clearPlates();
    this.parts = this.parts.filter((p) => p.k === 'mote');
    this.register = null;
    this.onCounter = null;
    this.flap = { open: false, t: -9 };
    this.lockSnap = -9;
    this.shrugT = -9;
    this.noteT = -9;
    this.slotOfId.clear();
    this.rest();
  }

  setOffers(offers: PawnOffers | null): void {
    if (this.dead) return;
    this.offers = offers;
    if (!this.busy) this.rest();
    this.kickDraw();
  }

  setUpgrades(tiers: readonly PawnTier[]): void {
    if (this.dead) return;
    if (this.busy) {
      this.heldUpgrades = tiers;
      return;
    }
    this.upgrades = tiers;
    this.kickDraw();
  }

  private releaseUpgrades(): void {
    if (this.heldUpgrades === null) return;
    this.upgrades = this.heldUpgrades;
    this.heldUpgrades = null;
  }

  setCanBuy(can: boolean): void {
    if (this.dead) return;
    this.canBuy = can;
    this.syncReady();
    this.kickDraw();
  }

  protected override kickDraw(): void {
    super.kickDraw();
    this.syncClock();
  }

  private syncClock(): void {
    if (!this.reduced || this.dead || !this.clockNeeded()) {
      clearInterval(this.clockTimer);
      this.clockTimer = undefined;
      return;
    }
    this.clockTimer ??= setInterval(() => {
      if (!this.paused) this.draw();
    }, 1000);
  }

  private clockNeeded(): boolean {
    const shop = this.shop;
    if (shop === null || shop.status !== 'Active') return false;
    return shop.nextSpawnOn !== null || shop.stock.some((i) => i.status === 'InStock');
  }

  override destroy(): void {
    this.dead = true;
    this.gen++;
    this.queue = [];
    this.busy = false;
    clearInterval(this.clockTimer);
    this.clockTimer = undefined;
    clearTimeout(this.plateSweep);
    this.fliers = [];
    super.destroy();
  }

  protected override finishAll(): void {
    for (const a of this.walkers()) if (a.walking) this.land(a);
    for (const f of this.fliers.splice(0)) f.done();
    this.flap.t = -9;
    this.clearPlates();
  }

  private walkers(): Walker[] {
    const all: (Walker | null)[] = [this.you, this.buddy, this.cand, this.old, this.cust];
    return all.filter((a): a is Walker => a !== null);
  }

  private land(a: Walker): void {
    if (a.tx !== undefined) a.x = a.tx;
    a.walking = false;
    a.g = null;
    const arrive = a.arrive;
    a.arrive = null;
    arrive?.();
  }

  // ----- run queue -----
  get idle(): boolean {
    return !this.busy && this.queue.length === 0;
  }

  run(steps: readonly PawnStep[]): void {
    if (this.dead || steps.length === 0) return;
    this.pendingRun = true;
    this.queue.push(...steps);
    this.pump();
    this.kickDraw();
  }

  private cancelRun(): void {
    this.gen++;
    this.queue = [];
    this.busy = false;
    this.pendingRun = false;
    this.releaseUpgrades();
  }

  private pump(): void {
    if (this.busy) return;
    const step = this.queue.shift();
    if (step === undefined) return;
    this.busy = true;
    this.exec(step);
  }

  private next(): void {
    this.busy = false;
    if (this.queue.length > 0) this.pump();
    else this.checkIdle();
  }

  private checkIdle(): void {
    if (!this.pendingRun || !this.idle) return;
    this.pendingRun = false;
    this.rest();
    this.releaseUpgrades();
    if (this.paused) this.clearPlates();
    this.kickDraw();
    this.onIdle?.();
  }

  private exec(step: PawnStep): void {
    const gen = this.gen;
    let revealed = false;
    const reveal = () => {
      if (revealed || gen !== this.gen) return;
      revealed = true;
      this.reveal(step);
    };
    this.playBeats(this.beatsOf(step, reveal), gen, () => {
      reveal();
      this.next();
    });
  }

  private reveal(step: PawnStep): void {
    this.shown = step.shop;
    this.kickDraw();
    this.onReveal?.();
  }

  private playBeats(beats: readonly Beat[], gen: number, end: () => void, i = 0): void {
    if (i >= beats.length) {
      end();
      return;
    }
    beats[i](() => {
      if (gen === this.gen) this.playBeats(beats, gen, end, i + 1);
    });
  }

  private beatsOf(step: PawnStep, reveal: () => void): readonly Beat[] {
    switch (step.kind) {
      case 'snap':
        return [
          this.act(() => {
            this.seat(step.shop);
            reveal();
          }),
        ];
      case 'paying':
        return this.payingBeats(reveal);
      case 'opened':
        return this.openedBeats(reveal);
      case 'rejected':
        return this.rejectedBeats(step.shop.rejectionReason || null, reveal);
      case 'hiring':
        return this.hiringBeats(step.tier, reveal);
      case 'workerHired':
        return this.hiredBeats(step.from, step.to, reveal);
      case 'workerRejected':
        return this.refusedBeats(step.reason, reveal);
      case 'itemDelivered':
        return this.deliveredBeats(step.items, reveal);
      case 'itemSold':
        return this.soldBeats(step.items, step.payout, reveal);
      case 'itemWithdrawn':
        return this.withdrawnBeats(step.items, reveal);
    }
  }

  // ----- beats -----
  private later(delay: number, fn: () => void): void {
    const gen = this.gen;
    this.schedule(delay, () => {
      if (gen === this.gen) fn();
    });
  }

  private act(fn: () => void): Beat {
    return (done) => {
      fn();
      done();
    };
  }

  private hold(seconds: number, fn?: () => void): Beat {
    return (done) => {
      fn?.();
      this.later(seconds, done);
    };
  }

  private stampNow(): number {
    return this.instant() ? -9 : this.t;
  }

  private walkTo(a: Walker, x: number, speed: number, done: () => void): void {
    if (this.instant()) {
      a.x = x;
      a.walking = false;
      a.g = null;
      done();
      return;
    }
    if (Math.abs(a.x - x) < 0.5) {
      done();
      return;
    }
    const gen = this.gen;
    WK.beginWalk(a, WK.idOf(a), x, speed, STAIRS, () => {
      if (gen === this.gen) done();
    });
  }

  private payingBeats(reveal: () => void): readonly Beat[] {
    const you = this.you;
    return [
      this.act(() => {
        this.note = null;
        you.carry = 'keys';
        you.action = null;
        reveal();
      }),
      (done) => this.walkTo(you, A.youDoor, 40, done),
      this.act(() => {
        you.face = 'right';
        this.lockRattle = true;
      }),
    ];
  }

  private rejectedBeats(reason: string | null, reveal: () => void): readonly Beat[] {
    const you = this.you;
    return [
      this.hold(0.5, () => {
        this.lockRattle = false;
        you.action = null;
        this.lockSnap = this.stampNow();
      }),
      this.hold(0.6, () => {
        this.note = reason;
        this.noteT = this.stampNow();
      }),
      this.hold(0.7, () => {
        you.carry = null;
        you.face = 'front';
        this.shrugT = this.stampNow();
      }),
      (done) => this.walkTo(you, 2, 30, done),
      this.hold(0.4, () => {
        you.face = 'front';
        reveal();
      }),
    ];
  }

  private openedBeats(reveal: () => void): readonly Beat[] {
    const you = this.you,
      stamps: Stamps = { s: {}, e: {} };
    return [
      this.act(() => {
        this.lockRattle = false;
        this.note = null;
        this.stamps = stamps;
        you.walking = false;
        you.x = A.youDoor;
        you.carry = null;
      }),
      (done) =>
        this.playOpening(stamps, () => {
          this.openNow = true;
          you.action = null;
          reveal();
          done();
        }),
      (done) =>
        this.walkTo(you, A.youOwner, 40, () => {
          you.face = 'front';
          done();
        }),
      this.act(() => {
        this.stamps = null;
      }),
    ];
  }

  private join(n: number, done: () => void): () => void {
    let left = n;
    return () => {
      left--;
      if (left === 0) done();
    };
  }

  private until(cond: () => boolean, fn: () => void): void {
    if (cond() || this.instant()) {
      fn();
      return;
    }
    this.later(0.05, () => this.until(cond, fn));
  }

  private setFlap(open: boolean, done?: () => void): void {
    if (this.flap.open === open) {
      done?.();
      return;
    }
    this.flap = { open, t: this.t };
    if (done) this.later(0.15, done);
  }

  private flyImage(img: Img, pts: readonly Pt[], dur: number, arc: number, done: () => void): void {
    if (this.instant()) {
      done();
      return;
    }
    const gen = this.gen;
    this.fliers.push({
      img,
      pts,
      dur,
      t0: this.t,
      arc,
      done: () => {
        if (gen === this.gen) done();
      },
    });
    this.kickDraw();
  }

  private stepFliers(T: number): void {
    const ended = this.fliers.filter((f) => T - f.t0 >= f.dur);
    if (ended.length === 0) return;
    this.fliers = this.fliers.filter((f) => T - f.t0 < f.dur);
    for (const f of ended) f.done();
  }

  private showPlate(lines: readonly PlateLine[], x: number, y: number, life = 2.6): void {
    this.plates = [
      { img: plateSprite(lines), x, y, at: this.t, life, lines: lines.map((l) => l[0]) },
    ];
    if (!this.reduced) return;
    clearTimeout(this.plateSweep);
    this.plateSweep = setTimeout(() => {
      this.plates = [];
      this.register = null;
      this.draw();
    }, SWEEP_MS);
  }

  private clearPlates(): void {
    clearTimeout(this.plateSweep);
    this.plates = [];
  }

  private addSpark(x: number, y: number, life: number): void {
    if (this.instant()) return;
    this.parts.push({ k: 'spark', x, y, t0: this.t, life });
  }

  private hiringBeats(tier: string, reveal: () => void): readonly Beat[] {
    const c = newCandidate(this.candKey(tier), -60);
    return [
      this.act(() => {
        this.cand = c;
        reveal();
      }),
      (done) => this.walkTo(c, A.doorX - 28, 40, done),
      this.act(() => {
        c.face = 'front';
      }),
    ];
  }

  private refusedBeats(reason: string | null, reveal: () => void): readonly Beat[] {
    const c = this.cand,
      lines: PlateLine[] = [['NOT THIS TIME', 'tiny', '#c9c2d0']];
    if (reason) lines.push([reason, 'tiny', REDL]);
    const beats: Beat[] = [this.act(() => this.showPlate(lines, A.doorX, 52, 3.4))];
    if (c) {
      beats.push(
        this.hold(1.2, () => {
          c.pose = 'shrug';
        }),
        this.act(() => {
          c.pose = 'down';
          reveal();
        }),
        (done) => this.walkTo(c, -70, 44, done),
      );
    }
    beats.push(
      this.act(() => {
        this.cand = null;
      }),
    );
    const b = this.buddy;
    if (b) {
      beats.push(
        this.hold(0.6, () => {
          b.mood = 'smile';
          b.pose = 'wave';
        }),
        this.act(() => {
          b.pose = 'down';
        }),
      );
    }
    return beats;
  }

  // ----- the crew -----
  private climbIn(c: Crew, done: () => void): void {
    c.behind = true;
    c.track = 'stairs';
    const landed = this.join(2, () => {
      c.track = null;
      c.top = A.buddy.y;
      c.face = 'front';
      this.buddy = c;
      this.cand = null;
      this.setFlap(false, done);
    });
    this.walkTo(c, A.buddy.x, 36, landed);
    this.until(
      () => !c.walking || c.x + CR.CX >= STAIR_X - 22,
      () => this.setFlap(true, landed),
    );
  }

  private highFiveBeats(p: Crew, q: Crew): readonly Beat[] {
    const both = (name: keyof typeof WK.ARM, dur: number) => {
      for (const a of [p, q]) {
        a.armHold = true;
        WK.arm(a, name, 'down', dur, this.t);
      }
    };
    return [
      this.hold(1 / 15, () => both('five1', 1 / 15)),
      this.hold(1 / 15, () => both('five2', 1 / 15)),
      this.hold(1 / 15, () => {
        both('five3', 1 / 15);
        p.dip = q.dip = 1;
      }),
      this.hold(0.1, () => both('fiveWind', 0.08)),
      this.hold(1 / 30, () => {
        both('fiveHit', 1 / 30);
        p.dip = q.dip = 0;
      }),
      this.hold(1 / 15, () => {
        p.shakeT = q.shakeT = this.t;
        p.mood = q.mood = 'laugh';
        this.addSpark((p.x + q.x) / 2 + CR.CX, L.floorY - CR.BH + 16, 0.4);
      }),
      this.hold(0.35, () => both('fiveFollow', 0.2)),
      this.hold(0.3, () => both('down', 0.3)),
    ];
  }

  private passKeyBeats(from: Crew, to: Crew): readonly Beat[] {
    return [
      this.hold(0.35, () => {
        from.armHold = to.armHold = true;
        from.hold = CR.keys;
        WK.arm(from, 'give', 'down', 0.3, this.t);
      }),
      this.hold(0.3, () => WK.arm(to, 'take', 'down', 0.25, this.t)),
      this.hold(0.15, () => {
        from.hold = null;
        to.hold = CR.keys;
      }),
      this.hold(0.35, () => {
        WK.arm(from, 'down', 'down', 0.3, this.t);
        WK.arm(to, 'down', 'down', 0.35, this.t);
      }),
      this.act(() => {
        to.hold = null;
        from.armHold = to.armHold = false;
        from.mood = to.mood = null;
      }),
    ];
  }

  private hiredBeats(from: string | null, to: string | null, reveal: () => void): readonly Beat[] {
    if (to === null) return [this.act(reveal)];
    const c = this.cand ?? newCandidate(CR.crewKeyOf(to), A.doorX - 28),
      old = this.buddy;
    this.cand = c;
    c.carry = false;
    c.wk = c.key;
    if (old && from !== null && from !== to) return this.handoverBeats(c, old, reveal);
    return [
      (done) => this.climbIn(c, done),
      this.hold(0.9, () => {
        c.pose = 'wave';
        c.mood = 'laugh';
        reveal();
      }),
      this.act(() => {
        c.pose = 'down';
        c.mood = null;
      }),
    ];
  }

  private handoverBeats(c: Crew, old: Crew, reveal: () => void): readonly Beat[] {
    const meet = STAIR_X - 2;
    const leave: Beat[] = [
      this.act(() => {
        old.face = 'front';
        old.mood = 'laugh';
      }),
      ...['wave', 'wave2', 'wave', 'wave2', 'wave'].map((pose) =>
        this.hold(0.22, () => {
          old.pose = pose;
        }),
      ),
      this.hold(0.25, () => {
        old.pose = 'down';
        old.mood = null;
      }),
      (done) => this.walkTo(old, -70, 40, done),
      this.act(() => {
        this.old = null;
      }),
    ];
    return [
      (done) => {
        this.old = old;
        this.buddy = null;
        const met = this.join(2, done);
        this.walkTo(c, meet - 32 - CR.CX, 40, met);
        this.setFlap(true, () => {
          old.behind = true;
          old.track = 'stairs';
          this.walkTo(old, meet - CR.CX, 36, () => {
            old.track = null;
            old.behind = false;
            WK.setGround(old, L.floorY);
            this.setFlap(false);
            met();
          });
        });
      },
      this.hold(0.2, () => {
        c.face = 'right';
        old.face = 'left';
      }),
      ...this.highFiveBeats(c, old),
      ...this.passKeyBeats(old, c),
      this.act(reveal),
      (done) => {
        const both = this.join(2, done);
        this.playBeats(leave, this.gen, both);
        this.later(0.4, () => this.climbIn(c, both));
      },
    ];
  }

  // ----- the stock -----
  private newCustomer(mood: string, carry: string | null): Cust {
    const cust: Cust = {
      i: this.custN++ % CR.CUSTOMERS.length,
      x: -40,
      feet: L.floorY,
      walking: false,
      mood,
      carry,
      face: 'right',
    };
    return cust;
  }

  private slotAt(id: string): Pt {
    const [x, y] = slotXY(this.slotOfId.get(id) ?? 0);
    return [x + 9, y + 9];
  }

  private deliveredBeats(items: readonly PawnItem[], reveal: () => void): readonly Beat[] {
    const b = this.buddy,
      first = items[0],
      cust = this.newCustomer('worried', 'bundle');
    const setB = (pose: string, mood?: string | null) => {
      if (!b) return;
      b.pose = pose;
      if (mood !== undefined) b.mood = mood;
    };
    return [
      this.act(() => {
        for (const it of items) {
          this.slotOf(it.publicStockItemId);
          this.hidden.add(it.publicStockItemId);
        }
        this.cust = cust;
        reveal();
      }),
      (done) => this.walkTo(cust, CUST_X, 42, done),
      this.hold(0.4, () => {
        cust.armHold = true;
        WK.arm(cust, 'reachUp', 'reachUp', 0.35, this.t);
      }),
      this.hold(0.4, () => {
        cust.carry = null;
        this.onCounter = { img: CR.bundle, x: GIVE_X, y: 112 };
        WK.arm(cust, 'down', 'down', 0.4, this.t);
        setB('reach');
      }),
      this.act(() => {
        this.onCounter = null;
        cust.armHold = false;
        setB('hold');
      }),
      (done) =>
        this.flyImage(
          CR.bundle,
          [
            [GIVE_X, 112],
            [212, 112],
          ],
          0.25,
          3,
          done,
        ),
      this.hold(1.3, () => {
        this.onCounter = { img: CR.bundle, x: 212, y: 112 };
        if (b) {
          b.mood = 'wow';
          this.appraise = this.t;
        }
      }),
      this.act(() => {
        this.onCounter = null;
        if (b) b.mood = 'laugh';
      }),
      (done) => {
        const [sx, sy] = this.slotAt(first.publicStockItemId);
        this.flyImage(
          CR.mini(first.rarity, 0),
          [
            [212, 108],
            [sx, sy],
          ],
          0.55,
          14,
          done,
        );
      },
      this.hold(0.5, () => {
        for (const it of items) this.hidden.delete(it.publicStockItemId);
        for (const it of items.slice(1)) {
          const [x, y] = slotXY(this.slotOf(it.publicStockItemId));
          this.addSpark(x + 9, y + 6, 0.5);
        }
        if (b) {
          b.pose = 'down';
          b.mood = null;
          this.appraise = -9;
        }
        cust.mood = 'happy';
      }),
      (done) => this.walkTo(cust, -50, 44, done),
      this.act(() => {
        this.cust = null;
      }),
    ];
  }

  private soldBeats(
    items: readonly PawnItem[],
    payout: number,
    reveal: () => void,
  ): readonly Beat[] {
    const b = this.buddy,
      first = items[0],
      item = CR.mini(first.rarity, 4),
      cust = this.newCustomer('happy', null);
    let at: Pt = [0, 0];
    return [
      this.act(() => {
        this.ghosts = items.slice();
        this.cust = cust;
        reveal();
      }),
      (done) => this.walkTo(cust, CUST_X, 42, done),
      this.act(() => {
        at = this.slotAt(first.publicStockItemId);
        this.ghosts = items.slice(1);
        if (b) b.pose = 'hold';
      }),
      (done) => this.flyImage(item, [at, [212, 108]], 0.6, 10, done),
      this.act(() => {
        if (b) b.pose = 'reach';
        cust.armHold = true;
        WK.arm(cust, 'reachUp', 'down', 0.35, this.t);
      }),
      (done) =>
        this.flyImage(
          item,
          [
            [212, 108],
            [GIVE_X, 110],
          ],
          0.25,
          2,
          done,
        ),
      this.hold(0.15, () => {
        this.onCounter = { img: item, x: GIVE_X, y: 110 };
      }),
      this.hold(1.0, () => {
        this.onCounter = null;
        cust.carry = first.rarity;
        WK.arm(cust, 'carry', 'carry', 0.35, this.t);
        if (b) {
          b.pose = 'down';
          b.mood = 'laugh';
        }
        this.ghosts = [];
        for (const it of items) this.slotOfId.delete(it.publicStockItemId);
        this.register = { amount: payout, at: this.t };
        this.showPlate(
          [
            ['SOLD', 'tiny', '#c9c2d0'],
            ['+' + fmt(payout), 'micro', GOLD],
          ],
          L.register.x + 15,
          L.register.y - 16,
          2.4,
        );
      }),
      this.act(() => {
        cust.armHold = false;
        if (b) b.mood = null;
      }),
      (done) => this.walkTo(cust, -50, 44, done),
      this.act(() => {
        this.cust = null;
      }),
    ];
  }

  private withdrawnBeats(items: readonly PawnItem[], reveal: () => void): readonly Beat[] {
    const b = this.buddy,
      it = items[0],
      mini = CR.mini(it.rarity, 2);
    let at: Pt = [0, 0];
    return [
      this.act(() => {
        this.ghosts = [];
        at = this.slotAt(it.publicStockItemId);
        for (const x of items) this.slotOfId.delete(x.publicStockItemId);
        reveal();
        if (b) b.pose = 'hold';
      }),
      (done) => this.flyImage(mini, [at, [212, 108]], 0.5, 8, done),
      this.hold(0.5, () => {
        this.onCounter = { img: mini, x: 212, y: 108 };
      }),
      this.hold(0.5, () => {
        this.onCounter = { img: CR.parcel, x: 212, y: 110 };
      }),
      this.act(() => {
        this.onCounter = null;
        if (b) {
          b.pose = 'wave';
          b.mood = 'laugh';
        }
        this.showPlate(
          [
            ['OFF TO', 'tiny', '#c9c2d0'],
            ['YOUR ROOM', 'micro', GOLD],
          ],
          150,
          70,
          2.2,
        );
      }),
      (done) =>
        this.flyImage(
          CR.parcel,
          [
            [212, 110],
            [L.door.x + 20, 120],
            [-20, 110],
          ],
          1.1,
          16,
          done,
        ),
      this.act(() => {
        if (b) {
          b.pose = 'down';
          b.mood = null;
        }
      }),
    ];
  }

  private playOpening(stamps: Stamps, done: () => void): void {
    const gen = this.gen;
    const host: BeatHost = {
      wait: (seconds, fn) => this.later(seconds, fn),
      act: (id, dur, end) => this.openAct(id, dur, end),
      stamp: () => (this.instant() ? -1e9 : this.t),
      live: () => gen === this.gen,
    };
    runBeats(OPEN_BEATS, host, stamps, done);
  }

  private openAct(id: BeatId, dur: number, end: () => void): void {
    const you = this.you;
    if (id === 'walkIn') {
      you.action = null;
      this.walkTo(you, A.youBulb, 40, () => {
        you.face = 'right';
        you.action = 'stand';
        end();
      });
      return;
    }
    this.openEffect(id);
    this.later(dur, () => {
      if (id === 'door') {
        you.x += PULL_BACK;
        you.action = 'stand';
      }
      end();
    });
  }

  private openEffect(id: BeatId): void {
    const you = this.you;
    switch (id) {
      case 'key':
        you.action = 'key';
        you.face = 'right';
        you.carry = null;
        if (this.spider.phase === 'up') this.spider.phase = 'down';
        break;
      case 'heap':
        this.dust(L.heap.x, L.heap.y - 4, 0, 0, 5, -7, 0.5);
        this.dust(L.heap.x - 6, L.heap.y - 3, 0, 0.06, -7, -5, 0.45);
        break;
      case 'door':
        you.action = 'pull';
        if (this.spider.y > L.tie + 8) {
          this.spider.phase = 'climb';
          this.spider.fast = true;
        }
        this.mouse = { x: 146, dir: 1, stop: 0, paused: 0, fast: true };
        break;
      case 'stale':
        for (let k = 0; k < 5; k++) {
          this.dust(
            L.door.x + 34 - k * 4,
            184 - (k % 2) * 5,
            k < 2 ? 2 : 1,
            k * 0.2,
            -30 - k * 5,
            -2.5,
            1.0,
          );
        }
        break;
      case 'kick':
        you.action = 'kick';
        break;
      case 'boards':
        this.art.planks.forEach((_, i) => {
          const f = plankFall(i, this.art.planks);
          this.dust(f.x1 + 8 + (i % 3) * 14, f.y1 + 1, 1, f.delay + f.tl, i % 2 ? 6 : -6, -6, 0.5);
        });
        break;
      case 'cord':
        you.action = 'cord';
        break;
      case 'bulb':
        this.openNow = true;
        break;
      case 'cloth':
        you.action = 'cloth';
        break;
      case 'puff':
        this.puffDust();
        break;
      case 'cheer':
        you.action = 'cheer';
        break;
      default:
        break;
    }
  }

  private puffDust(): void {
    for (let k = 0; k < 4; k++) {
      this.dust(206 + k * 30, L.counterTop - 3, 1, k * 0.06, (k - 1.5) * 3, -9, 0.6);
    }
    for (let k = 0; k < 3; k++) {
      this.dust(262 + k * 48, L.shelf.rows[1] + 20, 0, 0.1 + k * 0.07, 0, -6, 0.5);
    }
    this.dust(214, 186, 2, 0, -8, -3, 0.7);
    this.dust(244, 188, 1, 0.05, 9, -3, 0.6);
  }

  private dust(
    x: number,
    y: number,
    size: number,
    delay: number,
    vx: number,
    vy: number,
    life: number,
  ): void {
    if (this.instant()) return;
    this.parts.push({ k: 'clump', x, y, r: size, vx, vy, t0: this.t + delay, life });
  }

  // ----- state -----
  private get shop(): PawnShop | null {
    return this.shown === null || this.shown === 'none' ? null : this.shown;
  }

  private isOpen(): boolean {
    return this.openNow || this.shop?.status === 'Active';
  }

  private hasBot(): boolean {
    return this.shop !== null && this.shop.botTierName !== null;
  }

  private instant(): boolean {
    return this.reduced || this.paused;
  }

  private age(id: BeatId): number {
    return beatAge(this.stamps, id, this.t, this.isOpen(), this.reduced);
  }

  private facade(): FacadeState {
    return facadeState((id) => this.age(id), this.geo, this.reduced);
  }

  private helpShown(facade: FacadeState): boolean {
    return facade.help && this.isOpen() && this.shop !== null && !this.hasBot() && !this.busy;
  }

  private visibleNote(): string | null {
    return this.isOpen() ? null : this.note;
  }

  private drawerOpen(T: number): boolean {
    const r = this.register;
    return r !== null && (this.reduced || T - r.at < 2.4);
  }

  private candKey(name: string): CrewKey {
    return CR.crewKeyOf(tierRarity(this.offers?.botTiers ?? [], name));
  }

  private rest(): void {
    const shop = this.shop,
      you = this.you;
    this.openNow = false;
    this.settleWalker(you);
    const spot = youSpot(shop);
    you.x = spot.x;
    you.face = spot.face;
    you.carry = spot.carry;
    you.action = null;
    this.lockRattle = shop?.status === 'PendingPayment';
    this.note = shop?.status === 'Rejected' ? shop.rejectionReason || null : null;
    this.restBuddy(shop);
    this.cand = this.restCandidate(shop);
    this.old = null;
    this.cust = null;
    this.ghosts = [];
    this.hidden.clear();
    this.syncReady();
  }

  private restBuddy(shop: PawnShop | null): void {
    if (shop === null || shop.botTierName === null) {
      this.buddy = null;
      return;
    }
    const key = CR.crewKeyOf(shop.botRarity);
    if (this.buddy === null || this.buddy.key !== key || !this.buddy.behind) {
      this.buddy = newBuddy(key);
    }
    const b = this.buddy;
    this.settleWalker(b);
    b.x = A.buddy.x;
    b.top = A.buddy.y;
    b.behind = true;
    b.pose = 'down';
  }

  private restCandidate(shop: PawnShop | null): Crew | null {
    if (shop === null || shop.pendingBotTierName === null) return null;
    return newCandidate(this.candKey(shop.pendingBotTierName), A.doorX - 28);
  }

  private settleWalker(a: Walker): void {
    a.walking = false;
    a.g = null;
    a.arrive = null;
  }

  // "He can buy now" lives in the world, derived from the shown data: on the sidewalk with the
  // money he now and then glances at the notice on the door and pats the envelope.
  private syncReady(): void {
    const you = this.you;
    if (this.busy || this.stamps !== null || you.walking || this.shown === null) return;
    const want = !this.isOpen() && this.canBuy && this.readyShop();
    if (want) you.action = 'ready';
    else if (you.action === 'ready') you.action = null;
  }

  private readyShop(): boolean {
    return this.shown === 'none' || this.shop?.status === 'Rejected';
  }

  private youPoseName(): string | null {
    const you = this.you;
    if (!you.action || you.walking) return null;
    return youPose(you.action, (id) => this.age(id), this.t, this.reduced).name;
  }

  private ledNow(): readonly string[] | null {
    const shop = this.shop;
    if (!this.isOpen() || shop === null) return null;
    return ledRows(shop, Date.now());
  }

  private boardNow(): readonly BoardRow[] {
    return boardRows(this.offers?.botTiers ?? [], this.upgrades, this.shop?.botTierName ?? null);
  }

  private slotOf(id: string): number {
    const known = this.slotOfId.get(id);
    if (known !== undefined) return known;
    const used = new Set(this.slotOfId.values());
    let i = 0;
    while (used.has(i) && i < 11) i++;
    this.slotOfId.set(id, i);
    return i;
  }

  private shelfNow(): Entry[] {
    const shop = this.shop;
    if (!this.isOpen() || shop === null) return [];
    return shop.stock
      .filter((i) => i.status === 'InStock' && !this.hidden.has(i.publicStockItemId))
      .concat(this.ghosts)
      .map((item) => ({ item, slot: this.slotOf(item.publicStockItemId) }));
  }

  private printsUpTo(): number {
    if (this.stamps !== null) return this.age('walkIn') >= 0 ? this.you.x + 12 : -1;
    return this.isOpen() ? 999 : -1;
  }

  // ----- stepping -----
  protected override stepRoom(dt: number): void {
    const T = this.t;
    for (const a of this.walkers()) WK.step(a, dt, T);
    this.stepBlink(T);
    this.stepHabits(T, dt);
    this.stepFootfalls(T);
    this.stepMotes(T);
    this.parts = stepParts(this.parts, dt, T);
    this.stepFliers(T);
    this.plates = this.plates.filter((p) => T - p.at < p.life);
    this.stepSpider(T, dt);
    this.stepMouse(T, dt);
  }

  private stepBlink(T: number): void {
    if (T <= this.nextBlink) return;
    this.blinkUntil = T + 0.13;
    this.nextBlink = T + 2.2 + Math.random() * 2.5;
  }

  private stepHabits(T: number, dt: number): void {
    const b = this.buddy,
      id = this.habit;
    if (!b || this.busy || !b.behind || b.walking) {
      id.kind = null;
      return;
    }
    if (!id.kind && T > id.next) {
      id.kind = WK.pickHabit(b.key);
      id.t0 = T;
    }
    if (id.kind && T - id.t0 > WK.habitLen(id.kind)) {
      id.kind = null;
      id.next = T + 3.5 + Math.random() * 3;
    }
    const sneezeAt = 0.82,
      age = T - id.t0;
    if (id.kind === 'sneeze' && age >= sneezeAt && age - dt < sneezeAt) {
      for (let k = 0; k < 6; k++) {
        this.parts.push({
          k: 'mote',
          x: A.buddy.x + CR.CX + (Math.random() - 0.5) * 10,
          y: A.buddy.y + 24,
          vx: (Math.random() - 0.5) * 30,
          vy: -8 - Math.random() * 10,
          t0: T,
          life: 1.4,
        });
      }
    }
  }

  private stepFootfalls(T: number): void {
    const you = this.you;
    if (
      this.stamps === null ||
      this.age('walkIn') < 0 ||
      this.age('cord') >= 0 ||
      !you.walking ||
      !you.g
    ) {
      this.footWas = null;
      return;
    }
    const feet = WK.feetOf(you, T),
      was = this.footWas ?? [];
    feet.forEach((f, k) => {
      if (!f.planted || was[k] !== false || f.x < L.inside) return;
      this.dust(f.x - 3, f.y - 3, 1, 0, -7, -4, 0.6);
      this.dust(f.x + 4, f.y - 2, 0, 0.04, 6, -3, 0.5);
    });
    this.footWas = feet.map((f) => f.planted);
  }

  private stepMotes(T: number): void {
    if (T <= this.nextMote) return;
    const lit = bulbLevel(this.age('bulb'));
    this.nextMote = T + (lit >= 1 ? 0.16 : 0.07);
    if (lit < 1 || Math.random() < 0.3) {
      const [x, y] = this.inBeam(Math.random, Math.random, Math.random);
      this.parts.push({
        k: 'mote',
        src: 'cold',
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: 0.6 + Math.random() * 1.2,
        t0: T,
        life: 4 + Math.random() * 3,
      });
    }
    if (lit > 0) {
      const [x, y] = this.inCone(Math.random, Math.random);
      this.parts.push({
        k: 'mote',
        src: 'warm',
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: -0.4 - Math.random(),
        t0: T,
        life: 4 + Math.random() * 3,
      });
    }
  }

  private stepSpider(T: number, dt: number): void {
    const sp = this.spider;
    if (sp.phase === 'up' && T > sp.next) sp.phase = 'down';
    if (sp.phase === 'down') {
      sp.y += dt * 14;
      if (sp.y > 84) {
        sp.phase = 'hang';
        sp.next = T + 2.5;
      }
    }
    if (sp.phase === 'hang' && T > sp.next) sp.phase = 'climb';
    if (sp.phase === 'climb') {
      sp.y -= dt * (sp.fast ? 34 : 9);
      if (sp.y < L.tie + 4) {
        sp.y = L.tie + 4;
        sp.phase = 'up';
        sp.fast = false;
        sp.next = T + 7 + Math.random() * 5;
      }
    }
  }

  private stepMouse(T: number, dt: number): void {
    if (!this.mouse && T > this.nextMouse) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.mouse = { x: dir > 0 ? 150 : 478, dir, stop: 260 + Math.random() * 120, paused: 0 };
    }
    const m = this.mouse;
    if (!m) return;
    if (m.paused > 0) m.paused -= dt;
    else {
      m.x += m.dir * (m.fast ? 130 : 58) * dt;
      if (Math.abs(m.x - m.stop) < 2 && m.stop) {
        m.paused = 0.9;
        m.stop = 0;
      }
    }
    if (m.x > 482 || m.x < 140) {
      this.mouse = null;
      this.nextMouse = T + 8 + Math.random() * 7;
    }
  }

  // ----- drawing helpers -----
  protected rect(x: number, y: number, w: number, h: number, col: string): void {
    const S = this.s;
    this.ctx.fillStyle = col;
    this.ctx.fillRect(Math.round(x) * S, Math.round(y) * S, w * S, h * S);
  }

  private alpha(a: number, fn: () => void): void {
    this.ctx.globalAlpha = a;
    fn();
    this.ctx.globalAlpha = 1;
  }

  private blink(): boolean {
    return this.t < this.blinkUntil;
  }

  // A blink has two eyelid frames: half closed, closed, half closed.
  private blinkMood(): string | null {
    const age = this.t - (this.blinkUntil - 0.13);
    if (age < 0 || age >= 0.13) return null;
    if (age < 0.04 || age >= 0.09) return 'half';
    return 'blink';
  }

  // ----- the people -----
  private youFrontImg(blinkNow: boolean, turn: number): Img {
    if (!turn) return this.spr.youFront[blinkNow ? 1 : 0];
    let img = this.youTurn.get(turn);
    if (!img) {
      img = PP.youFront(false, turn, turn);
      if (this.youTurn.size > 160) this.youTurn.clear();
      this.youTurn.set(turn, img);
    }
    return img;
  }

  private drawYou(T: number): void {
    const you = this.you,
      top = you.feet - 96;
    if (you.action && !you.walking) {
      this.drawYouAction(you, T);
      return;
    }
    if (WK.side(you, T)) {
      CR.drawWalker(this, you, T, {
        mood: this.blinkMood() || 'smile',
        hold: you.carry === 'keys' ? CR.keys : null,
      });
      return;
    }
    const shrug =
      T - this.shrugT < 1.0
        ? Math.round(Math.abs(Math.sin((T - this.shrugT) * Math.PI * 2)) * 2)
        : 0;
    this.imgF(
      this.youFrontImg(this.blink(), WK.turnSide(you, T)),
      you.x,
      top - shrug + settled(you, T),
    );
    if (shrug) this.imgF(this.textImg('oh well', '#c9c2d0'), you.x + 4, top - 12);
    if (you.carry === 'keys') {
      this.imgF(CR.keys, you.x + 26, you.feet - 44);
      this.imgF(CR.envelope, you.x + 8, you.feet - 44);
    }
  }

  private drawYouAction(you: You, T: number): void {
    if (!you.action) return;
    const p = youPose(you.action, (id) => this.age(id), T, this.reduced);
    if (!p.name) {
      this.imgF(this.spr.youFront[this.blink() ? 1 : 0], you.x, you.feet - 96);
      return;
    }
    const at = placePose(p.name, you.x + (p.dx || 0), you.feet, p.left);
    this.imgF(at.img, at.x, at.y);
  }

  // Every change of a front pose passes through three in-between frames over 0.16 s.
  private blendPose(a: Crew, pose: string, T: number): string {
    if (a.pTo !== pose) {
      a.pFrom = a.pTo || pose;
      a.pTo = pose;
      a.pT0 = T;
    }
    const from = a.pFrom ?? pose;
    const q = (T - (a.pT0 ?? T)) / 0.16;
    if (q >= 1 || from === pose || this.instant()) return pose;
    const k = Math.floor(q * 4);
    return k ? `${from}>${pose}:${k}` : from;
  }

  private buddyImg(a: Crew): { img: Img; pose: string; dy: number } {
    const T = this.t;
    let pose = a.pose || 'down',
      mood = a.mood || this.blinkMood() || 'smile',
      dy = 0;
    const habit = this.habit.kind;
    const f =
      a === this.buddy && habit && !this.busy ? WK.habitFrame(habit, T - this.habit.t0) : null;
    if (f) {
      pose = f.pose;
      dy = f.dy;
      a.pTo = f.pose.split('>')[0];
      if (!a.mood && f.mood !== 'smile') mood = f.mood;
    } else pose = this.blendPose(a, pose, T);
    const breath = a.behind && !a.walking && !dy && breathing(a, T) ? 1 : 0;
    return { img: CR.buddy(a.key, pose, mood, 0, 0, WK.turnSide(a, T), breath), pose, dy };
  }

  private drawBuddy(a: Crew): void {
    const T = this.t;
    if (WK.side(a, T)) {
      const mood = a.mood === 'laugh' ? 'laugh' : this.blinkMood() || 'smile';
      CR.drawWalker(this, a, T, {
        mood,
        hold: a.carry ? CR.box2 : a.hold || null,
        carry: !!a.carry && !a.armHold,
      });
      return;
    }
    const { img, pose, dy } = this.buddyImg(a);
    const top = a.top + dy + settled(a, T);
    this.imgF(img, a.x, top);
    const appraising = pose === 'hold' && T - this.appraise < 1.4;
    CR.frontProps(this, a.key, pose, a.x, top, appraising ? 'hold' : null);
    if (a.carry) this.imgF(CR.box2, a.x + CR.CX - 11, top + 50);
  }

  private custSideMood(c: Cust): string {
    if (this.blinkMood() === 'blink') return 'blink';
    return c.mood === 'happy' ? 'smile' : 'worried';
  }

  private custHeld(c: Cust): Img | null {
    if (c.carry === 'bundle') return CR.bundle;
    if (c.carry) return CR.mini(c.carry, 4);
    return null;
  }

  private drawCust(T: number): void {
    const c = this.cust;
    if (!c) return;
    if (WK.side(c, T)) {
      CR.drawWalker(this, c, T, {
        mood: this.custSideMood(c),
        hold: this.custHeld(c),
        carry: !!c.carry && !c.armHold,
      });
      return;
    }
    const sp = CR.customer(
      c.i,
      c.mood,
      this.blink(),
      WK.turnSide(c, T),
      c.carry ? 'chest' : 'down',
    );
    const top = c.feet - 96 + settled(c, T);
    this.imgF(sp.img, c.x, top);
    if (c.carry === 'bundle') this.imgF(CR.bundle, c.x + 6, top + 33);
    else if (c.carry) this.imgF(CR.mini(c.carry, 4), c.x + 6, top + 32);
  }

  private crewList(): Crew[] {
    return [this.buddy, this.cand, this.old].filter((a): a is Crew => a !== null);
  }

  // ----- the street front -----
  private drawFacade(f: FacadeState, T: number): void {
    const w = L.window,
      d = L.door,
      art = this.art;
    if (f.windowAlpha > 0) this.alpha(f.windowAlpha, () => this.img(art.glass.win, w.x, w.y));
    for (const [x, y] of L.uppers)
      this.img(f.seams ? art.upperSeams : art.upperBoards, x - 2, y - 2);
    this.drawPlanks(f);
    this.drawNeonAndBalls(f);
    if (this.helpShown(f)) this.img(art.help, w.x + 10, w.y + 4);
    if (f.doorFrame > 0) this.alpha(f.doorGlassAlpha, () => this.img(art.glass.door, d.x, d.y));
    this.img(art.door[f.doorFrame].img, d.x, d.y - 2);
    this.drawLockAndChain(f, T);
    const note = this.visibleNote();
    if (note) {
      const nt = noteImg(note, 44),
        k = this.reduced ? 1 : clamp((T - this.noteT) / 0.3, 0, 1);
      this.imgF(nt, d.x + d.w / 2 - nt.width / 2, d.y + 78 - (1 - k) * 30);
    }
  }

  private drawPlanks(f: FacadeState): void {
    this.art.planks.forEach((p, i) => {
      const st = f.planks[i];
      if (st.mode === 'mounted') this.img(p.img, p.x, p.y);
      else if (st.mode === 'falling') this.imgF(p.fall[st.frame], st.x, st.y);
      else this.img(p.fall[2], st.x, st.y);
    });
  }

  private drawNeonAndBalls(f: FacadeState): void {
    const n = this.art.neon;
    this.img(n.off, L.neon.x, L.neon.y);
    n.letters.forEach((lt, i) => {
      if (!f.neon[i]) return;
      this.alpha(0.3, () => this.img(lt.glow2, L.neon.x, L.neon.y));
      this.alpha(0.65, () => this.img(lt.glow1, L.neon.x, L.neon.y));
      this.img(lt.tube, L.neon.x, L.neon.y);
    });
    this.img(this.art.ballsDull, L.balls.x, L.balls.y + 1);
    if (f.ballsAlpha > 0) {
      this.alpha(f.ballsAlpha, () => this.img(this.art.ballsLit, L.balls.x, L.balls.y + 1));
    }
  }

  // The chain slides through the staple link by link, falls and piles up under the lock.
  private drawLockAndChain(f: FacadeState, T: number): void {
    const art = this.art,
      pts = art.chainPts,
      n = pts.length - 1,
      hp = L.heap,
      lk = f.lock;
    if (f.links[0]?.mode === 'rest') {
      for (const [x, y, kind] of pts) {
        this.img(kind === 'face' ? art.linkFace : art.linkEdge, x, y + (kind === 'face' ? 0 : 1));
      }
      const rat = this.lockRattle && !this.reduced ? Math.round(Math.sin(T * 30)) : 0;
      const snap = T - this.lockSnap < 0.3 && !this.reduced ? -2 : 0;
      if (lk.open) this.img(art.lockOpen, lk.x, lk.y);
      else this.img(art.lock, lk.x + rat, lk.y + snap);
      return;
    }
    f.links.forEach((l, i) => {
      if (l.mode === 'thread') {
        const j = Math.floor(l.along),
          u = l.along - j,
          [x0, y0] = pts[j],
          [x1, y1] = pts[Math.min(n, j + 1)];
        const img = pts[i][2] === 'face' ? art.linkFace : art.linkEdge;
        this.imgF(img, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u);
      } else if (l.mode === 'fall') this.imgF(art.linkFace, l.x, l.y);
    });
    if (f.landed) {
      const img = art.heap[f.heapFrame];
      this.img(img, hp.x - Math.floor(img.width / 2), hp.y - img.height - f.heapHop);
    }
    this.imgF(art.lockOpen, lk.x, lk.y);
  }

  private drawBoard(): void {
    const b = L.board;
    const head = this.textImg('CREW WANTED', '#2a1a14');
    this.rect(b.x + 4, b.y + 3, b.w - 8, 9, R.paper[2]);
    this.img(head, b.x + Math.floor((b.w - head.width) / 2), b.y + 3);
    this.boardNow().forEach((row, i) => {
      const y = b.y + 14 + i * 19,
        acc = accentOf(rarityOf(row.rarity)),
        lit = row.on || row.live;
      this.rect(b.x + 3, y, b.w - 6, 17, lit ? R.paper[3] : R.paper[1]);
      this.rect(b.x + 3, y, 3, 17, acc[2]);
      this.img(this.textImg(row.name, lit ? '#2a1a14' : '#5a5048'), b.x + 8, y + 1);
      if (row.on) {
        const tag = this.textImg('ON SHIFT', PAPER);
        this.rect(b.x + 7, y + 9, tag.width, 7, R.red[2]);
        this.img(tag, b.x + 7, y + 9);
      } else {
        this.img(this.textImg(fmt(row.price), row.live ? acc[0] : '#6a6058'), b.x + 8, y + 9);
      }
      if (!lit) this.img(this.art.lock, b.x + b.w - 13, y + 4);
      else if (row.live) this.img(sparkle, b.x + b.w - 11, y + 5);
    });
  }

  private drawShelf(): void {
    const entries = this.shelfNow(),
      now = Date.now();
    for (const { item, slot } of entries) {
      const [x, y] = slotXY(slot);
      this.img(CR.mini(item.rarity, dustLevel(item, now)), x + 1, y - 1);
      const tag = this.textImg(fmt(item.price), '#2a1a14'),
        tw = tag.width;
      this.rect(x + 10 - Math.ceil(tw / 2), y + 16, tw + 1, 7, R.paper[3]);
      this.img(tag, x + 10 - Math.ceil(tw / 2), y + 16);
    }
    const live = new Set(entries.map((e) => e.item.publicStockItemId));
    for (const id of [...this.slotOfId.keys()]) {
      if (!live.has(id) && !this.hidden.has(id)) this.slotOfId.delete(id);
    }
  }

  // The counter cloth comes down in four drawn frames and stays as a pile. The shelf drape is
  // tucked under it, follows a moment later and drops out of sight behind the counter.
  private drawSheets(f: FacadeState): void {
    const sh = this.art.sheets;
    if (f.drape < 3) this.img(sh.drape[f.drape].img, sh.drape[f.drape].x, sh.drape[f.drape].y);
    for (const st of sh.stay) this.img(st.img, st.x, st.y);
    const c = sh.counter[f.cloth];
    this.img(c.img, c.x, c.y);
  }

  private drawBulb(f: FacadeState): void {
    const bb = L.bulb,
      lv = f.bulbLevel,
      sw = f.bulbSwing,
      bx = bb.x + sw,
      by = bb.y + 8,
      S = this.s;
    this.ctx.fillStyle = R.black[3];
    for (let k = 0; k <= 8; k++) {
      this.ctx.fillRect(Math.round((bb.x + (sw * k) / 8) * S), (bb.y + k - 1) * S, S, S);
    }
    if (lv >= 0.7) this.imgF(this.art.bulbOn, bx - 2, by);
    else bulbOff({ set: (x, y, c) => this.rect(x, y, 1, 1, c) }, Math.round(bx), by + 1);
    // the pull chain: beads under the socket, a brass pull at the end, stretched by the tug
    const y0 = by + 4,
      y1 = bb.cordY + f.cordTug;
    for (let y = y0; y < y1; y += 2) {
      this.rect(Math.round(bx + sw * ((y - y0) / (y1 - y0)) * 0.5), y, 1, 1, '#8a8070');
    }
    const ex = Math.round(bx + sw * 0.5);
    this.rect(ex, y1, 1, 3, R.gold[1]);
    this.rect(ex, y1, 1, 1, R.gold[2]);
  }

  // The bulb's cone and its pools lie under the people, so legs and shoes keep their colours.
  private drawConeHaze(f: FacadeState): void {
    if (f.bulbLevel <= 0) return;
    const dx = Math.round(f.bulbSwing * 0.5);
    this.art.cone.imgs.forEach((im, i) =>
      this.alpha(CONE_A[i] * f.bulbLevel, () => this.img(im, dx, 0)),
    );
  }

  private drawConePools(f: FacadeState): void {
    if (f.bulbLevel <= 0) return;
    this.art.cone.pools.forEach((im, i) =>
      this.alpha(CONE_A[i] * f.bulbLevel, () => this.img(im, 0, 0)),
    );
  }

  // Over the people: the shut room's dark, and the cold beams, so he catches each beam as he crosses.
  private drawLight(f: FacadeState): void {
    const lv = f.bulbLevel;
    if (lv < 1) this.alpha(0.62 * (1 - lv), () => this.img(this.art.dim, 0, 0));
    const cold = 1 - 0.75 * lv;
    this.art.beams.imgs.forEach((im, i) => this.alpha(BEAM_A[i] * cold, () => this.img(im, 0, 0)));
  }

  private drawPrints(): void {
    const upTo = this.printsUpTo();
    if (upTo < 0) return;
    for (const [x, y] of PRINTS) {
      if (x >= upTo) continue;
      this.rect(x, y, 4, 1, '#160e0a');
      this.rect(x + 1, y - 1, 2, 1, '#160e0a');
      this.rect(x - 1, y, 1, 1, '#6e665a');
      this.rect(x + 4, y - 1, 1, 1, '#6e665a');
      this.rect(x + 3, y - 1, 1, 1, '#4e483e');
    }
  }

  private drawLed(): void {
    const rows = this.ledNow();
    if (rows === null) return;
    this.img(ledPanel(rows, L.nextSign.w, AMBER), L.nextSign.x, L.nextSign.y);
  }

  private drawCounterTop(T: number): void {
    this.img(this.art.register, L.register.x, L.register.y);
    if (this.drawerOpen(T)) this.img(this.art.drawer, L.register.x + 2, L.register.y + 22);
    const o = this.onCounter;
    if (o) this.img(o.img, o.x - Math.floor(o.img.width / 2), o.y - Math.floor(o.img.height / 2));
  }

  private flapFrame(T: number): number {
    const k = this.instant() ? 2 : clamp(Math.floor((T - this.flap.t) / 0.07), 0, 2);
    return this.flap.open ? k : 2 - k;
  }

  private drawCounterGap(T: number): void {
    if (!this.isOpen()) return;
    const f = this.flapFrame(T),
      x = L.flap.x,
      w = L.flap.w,
      top = L.counterTop,
      bot = L.counterBottom;
    if (f > 0) {
      this.rect(x, top, w, bot - top, '#140d0b');
      this.rect(x, top, 1, bot - top, '#2a1c14');
      if (f === 1) {
        this.rect(x + 4, top + 4, w - 4, bot - top - 4, R.wood[1]);
        this.rect(x + 4, top + 4, 1, bot - top - 4, INK);
        for (let k = 0; k < 10; k++) {
          this.rect(
            Math.round(x + w - 2 - k * 0.75),
            Math.round(top - k * 0.65),
            2,
            2,
            k % 3 ? R.wood[3] : '#e2c08a',
          );
        }
      } else {
        this.rect(x + w - 2, top + 4, 2, bot - top - 4, R.wood[2]);
        this.rect(x + w - 3, top + 4, 1, bot - top - 4, INK);
        this.rect(x + w - 4, top - 11, 4, 12, INK);
        this.rect(x + w - 3, top - 10, 2, 11, R.wood[3]);
        this.rect(x + w - 3, top - 10, 1, 11, '#e2c08a');
      }
    }
    this.img(this.spr.steps, STAIR_X, L.floorY - 2 * RISE);
    // a buddy on the steps stands in front of the counter face, so draw him again left of the gap's far edge
    const c = this.ctx;
    for (const a of this.crewList()) {
      if (!a.behind || a.track !== 'stairs') continue;
      c.save();
      c.beginPath();
      c.rect(0, 0, (x + w) * this.s, H * this.s);
      c.clip();
      this.drawBuddy(a);
      c.restore();
    }
  }

  private drawSpider(): void {
    const sp = this.spider,
      x = L.spiderX,
      S = this.s;
    this.ctx.fillStyle = '#8a8494';
    this.ctx.fillRect(x * S, L.tie * S, Math.max(1, S / 2), Math.round((sp.y - L.tie) * S));
    this.imgF(this.spr.spider, x - 4, sp.y);
  }

  private drawMouse(T: number): void {
    const m = this.mouse;
    if (!m) return;
    const fr = m.paused > 0 ? 0 : Math.floor(T * 10) % 2;
    this.imgF((m.dir > 0 ? this.spr.mouse : this.spr.mouseL)[fr], m.x - 8, L.floorY - 6);
  }

  // ----- motes -----
  // Motes live only inside the light. A spawn point inside a beam or the cone, from three randoms.
  private inBeam(r1: () => number, r2: () => number, r3: () => number): [number, number] {
    const bs = this.art.BEAMS,
      b = bs[Math.floor(r1() * bs.length) % bs.length];
    const y = b.y0 + 6 + r2() * (b.y1 - b.y0 - 6),
      t = (y - b.y0) / (b.y1 - b.y0),
      half = b.h0 + (b.h1 - b.h0) * t;
    return [b.x0 + (y - b.y0) * this.art.SLANT + (r3() - 0.5) * 1.7 * half, y];
  }

  private inCone(r1: () => number, r2: () => number): [number, number] {
    const top = L.bulb.y + 14,
      y = top + r1() * (L.counterTop - 4 - top),
      half = 3 + (y - L.bulb.y - 9) * 0.62;
    return [L.bulb.x + (r2() - 0.5) * 1.7 * half, y];
  }

  // A mote is as bright as the band it is crossing, and invisible outside the light.
  private moteColor(p: { src?: 'cold' | 'warm'; x: number; y: number }, lv: number): string | null {
    const grid = p.src === 'warm' ? this.art.cone.grid : this.art.beams.grid;
    const x = Math.round(p.x),
      y = Math.round(p.y);
    if (x < 0 || y < 0 || x >= W || y >= H) return null;
    const band = grid[y * W + x];
    if (!band) return null;
    if (p.src === 'cold' && lv >= 1) return MOTE_COLD[Math.max(0, band - 2)];
    return (p.src === 'warm' ? MOTE_WARM : MOTE_COLD)[band - 1];
  }

  // Under reduced motion the motes stand still: a fixed scatter in the light that is there.
  private drawStillMotes(lv: number): void {
    if (!this.stillMotes) {
      srand(99);
      const cold: Mote[] = [],
        warm: Mote[] = [];
      for (let k = 0; k < 40; k++) {
        const [x, y] = this.inBeam(rand, rand, rand);
        cold.push({ src: 'cold', x, y });
      }
      for (let k = 0; k < 30; k++) {
        const [x, y] = this.inCone(rand, rand);
        warm.push({ src: 'warm', x, y });
      }
      this.stillMotes = { cold, warm };
    }
    const c = this.ctx,
      S = this.s,
      still = this.stillMotes;
    const list = lv >= 1 ? still.warm.concat(still.cold.slice(0, 12)) : still.cold;
    for (const p of list) {
      const col = this.moteColor(p, lv);
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(Math.round(p.x) * S, Math.round(p.y) * S, S, S);
    }
  }

  private drawParticles(lv: number, T: number): void {
    const c = this.ctx,
      S = this.s;
    if (this.reduced) this.drawStillMotes(lv);
    for (const p of this.parts) {
      if (T < p.t0) continue;
      const age = (T - p.t0) / p.life;
      if (p.k === 'mote' && p.src) {
        const col = this.moteColor(p, lv);
        if (col) {
          c.fillStyle = col;
          c.fillRect(Math.round(p.x) * S, Math.round(p.y) * S, S, S);
        }
      } else if (p.k === 'mote') {
        c.fillStyle = age < 0.5 ? '#e8dcc0' : '#b8ac94';
        c.fillRect(Math.round(p.x * S), Math.round(p.y * S), S, S);
      } else if (p.k === 'clump') {
        const f = Math.min(4, Math.floor(age * 5)),
          im = this.spr.puff[p.r][f];
        this.alpha(CLUMP_ALPHA[f], () => this.imgF(im, p.x - im.width / 2, p.y - im.height / 2));
      } else this.imgF(sparkle, p.x - 2, p.y - 2);
    }
  }

  private drawFx(T: number): void {
    for (const f of this.fliers) {
      const k = clamp((T - f.t0) / f.dur, 0, 1),
        n = f.pts.length - 1;
      const seg = Math.min(n - 1, Math.floor(k * n)),
        u = easeInOut(k * n - seg);
      const [x0, y0] = f.pts[seg],
        [x1, y1] = f.pts[seg + 1];
      const x = x0 + (x1 - x0) * u,
        y = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * f.arc;
      this.imgF(f.img, x - f.img.width / 2, y - f.img.height / 2);
    }
    const S = this.s;
    for (const p of this.plates) {
      const age = T - p.at,
        k = this.reduced ? 1 : clamp(age / 0.12, 0, 1);
      const w = p.img.width * (0.6 + 0.4 * k),
        h = p.img.height * (0.6 + 0.4 * k);
      const x = clamp(p.x - w / 2, 2, W - w - 2),
        y = clamp(p.y - h / 2, 2, H - h - 2);
      this.ctx.drawImage(
        p.img,
        Math.round(x * S),
        Math.round(y * S),
        Math.round(w * S),
        Math.round(h * S),
      );
    }
  }

  protected draw(): void {
    const S = this.s,
      T = this.t;
    this.syncReady();
    const f = this.facade(),
      open = this.isOpen();
    this.ctx.clearRect(0, 0, W * S, H * S);
    this.img(this.art.back, 0, 0);
    this.drawFacade(f, T);
    this.drawBoard();
    this.drawBulb(f);
    this.drawConeHaze(f);
    if (open) this.drawShelf();
    for (const a of this.crewList()) if (a.behind) this.drawBuddy(a);
    if (open) this.drawCounterTop(T);
    this.img(this.art.front, 0, 0);
    this.drawConePools(f);
    this.drawPrints();
    this.drawLed();
    this.drawSheets(f);
    this.drawCounterGap(T);
    this.drawSpider();
    for (const a of this.crewList()) if (!a.behind) this.drawBuddy(a);
    this.drawCust(T);
    this.drawYou(T);
    this.drawMouse(T);
    this.drawLight(f);
    this.drawParticles(f.bulbLevel, T);
    this.drawFx(T);
  }
}
