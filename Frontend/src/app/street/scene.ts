// Street renderer. Moving sprites land on whole screen pixels (smooth motion) and every sprite
// pixel stays square. The turnover meter's effects live here too: popups over buildings, a
// spotlight, coins and sparks, a short shake and a crowd that grows with the player.
import type { FontKey } from './pix';
import { R, INK, Sprite, mix, measure, text } from './pix';
import type { Building, BuildingId } from './city';
import { compose, CORE, CORE_X } from './city';
import type { PersonSpec, CarKind } from './actors';
import * as A from './actors';
import { deviceScale, streetFit, widthScale } from './street-fit';

type Mode = 'smooth' | 'snap';
type PartKind = 'coin' | 'spark';
type Line = [string, FontKey, string];

interface SceneOptions {
  interactive?: boolean;
  cssWidth?: () => number;
  scaleWidth?: () => number;
  onHover?: (building: Building | null, event?: PointerEvent) => void;
  onPick?: (building: Building) => void;
  mode?: Mode;
  scale?: number;
  fit?: boolean;
  heightBudget?: () => number;
  view?: { x?: number; y?: number; w?: number; h?: number };
  demo?: boolean;
}
interface Actor {
  x: number;
  d: number;
  v: number;
  dist: number;
  leaving?: boolean;
  spec?: unknown;
}
interface Walker extends Actor {
  k: string;
  y: number;
  cart?: boolean;
}
interface Vehicle extends Actor {
  k: CarKind;
  lane: number;
  wait: number;
}
interface WalkerSpec {
  k: string;
  y: number;
  v: number;
  d: number;
}
interface VehicleSpec {
  k: CarKind;
  lane: number;
  v: number;
  d: number;
}
interface Puff {
  x: number;
  y: number;
  age: number;
  life: number;
}
interface Pigeon {
  x: number;
  y: number;
  f: number;
  next: number;
}
interface Part {
  kind: PartKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  age: number;
  life: number;
}
interface Popup {
  id: BuildingId;
  img: HTMLCanvasElement;
  x: number;
  y: number;
  at: number;
  life: number;
}
interface Spot {
  b: Building;
  at: number;
  life: number;
}
interface Directional {
  r: HTMLCanvasElement[];
  l: HTMLCanvasElement[];
}
interface World {
  city: ReturnType<typeof compose>;
  bg: HTMLCanvasElement;
  fg: HTMLCanvasElement;
  frames: Record<string, Directional>;
  cart: { r: HTMLCanvasElement; l: HTMLCanvasElement };
  cars: Record<string, Directional>;
  beam: { r: HTMLCanvasElement; l: HTMLCanvasElement };
  pigeon: HTMLCanvasElement[];
  pawn: {
    boarded: HTMLCanvasElement;
    open: HTMLCanvasElement;
    neon: HTMLCanvasElement;
    boards: HTMLCanvasElement;
  };
  overlays: Record<string, Record<string, HTMLCanvasElement>>;
  loans: HTMLCanvasElement[];
  outline: Record<string, HTMLCanvasElement>;
  bubbles: Map<string, HTMLCanvasElement>;
  labels: Map<string, HTMLCanvasElement>;
}

const LOANS = [400, 2000, 10000],
  PAWN_AT = 1000000;
let shared: World | null = null;

function cv(sp: Sprite) {
  return sp.canvas();
}
function outlineOf(b: Building, col: string) {
  const s = new Sprite(b.s.w + 2, b.s.h + 2);
  b.s.each((x, y, c) => {
    if (!c) return;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (!b.s.get(x + dx, y + dy)) s.set(x + 1 + dx, y + 1 + dy, col);
  });
  return cv(s);
}

