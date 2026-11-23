// The bank room: the CHECKS CASHED storefront at night with its queue, the loan shark, the
// enforcer, the LED under the window and the letter board. The room draws what it is told to
// show and never computes a loan, a fee or a payout. Its ambient life (queue, door, smoke, steam,
// sparks, rat and flickering lights) steps on the room clock and keeps no timer of its own.
// `run` plays the steps of a loan or a wire as beats on the same clock. Only the reduced-motion
// sweep of the stamp and the plates and the LED clock use a real timer.
import { Sprite, bayer, box, cylV, disc, measure, rand, R, srand, text } from '../street/pix';
import * as FL from '../casino/floor';
import { GOLD, GREEN, PAPER, REDL, Room, clamp, easeOut, flipX, fmt } from '../casino/room';
import type { RoomOpts } from '../casino/room';
import type { PlateLine } from '../casino/sprites';
import { BOARD_FEE, boardLine, boardRows, ledRows, neonLines, slipLabel } from './bank-labels';
import type { BoardRow } from './bank-labels';
import type {
  BankLoan,
  BankOffer,
  BankShown,
  BankStep,
  BankWallet,
  Collector,
  DueFormat,
  WireSlip,
} from './bank-watch';
import * as PP from './people';
import { L, W, H, anchors as A, bank } from './rooms';
import * as SP from './sprites';

export const FOCUS_X = { loans: 244, wires: 372 } as const;
export const STAMP_OK = ['#173328', '#2a5a3c', '#4a8a4a', '#8cc063'];
export const STAMP_NO = ['#43142a', '#7a2034', '#b0383a', '#ff8a6a'];
export const STAMP_PAID = ['#3a2a08', '#7a5a14', '#d9a520', '#ffd75e'];

export interface BankRoomOpts extends RoomOpts {
  focus?: 'loans' | 'wires';
  format?: DueFormat | null;
  onReveal?: () => void;
  onIdle?: () => void;
}
export interface BankPainted {
  readonly led: readonly string[];
  readonly board: readonly string[];
  readonly neon: readonly string[];
  readonly slips: readonly string[];
  readonly stamp: string | null;
  readonly plate: readonly string[] | null;
  readonly calc: string;
  readonly you: { readonly x: number; readonly spot: string };
  readonly brute: { readonly x: number; readonly inside: boolean; readonly pose: string };
  readonly shark: string;
  readonly redLight: boolean;
  readonly polaroid: boolean;
}

type Pt = readonly [number, number];
type Beat = (done: () => void) => void;
type Stop = Exclude<Spot, 'moving'>;
type Neon = ReturnType<typeof SP.neon>;
type Spot = 'queue' | 'loan' | 'wires' | 'curb' | 'moving';
type Face = 'front' | 'back' | 'left' | 'right' | 'sit';
type SharkPose =
  'idle' | 'inspect' | 'calc' | 'stampUp' | 'stampDown' | 'pay' | 'count' | 'camera' | 'laugh';
type SharkIdle = 'beckon' | 'coin' | 'puff';
type BrutePose = 'idle' | 'stand' | 'walk' | 'tap' | 'point' | 'knock';
type BruteMode = BrutePose | 'lean';
interface Hand {
  img: HTMLCanvasElement;
  dx: number;
  dy: number;
}
interface Actor {
  x: number;
  walking: boolean;
  dist: number;
  tx: number;
  speed: number;
  arrive: (() => void) | null;
}
interface You extends Actor {
  feet: number;
  spot: Spot;
  face: Face;
  arm: 'reach' | null;
  sitT: number;
}
interface GateStep {
  f0: number;
  t0: number;
  done: () => void;
}
interface Brute extends Actor {
  feet: number;
  inside: boolean;
  pose: BrutePose;
  t0: number;
  lean: number;
  stepDown: GateStep | null;
  stepUp: GateStep | null;
}
interface Shark {
  pose: SharkPose;
  t0: number;
  grinUntil: number;
  laughUntil: number;
  sadUntil: number;
  calc: string;
  stamp: 'ok' | 'no' | 'paid' | null;
  nextIdle: number;
  idle: SharkIdle | null;
  idleT0: number;
}
interface Canister {
  y: number;
  t0: number;
  dir: number;
}
interface Part {
  k: 'steam' | 'smoke' | 'spark' | 'zzz';
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  life: number;
  ph?: number;
}
interface Flier {
  img: HTMLCanvasElement;
  pts: readonly Pt[];
  dur: number;
  t0: number;
  arc: number;
  done: () => void;
}
interface Slammed {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  at: number;
  word: string;
}
interface Plate {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  at: number;
  life: number;
  lines: readonly string[];
}
interface Rat {
  x: number;
  dir: number;
}
interface Flick {
  off: number;
  next: number;
}

const SPOTS = {
  queue: { x: A.youQueue, face: 'front' },
  loan: { x: A.youLoan, face: 'back' },
  wires: { x: A.youWires, face: 'back' },
  curb: { x: A.youCurb, face: 'sit' },
} as const;
const BARREL = { x: 26, y: 168 };
const SPIKE_SLIPS = 5;
const BOARD_X = [3, 45, 71, 97];
const NEON_RATES = [0.08, 0.12, 0.06, 0.3, 0.1];
const AT_WINDOW = ['PendingApproval', 'Active', 'CollectionPending', 'Overdue'];
const BRUTE_INSIDE_FEET = 166;
const SWEEP_MS = 2800;
const STAMP_LIFE = 2.2;
const GATE_SECONDS = 0.4;
const YOU_SPEED = 46;

const easeInOut = (k: number): number =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const besideX = (x: number): number => x - 33;
const atWindow = (loan: BankLoan | null): boolean =>
  loan !== null && AT_WINDOW.includes(loan.status);

function beaconOf(loan: BankLoan | null): boolean {
  if (loan === null) return false;
  if (loan.status === 'Overdue') return true;
  return loan.status === 'CollectionPending' && loan.overdueSince !== null;
}

function sharkOf(loan: BankLoan | null): SharkPose {
  if (loan === null) return 'idle';
  if (loan.status === 'PendingApproval') return 'inspect';
  if (loan.status === 'CollectionPending') return 'count';
  return 'idle';
}

function bruteMode(b: Brute): BruteMode {
  if (b.inside && b.lean) return 'lean';
  return b.pose;
}

function flameColor(k: number): string {
  if (k > 0.75) return '#ffe9a8';
  if (k > 0.45) return '#ffb040';
  if (k > 0.2) return '#e8602a';
  return '#a8301c';
}

function buildSprites() {
  const q = PP.queuePeople();
  const clerk = FL.person({
    skin: R.skinC,
    hair: 'bald',
    hairRamp: R.grey,
    top: R.white,
    neck: 'tie',
    tieRamp: R.green,
    collar: true,
    garters: true,
    visor: true,
  });
  const lackey = FL.person({
    skin: R.skinA,
    hair: 'slick',
    hairRamp: R.hair,
    top: R.white,
    over: R.olive,
    overKind: 'vest',
    neck: 'tie',
    tieRamp: R.red,
    collar: true,
    garters: true,
  });
  const sharkFaces = {} as Record<PP.SharkMood, HTMLCanvasElement>;
  for (const m of ['smirk', 'blink', 'grin', 'laugh', 'sad', 'loupe'] as const) {
    sharkFaces[m] = PP.shark(m);
  }
  const youWalk = PP.youWalk();
  return {
    q,
    clerk,
    lackey,
    sharkFaces,
    youFront: [PP.youFront(false, 1), PP.youFront(true, 1), PP.youFront(false, 0)],
    youBack: PP.youBack(),
    youWalk,
    youWalkL: youWalk.map(flipX),
    youSit: [PP.youSit(false), PP.youSit(true)],
    brute: {
      idle: PP.enforcer({}),
      chew: PP.enforcer({ chew: true }),
      walkA: PP.enforcer({ walk: true, step: 1 }),
      walkB: PP.enforcer({ walk: true, step: -1 }),
    },
    open: SP.neon('OPEN', 'jersey', SP.NRED, '#ffd8cc'),
    wires: SP.neon('WIRES', 'jersey', ['#0b2530', '#164a58', '#2a8ea3', '#8ef0ff'], '#e6fdff'),
    ratL: PP.rat.map(flipX),
  };
}

