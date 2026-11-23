// The roulette room: the wheel and the ball, the croupier, two guests, the felt with its
// stacks, the LAST board and the rail. The server decides the pocket and every payout. The
// room only stages them, and nothing here computes a payout.
import { INK, R, Sprite, cylV, measure, sphere, text } from '../street/pix';
import * as FL from './floor';
import { GOLD, GREEN, PAPER, REDL, Room, clamp, easeOut, faceOf, fmt } from './room';
import type { RoomOpts } from './room';
import { roulette } from './rooms';
import type { Zone } from './rooms';
import { feltStacks, zoneOf } from './roulette-watch';
import type { FeltBet, FeltStack, SpinView } from './roulette-watch';
import * as SP from './sprites';
import type { PlateLine } from './sprites';
import { ballSprite, bowl, headSize, paintHead } from './wheel';
import {
  ORDER,
  colorOf,
  create,
  landNow,
  launch,
  pocketIndexAt,
  place,
  step as stepWheel,
} from './wheel-math';

const RED3 = '#ff6b6b',
  GREY3 = '#d6d2dc',
  GREEN3 = '#8cc063';
const SPIN_DUR = 4.8;
const SPARKLES: [number, number][] = [
  [90, 20],
  [74, 24],
  [102, 24],
  [436, 20],
  [470, 20],
  [252, 13],
];

export interface RouletteRoomOpts extends RoomOpts {
  onSettled?: () => void;
}

type Reaction = 'cheer' | 'groan' | 'idle';
type Person = ReturnType<typeof FL.person>;
interface Rake {
  t0: number;
  dur: number;
  to: { x: number; y: number };
  zones: string[];
  grabbed: boolean;
}

const tags = new Map<string, HTMLCanvasElement>();
function tag(str: string): HTMLCanvasElement {
  const cached = tags.get(str);
  if (cached) return cached;
  const w = Math.max(18, measure(str, 'tiny') + 6),
    s = new Sprite(w, 9);
  s.rect(1, 0, w - 2, 9, INK);
  s.rect(0, 1, w, 7, INK);
  text(s, str, Math.floor((w - measure(str, 'tiny')) / 2), 1, PAPER, 'tiny', { alignTop: true });
  const c = s.canvas();
  tags.set(str, c);
  return c;
}

function toteColor(n: number): readonly [string, number] {
  const c = colorOf(n);
  if (c === 'red') return [RED3, 22];
  if (c === 'green') return [GREEN3, 11];
  return [GREY3, 1];
}

function netPlate(net: number): PlateLine {
  if (net > 0) return ['NET +' + fmt(net), 'jersey', GREEN];
  if (net < 0) return ['NET -' + fmt(-net), 'jersey', REDL];
  return ['NET 0', 'jersey', PAPER];
}

function reactionOf(net: number): Reaction {
  if (net > 0) return 'cheer';
  if (net < 0) return 'groan';
  return 'idle';
}

const dollySprite = (): HTMLCanvasElement => {
  const s = new Sprite(7, 9);
  cylV(s, 1, 3, 5, 6, R.white);
  sphere(s, 3.5, 2.5, 2.4, R.gold);
  s.outline();
  return s.canvas();
};

export class RouletteRoom extends Room {
  readonly focusX = 150;

  private readonly layer = roulette();
  private readonly bowlImg = bowl();
  private readonly wst = create(0);
  private readonly croupier = FL.person({
    skin: R.skinC,
    hair: 'slick',
    hairRamp: R.grey,
    top: R.white,
    over: R.black,
    overKind: 'jacket',
    neck: 'bow',
    collar: true,
    mustache: true,
  });
  private readonly woman = FL.person({
    arms: false,
    skin: R.skinC,
    hair: 'big',
    hairRamp: R.blond,
    top: R.red,
    neck: 'dress',
    earrings: true,
    lips: R.red[2],
    sleeve: R.skinC,
  });
  private readonly man = FL.person({
    arms: false,
    skin: R.skinA,
    hair: 'slick',
    hairRamp: R.hair,
    top: R.white,
    over: R.purple,
    overKind: 'jacket',
    neck: 'chain',
    shades: true,
  });
  private readonly dollyImg = dollySprite();
  private readonly onSettled: (() => void) | undefined;