const PEOPLE: Record<string, PersonSpec> = {
  picker: {
    skin: R.skinB,
    hair: 'beanie',
    capRamp: R.green,
    top: R.olive,
    bottom: R.black,
    pose: 'push',
  },
  boombox: {
    skin: R.skinB,
    hair: 'cap',
    capRamp: R.red,
    top: R.purple,
    bottom: R.denim,
    pose: 'carry',
  },
  suit: {
    skin: R.skinC,
    hair: 'long',
    hairRamp: R.blond,
    top: R.denim,
    bottom: R.black,
    pose: 'case',
  },
  hoodie: { skin: R.skinA, hair: 'short', top: R.red, bottom: R.denim, pose: 'walk' },
  oldman: {
    skin: R.skinA,
    hair: 'cap',
    capRamp: R.grey,
    top: R.tan,
    bottom: R.wood,
    pose: 'gesture',
  },
  lady: { skin: R.skinC, hair: 'long', top: R.red, bottom: R.denim, pose: 'gesture' },
  jogger: { skin: R.skinC, hair: 'short', top: R.green, bottom: R.grey, pose: 'walk' },
  shopper: {
    skin: R.skinA,
    hair: 'long',
    hairRamp: R.hair,
    top: R.purple,
    bottom: R.denim,
    pose: 'bag',
  },
  grandpa: { skin: R.skinA, hair: 'bald', top: R.grey, bottom: R.wood, pose: 'cane' },
  courier: {
    skin: R.skinB,
    hair: 'cap',
    capRamp: R.taxi,
    top: R.taxi,
    bottom: R.black,
    pose: 'carry',
  },
  clerk: { skin: R.skinC, hair: 'short', top: R.white, bottom: R.black, pose: 'case' },
};
// How many people and cars the block holds at each meter stop. Index = stop.
const CROWD = { walkers: [0, 1, 2, 3, 5], cars: [0, 0, 1, 1, 2] };
const EXTRA_WALKERS: WalkerSpec[] = [
  { k: 'jogger', y: 11, v: 22, d: 1 },
  { k: 'shopper', y: 12, v: 10, d: -1 },
  { k: 'grandpa', y: 10, v: 6, d: 1 },
  { k: 'courier', y: 13, v: 15, d: -1 },
  { k: 'clerk', y: 11, v: 13, d: 1 },
];
const EXTRA_CARS: VehicleSpec[] = [
  { k: 'sedan', lane: 1, v: 28, d: 1 },
  { k: 'taxi', lane: 0, v: 32, d: -1 },
];
// [chance per frame, shortest off time, longest off time]. The R of OPEN 24 HRS stutters most.
const FLICKER: Record<string, [number, number, number]> = {
  blade: [0.004, 0.05, 0.17],
  cards: [0.004, 0.05, 0.17],
  hours: [0.004, 0.05, 0.17],
  open: [0.004, 0.05, 0.17],
  dice: [0.004, 0.05, 0.17],
  hoursR: [0.025, 0.08, 0.5],
};

function build() {
  if (shared) return shared;
  const city = compose(0);
  const frames: Record<string, Directional> = {};
  for (const [k, o] of Object.entries(PEOPLE)) {
    frames[k] = {
      r: [0, 1, 2, 3].map((f) => cv(A.person(o, f))),
      l: [0, 1, 2, 3].map((f) => cv(A.person(o, f).flipX())),
    };
  }
  const cartS = A.cart();
  const cars: Record<string, Directional> = {};
  for (const k of Object.keys(A.CARS) as CarKind[])
    cars[k] = {
      r: [0, 1, 2, 3].map((f) => cv(A.car(k, f))),
      l: [0, 1, 2, 3].map((f) => cv(A.car(k, f, true))),
    };
  const beamR = A.beam(),
    beamL = beamR.flipX();
  const pawn = city.buildings.find((b) => b.id === 'pawn')!;
  const boardRows = new Sprite(pawn.s.w, 28);
  pawn.s.each((x, y, c) => {
    if (c && y >= 46 && y < 74) boardRows.set(x, y - 46, c);
  });
  shared = {
    city,
    bg: cv(city.bg),
    fg: cv(city.fg),
    frames,
    cart: { r: cv(cartS), l: cv(cartS.flipX()) },
    cars,
    beam: { r: cv(beamR), l: cv(beamL) },
    pigeon: [cv(A.pigeon(0)), cv(A.pigeon(1))],
    pawn: {
      boarded: cv(pawn.s),
      open: cv(pawn.open.s),
      neon: cv(pawn.open.fx.neon),
      boards: cv(boardRows),
    },
    overlays: Object.fromEntries(
      city.buildings.map((b) => [
        b.id,
        Object.fromEntries(
          Object.entries(b.fx)
            .filter(([, v]) => v instanceof Sprite)
            .map(([k, v]) => [k, cv(v as Sprite)]),
        ),
      ]),
    ),
    loans: city.buildings.find((b) => b.id === 'bank')!.fx.loans.map(cv),
    outline: Object.fromEntries(city.buildings.map((b) => [b.id, outlineOf(b, '#f6dc6a')])),
    bubbles: new Map(),
    labels: new Map(),
  };
  return shared;
}

const CHAT = [
  [
    ['Unit 7 said 9,000.', 'Got a mattress.'],
    ['Bid late and the', 'clock adds 30 s.'],
  ],
  [
    ['The window lent', 'me 200 bucks.'],
    ['Wants 220 back', 'in one minute.'],
  ],
  [
    ['That pawnshop is', 'boarded for good?'],
    ['Move a million', 'and buy the keys.'],
  ],
];
// One exchange: dots, line A, dots, line B, then a pause so the facade shows again.
const TALK = { lead: 0.3, say: 3.0, gap: 0.3, cycle: 10 };
function talkPhase(since: number): { side: number; dots?: boolean; show?: boolean } {
  const { lead, say, gap } = TALK,
    second = lead + say + gap;
  if (since < lead) return { side: 0, dots: true };
  if (since < lead + say) return { side: 0, show: true };
  if (since < second) return { side: 1, dots: true };
  if (since < second + say) return { side: 1, show: true };
  return { side: -1 };
}
const LINE_H: Record<string, number> = { tiny: 7, micro: 7, jersey: 17 };