function buildFx() {
  const barrel = (() => {
    const s = new Sprite(18, 26);
    cylV(s, 1, 2, 16, 23, R.rust);
    for (const j of [6, 14, 21]) s.hline(1, j, 16, R.rust[0]);
    s.rect(1, 0, 16, 3, '#2a1210');
    s.hline(1, 0, 16, R.rust[3]);
    s.set(5, 10, '#ff9a3a');
    s.set(11, 17, '#ff9a3a');
    s.outline();
    return s.canvas();
  })();
  const fire = [0, 1, 2, 3, 4, 5].map((f) => {
    const s = new Sprite(16, 16);
    srand(f * 7 + 3);
    for (let i = 0; i < 16; i++) {
      const h =
        4 +
        Math.round((Math.sin(i * 0.9 + f * 1.7) + 1) * 3 + rand() * 4) -
        Math.abs(i - 7.5) * 0.6;
      for (let j = 0; j < h; j++) s.set(i, 15 - j, flameColor(j / Math.max(1, h)));
    }
    return s.canvas();
  });
  const puff = [2, 3, 5, 7].map((r) => {
    const s = new Sprite(r * 2 + 1, r * 2 + 1);
    for (let j = 0; j <= 2 * r; j++)
      for (let i = 0; i <= 2 * r; i++) {
        const d = Math.hypot(i - r, (j - r) * 1.2) / r;
        if (d > 1) continue;
        if (d < 0.45) s.set(i, j, '#d8d4de');
        else if (bayer(i, j) < 0.8 - d * 0.6) s.set(i, j, d < 0.75 ? '#b0acb8' : '#7a7684');
      }
    return s.canvas();
  });
  return { barrel, fire, puff };
}

const CAMERA = (() => {
  const s = new Sprite(18, 12);
  box(s, 0, 2, 18, 10, R.black, { band: 1 });
  disc(s, 9, 7, 3.4, R.grey[1]);
  disc(s, 9, 7, 2, '#5a7b8a');
  s.rect(13, 0, 4, 2, R.white[2]);
  s.outline();
  return s.canvas();
})();

function boardImage(rows: readonly BoardRow[]): HTMLCanvasElement {
  const b = L.board,
    s = new Sprite(b.w - 4, b.h - 4);
  const col = (str: string, x: number, y: number, c: string) =>
    text(s, str, x, y, c, 'tiny', { alignTop: true, shadow: '#000000' });
  col("TODAY'S DEALS", 3, 2, '#f6dc6a');
  col(BOARD_FEE, b.w - 8 - measure(BOARD_FEE), 2, '#ff6b6b');
  if (rows.some((r) => r.locked))
    col('MEMBERS ONLY', b.w - 8 - measure('MEMBERS ONLY'), 35, '#ff6b8a');
  rows.forEach((row, i) => {
    const y = 11 + i * 8,
      c = row.locked ? '#7a7484' : '#f6f3f6';
    row.cells.forEach((cell, k) => col(cell, BOARD_X[k], y, c));
    if (row.tag !== null) col(row.tag, b.w - 8 - measure(row.tag), y, '#ff6b8a');
  });
  const firstLocked = rows.findIndex((r) => r.locked);
  if (firstLocked >= 0) {
    const ry = 11 + firstLocked * 8 - 2;
    for (let x = 0; x < s.w; x++) {
      const sag = Math.round(Math.sin((x / s.w) * Math.PI) * 2);
      s.set(x, ry + sag, '#d02a3a');
      s.set(x, ry + sag + 1, '#7a1420');
    }
    for (const x of [0, s.w - 3]) {
      s.rect(x, ry - 2, 3, 5, R.gold[2]);
      s.set(x + 1, ry - 2, R.gold[3]);
    }
  }
  return s.canvas();
}

export class BankRoom extends Room {
  readonly focusX: number;
  private readonly art = bank();
  private readonly spr = buildSprites();
  private readonly fx = buildFx();
  private readonly format: DueFormat | null;
  private readonly onReveal: (() => void) | undefined;
  private readonly onIdle: (() => void) | undefined;
  private dead = false;
  private gen = 0;
  private queue: BankStep[] = [];
  private busy = false;
  private pendingRun = false;
  private held: { wallet: BankWallet | null } | null = null;
  private stampSweep: ReturnType<typeof setTimeout> | undefined;
  private plateSweep: ReturnType<typeof setTimeout> | undefined;
  private clockTimer: ReturnType<typeof setInterval> | undefined;
  private shown: BankShown = { loan: null, known: false, slips: [] };
  private offers: readonly BankOffer[] | null = null;
  private wallet: BankWallet | null = null;
  private turnover: number | null = null;
  private rows: readonly BoardRow[] = [];
  private board: HTMLCanvasElement = boardImage([]);
  private boardKey = '';
  private facade: Neon | null = null;
  private facadeKey = '';
  private you: You = {
    x: A.youQueue,
    feet: L.floorY,
    spot: 'queue',
    face: 'front',
    walking: false,
    dist: 0,
    tx: A.youQueue,
    speed: 0,
    arrive: null,
    arm: null,
    sitT: -9,
  };
  private queueShift = 0;
  private queueTarget = 0;
  private shark: Shark = {
    pose: 'idle',
    t0: 0,
    grinUntil: -9,
    laughUntil: -9,
    sadUntil: -9,
    calc: '',
    stamp: null,
    nextIdle: 2.5,
    idle: null,
    idleT0: 0,
  };
  private brute: Brute = {
    x: A.brute.x,
    feet: BRUTE_INSIDE_FEET,
    inside: true,
    pose: 'idle',
    t0: 0,
    walking: false,
    dist: 0,
    tx: A.brute.x,
    speed: 0,
    arrive: null,
    lean: 0,
    stepDown: null,
    stepUp: null,
  };
  private fliers: Flier[] = [];
  private slammed: Slammed | null = null;
  private plates: Plate[] = [];
  private flashAt = -9;
  private clerkAwakeUntil = -9;
  private lackeyFastUntil = -9;
  private gateOpen = 0;
  private door = 0;
  private redLight = false;
  private polaroid = false;
  private canister: Canister | null = null;
  private teletypeUntil = -9;
  private parts: Part[] = [];
  private rat: Rat | null = null;
  private nextRat = 6;
  private nextSteam = 0;
  private nextSmoke = 0;
  private flicks: Flick[] = NEON_RATES.map((_, i) => ({ off: 0, next: 1 + i }));
  private lamp: Flick = { off: 0, next: 1 };
  private tube: Flick = { off: 0, next: 4 };
  private box: Flick = { off: 0, next: 3 };

  constructor(cv: HTMLCanvasElement, opts: BankRoomOpts = {}) {
    super(cv, opts);
    this.focusX = FOCUS_X[opts.focus ?? 'loans'];
    this.format = opts.format ?? null;
    this.onReveal = opts.onReveal;
    this.onIdle = opts.onIdle;
  }

  get painted(): BankPainted {
    return {
      led: this.led,
      board: this.rows.map(boardLine),
      neon: this.offers === null ? [] : neonLines(this.offers),
      slips: this.spikeSlips.map(slipLabel),
      stamp: this.slammed?.word ?? null,
      plate: this.plates[0]?.lines ?? null,
      calc: this.calcText,
      you: { x: this.you.x, spot: this.you.spot },
      brute: { x: this.brute.x, inside: this.brute.inside, pose: this.brute.pose },
      shark: this.shark.pose,
      redLight: this.redLight,
      polaroid: this.polaroid,
    };
  }

  private get led(): readonly string[] {
    return ledRows(this.shown.loan, this.shown.known, Date.now(), this.format);
  }

  private get spikeSlips(): readonly WireSlip[] {
    return this.shown.slips.slice(0, SPIKE_SLIPS);
  }

  private get calcText(): string {
    const pose = this.shark.pose;
    return pose === 'calc' || pose === 'count' ? this.shark.calc : '';
  }

  place(shown: BankShown): void {
    if (this.dead) return;
    this.cancelRun();
    this.shown = shown;
    this.seat(shown.loan);
    this.kickDraw();
  }

  setOffers(offers: readonly BankOffer[] | null): void {
    if (this.dead) return;
    this.offers = offers;
    this.refreshSigns();
    this.kickDraw();
  }

  setWallet(wallet: BankWallet | null): void {
    if (this.dead) return;
    if (this.busy) {
      this.held = { wallet };
      return;
    }
    this.wallet = wallet;
    this.applyWallet();
    this.kickDraw();
  }

  private releaseWallet(): void {
    if (this.held === null) return;
    this.wallet = this.held.wallet;
    this.held = null;
    this.applyWallet();
  }

  private applyWallet(): void {
    this.turnover = this.wallet?.lifetimeTurnover ?? null;
    this.refreshSigns();
  }