  private tote: number[] = [];
  private toteAt = -9;
  private launchAt = -9;
  private dolly: { x: number; y: number } | null = null;
  private rake: Rake | null = null;
  private react: { kind: Reaction; t0: number } | null = null;
  private shown = new Map<string, FeltStack>();
  private flying = new Set<string>();
  private latestBets: readonly FeltBet[] = [];
  private latestHistory: readonly number[] = [];
  private historyWaiting = false;
  private chipsNow: number | null = null;
  private payoutHold: number | null = null;
  private flightsLeft = 0;
  private throwNo = 0;
  private throwing = false;
  private touched = false;

  constructor(cv: HTMLCanvasElement, opts: RouletteRoomOpts = {}) {
    super(cv, opts);
    this.onSettled = opts.onSettled;
    this.useRoom({ ...this.layer, sparkles: SPARKLES });
    place(this.wst, 0);
  }

  get rolling(): boolean {
    return this.throwing;
  }

  get ball(): { pocket: number; r: number } {
    return { pocket: ORDER[pocketIndexAt(this.wst.theta, this.wst.W)], r: this.wst.r };
  }

  protected get board(): readonly number[] {
    return this.tote;
  }

  protected get railChips(): number {
    if (this.chipsNow === null) return 0;
    if (this.payoutHold === null) return this.chipsNow;
    return this.chipsNow - this.payoutHold;
  }

  setBets(bets: readonly FeltBet[]): void {
    this.latestBets = bets;
    if (!this.throwing) this.reform();
  }

  setChips(chips: number | null): void {
    this.chipsNow = chips;
    this.kickDraw();
  }

  setHistory(pockets: readonly number[]): void {
    this.latestHistory = pockets;
    if (this.throwing) {
      this.historyWaiting = true;
      return;
    }
    this.tote = pockets.slice(0, 9);
    if (!this.touched) place(this.wst, pockets[0] ?? 0);
    this.kickDraw();
  }

  roll(spin: SpinView): void {
    landNow(this.wst, this.t);
    const id = ++this.throwNo;
    this.touched = true;
    this.throwing = true;
    this.payoutHold = spin.totalPayout;
    this.rake = null;
    this.dolly = null;
    this.flying.clear();
    this.shown = new Map(feltStacks(spin.bets).map((st) => [st.zone, st]));
    if (this.reduced || this.paused) {
      place(this.wst, spin.pocket);
      this.wst.landedAt = this.t;
      this.land(spin, id);
      return;
    }
    this.launchAt = this.t;
    launch(this.wst, this.t, spin.pocket, SPIN_DUR, () => this.land(spin, id));
    this.schedule(SPIN_DUR * 0.42, () => {
      if (id !== this.throwNo) return;
      this.setPlate([['NO MORE BETS', 'jersey', GOLD]], 300, 104, 1.4);
    });
    this.kick();
  }

  show(spin: SpinView | null): void {
    if (!spin || this.throwing) return;
    this.touched = true;
    place(this.wst, spin.pocket);
    this.kickDraw();
  }

  private land(spin: SpinView, id: number): void {
    const pocket = spin.pocket,
      color = colorOf(pocket);
    this.tote = [pocket, ...this.tote].slice(0, 9);
    this.toteAt = this.t;
    this.setPlate(
      [
        [String(pocket), 'jersey', PAPER],
        [color.toUpperCase(), 'tiny', toteColor(pocket)[0]],
      ],
      this.layer.wheel.x,
      104,
      2.6,
    );
    this.dolly = this.zoneCenter('n' + pocket);
    this.schedule(0.7, () => this.payOut(spin, id));
  }