class Scene {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  opts: SceneOptions;
  mode: Mode;
  speed: number;
  w: World;
  city: World['city'];
  turnover: number;
  pawnOpenAt: number;
  loanAt: number[];
  hover: Building | null;
  t: number;
  last: number;
  running: boolean;
  visible: boolean;
  reduced: boolean;
  frameTimes: number[];
  buf: HTMLCanvasElement;
  bctx: CanvasRenderingContext2D;
  dark: HTMLCanvasElement;
  dctx: CanvasRenderingContext2D;
  flick: Record<string, { off: number }>;
  popups: Popup[];
  parts: Part[];
  spot: Spot | null;
  shakeUntil: number;
  walkers!: Walker[];
  cars!: Vehicle[];
  talk!: { i: number; since: number };
  puffs!: Puff[];
  puffClock!: number;
  pigeons!: Pigeon[];
  vw!: number;
  vh!: number;
  vx!: number;
  vy!: number;
  s!: number;
  ds!: number;
  skip = 0;
  private readonly observer: IntersectionObserver;
  private readonly abort = new AbortController();
  private destroyed = false;
  private frame = 0;

  constructor(canvas: HTMLCanvasElement, opts: SceneOptions = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.opts = opts;
    this.mode = opts.mode || 'smooth';
    this.speed = 1;
    this.w = build();
    this.city = this.w.city;
    this.turnover = 0;
    this.pawnOpenAt = -1;
    this.loanAt = [-1, -1, -1];
    this.hover = null;
    this.t = 0;
    this.last = 0;
    this.running = false;
    this.visible = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.frameTimes = [];
    this.buf = document.createElement('canvas');
    this.bctx = this.buf.getContext('2d')!;
    this.dark = document.createElement('canvas');
    this.dctx = this.dark.getContext('2d')!;
    this.flick = {};
    this.popups = [];
    this.parts = [];
    this.spot = null;
    this.shakeUntil = 0;
    this.initActors();
    this.resize();
    if (opts.interactive) this.bindPointer();
    this.observer = new IntersectionObserver(
      (es) => {
        this.visible = es[0].isIntersecting;
        this.kick();
      },
      { threshold: 0 },
    );
    this.observer.observe(canvas);
    document.addEventListener('visibilitychange', () => this.kick(), { signal: this.abort.signal });
    this.kick();
  }
  initActors() {
    const G = this.city.GROUND,
      demo = this.opts.demo;
    const walkers: Omit<Walker, 'dist'>[] = demo
      ? [{ k: 'hoodie', x: CORE_X + 180, y: G + 12, v: 12, d: 1 }]
      : [
          { k: 'picker', x: 120, y: G + 10, v: 7, d: 1, cart: true },
          { k: 'boombox', x: 420, y: G + 13, v: 14, d: -1 },
          { k: 'suit', x: 300, y: G + 10, v: 16, d: 1 },
          { k: 'hoodie', x: 560, y: G + 13, v: 12, d: -1 },
        ];
    this.walkers = walkers.map((w) => ({ ...w, dist: 0 }));
    const cars: Omit<Vehicle, 'dist' | 'wait'>[] = demo
      ? [{ k: 'taxi', x: CORE_X + 120, lane: 1, v: 18, d: 1 }]
      : [
          { k: 'taxi', x: 40, lane: 1, v: 34, d: 1 },
          { k: 'van', x: 360, lane: 1, v: 26, d: 1 },
          { k: 'wagon', x: 500, lane: 0, v: 22, d: -1 },
          { k: 'sedan', x: 160, lane: 0, v: 30, d: -1 },
        ];
    this.cars = cars.map((c) => ({ ...c, dist: 0, wait: 0 }));
    this.talk = { i: 0, since: 0 };
    this.puffs = [];
    this.puffClock = 0;
    this.pigeons = demo
      ? []
      : [0, 1, 2].map((i) => ({
          x: CORE_X + 352 + i * 11,
          y: this.city.GROUND + 7 + (i % 2),
          f: 0,
          next: Math.random(),
        }));
  }
  setMode(m: Mode) {
    this.mode = m;
    this.draw();
  }
  highlight(id: BuildingId | null) {
    this.hover = id ? this.building(id) : null;
    this.draw();
  }
  setSpeed(v: number) {
    this.speed = v;
  }
  setTurnover(v: number) {
    const now = this.t,
      prev = this.turnover;
    this.turnover = v;
    LOANS.forEach((th, k) => {
      if (v >= th && prev < th) this.loanAt[k] = now;
    });
    if (v >= PAWN_AT && prev < PAWN_AT) this.pawnOpenAt = now;
    if (v < PAWN_AT) this.pawnOpenAt = -1;
    this.kick();
    this.draw();
  }