  private refreshSigns(): void {
    this.rows = this.offers === null ? [] : boardRows(this.offers, this.turnover);
    const boardKey = this.rows.map(boardLine).join('|');
    if (boardKey !== this.boardKey) {
      this.board = boardImage(this.rows);
      this.boardKey = boardKey;
    }
    const lines = this.offers === null ? [] : neonLines(this.offers);
    const facadeKey = lines.join('|');
    if (facadeKey === this.facadeKey) return;
    this.facadeKey = facadeKey;
    this.facade = lines.length === 0 ? null : SP.neon(lines, 'tiny', SP.NGREEN, '#eaffd0', 7);
  }

  private seat(loan: BankLoan | null): void {
    const spot = atWindow(loan) ? 'loan' : 'queue';
    const out = beaconOf(loan);
    const you = this.you,
      b = this.brute,
      sh = this.shark;
    you.x = SPOTS[spot].x;
    you.face = SPOTS[spot].face;
    you.spot = spot;
    you.feet = L.floorY;
    you.walking = false;
    you.dist = 0;
    you.arrive = null;
    you.arm = null;
    b.walking = false;
    b.dist = 0;
    b.arrive = null;
    b.lean = 0;
    b.stepDown = null;
    b.stepUp = null;
    b.t0 = this.t;
    b.inside = !out;
    b.pose = out ? 'stand' : 'idle';
    b.x = out ? besideX(A.youLoan) - 32 : A.brute.x;
    b.feet = out ? L.floorY : BRUTE_INSIDE_FEET;
    sh.pose = sharkOf(loan);
    sh.t0 = this.t;
    sh.calc = '';
    sh.stamp = null;
    sh.idle = null;
    sh.grinUntil = -9;
    sh.laughUntil = -9;
    sh.sadUntil = -9;
    this.queueShift = 0;
    this.queueTarget = 0;
    this.gateOpen = 0;
    this.canister = null;
    this.lackeyFastUntil = -9;
    this.redLight = out;
    this.polaroid = loan !== null && loan.overdueSince !== null;
  }

  protected override kickDraw(): void {
    super.kickDraw();
    this.syncClock();
  }