  private payOut(spin: SpinView, id: number): void {
    if (id !== this.throwNo) return;
    const paid = spin.bets.filter((b) => zoneOf(b) !== null);
    const winners = paid.filter((b) => b.payout > 0),
      losers = paid.filter((b) => b.payout <= 0);
    const rail = this.layer.rail;
    if (losers.length && !this.reduced && !this.paused) {
      const z = this.zoneCenter(zoneOf(losers[0])!);
      this.rake = {
        t0: this.t,
        dur: 1.1,
        to: z,
        zones: losers.map((b) => zoneOf(b)!),
        grabbed: false,
      };
    }
    this.flightsLeft = winners.length;
    if (!winners.length) this.payoutHold = null;
    for (const [i, b] of winners.entries()) {
      const p = this.zoneCenter(zoneOf(b)!);
      this.fly(SP.chipKeyFor(b.stake), p.x, p.y, rail.x, rail.y, 0.5 + i * 0.1, () =>
        this.landed(id),
      );
    }
    this.shown.clear();
    const net = spin.totalPayout - spin.totalStake;
    this.react = { kind: reactionOf(net), t0: this.t };
    if (net > 0) this.burst(rail.x - 20, rail.y - 10, 10, 30);
    this.schedule(0.75, () => this.settled(net, id));
  }

  private landed(id: number): void {
    if (id !== this.throwNo) return;
    this.flightsLeft--;
    if (this.flightsLeft === 0) this.payoutHold = null;
  }

  private settled(net: number, id: number): void {
    if (id !== this.throwNo) return;
    this.setPlate([netPlate(net)], 300, 104, 2.2);
    this.throwing = false;
    if (this.historyWaiting) {
      this.tote = this.latestHistory.slice(0, 9);
      this.historyWaiting = false;
    }
    this.onSettled?.();
    this.reform();
  }

  private reform(): void {
    const want = feltStacks(this.latestBets),
      rail = this.layer.rail;
    const keep = new Set(want.map((st) => st.zone));
    let back = 0;
    for (const [zone, st] of [...this.shown]) {
      if (keep.has(zone)) continue;
      this.shown.delete(zone);
      const p = this.zoneCenter(zone);
      this.fly(SP.chipKeyFor(st.stake), p.x, p.y, rail.x, rail.y, 0.35 + back++ * 0.07);
    }
    for (const st of want) this.addStack(st);
    this.kickDraw();
  }

  private addStack(st: FeltStack): void {
    const cur = this.shown.get(st.zone);
    if (cur && cur.stake === st.stake && cur.count === st.count) return;
    if (this.flying.has(st.zone)) return;
    if (cur && st.stake <= cur.stake) {
      this.shown.set(st.zone, st);
      return;
    }
    const p = this.zoneCenter(st.zone),
      rail = this.layer.rail;
    this.dolly = null;
    this.flying.add(st.zone);
    this.fly(SP.chipKeyFor(st.stake - (cur?.stake ?? 0)), rail.x, rail.y, p.x, p.y, 0.4, () => {
      this.flying.delete(st.zone);
      if (this.throwing) return;
      const now = feltStacks(this.latestBets).find((s) => s.zone === st.zone);
      if (now) this.shown.set(st.zone, now);
      this.reform();
    });
  }

  private zoneCenter(key: string): { x: number; y: number } {
    const z: Zone = this.layer.board.zones[key];
    return { x: this.layer.boardAt.x + z.x + z.w / 2, y: this.layer.boardAt.y + z.y + z.h / 2 };
  }

  protected override stepRoom(dt: number): void {
    stepWheel(this.wst, this.t, dt);
  }

  protected override finishAll(): void {
    landNow(this.wst, this.t);
  }