  // ----- crowd: extra people and cars walk in from the edge and walk out again -----
  setCrowd(stop: number) {
    if (this.opts.demo) return;
    const G = this.city.GROUND;
    this.syncExtras(this.walkers, EXTRA_WALKERS, CROWD.walkers[stop], (spec) => ({
      ...spec,
      y: G + spec.y,
      dist: 0,
    }));
    this.syncExtras(this.cars, EXTRA_CARS, CROWD.cars[stop], (spec) => ({
      ...spec,
      dist: 0,
      wait: 0,
    }));
  }
  syncExtras<S extends { d: number }, T extends Actor>(
    list: T[],
    specs: S[],
    want: number,
    make: (spec: S) => Omit<T, 'x' | 'spec'>,
  ) {
    specs.forEach((spec, k) => {
      const cur = list.find((a) => a.spec === spec);
      if (cur) {
        cur.leaving = k >= want;
        return;
      }
      if (k >= want) return;
      const a = make(spec) as T;
      a.spec = spec;
      a.x = this.entryX(a.d);
      list.push(a);
    });
  }
  entryX(d: number) {
    return d > 0 ? this.vx - 34 : this.vx + this.vw + 14;
  }
  offView(a: Actor) {
    return a.x < this.vx - 40 || a.x > this.vx + this.vw + 40;
  }

  // ----- effects for the meter -----
  building(id: BuildingId) {
    return this.city.buildings.find((b) => b.id === id) || null;
  }
  centerOf(id: BuildingId) {
    const b = this.building(id);
    if (!b) return 0;
    return ((b.x + b.w / 2 - this.vx) * this.ds) / (window.devicePixelRatio || 1);
  }
  // A popup is a dark plate with a border in the tone of its main line, so it reads over any
  // part of the street, the billboard included.
  label(lines: Line[]) {
    const key = JSON.stringify(lines);
    if (this.w.labels.has(key)) return this.w.labels.get(key)!;
    const widths = lines.map(([t, f]) => measure(t, f)),
      w = Math.max(...widths) + 8;
    const h = lines.reduce((n, [, f]) => n + LINE_H[f], 0) + 5,
      s = new Sprite(w, h);
    const tone = mix(lines[Math.min(1, lines.length - 1)][2], INK, 0.35);
    s.rect(1, 1, w - 2, h - 2, INK);
    s.hline(1, 0, w - 2, tone);
    s.hline(1, h - 1, w - 2, tone);
    s.vline(0, 1, h - 2, tone);
    s.vline(w - 1, 1, h - 2, tone);
    let y = 3;
    lines.forEach(([t, f, col], k) => {
      text(s, t, Math.floor((w - widths[k]) / 2), y, col, f, { alignTop: true });
      y += LINE_H[f];
    });
    const img = cv(s);
    this.w.labels.set(key, img);
    return img;
  }
  // A new popup ends every older one it would cover, so two plates never stack.
  popup(id: BuildingId, lines: Line[], life = 2.2) {
    const b = this.building(id);
    if (!b) return;
    const img = this.label(lines),
      at = this.t;
    const next = {
      id,
      img,
      x: b.x + b.w / 2 - img.width / 2,
      y: Math.max(16, b.y - 4 - img.height),
      at,
      life,
    };
    const hits = (p: Popup) =>
      p.x < next.x + img.width &&
      next.x < p.x + p.img.width &&
      p.y - 10 < next.y + img.height &&
      next.y - 10 < p.y + p.img.height;
    for (const p of this.popups) if (hits(p)) p.life = Math.min(p.life, at - p.at + 0.12);
    this.popups.push(next);
    this.kick();
  }
  spotlight(id: BuildingId, life = 1.6) {
    const b = this.building(id);
    if (!b) return;
    this.spot = { b, at: this.t, life };
    this.kick();
  }
  shake(life = 0.45) {
    this.shakeUntil = this.t + life;
    this.kick();
  }
  origin(b: Building) {
    if (b.id === 'room' && b.fx.tv)
      return { x: b.x - 1 + b.fx.tv.x + 4, y: b.y - 1 + b.fx.tv.y + 5 };
    if (b.id === 'bank') return { x: b.x + b.w / 2, y: b.y + 14 };
    if (b.id === 'pawn') return { x: b.x + 31, y: b.y + 56 };
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }
  burst(id: BuildingId, kind: PartKind, n: number) {
    const b = this.building(id);
    if (!b) return;
    const o = this.origin(b),
      G = this.city.GROUND,
      rnd = (a: number, z: number) => a + Math.random() * (z - a);
    for (let k = 0; k < n; k++) {
      if (kind === 'coin')
        this.parts.push({
          kind,
          x: o.x + rnd(-4, 4),
          y: o.y,
          vx: rnd(-34, 34),
          vy: rnd(-95, -45),
          floor: G + rnd(5, 12),
          age: 0,
          life: rnd(1.4, 2.2),
        });
      else
        this.parts.push({
          kind,
          x: o.x + rnd(-24, 24),
          y: o.y + rnd(-6, 6),
          vx: rnd(-30, 30),
          vy: rnd(-50, -10),
          floor: G + 14,
          age: 0,
          life: rnd(0.35, 0.7),
        });
    }
    this.kick();
  }
  shakeOffset() {
    if (this.t >= this.shakeUntil) return 0;
    return Math.random() < 0.5 ? -1 : 1;
  }