  private syncClock(): void {
    const counting = this.shown.loan?.status === 'Active';
    if (!this.reduced || this.dead || !counting) {
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
    this.gen++;
    this.queue = [];
    this.busy = false;
    this.fliers = [];
    clearTimeout(this.stampSweep);
    clearTimeout(this.plateSweep);
    clearInterval(this.clockTimer);
    this.clockTimer = undefined;
    super.destroy();
  }

  protected override finishAll(): void {
    for (const a of [this.you, this.brute]) if (a.walking) this.land(a);
    for (const f of this.fliers.splice(0)) f.done();
    this.landGate('stepDown');
    this.landGate('stepUp');
    this.queueShift = this.queueTarget;
    this.canister = null;
    this.clearStamp();
    this.clearPlates();
  }

  protected rect(x: number, y: number, w: number, h: number, col: string): void {
    const S = this.s;
    this.ctx.fillStyle = col;
    this.ctx.fillRect(Math.round(x) * S, Math.round(y) * S, w * S, h * S);
  }

  // ----- stepping -----
  private get instant(): boolean {
    return this.reduced || this.paused;
  }

  private land(a: Actor): void {
    a.x = a.tx;
    a.walking = false;
    const arrive = a.arrive;
    a.arrive = null;
    arrive?.();
  }

  private stepWalker(a: Actor, dt: number): void {
    if (!a.walking) return;
    const d = a.tx - a.x,
      move = Math.sign(d) * Math.min(Math.abs(d), a.speed * dt);
    a.x += move;
    a.dist += Math.abs(move);
    if (Math.abs(a.tx - a.x) < 0.01) this.land(a);
  }

  private gateFeet(kind: 'stepDown' | 'stepUp'): number {
    return kind === 'stepDown' ? L.floorY : BRUTE_INSIDE_FEET;
  }

  private stepGate(kind: 'stepDown' | 'stepUp', dt: number): void {
    const b = this.brute,
      g = b[kind];
    if (!g) return;
    const k = clamp((this.t - g.t0) / GATE_SECONDS, 0, 1);
    b.feet = g.f0 + (this.gateFeet(kind) - g.f0) * easeInOut(k);
    b.x += kind === 'stepDown' ? dt * 8 : -dt * 8;
    if (k < 1) return;
    b[kind] = null;
    g.done();
  }

  private landGate(kind: 'stepDown' | 'stepUp'): void {
    const b = this.brute,
      g = b[kind];
    if (!g) return;
    b.feet = this.gateFeet(kind);
    b[kind] = null;
    g.done();
  }

  private stepFx(T: number): void {
    const ended = this.fliers.filter((f) => T - f.t0 >= f.dur);
    this.fliers = this.fliers.filter((f) => T - f.t0 < f.dur);
    for (const f of ended) f.done();
    if (this.slammed && T - this.slammed.at > STAMP_LIFE) this.slammed = null;
    this.plates = this.plates.filter((p) => T - p.at < p.life);
  }

  private stepCanister(T: number): void {
    const c = this.canister;
    if (!c) return;
    const k = clamp((T - c.t0) / 0.6, 0, 1);
    if (c.dir < 0) c.y = L.tube.bottom - 12 - (L.tube.bottom + 4) * easeInOut(k);
    else c.y = -14 + (L.tube.bottom - 2) * easeOut(k);
  }

  // ----- run queue -----
  get idle(): boolean {
    return !this.busy && this.queue.length === 0;
  }

  run(steps: readonly BankStep[]): void {
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
    this.fliers = [];
    this.flashAt = -9;
    this.teletypeUntil = -9;
    this.clearStamp();
    this.clearPlates();
    this.releaseWallet();
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
    this.releaseWallet();
    if (this.paused) {
      this.clearStamp();
      this.clearPlates();
    }
    this.kickDraw();
    this.onIdle?.();
  }

  private exec(step: BankStep): void {
    const gen = this.gen;
    let revealed = false;
    const reveal = () => {
      if (revealed || gen !== this.gen) return;
      revealed = true;
      this.reveal(step);
    };
    this.clearPlates();
    this.runBeats(this.beatsOf(step, reveal), gen, () => {
      reveal();
      this.next();
    });
  }

  private reveal(step: BankStep): void {
    if ('slips' in step) {
      this.shown = { ...this.shown, slips: step.slips };
    } else {
      this.shown = { ...this.shown, loan: step.loan };
    }
    this.kickDraw();
    this.onReveal?.();
  }

  private runBeats(beats: readonly Beat[], gen: number, end: () => void, i = 0): void {
    if (i >= beats.length) {
      end();
      return;
    }
    beats[i](() => {
      if (gen === this.gen) this.runBeats(beats, gen, end, i + 1);
    });
  }

  private beatsOf(step: BankStep, reveal: () => void): readonly Beat[] {
    switch (step.kind) {
      case 'snapLoan':
        return [
          this.act(() => {
            this.seat(step.loan);
            reveal();
          }),
        ];
      case 'snapSlips':
        return [this.act(reveal)];
      case 'requested':
        return this.requestedBeats(step.loan, reveal);
      case 'approved':
        return this.approvedBeats(step.loan, reveal);
      case 'rejected':
        return this.rejectedBeats(step.loan, reveal);
      case 'collecting':
        return this.collectingBeats(step.by, step.loan, reveal);
      case 'partial':
        return this.partialBeats(step.collected, reveal);
      case 'repaid':
        return this.repaidBeats(step.collected, reveal);
      case 'overdue':
        return this.overdueBeats(step.first, step.loan, reveal);
      case 'wireOut':
        return this.wireOutBeats(step.amount, reveal);
      case 'wireIn':
        return this.wireInBeats(step.amount, reveal);
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

  private when(cond: () => boolean, beats: readonly Beat[]): Beat {
    return (done) => {
      if (cond()) this.runBeats(beats, this.gen, done);
      else done();
    };
  }

  private flyImage(
    img: HTMLCanvasElement,
    pts: readonly Pt[],
    dur: number,
    done: () => void,
    arc = 8,
  ): void {
    if (this.instant) {
      done();
      this.kickDraw();
      return;
    }
    this.fliers.push({ img, pts, dur, t0: this.t, arc, done });
    this.kick();
  }

  private walk(a: Actor, x: number, speed: number, done: () => void): void {
    if (this.instant) {
      a.x = x;
      a.walking = false;
      done();
      return;
    }
    a.walking = true;
    a.tx = x;
    a.speed = speed;
    a.arrive = done;
    this.kick();
  }

  private goTo(spot: Stop): Beat {
    return (done) => {
      const you = this.you;
      if (you.spot === spot && !you.walking) {
        done();
        return;
      }
      if (you.spot === 'queue') this.queueTarget = 9;
      if (you.face !== 'sit') {
        this.walkYou(spot, done);
        return;
      }
      you.face = 'front';
      you.feet = L.floorY;
      this.later(0.25, () => this.walkYou(spot, done));
    };
  }

  private walkYou(spot: Stop, done: () => void): void {
    const you = this.you,
      sp = SPOTS[spot];
    you.face = sp.x >= you.x ? 'right' : 'left';
    you.spot = 'moving';
    let waiting = this.brute.inside ? 1 : 2;
    const join = () => {
      waiting--;
      if (waiting === 0) done();
    };
    if (!this.brute.inside) this.follow(sp.x, join);
    this.walk(you, sp.x, YOU_SPEED, () => {
      if (spot === 'curb') {
        you.feet = 199;
        you.face = 'sit';
        you.sitT = this.t;
      } else you.face = sp.face;
      you.spot = spot;
      if (spot === 'queue') this.queueTarget = 0;
      if (this.instant) this.queueShift = this.queueTarget;
      join();
    });
  }

  private follow(x: number, done: () => void): void {
    const b = this.brute;
    b.pose = 'walk';
    this.walk(b, besideX(x) - 32, 40, () => {
      b.pose = 'stand';
      done();
    });
  }

  private gateStep(kind: 'stepDown' | 'stepUp', done: () => void): void {
    const b = this.brute;
    if (this.instant) {
      b.feet = this.gateFeet(kind);
      done();
      return;
    }
    b[kind] = { f0: b.feet, t0: this.t, done };
    this.kick();
  }

  private bruteOut(): Beat {
    const b = this.brute;
    return this.when(
      () => b.inside,
      [
        (done) => {
          b.pose = 'walk';
          this.walk(b, 135, 38, done);
        },
        this.hold(0.2, () => (this.gateOpen = 1)),
        (done) => {
          b.inside = false;
          this.gateStep('stepDown', done);
        },
        (done) => {
          this.gateOpen = 0;
          const x = this.you.spot === 'wires' ? A.youWires : A.youLoan;
          this.walk(b, besideX(x) - 32, 40, done);
        },
        this.act(() => (b.pose = 'stand')),
      ],
    );
  }

  private bruteIn(): Beat {
    const b = this.brute;
    return this.when(
      () => !b.inside,
      [
        (done) => {
          b.pose = 'walk';
          this.walk(b, 135, 40, done);
        },
        (done) => {
          this.gateOpen = 1;
          this.gateStep('stepUp', done);
        },
        (done) => {
          b.inside = true;
          this.gateOpen = 0;
          this.walk(b, A.brute.x, 38, done);
        },
        this.act(() => (b.pose = 'idle')),
      ],
    );
  }

  // ----- stamp and plates -----
  private slam(word: string, ramp: readonly string[], x = 240, y = 96): void {
    this.slammed = { img: SP.stamp(word, ramp), x, y, at: this.t, word };
    if (!this.reduced) return;
    clearTimeout(this.stampSweep);
    this.stampSweep = setTimeout(() => {
      this.slammed = null;
      this.draw();
    }, SWEEP_MS);
  }

  private showPlate(lines: readonly PlateLine[], x: number, y: number, life = 2.4): void {
    this.plates = [{ img: SP.plate(lines), x, y, at: this.t, life, lines: lines.map((l) => l[0]) }];
    if (!this.reduced) return;
    clearTimeout(this.plateSweep);
    this.plateSweep = setTimeout(() => {
      this.plates = [];
      this.draw();
    }, SWEEP_MS);
  }

  private clearStamp(): void {
    clearTimeout(this.stampSweep);
    this.slammed = null;
  }

  private clearPlates(): void {
    clearTimeout(this.plateSweep);
    this.plates = [];
  }

  // ----- steps -----
  private requestedBeats(loan: BankLoan, reveal: () => void): readonly Beat[] {
    const you = this.you,
      sh = this.shark;
    return [
      this.goTo('loan'),
      (done) => {
        you.arm = 'reach';
        this.flyImage(
          PP.paper,
          [
            [you.x + 14, 132],
            [241, 117],
            [230, 104],
          ],
          0.8,
          done,
        );
      },
      this.hold(1.4, () => {
        you.arm = null;
        sh.pose = 'inspect';
        sh.t0 = this.t;
        this.brute.lean = 1;
      }),
      this.hold(0.7, () => {
        sh.pose = 'calc';
        sh.calc = fmt(loan.principal);
      }),
      this.hold(0.9, () => (sh.calc = fmt(loan.totalDue))),
      this.act(() => {
        sh.pose = 'inspect';
        reveal();
      }),
    ];
  }

  private approvedBeats(loan: BankLoan, reveal: () => void): readonly Beat[] {
    const sh = this.shark,
      b = this.brute,
      label = '$' + fmt(loan.principal);
    return [
      this.goTo('loan'),
      this.hold(0.35, () => {
        sh.pose = 'stampUp';
        sh.stamp = 'ok';
        sh.t0 = this.t;
      }),
      this.hold(0.45, () => {
        sh.pose = 'stampDown';
        sh.t0 = this.t;
        this.slam('APPROVED', STAMP_OK);
        reveal();
        b.lean = 0;
      }),
      (done) => {
        sh.pose = 'pay';
        this.flyImage(
          PP.bundle(label),
          [
            [248, 110],
            [241, 119],
            [this.you.x + 12, 140],
          ],
          0.9,
          done,
        );
      },
      this.hold(2.6, () => {
        this.showPlate(
          [
            ['LOAN', 'jersey', GREEN],
            ['+' + label, 'tiny', PAPER],
          ],
          240,
          44,
        );
        sh.pose = 'idle';
        sh.grinUntil = this.t + 2.6;
        b.pose = 'tap';
        b.t0 = this.t;
      }),
      this.act(() => {
        if (b.pose === 'tap') b.pose = 'idle';
      }),
    ];
  }

  private rejectedBeats(loan: BankLoan, reveal: () => void): readonly Beat[] {
    const sh = this.shark,
      b = this.brute;
    return [
      this.goTo('loan'),
      this.hold(0.35, () => {
        sh.pose = 'stampUp';
        sh.stamp = 'no';
        sh.t0 = this.t;
      }),
      this.hold(0.4, () => {
        sh.pose = 'stampDown';
        sh.t0 = this.t;
        this.slam('DENIED', STAMP_NO);
        reveal();
        this.showPlate(this.deniedLines(loan.rejectionReason), 240, 44, 3);
        b.lean = 0;
      }),
      this.hold(1.3, () => {
        sh.pose = 'laugh';
        sh.laughUntil = this.t + 2.6;
        b.pose = 'point';
        b.t0 = this.t;
      }),
      this.goTo('curb'),
      this.act(() => {
        sh.pose = 'idle';
        b.pose = 'idle';
      }),
    ];
  }

  private deniedLines(reason: string | null): readonly PlateLine[] {
    const head: PlateLine = ['DENIED', 'jersey', REDL];
    if (reason === null) return [head];
    return [head, [reason, 'micro', PAPER]];
  }

  private collectingBeats(by: Collector, loan: BankLoan, reveal: () => void): readonly Beat[] {
    const sh = this.shark,
      b = this.brute;
    const count = this.act(() => {
      if (b.pose === 'knock') b.pose = 'stand';
      sh.pose = 'count';
      this.lackeyFastUntil = this.t + 2;
      reveal();
    });
    if (by === 'player') return [this.goTo('loan'), this.playerPush(), count];
    if (by === 'retry' && !b.inside) {
      return [
        this.hold(1.0, () => {
          b.pose = 'knock';
          b.t0 = this.t;
        }),
        count,
      ];
    }
    return [
      this.hold(0.6, () => {
        sh.pose = 'calc';
        sh.calc = fmt(loan.outstanding);
      }),
      count,
    ];
  }

  private playerPush(): Beat {
    const you = this.you;
    return (done) => {
      you.arm = 'reach';
      const finish = () => {
        you.arm = null;
        done();
      };
      if (this.wallet?.availableFunds === 0) {
        this.showPlate([['EMPTY POCKETS', 'tiny', PAPER]], 240, 50, 1.6);
        finish();
        return;
      }
      this.flyImage(
        PP.bundle(''),
        [
          [you.x + 12, 140],
          [241, 119],
          [236, 108],
        ],
        0.8,
        finish,
      );
    };
  }

  private paidBackLines(collected: number): readonly PlateLine[] {
    return [
      ['PAID BACK', 'jersey', GREEN],
      ['$' + fmt(collected), 'tiny', PAPER],
    ];
  }

  private partialBeats(collected: number, reveal: () => void): readonly Beat[] {
    return [
      this.hold(1.2, () => {
        reveal();
        this.shark.pose = 'idle';
        this.showPlate(this.paidBackLines(collected), 240, 44);
      }),
    ];
  }

  private repaidBeats(collected: number, reveal: () => void): readonly Beat[] {
    const sh = this.shark;
    return [
      this.hold(0.3, () => {
        sh.pose = 'stampUp';
        sh.stamp = 'paid';
        sh.t0 = this.t;
      }),
      this.hold(0.8, () => {
        sh.pose = 'stampDown';
        sh.t0 = this.t;
        this.slam('PAID', STAMP_PAID);
        reveal();
        this.redLight = false;
        this.showPlate(this.paidBackLines(collected), 240, 44);
        sh.pose = 'idle';
        sh.sadUntil = this.t + 4;
      }),
      this.bruteIn(),
    ];
  }

  private overdueBeats(first: boolean, loan: BankLoan, reveal: () => void): readonly Beat[] {
    const sh = this.shark;
    const start = this.act(() => {
      reveal();
      this.redLight = true;
      sh.pose = 'idle';
      this.showPlate(this.overdueLines(first, loan), 240, 44, first ? 2.8 : 2.4);
    });
    if (!first) return [start, this.bruteOut(), this.hold(1)];
    return [
      start,
      this.bruteOut(),
      this.hold(0.5, () => {
        sh.pose = 'camera';
        sh.t0 = this.t;
      }),
      this.hold(0.25, () => (this.flashAt = this.t)),
      (done) =>
        this.flyImage(
          PP.polaroid,
          [
            [236, 80],
            [212, 60],
            [L.shame.slot[0] + 6, L.shame.slot[1] + 7],
          ],
          0.9,
          done,
          10,
        ),
      this.act(() => {
        this.polaroid = true;
        sh.pose = 'idle';
        sh.grinUntil = this.t + 1.6;
      }),
    ];
  }

  private overdueLines(first: boolean, loan: BankLoan): readonly PlateLine[] {
    const head: PlateLine = ['OVERDUE', 'jersey', REDL];
    if (first) return [head, ['LATE FEE $' + fmt(loan.penalty), 'tiny', PAPER]];
    return [head, ['OWED $' + fmt(loan.outstanding), 'tiny', PAPER]];
  }

  private wireOutBeats(amount: number, reveal: () => void): readonly Beat[] {
    const you = this.you,
      label = '$' + fmt(amount);
    return [
      this.goTo('wires'),
      (done) => {
        this.clerkAwakeUntil = this.t + 6;
        you.arm = 'reach';
        this.flyImage(
          PP.bundle(label),
          [
            [you.x + 12, 140],
            [352, 119],
            [340, 106],
          ],
          0.8,
          done,
        );
      },
      this.hold(0.9, () => {
        you.arm = null;
        this.canister = { y: L.tube.bottom - 12, dir: -1, t0: this.t };
      }),
      this.hold(1.2, () => {
        this.canister = null;
        this.teletypeUntil = this.t + 1.2;
      }),
      this.hold(0.6, () => {
        reveal();
        this.showPlate(
          [
            ['WIRE OUT', 'jersey', REDL],
            ['-' + label, 'tiny', PAPER],
          ],
          372,
          44,
        );
      }),
    ];
  }

  private wireInBeats(amount: number, reveal: () => void): readonly Beat[] {
    const label = '$' + fmt(amount);
    return [
      this.act(() => (this.canister = { y: -14, dir: 1, t0: this.t })),
      this.goTo('wires'),
      this.hold(0.4),
      (done) => {
        this.canister = null;
        this.clerkAwakeUntil = this.t + 6;
        this.flyImage(
          PP.envelope(label),
          [
            [332, 104],
            [352, 119],
            [this.you.x + 12, 140],
          ],
          0.8,
          done,
        );
      },
      this.hold(1.2, () => {
        this.teletypeUntil = this.t + 1.2;
        reveal();
        this.showPlate(
          [
            ['WIRE IN', 'jersey', GREEN],
            ['+' + label, 'tiny', PAPER],
          ],
          372,
          44,
        );
      }),
    ];
  }

  // ----- ambient life -----
  private flickerStep(o: Flick, dt: number, rate: number): void {
    if (o.off > 0) {
      o.off -= dt;
      return;
    }
    if (this.t < o.next) return;
    if (Math.random() < rate * dt) {
      o.off = 0.06 + Math.random() * 0.1;
      o.next = this.t + o.off + 0.4 + Math.random() * 0.8;
    }
  }

  private sharkMouth(): Pt {
    return [A.shark.x + PP.sharkInfo.mouth[0], A.shark.y + PP.sharkInfo.mouth[1]];
  }

  protected override stepRoom(dt: number): void {
    const T = this.t,
      you = this.you,
      b = this.brute;
    this.stepWalker(you, dt);
    this.stepWalker(b, dt);
    this.stepGate('stepDown', dt);
    this.stepGate('stepUp', dt);
    this.queueShift += clamp(this.queueTarget - this.queueShift, -dt * 10, dt * 10);
    const nearDoor = Math.abs(you.x - 150) < 16 || (!b.inside && Math.abs(b.x + 32 - 150) < 20);
    this.door += clamp((nearDoor ? 1 : 0) - this.door, -dt * 4, dt * 4);
    this.stepFx(T);
    const sh = this.shark;
    if (sh.pose === 'idle' && T > sh.nextIdle) {
      sh.idle = you.spot === 'loan' ? 'coin' : 'beckon';
      if (Math.random() < 0.3) sh.idle = 'puff';
      sh.idleT0 = T;
      sh.nextIdle = T + 4.5 + Math.random() * 2.5;
    }
    if (sh.idle && T - sh.idleT0 > 1.8) sh.idle = null;
    this.stepParticles(dt, T);
    if (!this.rat && T > this.nextRat) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.rat = { x: dir > 0 ? -18 : 140, dir };
    }
    if (this.rat) {
      this.rat.x += this.rat.dir * 64 * dt;
      if (this.rat.x > 142 || this.rat.x < -20) {
        this.rat = null;
        this.nextRat = T + 9 + Math.random() * 8;
      }
    }
    this.flicks.forEach((n, i) => this.flickerStep(n, dt, NEON_RATES[i]));
    this.flickerStep(this.lamp, dt, 0.35);
    this.flickerStep(this.tube, dt, 0.25);
    this.flickerStep(this.box, dt, 0.18);
    this.stepCanister(T);
  }

  private stepParticles(dt: number, T: number): void {
    if (T > this.nextSteam) {
      this.nextSteam = T + 0.35 + Math.random() * 0.3;
      this.parts.push({
        k: 'steam',
        x: 76 + Math.random() * 18,
        y: 190,
        vx: (Math.random() - 0.5) * 4,
        vy: -14 - Math.random() * 6,
        t0: T,
        life: 2.6,
      });
    }
    if (T > this.nextSmoke) {
      this.nextSmoke = T + 0.5 + Math.random() * 0.4;
      const m = this.sharkMouth();
      this.parts.push({
        k: 'smoke',
        x: m[0] + 9,
        y: m[1] + 1,
        vx: 1.5,
        vy: -7,
        t0: T,
        life: 2.4,
        ph: Math.random() * 6,
      });
    }
    if (Math.random() < dt * 9)
      this.parts.push({
        k: 'spark',
        x: BARREL.x + 4 + Math.random() * 10,
        y: BARREL.y + 2,
        vx: (Math.random() - 0.5) * 10,
        vy: -20 - Math.random() * 24,
        t0: T,
        life: 0.9 + Math.random() * 0.6,
      });
    if (T - this.clerkAwakeUntil > 0 && Math.random() < dt * 0.7)
      this.parts.push({
        k: 'zzz',
        x: A.clerk.x + 26,
        y: A.clerk.y + 2,
        vx: 3,
        vy: -6,
        t0: T,
        life: 2.2,
      });
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.k === 'smoke') p.x += Math.sin(T * 2 + (p.ph ?? 0)) * dt * 4;
      if (p.k === 'steam') p.vx *= 0.99;
    }
    this.parts = this.parts.filter((p) => T - p.t0 < p.life);
    if (this.parts.length > 160) this.parts.splice(0, this.parts.length - 160);
  }