  private drawTote(): void {
    const { x, y } = this.layer.tote,
      T = this.t,
      S = this.s;
    this.tote.slice(0, 9).forEach((n, i) => {
      const [col, dx] = toteColor(n);
      if (
        i === 0 &&
        !this.reduced &&
        T - this.toteAt < 3 &&
        Math.floor((T - this.toteAt) * 4) % 2 === 0
      ) {
        this.ctx.fillStyle = '#3a1e08';
        this.ctx.fillRect(x * S, (y + i * 7) * S, 30 * S, 7 * S);
      }
      this.text(String(n), x + dx, y + i * 7, col);
    });
  }

  private spectatorArms(p: Person, at: { x: number; y: number }, kind: Reaction, T: number): void {
    const [[sx0, sy0], [sx1, sy1]] = p.shoulders,
      L = [at.x + sx0, at.y + sy0],
      Rr = [at.x + sx1, at.y + sy1];
    const sleeve = p.sleeve,
      skin = p.skin;
    const draw = (sh: number[], el: number[], hd: number[]) => {
      FL.limb(this, [sh, el, hd], sleeve);
      FL.hand(this, hd[0], hd[1], skin);
    };
    if (kind === 'cheer') {
      const up = Math.round(Math.sin(T * 10) * 2);
      draw(L, [L[0] - 6, L[1] - 9], [L[0] - 4, L[1] - 21 + up]);
      draw(Rr, [Rr[0] + 6, Rr[1] - 9], [Rr[0] + 4, Rr[1] - 21 - up]);
      return;
    }
    if (kind === 'groan') {
      draw(L, [L[0] - 6, L[1] - 6], [L[0] + 3, L[1] - 18]);
      draw(Rr, [Rr[0] + 6, Rr[1] - 6], [Rr[0] - 3, Rr[1] - 18]);
      return;
    }
    draw(L, [L[0] - 2, L[1] + 12], [L[0] - 1, L[1] + 24]);
    if (p === this.woman) {
      draw(Rr, [Rr[0] + 4, Rr[1] + 11], [Rr[0] - 3, Rr[1] + 8]);
      this.img(FL.martini, Rr[0] - 6, Rr[1]);
      return;
    }
    draw(Rr, [Rr[0] + 2, Rr[1] + 12], [Rr[0] + 1, Rr[1] + 24]);
  }

  private drawRake(rh: number[], T: number): void {
    const rake = this.rake;
    if (!rake) return;
    const c = this.ctx,
      S = this.s;
    const k = clamp((T - rake.t0) / rake.dur, 0, 1),
      out = k < 0.45 ? easeOut(k / 0.45) : 1 - easeOut((k - 0.45) / 0.55);
    const head = [rh[0] + (rake.to.x - rh[0]) * out, rh[1] + 6 + (rake.to.y - rh[1] - 6) * out];
    rake.grabbed = k >= 0.45;
    c.fillStyle = R.wood[2];
    const n = Math.ceil(Math.hypot(head[0] - rh[0], head[1] - rh[1]) * 1.5);
    for (let i = 0; i <= n; i++)
      c.fillRect(
        Math.round(rh[0] + (head[0] - rh[0]) * (i / n)) * S,
        Math.round(rh[1] + (head[1] - rh[1]) * (i / n)) * S,
        S,
        S,
      );
    c.fillStyle = INK;
    c.fillRect(Math.round((head[0] - 6) * S), Math.round((head[1] - 1) * S), 13 * S, 3 * S);
    c.fillStyle = R.wood[3];
    c.fillRect(Math.round((head[0] - 5) * S), Math.round(head[1] * S), 11 * S, S);
    if (rake.grabbed && k < 1)
      for (let i = 0; i < Math.min(3, rake.zones.length); i++)
        this.imgF(SP.chips.side['r'], head[0] - 4 + i * 2, head[1] - 4);
    if (k >= 1) this.rake = null;
  }