  resize() {
    const o = this.opts,
      dpr = window.devicePixelRatio || 1;
    const cw = o.cssWidth ? o.cssWidth() : this.cv.parentElement!.clientWidth;
    const sw = o.scaleWidth ? o.scaleWidth() : cw;
    const view = o.view || {};
    let s: number;
    let skyRows = 0;
    if (o.heightBudget) {
      const fit = streetFit({
        viewportWidth: sw,
        heightBudget: o.heightBudget(),
        dpr,
        rows: this.city.H,
        worldCols: this.city.W,
      });
      s = fit.scale;
      skyRows = fit.skyRows;
    } else {
      s = o.scale || widthScale(sw);
    }
    const ds = deviceScale(s, dpr);
    this.vw = o.fit
      ? Math.max(40, Math.ceil((cw * dpr) / ds))
      : view.w || Math.min(this.city.W, Math.max(Math.floor((cw * dpr) / ds), CORE + 8));
    this.vh = view.h || this.city.H - skyRows;
    this.vy = view.y || skyRows;
    this.vx =
      view.x ??
      Math.max(0, Math.min(this.city.W - this.vw, Math.round(CORE_X + CORE / 2 - this.vw / 2)));
    this.s = s;
    this.ds = ds;
    this.cv.width = this.vw * this.ds;
    this.cv.height = this.vh * this.ds;
    this.cv.style.width = (this.vw * this.ds) / dpr + 'px';
    this.cv.style.height = (this.vh * this.ds) / dpr + 'px';
    this.buf.width = this.vw;
    this.buf.height = this.vh;
    this.dark.width = this.vw;
    this.dark.height = this.vh;
    this.draw();
  }
  bindPointer() {
    const signal = this.abort.signal;
    const toArt = (e: MouseEvent): [number, number] => {
      const r = this.cv.getBoundingClientRect();
      return [
        this.vx + ((e.clientX - r.left) * this.vw) / r.width,
        this.vy + ((e.clientY - r.top) * this.vh) / r.height,
      ];
    };
    const pick = (ax: number, ay: number) =>
      this.city.buildings.find(
        (b) =>
          ax >= b.x &&
          ax < b.x + b.w &&
          ay >= b.y &&
          ay < this.city.GROUND &&
          b.s.get(Math.floor(ax - b.x + 1), Math.floor(ay - b.y + 1)),
      );
    this.cv.addEventListener(
      'pointermove',
      (e) => {
        const b = pick(...toArt(e)) || null;
        if (b !== this.hover) {
          this.hover = b;
          this.cv.style.cursor = b ? 'pointer' : 'default';
          this.draw();
        }
        this.opts.onHover && this.opts.onHover(b, e);
      },
      { signal },
    );
    this.cv.addEventListener(
      'pointerleave',
      () => {
        this.hover = null;
        this.draw();
        this.opts.onHover && this.opts.onHover(null);
      },
      { signal },
    );
    this.cv.addEventListener(
      'click',
      (e) => {
        const b = pick(...toArt(e));
        if (b && this.opts.onPick) this.opts.onPick(b);
      },
      { signal },
    );
  }
  kick() {
    if (this.destroyed) return;
    const want = !this.reduced && this.visible && !document.hidden;
    if (want && !this.running) {
      this.running = true;
      this.last = performance.now();
      this.frameTimes = [];
      this.skip = 12;
      this.frame = requestAnimationFrame((ts) => this.loop(ts));
    }
    if (!want) {
      this.running = false;
      cancelAnimationFrame(this.frame);
    }
    if (!want) this.draw();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.abort.abort();
  }
  loop(ts: number) {
    if (!this.running) return;
    const dt = Math.max(0, Math.min(0.05, (ts - this.last) / 1000));
    if (this.skip > 0) this.skip -= 1;
    else if (this.last && ts > this.last) {
      this.frameTimes.push(ts - this.last);
      if (this.frameTimes.length > 240) this.frameTimes.shift();
    }
    this.last = ts;
    this.update(dt * this.speed, dt);
    this.draw();
    this.frame = requestAnimationFrame((t2) => this.loop(t2));
  }
  stats() {
    const a = this.frameTimes.slice().sort((x, y) => x - y);
    if (!a.length) return null;
    const avg = a.reduce((x, y) => x + y, 0) / a.length;
    return { avg, p95: a[Math.floor(a.length * 0.95)], max: a[a.length - 1], n: a.length };
  }
  pastExit(c: Vehicle, W: number) {
    if (c.d > 0) {
      if (this.opts.demo) return c.x > this.vx + this.vw + 10;
      return c.x > W + 10;
    }
    return c.x < -60;
  }
  reentryX(c: Vehicle, W: number) {
    if (c.d > 0) {
      if (this.opts.demo) return this.vx - 50;
      return -60;
    }
    return W + 10;
  }
  update(dt: number, rawDt: number) {
    this.t += rawDt;
    const W = this.city.W;
    for (const w of this.walkers) {
      w.x += w.v * w.d * dt;
      w.dist += w.v * dt;
      if (w.leaving) continue;
      if (w.x > W + 30) w.x = -30;
      if (w.x < -30) w.x = W + 30;
      if (this.opts.demo && w.x > this.vx + this.vw + 20) w.x = this.vx - 20;
    }
    this.walkers = this.walkers.filter((w) => !(w.leaving && this.offView(w)));
    for (const c of this.cars) {
      if (c.wait > 0) {
        c.wait -= dt;
        continue;
      }
      c.x += c.v * c.d * dt;
      c.dist += c.v * dt;
      if (this.pastExit(c, W) && !c.leaving) {
        c.x = this.reentryX(c, W);
        c.wait = this.opts.demo ? 0.4 : 1 + Math.random() * 3;
      }
    }
    this.cars = this.cars.filter((c) => !(c.leaving && this.offView(c)));
    this.puffClock += dt;
    if (!this.opts.demo && this.puffClock > 0.34) {
      this.puffClock = 0;
      this.puffs.push({
        x: this.city.manhole.x + (Math.random() * 6 - 3),
        y: this.city.manhole.y - 1,
        age: 0,
        life: 2.4 + Math.random(),
      });
    }
    for (const p of this.puffs) {
      p.age += dt;
      p.y -= 7 * dt;
      p.x += 3 * dt;
    }
    this.puffs = this.puffs.filter((p) => p.age < p.life);
    for (const p of this.pigeons) {
      p.next -= rawDt;
      if (p.next < 0) {
        p.f = 1 - p.f;
        p.next = 0.2 + Math.random() * 1.2;
      }
    }
    this.talk.since += rawDt;
    if (this.talk.since > TALK.cycle) {
      this.talk.since = 0;
      this.talk.i = (this.talk.i + 1) % CHAT.length;
    }
    for (const [k, [p, lo, hi]] of Object.entries(FLICKER)) {
      const f = this.flick[k] || (this.flick[k] = { off: 0 });
      if (f.off > 0) f.off -= rawDt;
      else if (Math.random() < p) f.off = lo + Math.random() * (hi - lo);
    }
    for (const p of this.parts) {
      p.age += rawDt;
      p.vy += (p.kind === 'coin' ? 230 : 80) * rawDt;
      p.x += p.vx * rawDt;
      p.y += p.vy * rawDt;
      if (p.kind !== 'coin' || p.vy <= 0 || p.y < p.floor) continue;
      p.y = p.floor;
      p.vy *= -0.35;
      p.vx *= 0.5;
      if (Math.abs(p.vy) < 14) {
        p.vy = 0;
        p.vx = 0;
      }
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    this.popups = this.popups.filter((p) => this.t - p.at < p.life);
  }

  // drawing helpers: X and Y are world art coordinates, possibly fractional
  target() {
    return this.mode === 'snap' ? this.bctx : this.ctx;
  }
  blit(img: HTMLCanvasElement, x: number, y: number, alpha?: number) {
    const c = this.target();
    if (alpha !== undefined) c.globalAlpha = alpha;
    if (this.mode === 'snap') c.drawImage(img, Math.round(x - this.vx), Math.round(y - this.vy));
    else {
      const ds = this.ds;
      c.drawImage(
        img,
        Math.round((x - this.vx) * ds),
        Math.round((y - this.vy) * ds),
        img.width * ds,
        img.height * ds,
      );
    }
    if (alpha !== undefined) c.globalAlpha = 1;
  }
  px(x: number, y: number, w: number, h: number, col: string) {
    const c = this.target();
    c.fillStyle = col;
    if (this.mode === 'snap') c.fillRect(Math.round(x - this.vx), Math.round(y - this.vy), w, h);
    else {
      const ds = this.ds;
      c.fillRect(Math.round((x - this.vx) * ds), Math.round((y - this.vy) * ds), w * ds, h * ds);
    }
  }
  disc(cx: number, cy: number, r: number, col: string, alpha: number) {
    const c = this.target(),
      x0 = Math.round(cx),
      y0 = Math.round(cy),
      n = Math.ceil(r);
    c.globalAlpha = alpha;
    for (let y = -n; y <= n; y++) {
      const hw = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      this.px(x0 - hw, y0 + y, hw * 2 + 1, 1, col);
    }
    c.globalAlpha = 1;
  }
  on(k: string) {
    const f = this.flick[k];
    return !f || f.off <= 0;
  }
  bubble(lines: string[], tailAt: number) {
    const key = lines.join('|') + tailAt;
    if (!this.w.bubbles.has(key)) this.w.bubbles.set(key, cv(A.bubble(lines, tailAt)));
    return this.w.bubbles.get(key)!;
  }
  ellipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
    for (let y = -Math.ceil(ry); y <= ry; y++) {
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      g.fillRect(Math.round(cx) - hw, Math.round(cy) + y, hw * 2 + 1, 1);
    }
  }
  drawSpot() {
    const sp = this.spot;
    if (!sp) return;
    const age = this.t - sp.at;
    if (age > sp.life) {
      this.spot = null;
      return;
    }
    const a = 0.6 * Math.max(0, Math.min(1, age / 0.18, (sp.life - age) / 0.4));
    const g = this.dctx,
      d = this.dark,
      b = sp.b,
      G = this.city.GROUND;
    const cx = b.x + b.w / 2 - this.vx,
      cy = (b.y + G) / 2 - this.vy,
      rx = b.w / 2 + 12,
      ry = (G - b.y) / 2 + 14;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, d.width, d.height);
    g.fillStyle = '#0a0712';
    g.globalAlpha = a;
    g.fillRect(0, 0, d.width, d.height);
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 0.5;
    this.ellipse(g, cx, cy, rx + 7, ry + 7);
    g.globalAlpha = 1;
    this.ellipse(g, cx, cy, rx, ry);
    g.globalCompositeOperation = 'source-over';
    const c = this.target(),
      k = this.mode === 'snap' ? 1 : this.ds;
    c.drawImage(d, 0, 0, this.vw * k, this.vh * k);
  }
  // One fill colour per pass: switching fillStyle for every coin costs more than the coins.
  drawParts() {
    if (!this.parts.length) return;
    const c = this.target(),
      k = this.mode === 'snap' ? 1 : this.ds,
      ox = this.vx,
      oy = this.vy;
    const rect = (p: Part, w: number, h: number) =>
      c.fillRect(Math.round((p.x - ox) * k), Math.round((p.y - oy) * k), w * k, h * k);
    const pass = (col: string, keep: (p: Part) => boolean, w: (p: Part) => number, h: number) => {
      c.fillStyle = col;
      for (const p of this.parts) if (keep(p)) rect(p, w(p), h);
    };
    const isCoin = (p: Part) => p.kind === 'coin',
      spin = (p: Part) => (Math.floor(p.age * 12) % 3 === 1 ? 1 : 2),
      one = () => 1;
    pass(R.gold[2], isCoin, spin, 2);
    pass(R.gold[3], isCoin, one, 1);
    pass('#fffbe8', (p) => p.kind === 'spark' && p.age < 0.2, one, 1);
    pass('#ffd36a', (p) => p.kind === 'spark' && p.age >= 0.2, one, 1);
  }
  drawPopups() {
    for (const p of this.popups) {
      const age = this.t - p.at;
      if (age > p.life - 0.3 && Math.floor(age * 16) % 2 === 1) continue;
      const rise = 10 * (1 - Math.pow(1 - Math.min(1, age / 0.5), 3));
      const x = Math.max(this.vx + 2, Math.min(this.vx + this.vw - p.img.width - 2, p.x));
      this.blit(p.img, x, p.y - rise);
    }
  }

  draw() {
    const sx = this.shakeOffset();
    this.vx += sx;
    this.drawWorld();
    this.vx -= sx;
  }
  drawWorld() {
    const w = this.w,
      c = this.city,
      ctx = this.ctx,
      b = this.bctx,
      snap = this.mode === 'snap';
    ctx.imageSmoothingEnabled = false;
    b.imageSmoothingEnabled = false;
    if (snap) b.drawImage(w.bg, this.vx, this.vy, this.vw, this.vh, 0, 0, this.vw, this.vh);
    else
      ctx.drawImage(
        w.bg,
        this.vx,
        this.vy,
        this.vw,
        this.vh,
        0,
        0,
        this.vw * this.ds,
        this.vh * this.ds,
      );
    const t = this.t,
      B = Object.fromEntries(c.buildings.map((x) => [x.id, x])) as Record<BuildingId, Building>;
    const ov = (id: BuildingId, k: string) => w.overlays[id] && w.overlays[id][k];
    const at = (id: BuildingId, img: HTMLCanvasElement) => this.blit(img, B[id].x - 1, B[id].y - 1);
    const hall = B.auction,
      phase = Math.floor(t * 7) % 3;
    hall.fx.bulbs.forEach(([bx, by]: [number, number], k: number) => {
      if (k % 3 === phase) this.px(hall.x - 1 + bx, hall.y - 1 + by, 1, 1, '#fff4c8');
    });
    hall.fx.bladeBulbs.forEach(([bx, by]: [number, number], k: number) => {
      if ((k >> 1) % 3 === phase) this.px(hall.x - 1 + bx, hall.y - 1 + by, 1, 1, '#ffe08a');
    });
    if (this.on('blade')) at('auction', ov('auction', 'blade'));
    if (this.on('cards')) at('casino', ov('casino', 'cards'));
    if (this.on('hours')) at('casino', ov('casino', 'hours'));
    if (this.on('hours') && this.on('hoursR')) at('casino', ov('casino', 'hoursDead'));
    if (Math.floor(t * 1.5) % 2 === 0) at('casino', ov('casino', 'dice'));
    else at('casino', ov('casino', 'bj'));
    if (this.on('open')) at('bank', ov('bank', 'open'));
    LOANS.forEach((th, k) => {
      if (this.turnover < th) return;
      const since = this.loanAt[k] < 0 ? 9 : t - this.loanAt[k];
      if (since < 0.7 && [0, 1, 0, 0, 1, 1, 0, 1][Math.floor(since * 11) % 8] === 0) return;
      at('bank', w.loans[k]);
    });
    const tv = B.room.fx.tv;
    if (tv) {
      const cols = ['#5f7fb8', '#8fb0d8', '#46649a', '#a9c4ea'];
      this.px(
        B.room.x - 1 + tv.x,
        B.room.y - 1 + tv.y,
        tv.w,
        tv.h,
        cols[Math.floor(t * 4 + Math.sin(t * 13)) & 3],
      );
    }
    const st = B.storage,
      lampOn = Math.sin(t * 2.3) + Math.sin(t * 17) > -0.9;
    this.px(st.x - 1 + st.fx.lamp.x, st.y - 1 + st.fx.lamp.y, 3, 1, lampOn ? '#fff0c0' : '#5a5040');
    const pawn = B.pawn;
    if (this.turnover >= PAWN_AT) {
      at('pawn', w.pawn.open);
      const since = this.pawnOpenAt < 0 ? 9 : t - this.pawnOpenAt;
      if (since < 0.9) {
        const fall = since * since * 140;
        this.blit(w.pawn.boards, pawn.x - 1, pawn.y - 1 + 46 + fall);
      }
      const neonOk = since > 1.3 || [0, 1, 0, 1, 1][Math.floor((since - 0.9) * 12) % 5] === 1;
      if (since > 0.9 && neonOk) at('pawn', w.pawn.neon);
    } else at('pawn', w.pawn.boarded);
    for (const p of this.pigeons) this.blit(w.pigeon[p.f], p.x, p.y - 9);
    const chat = CHAT[this.talk.i],
      tx = CORE_X + 4,
      ty = c.GROUND + 9,
      talk = talkPhase(this.talk.since);
    if (!this.opts.demo) {
      const flap = Math.floor(t * 3) % 2;
      this.blit(w.frames['oldman'].r[talk.side === 0 && talk.show ? flap : 0], tx, ty - 26);
      this.blit(w.frames['lady'].l[talk.side === 1 && talk.show ? flap : 0], tx + 15, ty - 26);
    }
    const walkers = this.walkers.slice().sort((a, b2) => a.y - b2.y);
    for (const wk of walkers) {
      const f = w.frames[wk.k],
        fr = Math.floor(wk.dist / 2.6) % 4,
        set = wk.d > 0 ? f.r : f.l;
      this.blit(set[fr], wk.x - 10, wk.y - 26);
      if (wk.cart)
        this.blit(wk.d > 0 ? w.cart.r : w.cart.l, wk.d > 0 ? wk.x + 5 : wk.x - 24, wk.y - 15);
    }
    this.blit(w.fg, 0, 0);
    if (!this.opts.demo && talk.side >= 0) {
      const head = tx + 10 + talk.side * 15;
      if (talk.show) {
        const bx = CORE_X + 1,
          img = this.bubble(chat[talk.side], head - bx - 1);
        this.blit(img, bx, ty - 26 - img.height + 1);
      } else this.px(head - 1, ty - 30, 2, 2, R.white[3]);
    }
    const laneY = [c.GROUND + 29, c.GROUND + 41];
    for (const lane of [0, 1]) {
      if (lane === 1)
        for (const p of this.puffs) {
          const k = p.age / p.life;
          this.disc(p.x, p.y, 1.5 + k * 4.5, '#ddd4e6', 0.34 * (1 - k));
        }
      for (const car of this.cars) {
        if (car.lane !== lane || car.wait > 0) continue;
        const set = this.w.cars[car.k][car.d > 0 ? 'r' : 'l'],
          fr = Math.floor(car.dist / 2) % 4,
          img = set[fr];
        const y = laneY[lane] - img.height + 1;
        const beam = car.d > 0 ? w.beam.r : w.beam.l;
        this.blit(beam, car.d > 0 ? car.x + img.width - 2 : car.x - beam.width + 2, y + 6, 0.2);
        this.blit(img, car.x, y);
      }
    }
    if (this.hover) this.blit(w.outline[this.hover.id], this.hover.x - 2, this.hover.y - 2);
    this.drawSpot();
    this.drawParts();
    this.drawPopups();
    if (snap) ctx.drawImage(this.buf, 0, 0, this.vw * this.ds, this.vh * this.ds);
  }
}

export type { SceneOptions };
export { Scene, build, LOANS, PAWN_AT };