  // ----- drawing -----
  private redLit(T: number): boolean {
    return this.redLight && (this.reduced || Math.floor(T * 3) % 2 === 0);
  }

  protected draw(): void {
    const T = this.t,
      S = this.s;
    this.ctx.clearRect(0, 0, W * S, H * S);
    this.img(this.art.back, 0, 0);
    this.drawStreet(T);
    this.drawInteriorBack(T);
    this.drawStaff(T);
    this.drawDesks(T);
    this.staffHands(T);
    this.img(this.art.front, 0, 0);
    this.drawFrontBits(T);
    this.drawQueue(T);
    const actors = [
      { y: this.you.feet, f: () => this.drawYou(T) },
      { y: 196, f: () => this.drawBarrel(T) },
    ];
    if (!this.brute.inside) actors.push({ y: this.brute.feet + 0.5, f: () => this.drawBrute(T) });
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.f());
    this.drawParticles(T);
    this.drawFx(T);
    if (this.redLit(T) && !this.reduced) {
      this.ctx.fillStyle = 'rgba(255,40,48,0.07)';
      this.ctx.fillRect(L.cutEnd * S, 10 * S, (W - L.cutEnd) * S, (H - 10) * S);
    }
  }

  private sharkFace(T: number): PP.SharkMood {
    const sh = this.shark;
    if (sh.pose === 'inspect') return 'loupe';
    if (sh.pose === 'laugh' || T < sh.laughUntil) return Math.floor(T * 5) % 2 ? 'laugh' : 'grin';
    if (T < sh.sadUntil) return 'sad';
    if (T < sh.grinUntil || sh.pose === 'pay' || sh.pose === 'stampDown') return 'grin';
    if (!this.reduced && T % 4.2 < 0.14) return 'blink';
    return 'smirk';
  }

  private drawShark(T: number): void {
    const sh = this.shark,
      p = A.shark,
      info = PP.sharkInfo,
      reduced = this.reduced;
    const bob =
      (sh.pose === 'laugh' || T < sh.laughUntil) && !reduced ? Math.round(Math.sin(T * 18)) : 0;
    const face = this.sharkFace(T);
    this.img(this.spr.sharkFaces[face], p.x, p.y + bob);
    if (face === 'grin' && !reduced && (T * 1.25) % 1 < 0.16)
      this.img(FL.sparkle, p.x + info.tooth[0], p.y + info.tooth[1] - 2);
    if (face === 'grin' && reduced)
      this.img(FL.sparkle, p.x + info.tooth[0], p.y + info.tooth[1] - 2);
    if (face !== 'laugh')
      this.img(PP.cigar, p.x + info.mouth[0] - 1, p.y + info.mouth[1] - 2 + bob);
  }

  private sharkHands(T: number): void {
    const sh = this.shark,
      p = A.shark,
      info = PP.sharkInfo,
      reduced = this.reduced;
    const eL: Pt = [p.x + info.elbows[0][0], p.y + info.elbows[0][1]],
      eR: Pt = [p.x + info.elbows[1][0], p.y + info.elbows[1][1]];
    let hL: Pt = [p.x + 20, p.y + 52],
      hR: Pt = [p.x + 46, p.y + 52],
      inL: Hand | null = null,
      inR: Hand | null = null;
    const pose = sh.pose === 'idle' && sh.idle ? sh.idle : sh.pose;
    const k = reduced ? 1 : clamp((T - sh.t0) / 0.3, 0, 1);
    const stampTool = sh.stamp === 'no' ? PP.stampNo : PP.stampOk;
    switch (pose) {
      case 'beckon':
        hR = [p.x + 52, p.y + 36 + (reduced ? 0 : Math.round(Math.sin(T * 12) * 2))];
        break;
      case 'coin': {
        const u = reduced ? 0.5 : clamp((T - sh.idleT0) / 1.4, 0, 1);
        hR = [p.x + 48, p.y + 46 - Math.round(Math.sin(Math.min(1, u * 4) * (Math.PI / 2)) * 4)];
        const cy = p.y + 40 - Math.sin(u * Math.PI) * 34;
        inR = { img: PP.coinBig[Math.floor(T * 14) % 4], dx: -3, dy: cy - hR[1] - 3 };
        break;
      }
      case 'puff':
        hR = [p.x + 44, p.y + 26];
        break;
      case 'inspect':
        hL = [p.x + 18, p.y + 38];
        hR = [p.x + 40, p.y + 22];
        inL = { img: PP.paper, dx: -2, dy: -12 };
        inR = { img: PP.loupe, dx: -6, dy: -10 };
        break;
      case 'calc':
        hL = [p.x + 34, p.y + 48];
        hR = [p.x + 46, p.y + 48 - (reduced ? 0 : (Math.floor(T * 8) % 2) * 2)];
        break;
      case 'stampUp':
        hR = [p.x + 46, p.y + 52 - Math.round(20 * k)];
        inR = { img: stampTool, dx: -4, dy: -14 };
        break;
      case 'stampDown':
        hR = [p.x + 38, p.y + 32 + Math.round(18 * k)];
        inR = { img: stampTool, dx: -4, dy: -14 };
        break;
      case 'pay':
        hR = [p.x + 38, p.y + 54];
        break;
      case 'count': {
        const w = reduced ? 0 : Math.round(Math.sin(T * 14) * 2);
        hL = [p.x + 28 + w, p.y + 50];
        hR = [p.x + 40 - w, p.y + 50];
        break;
      }
      case 'camera':
        hL = [p.x + 22, p.y + 22];
        hR = [p.x + 40, p.y + 22];
        inL = { img: CAMERA, dx: 0, dy: -6 };
        break;
      case 'laugh':
        hL = [p.x + 22, p.y + 46];
        hR = [p.x + 44, p.y + 46];
        break;
      default:
        break;
    }
    FL.limb(this, [eL, hL], info.sleeve, 5);
    if (inL) this.img(inL.img, hL[0] + inL.dx, hL[1] + inL.dy);
    this.img(PP.ringHand, hL[0] - 3, hL[1] - 3);
    FL.limb(this, [eR, hR], info.sleeve, 5);
    if (inR) this.imgF(inR.img, hR[0] + inR.dx, hR[1] + inR.dy);
    this.img(PP.ringHand, hR[0] - 3, hR[1] - 3);
  }

  private bruteSprite(T: number): HTMLCanvasElement {
    const b = this.brute,
      sp = this.spr.brute;
    if (b.walking || b.stepDown || b.stepUp)
      return Math.floor(b.dist / 8) % 2 ? sp.walkA : sp.walkB;
    if (!this.reduced && Math.floor(T * 3.2) % 2) return sp.chew;
    return sp.idle;
  }

  private drawBrute(T: number): void {
    const b = this.brute,
      info = PP.bruteInfo,
      reduced = this.reduced;
    const leanX = b.lean && b.inside ? -5 : 0,
      leanY = b.lean && b.inside ? 2 : 0;
    const x = b.x + leanX,
      y = b.feet - 105 + leanY;
    const moving = b.walking || b.stepDown || b.stepUp;
    if (moving) this.imgF(this.bruteSprite(T), x, y);
    else this.img(this.bruteSprite(T), x, y);
    if (moving) {
      this.imgF(PP.bat, x + 52, y + 50);
      return;
    }
    const eL: Pt = [x + info.elbows[0][0], y + info.elbows[0][1]],
      eR: Pt = [x + info.elbows[1][0], y + info.elbows[1][1]];
    let hL: Pt = [x + 12, y + 64],
      hR: Pt = [x + 46, y + 40],
      batTo: Pt | null = [x + 60, y + 8];
    switch (bruteMode(b)) {
      case 'lean':
        hL = [x + 18, y + 58];
        hR = [x + 34, y + 58];
        batTo = null;
        break;
      case 'tap': {
        const u = reduced ? 0 : Math.abs(Math.sin(T * 6));
        hR = [x + 46, y + 60];
        hL = [x + 22, y + 58];
        batTo = [x + 22 + u * 10, y + 50 - u * 18];
        break;
      }
      case 'point':
        hL = [x - 10, y + 34];
        hR = [x + 52, y + 64];
        batTo = [x + 56, y + 96];
        break;
      case 'knock': {
        const u = reduced ? 1 : ((T - b.t0) * 2.5) % 1;
        hR = [x + 56, Math.min(121, y + 30 + Math.round(easeOut(Math.min(1, u * 1.4)) * 40))];
        hL = [x + 12, y + 64];
        batTo = null;
        if (u > 0.72) {
          this.img(FL.sparkle, x + 54, 116);
          this.img(this.textImg('KNOCK', GOLD), x + 46, 104);
        }
        break;
      }
      default: {
        if (!reduced && b.inside && T % 7.5 > 6.2) {
          hL = [x + 28, y + 46];
          hR = [x + 36, y + 46];
          batTo = null;
          if (T % 7.5 > 6.8 && T % 7.5 < 7.0) this.img(FL.sparkle, x + 30, y + 40);
        }
        break;
      }
    }
    if (batTo) FL.limb(this, [hR, batTo], R.wood, 3);
    FL.limb(this, [eL, hL], info.sleeve, 7);
    this.img(PP.fistSprite, hL[0] - 4, hL[1] - 4);
    FL.limb(this, [eR, hR], info.sleeve, 7);
    this.img(PP.fistSprite, hR[0] - 4, hR[1] - 4);
    const bub = reduced ? -1 : Math.floor(((T + 3) % 9) / 0.35);
    if (bub >= 0 && bub < 3)
      this.img(PP.bubble[bub], x + info.mouth[0] - bub - 1, y + info.mouth[1] - bub);
  }

  private drawYou(T: number): void {
    const you = this.you,
      sp = this.spr,
      reduced = this.reduced;
    const y = you.feet;
    if (you.face === 'sit') {
      this.img(sp.youSit[!reduced && (T - you.sitT) % 5 > 4.2 ? 1 : 0], you.x - 22, y - 65);
      return;
    }
    if (you.walking) {
      const f = Math.floor(you.dist / 7) % 4;
      const img = you.face === 'left' ? sp.youWalkL[f] : sp.youWalk[f];
      this.imgF(img, you.x - 16, y - 97);
      return;
    }
    if (you.face === 'back') {
      const bk = sp.youBack;
      this.img(bk.img, you.x - bk.cx, y - 96);
      if (you.arm === 'reach') {
        const sh: Pt = [you.x - bk.cx + bk.shoulderR[0], y - 96 + bk.shoulderR[1]];
        const target: Pt = you.spot === 'wires' ? [348, 121] : [234, 121];
        FL.limb(this, [sh, [sh[0] + 6, sh[1] + 2], target], bk.sleeve, 5);
        FL.hand(this, target[0], target[1], bk.skin);
      }
      return;
    }
    const blink = !reduced && T % 3.7 < 0.15;
    this.img(sp.youFront[blink ? 1 : 0], you.x - 20, y - 96);
  }

  private drawQueue(T: number): void {
    const q = this.spr.q,
      sh = this.queueShift,
      reduced = this.reduced;
    const jit = (seed: number, period: number) => {
      if (reduced || (T + seed) % period >= 0.6) return 0;
      return Math.sin(T * 70 + seed) * 0.34;
    };
    const bobQ =
      this.queueShift !== this.queueTarget && !reduced
        ? -Math.abs(Math.round(Math.sin(T * 12)))
        : 0;
    const blink = (seed: number, period: number) => !reduced && (T + seed) % period < 0.14;
    const x0 = A.queue[3] + sh,
      x1 = A.queue[2] + sh,
      x2 = A.queue[1] + sh,
      x3 = A.queue[0] + sh;
    this.imgF(q.cart, 2, L.floorY - 40 + 2);
    const cough = !reduced && T % 7.3 > 6.4;
    this.imgF(
      q.granny[blink(1.3, 4.1) ? 'blink' : 'open'],
      x0 - 20 + jit(0.5, 6.1),
      L.floorY - 88 + (cough ? 1 : 0) + bobQ,
    );
    if (cough && T % 7.3 < 6.5)
      this.parts.push({
        k: 'steam',
        x: x0 + 6,
        y: L.floorY - 74,
        vx: 8,
        vy: -3,
        t0: T,
        life: 0.8,
      });
    const sway = reduced ? 0 : Math.round(Math.sin(T * 1.3) * 1);
    this.imgF(
      q.signGuy[blink(2.1, 5.3) ? 'blink' : 'open'],
      x1 - 20 + sway * 0.34 + jit(2.2, 5.5),
      L.floorY - 94 + bobQ,
    );
    this.imgF(
      q.mom[blink(0.4, 3.9) ? 'blink' : 'open'],
      x2 - 20 + jit(3.1, 6.7),
      L.floorY - 92 + bobQ,
    );
    const tug = !reduced && T % 5.1 > 4 && Math.floor(T * 6) % 2 === 1;
    this.imgF(tug ? q.kid.b : q.kid.a, x2 - 4, L.floorY - 58 + bobQ);
    this.imgF(
      q.man[blink(1.7, 4.6) ? 'blink' : 'open'],
      x3 - 20 + jit(4.4, 5.2),
      L.floorY - 96 + bobQ,
    );
    this.imgF(
      q.cardboard,
      x1 - 24 + sway * 0.34,
      L.floorY - 70 + (reduced ? 0 : Math.round(Math.sin(T * 2.1) * 0.6)) + bobQ,
    );
  }

  private drawBarrel(T: number): void {
    const { x, y } = BARREL,
      fire = this.fx.fire;
    this.img(this.fx.barrel, x, y);
    if (this.reduced) {
      this.img(fire[0], x + 1, y - 13);
      return;
    }
    this.img(fire[Math.floor(T * 9) % fire.length], x + 1, y - 13);
  }

  private drawStreet(T: number): void {
    const reduced = this.reduced,
      art = this.art;
    if (reduced || this.lamp.off <= 0) {
      this.img(art.lampCone, 0, 0);
      this.img(art.lampOn, 10, 17);
    }
    const green = this.flicks[0],
      open = this.flicks[3];
    const nl = this.facade;
    if (nl) this.img(reduced || green.off <= 0 ? nl.on : nl.off, 72 - Math.floor(nl.w / 2), 6);
    this.img(reduced || open.off <= 0 ? this.spr.open.on : this.spr.open.off, 36, 70);
    if (!reduced && this.box.off > 0) this.img(art.boxOff, art.boxAt.x, art.boxAt.y);
    const openOn = reduced || open.off <= 0,
      greenOn = reduced || green.off <= 0,
      boxOn = reduced || this.box.off <= 0;
    for (const [px, pw] of [
      [12, 34],
      [98, 30],
    ]) {
      for (let i = 2; i < pw - 2; i++) {
        const k = (i + px) % 9,
          shimmer = reduced ? 0 : Math.floor(T * 3 + i * 0.7) % 4;
        let c: string | null = null;
        if (k < 3 && boxOn) c = '#c89a2a';
        else if (k < 5 && openOn) c = '#d8403a';
        else if (k < 6 && greenOn) c = '#5ab84a';
        if (!c || shimmer === 3) continue;
        this.rect(px + i, 195 + (i % 2), 1, shimmer === 0 ? 3 : 2, c);
      }
    }
    if (this.rat) {
      const frame = Math.floor(this.t * 10) % 2;
      this.imgF(this.rat.dir > 0 ? PP.rat[frame] : this.spr.ratL[frame], this.rat.x, 191);
    }
  }

  private drawInteriorBack(T: number): void {
    const lit = this.reduced || this.tube.off <= 0;
    this.rect(196, 7, 88, 2, lit ? '#eaf6e0' : '#5a5e58');
    if (lit) this.rect(196, 9, 88, 1, '#a8c8a0');
    this.img(this.redLit(T) ? this.art.beaconOn : this.art.beaconOff, 297, 0);
    if (this.polaroid) this.img(PP.polaroid, L.shame.slot[0], L.shame.slot[1]);
  }

  private drawTv(T: number): void {
    const x = 440,
      y = 16,
      reduced = this.reduced;
    this.img(this.art.tv, x, y);
    const sx = x + 4,
      sy = y + 4,
      sw = 28,
      sh = 18;
    const scroll = reduced ? 0 : Math.floor(T * 14) % 8;
    this.rect(sx, sy, sw, sh, '#2c5a34');
    this.rect(sx, sy, sw, 5, '#1f3a5a');
    for (let i = -8; i < sw; i += 8)
      this.rect(sx + clamp(i + scroll, 0, sw - 1), sy + 6, 1, 1, '#f6f3f6');
    this.rect(sx, sy + 7, sw, 1, '#f6f3f6');
    [0, 1, 2].forEach((k) => {
      const hx = sx + 4 + (reduced ? k * 8 : (T * (5 + k * 1.3) + k * 9) % 26),
        hy = sy + 9 + k * 3;
      this.rect(hx, hy, 5, 2, ['#5a3a20', '#2a1c16', '#8a5a34'][k]);
      this.rect(hx + 4, hy - 1, 2, 2, ['#5a3a20', '#2a1c16', '#8a5a34'][k]);
      const leg = reduced ? 0 : Math.floor(T * 10 + k) % 2;
      this.rect(hx + (leg ? 0 : 1), hy + 2, 1, 1, '#1a1210');
      this.rect(hx + (leg ? 4 : 3), hy + 2, 1, 1, '#1a1210');
      this.rect(hx + 2, hy - 1, 1, 1, ['#d02a3a', '#f6dc6a', '#2a8ea3'][k]);
    });
    if (!reduced) for (let j = 0; j < sh; j += 2) this.rect(sx, sy + j, sw, 1, 'rgba(0,0,0,0.18)');
  }

  private drawStaff(T: number): void {
    const lk = A.lackey,
      cl = A.clerk;
    this.img(this.spr.lackey.open, lk.x, lk.y);
    const awake = T < this.clerkAwakeUntil;
    const nod = !awake && !this.reduced && T % 3.4 > 2.6 ? 1 : 0;
    this.img(awake ? this.spr.clerk.open : this.spr.clerk.blink, cl.x, cl.y + nod);
    if (this.brute.inside) this.drawBrute(T);
    this.drawShark(T);
  }

  private drawDesks(T: number): void {
    const reduced = this.reduced,
      art = this.art;
    const calcX = L.calc.x,
      calcY = L.calc.y;
    this.img(art.calc, calcX, calcY);
    const shownCalc = this.calcText;
    if (shownCalc)
      this.img(this.textImg(shownCalc, GREEN), calcX + 22 - measure(shownCalc), calcY + 1);
    const sh = this.shark;
    const inHand = sh.pose === 'stampUp' || sh.pose === 'stampDown' ? sh.stamp : null;
    if (inHand !== 'ok' && inHand !== 'paid') this.img(PP.stampOk, 211, 108);
    if (inHand !== 'no') this.img(PP.stampNo, 220, 108);
    const fast = T < this.lackeyFastUntil;
    this.img(art.desk, L.desk.x, L.desk.y);
    this.img(art.counter, 412, 102);
    if (!reduced) {
      const f = Math.floor(T * (fast ? 24 : 10)) % 3;
      for (let k = 0; k < 4; k++)
        this.rect(416 + k * 3, 100 - ((f + k) % 3), 2, 3, (f + k) % 2 ? '#78b860' : '#a8d880');
    }
    this.img(art.banker, 438, 96);
    this.rect(462, 114, 2, 4, R.grey[1]);
    this.rect(459, 117, 8, 1, R.grey[2]);
    const fb = reduced ? 0 : Math.floor(T * 12) % 2;
    this.rect(458, 106, 10, 9, '#2a2632');
    this.rect(459, 107, 8, 7, '#3a3644');
    if (fb) {
      this.rect(462, 107, 2, 7, R.grey[3]);
      this.rect(459, 110, 8, 1, R.grey[2]);
    } else {
      this.rect(460, 108, 2, 2, R.grey[3]);
      this.rect(464, 108, 2, 2, R.grey[2]);
      this.rect(460, 112, 2, 2, R.grey[2]);
      this.rect(464, 112, 2, 2, R.grey[3]);
    }
    this.rect(462, 110, 2, 1, R.gold[2]);
    const tt = L.teletype;
    this.img(art.teletype, tt.x, tt.y);
    const printing = T < this.teletypeUntil;
    const paperH = printing && !reduced ? 4 + Math.floor((1.2 - (this.teletypeUntil - T)) * 10) : 4;
    this.rect(tt.x + 5, tt.y - paperH, 8, paperH, R.paper[3]);
    for (let j = 1; j < paperH; j += 2) this.rect(tt.x + 6, tt.y - paperH + j, 5, 1, R.paper[1]);
    this.img(art.basket, L.tube.x - 3, L.tube.bottom - 2);
  }

  private staffHands(T: number): void {
    this.sharkHands(T);
    const lk = A.lackey,
      pace = T < this.lackeyFastUntil ? 20 : 9,
      w = this.reduced ? 0 : Math.round(Math.sin(T * pace) * 2);
    const sl = this.spr.lackey,
      [[ex0], [ex1]] = sl.elbows;
    FL.limb(
      this,
      [
        [lk.x + ex0 + 2, L.desk.y + 1],
        [420 + w, 104],
      ],
      sl.sleeve,
    );
    FL.hand(this, 420 + w, 104, sl.skin);
    FL.limb(
      this,
      [
        [lk.x + ex1 - 2, L.desk.y + 1],
        [430 - w, 104],
      ],
      sl.sleeve,
    );
    FL.hand(this, 430 - w, 104, sl.skin);
    const cl = A.clerk,
      cs = this.spr.clerk,
      awake = T < this.clerkAwakeUntil,
      [[cx0, cy0], [cx1, cy1]] = cs.elbows;
    const ch = awake
      ? [
          [cl.x + 6, 110],
          [cl.x + 32, 108],
        ]
      : [
          [cl.x + 12, 114],
          [cl.x + 28, 114],
        ];
    FL.limb(this, [[cl.x + cx0, cl.y + cy0], ch[0]], cs.sleeve);
    FL.hand(this, ch[0][0], ch[0][1], cs.skin);
    FL.limb(this, [[cl.x + cx1, cl.y + cy1], ch[1]], cs.sleeve);
    FL.hand(this, ch[1][0], ch[1][1], cs.skin);
  }

  private drawFrontBits(T: number): void {
    const reduced = this.reduced,
      art = this.art;
    this.img(this.board, L.board.x + 2, L.board.y + 2);
    this.img(SP.ledPanel(this.led, L.led.w), L.led.x, L.led.y);
    if (this.gateOpen) {
      this.rect(158, 126, 18, 34, '#0c0a10');
      this.rect(158, 126, 2, 34, R.wood[2]);
    }
    const sp = L.spike;
    this.rect(sp.x + 6, sp.y, 1, 16, R.grey[3]);
    this.spikeSlips
      .slice()
      .reverse()
      .forEach((r, i) => {
        const img = PP.slip(slipLabel(r), !r.out);
        this.img(img, sp.x + 6 - Math.floor(img.width / 2) + (i % 2 ? 1 : -1), sp.y + 10 - i * 2);
      });
    this.rect(sp.x + 3, sp.y + 14, 7, 2, R.black[2]);
    this.img(art.tube, L.tube.x - 1, 0);
    if (this.canister && !reduced) this.imgF(PP.canister, L.tube.x - 2, this.canister.y);
    this.img(art.tubeGlass, L.tube.x - 1, 0);
    this.drawTv(T);
    const wn = this.flicks[4];
    this.img(reduced || wn.off <= 0 ? this.spr.wires.on : this.spr.wires.off, 330, 16);
  }

  private drawFx(T: number): void {
    const S = this.s,
      ctx = this.ctx,
      reduced = this.reduced;
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
    if (this.slammed) {
      const st = this.slammed,
        k = reduced ? 1 : clamp((T - st.at) / 0.14, 0, 1);
      const sc = 1.6 - 0.6 * k,
        w = st.img.width * sc,
        h = st.img.height * sc;
      ctx.drawImage(
        st.img,
        Math.round(st.x - w / 2) * S,
        Math.round(st.y - h / 2) * S,
        Math.round(w) * S,
        Math.round(h) * S,
      );
    }
    for (const p of this.plates) {
      const k = reduced ? 1 : clamp((T - p.at) / 0.12, 0, 1);
      const w = p.img.width * (0.6 + 0.4 * k),
        h = p.img.height * (0.6 + 0.4 * k);
      const x = clamp(p.x - w / 2, 2, W - w - 2),
        y = clamp(p.y - h / 2, 2, H - h - 2);
      ctx.drawImage(
        p.img,
        Math.round(x * S),
        Math.round(y * S),
        Math.round(w * S),
        Math.round(h * S),
      );
    }
    if (!reduced && T - this.flashAt < 0.12) this.img(this.art.flash, 222, 64);
  }

  private drawParticles(T: number): void {
    const puff = this.fx.puff,
      S = this.s;
    for (const p of this.parts) {
      const age = (T - p.t0) / p.life;
      if (p.k === 'steam') {
        const im = puff[Math.min(3, Math.floor(age * 4))];
        this.imgF(im, p.x - im.width / 2, p.y - im.height / 2);
      } else if (p.k === 'smoke') {
        if (Math.floor(age * 10) % 3 !== 2)
          this.imgF(puff[Math.min(1, Math.floor(age * 2))], p.x - 2, p.y - 2);
      } else if (p.k === 'spark') {
        if (Math.floor((T - p.t0) * 14) % 2 === 0) {
          this.ctx.fillStyle = age < 0.5 ? '#ffd166' : '#e8602a';
          this.ctx.fillRect(Math.round(p.x * S), Math.round(p.y * S), S, S);
        }
      } else this.imgF(this.textImg(age < 0.5 ? 'z' : 'Z', '#cfd8ff'), p.x, p.y);
    }
  }
}