  protected draw(): void {
    const c = this.ctx,
      T = this.t,
      S = this.s,
      ROU = this.layer,
      wst = this.wst;
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    this.img(ROU.back, 0, 0);
    this.drawNeon();
    this.drawRings();
    this.drawSlots();
    this.drawTote();
    if (!this.reduced) {
      const d = ROU.drops[Math.floor(T * 3) % ROU.drops.length];
      this.img(FL.bulbMini, d[0] - 1, d[1] - 1);
    }
    this.img(faceOf(this.woman, T, 9, this.reduced), ROU.woman.x, ROU.woman.y);
    this.img(faceOf(this.man, T, 11, this.reduced), ROU.man.x, ROU.man.y);
    this.img(faceOf(this.croupier, T, 8, this.reduced), ROU.croupier.x, ROU.croupier.y);
    this.img(ROU.front, 0, 0);
    const wx = ROU.wheel.x,
      wy = ROU.wheel.y;
    this.img(this.bowlImg.img, wx - this.bowlImg.c, wy - this.bowlImg.c);
    const landedAgo = T - wst.landedAt;
    const hl =
      !wst.spin &&
      (this.reduced || (landedAgo < 3 && Math.floor(landedAgo * 4) % 2 === 0)) &&
      wst.landedAt > -5
        ? wst.restIdx
        : -1;
    this.img(paintHead(wst.W, hl), wx - headSize / 2, wy - headSize / 2);
    for (const p of wst.trail) {
      c.globalAlpha = 0.4;
      this.imgF(ballSprite, wx + Math.cos(p.theta) * p.r - 1.5, wy + Math.sin(p.theta) * p.r - 1.5);
      c.globalAlpha = 1;
    }
    const bx = wx + Math.cos(wst.theta) * wst.r,
      by = wy + Math.sin(wst.theta) * wst.r;
    c.fillStyle = 'rgba(8,6,12,0.6)';
    c.fillRect(Math.round((bx - 0.5) * S), Math.round((by - 0.5) * S), 3 * S, 3 * S);
    this.imgF(ballSprite, bx - 1.5, by - 1.5);
    for (const [zone, info] of this.shown) {
      if (this.rake && this.rake.zones.includes(zone) && this.rake.grabbed) continue;
      const p = this.zoneCenter(zone);
      for (let n = 0; n < Math.min(4, info.count); n++)
        this.img(SP.chips.side[SP.chipKeyFor(info.stake)], p.x - 4, p.y + 1 - n * 2);
      this.img(tag('x' + fmt(info.stake)), p.x - 9, p.y - 14);
    }
    if (this.dolly) this.img(this.dollyImg, this.dolly.x - 3, this.dolly.y - 8);
    const cp = ROU.croupier,
      [[ex0, ey0], [ex1, ey1]] = this.croupier.elbows;
    const flick =
      !this.reduced && T - this.launchAt < 0.35
        ? Math.sin(((T - this.launchAt) / 0.35) * Math.PI)
        : 0;
    const lh = [cp.x + ex0 - 4 - Math.round(flick * 6), cp.y + ey0 + 14 + Math.round(flick * 4)];
    FL.limb(this, [[cp.x + ex0, cp.y + ey0], lh], this.croupier.sleeve);
    FL.hand(this, lh[0], lh[1], this.croupier.skin);
    const rh = [cp.x + ex1 + 6, cp.y + ey1 + 14];
    this.drawRake(rh, T);
    FL.limb(this, [[cp.x + ex1, cp.y + ey1], rh], this.croupier.sleeve);
    FL.hand(this, rh[0], rh[1], this.croupier.skin);
    const kind = this.react && T - this.react.t0 < 2.2 ? this.react.kind : 'idle';
    this.spectatorArms(this.woman, ROU.woman, kind, T);
    this.spectatorArms(this.man, ROU.man, kind, T);
    this.stacks(this.railChips, ROU.stacks.x, ROU.stacks.y, 11);
    this.drawFliers();
    this.drawSparkles();
    this.drawPlate();
  }
}
