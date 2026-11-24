export type CrewKey = 'clerk' | 'appraiser' | 'dealer' | 'magnate';
export type WalkerId = CrewKey | 'you' | `cust${number}`;
export type Face = 'front' | 'left' | 'right';
export type Pt = [number, number];
export type Ang = [number, number];
export interface Plant {
  x: number;
  y: number;
}
export interface Stairs {
  readonly plants: readonly Plant[];
  at(x: number): number;
}
export interface ArmState {
  from: Ang;
  to: Ang;
  name: string;
  t0: number;
  dur: number;
}
export interface Gait {
  x0: number;
  x1: number;
  y0: number;
  dir: number;
  P: Plant[];
  Hs: number[];
  Hy: number[];
  D: number;
  s: number;
  v: number;
  vmax: number;
  sl: number;
  delay: number;
  id: WalkerId;
}
export interface Walker {
  x: number;
  feet?: number;
  top?: number;
  face: Face;
  walking: boolean;
  tx?: number;
  key?: CrewKey;
  i?: number;
  wk?: WalkerId;
  track?: 'stairs' | null;
  g?: Gait | null;
  arrive?: (() => void) | null;
  settleT?: number;
  dip?: number;
  shakeT?: number;
  armHold?: boolean;
  armN?: ArmState;
  armF?: ArmState;
  _face?: Face;
  turnT?: number;
  turnFrom?: Face;
  turnTo?: Face;
}
export interface Foot {
  x: number;
  y: number;
  v: 'flat' | 'toe' | 'heel1' | 'heel2';
  planted: boolean;
}
export interface Pose {
  K: typeof KB;
  gt: (typeof GAIT)[keyof typeof GAIT];
  dir: number;
  hx: number;
  hy: number;
  gy: number;
  feet: Foot[];
  fN: number;
  j: number;
  u: number;
  g: Gait | null;
}

const clamp = (v: number, a: number, z: number) => Math.max(a, Math.min(z, v));
const smooth = (k: number) => k * k * (3 - 2 * k);

export const CREW_H = 104;

export const KB = {
  w: 56,
  h: 104,
  cx: 28,
  hip: 64,
  sh: 35,
  thigh: 18.5,
  shin: 18,
  upper: 13,
  fore: 12,
  legW: 7,
  armW: 6,
  shoe: 'big',
};
export const KS = {
  w: 40,
  h: 96,
  cx: 20,
  hip: 57,
  sh: 28,
  thigh: 18,
  shin: 17.5,
  upper: 12,
  fore: 11,
  legW: 6,
  armW: 5,
  shoe: 'small',
};

export const GAIT = {
  clerk: { step: 15, lift: 5, rise: 2, arm: 0.45, elbow: 0.25, lean: 1, k: 1.0 },
  appraiser: { step: 10, lift: 2, rise: 1, arm: 0.2, elbow: 0.45, lean: 0, k: 0.85 },
  dealer: {
    step: 14,
    lift: 3,
    rise: 1,
    arm: 0.62,
    elbow: 0.5,
    lean: 0,
    k: 0.95,
    sway: 1,
    chain: true,
  },
  magnate: { step: 12, lift: 2, rise: 1, arm: 0.18, elbow: 0.3, lean: 0, k: 0.8, cane: true },
  cust: { step: 13, lift: 3, rise: 1, arm: 0.4, elbow: 0.3, lean: 1, k: 1.0 },
  you: { step: 14, lift: 3, rise: 1, arm: 0.45, elbow: 0.3, lean: 1, k: 1.0 },
};
export const SIDE = {
  clerk: { back: 6, front: 6, belly: 0, hem: 68 },
  appraiser: { back: 7, front: 6, belly: 1, hem: 66 },
  dealer: { back: 8, front: 8, belly: 3, hem: 64 },
  magnate: { back: 8, front: 8, belly: 5, hem: 70 },
};
export const US = 0.8;
export const TURN = 0.12,
  FLIP = 0.16;

export const ARM = {
  down: [0.1, 0.2],
  carry: [0.55, 1.35],
  reach: [1.25, 0.2],
  give: [0.6, 0.6],
  take: [0.5, 0.6],
  five1: [0.7, 1.9],
  five2: [1.4, 1.4],
  five3: [2.4, 0.5],
  fiveWind: [2.75, 0.25],
  fiveHit: [2.6, -0.1],
  fiveFollow: [2.3, 0.3],
  wave: [2.6, 0.5],
  cane: [0.3, 0.35],
  reachUp: [2.0, -0.2],
} satisfies Record<string, Ang>;

const isCrew = (id: WalkerId): id is CrewKey => id in SIDE;

export function sizeOf(id: WalkerId): { K: typeof KB; gt: (typeof GAIT)[keyof typeof GAIT] } {
  if (isCrew(id)) return { K: KB, gt: GAIT[id] };
  return { K: KS, gt: id === 'you' ? GAIT.you : GAIT.cust };
}

export const groundOf = (a: Walker): number => a.feet ?? (a.top as number) + CREW_H;
export function setGround(a: Walker, y: number): void {
  if (a.feet !== undefined) a.feet = y;
  else a.top = y - CREW_H;
}

export function beginWalk(
  a: Walker,
  id: WalkerId,
  toX: number,
  speed: number,
  stairs: Stairs | null,
  arrive: () => void,
): void {
  if (Math.abs(a.x - toX) < 0.5) return;
  a.face = toX > a.x ? 'right' : 'left';
  a.walking = true;
  a.tx = toX;
  a.arrive = arrive;
  start(a, id, toX, speed, stairs);
}

function start(a: Walker, id: WalkerId, toX: number, speed: number, stairs: Stairs | null): void {
  const { K, gt } = sizeOf(id);
  const x0 = a.x + K.cx,
    x1 = toX + K.cx,
    y0 = groundOf(a),
    dir = Math.sign(x1 - x0) || 1;
  const sl0 = gt.step * clamp(Math.sqrt(speed / 40), 0.85, 1.35);
  const track = a.track === 'stairs' ? stairs : null;
  let fixed = track ? track.plants.filter((p) => (p.x - x0) * dir > 2 && (x1 - p.x) * dir > 2) : [];
  if (dir < 0) fixed = fixed.slice().reverse();
  const xs = [x0];
  let cur = x0;
  const run = (to: number) => {
    const D = Math.abs(to - cur);
    if (D < 0.5) return;
    if (xs.length === 1) {
      const m = Math.max(1, Math.round(D / sl0 + 0.5)),
        sl = D / (m - 0.5);
      for (let j = 1; j <= m; j++) xs.push(cur + dir * (j - 0.5) * sl);
    } else {
      const m = Math.max(1, Math.round(D / sl0)),
        sl = D / m;
      for (let j = 1; j <= m; j++) xs.push(cur + dir * j * sl);
    }
    cur = to;
  };
  for (const f of fixed) run(f.x);
  run(x1);
  xs[xs.length - 1] = x1;
  xs.push(x1);
  const P: Plant[] = xs.map((x) => ({ x, y: track ? track.at(x) : y0 }));
  P[0].y = y0;
  const Hx = [x0],
    Hy = [y0];
  for (let j = 1; j < P.length; j++) {
    const last = j === P.length - 1;
    Hx.push(last ? P[j].x : (P[j - 1].x + P[j].x) / 2);
    Hy.push(last ? P[j].y : (P[j - 1].y + P[j].y) / 2);
  }
  a.g = {
    x0,
    x1,
    y0,
    dir,
    P,
    Hs: Hx.map((x) => Math.abs(x - x0)),
    Hy,
    D: Math.abs(x1 - x0),
    s: 0,
    v: 0,
    vmax: speed * gt.k,
    sl: sl0,
    delay: turnDelay(a),
    id,
  };
  a.wk = id;
}

function turnDelay(a: Walker): number {
  if (a._face === undefined || a._face === a.face) return 0;
  return a._face === 'front' ? TURN : FLIP;
}

export function step(a: Walker, dt: number, now: number): void {
  if (a._face !== a.face) {
    if (a._face !== undefined) {
      a.turnT = now;
      a.turnFrom = a._face;
      a.turnTo = a.face;
    }
    a._face = a.face;
  }
  if (!a.walking) {
    a.g = null;
    return;
  }
  const g = a.g;
  if (!g) return;
  if (g.delay > 0) {
    g.delay -= dt;
    return;
  }
  const sa = 0.45 * g.sl,
    sd = 0.5 * g.sl;
  let v =
    g.vmax *
    clamp(Math.min(Math.sqrt((g.s + 0.05) / sa), Math.sqrt(Math.max(0, g.D - g.s) / sd)), 0.2, 1);
  const j = stepIndex(g);
  if (g.P[j].y !== g.P[j - 1].y) v *= 0.65;
  g.v = v;
  g.s += v * dt;
  a.x = g.x0 + g.dir * Math.min(g.s, g.D) - sizeOf(g.id).K.cx;
  if (g.s >= g.D - 1e-3) {
    a.x = a.tx as number;
    setGround(a, g.P[g.P.length - 1].y);
    a.walking = false;
    a.g = null;
    a.settleT = now;
    const r = a.arrive;
    a.arrive = null;
    if (r) r();
  }
}

export function stepIndex(g: Gait): number {
  let j = 1;
  while (j < g.P.length - 1 && g.Hs[j] <= g.s) j++;
  return j;
}

const swingShoe = (q: number): Foot['v'] => {
  if (q < 0.18) return 'heel2';
  if (q > 0.78) return 'toe';
  return 'flat';
};

function swingFoot(o: Plant, t: Plant, u: number, lift: number): Foot {
  if (u >= US) return { x: t.x, y: t.y, v: u < 0.9 ? 'toe' : 'flat', planted: true };
  const q = u / US,
    e = smooth(q),
    up = t.y < o.y;
  const ey = up ? smooth(Math.min(1, q * 1.7)) : e;
  return {
    x: o.x + (t.x - o.x) * e,
    y: o.y + (t.y - o.y) * ey - (lift + (up ? 3 : 0)) * Math.sin(Math.PI * q),
    v: swingShoe(q),
    planted: false,
  };
}

function stanceFoot(p: Plant, u: number, roll: boolean): Foot {
  if (roll && u >= US)
    return { x: p.x, y: p.y, v: (u - US) / (1 - US) < 0.5 ? 'heel1' : 'heel2', planted: false };
  return { x: p.x, y: p.y, v: 'flat', planted: true };
}

export function shakeOf(a: Walker, now: number): number {
  const q = now - (a.shakeT ?? -9);
  if (q >= 0.1) return 0;
  return Math.floor(q * 60) % 2 ? -1 : 1;
}

const idOf = (a: Walker): WalkerId =>
  a.wk ?? a.key ?? (a.i !== undefined ? `cust${a.i % 4}` : 'you');

export function pose(a: Walker, now: number): Pose {
  const { K, gt } = sizeOf(idOf(a)),
    dir = a.face === 'left' ? -1 : 1;
  const g = a.walking && a.g && a.g.delay <= 0 ? a.g : null;
  let hx: number,
    gy: number,
    bob = 0,
    feet: Foot[],
    fN = 0,
    j = 0,
    u = 0;
  if (g) {
    j = stepIndex(g);
    const P = g.P,
      last = j === P.length - 1;
    u = clamp((g.s - g.Hs[j - 1]) / Math.max(1e-6, g.Hs[j] - g.Hs[j - 1]), 0, 1);
    hx = g.x0 + g.dir * Math.min(g.s, g.D);
    gy = g.Hy[j - 1] + (g.Hy[j] - g.Hy[j - 1]) * smooth(u);
    const vr = Math.min(1, (g.v / g.vmax) * 1.3),
      rise = last ? 0 : Math.round(gt.rise * vr);
    if (u >= US) bob = 1;
    else if (u > 0.3 && u < 0.62) bob = rise > 1 && (u < 0.38 || u > 0.54) ? -1 : -rise;
    const sw = (j - 1) % 2,
      st = 1 - sw;
    feet = [];
    feet[sw] = swingFoot(P[Math.max(0, j - 2)], P[j], u, gt.lift);
    feet[st] = stanceFoot(P[j - 1], u, !last);
    fN = clamp(((feet[0].x - hx) * g.dir) / (g.sl * 0.75), -1, 1);
  } else {
    hx = a.x + K.cx;
    gy = groundOf(a);
    const st = now - (a.settleT ?? -9);
    if (st > 0.02 && st < 0.14) bob = 1;
    feet = [
      { x: hx, y: gy, v: 'flat', planted: true },
      { x: hx, y: gy, v: 'flat', planted: true },
    ];
  }
  const hy = gy - (K.h - K.hip) + bob + (a.dip || 0);
  return { K, gt, dir, hx, hy, gy, feet, fN, j, u, g };
}

export function feetOf(
  a: Walker,
  now: number,
): readonly { foot: 'near' | 'far'; x: number; y: number; planted: boolean; v: Foot['v'] }[] {
  return pose(a, now).feet.map((f, k) => ({
    foot: k ? ('far' as const) : ('near' as const),
    x: Math.round(f.x * 100) / 100,
    y: f.y,
    planted: f.planted,
    v: f.v,
  }));
}

export function armAngles(a: Walker, now: number, side: 'n' | 'f'): [number, number] {
  const st = side === 'n' ? a.armN : a.armF;
  if (!st) return [...ARM.down];
  const q = st.dur > 0 ? clamp((now - st.t0) / st.dur, 0, 1) : 1,
    e = smooth(q);
  const r: Ang = [
    st.from[0] + (st.to[0] - st.from[0]) * e,
    st.from[1] + (st.to[1] - st.from[1]) * e,
  ];
  if (st.name === 'wave' && q >= 1) r[1] += Math.sin((now - st.t0) * 13) * 0.45;
  return r;
}

export function arm(
  a: Walker,
  near: keyof typeof ARM,
  far: keyof typeof ARM | null,
  dur: number,
  now: number,
): void {
  const cur = { n: armAngles(a, now, 'n'), f: armAngles(a, now, 'f') };
  a.armN = { from: cur.n, to: [...ARM[near]], name: near, t0: now, dur };
  a.armF = { from: cur.f, to: [...ARM[far ?? 'down']], name: far ?? 'down', t0: now, dur };
}

export function knee(h: Pt, a: Pt, A: number, B: number, dir: number): Pt {
  const dx = a[0] - h[0],
    dy = a[1] - h[1],
    d = Math.hypot(dx, dy);
  if (d >= A + B - 0.01) return [h[0] + (dx * A) / d, h[1] + (dy * A) / d];
  const ang = Math.acos(clamp((A * A + d * d - B * B) / (2 * A * d), -1, 1)),
    base = Math.atan2(dy, dx);
  const k1: Pt = [h[0] + Math.cos(base + ang) * A, h[1] + Math.sin(base + ang) * A],
    k2: Pt = [h[0] + Math.cos(base - ang) * A, h[1] + Math.sin(base - ang) * A];
  return (k1[0] - k2[0]) * dir > 0 ? k1 : k2;
}

export function armPoints(
  sh: Pt,
  ang: readonly [number, number],
  K: typeof KB,
  dir: number,
): [Pt, Pt, Pt] {
  const [a, b] = ang,
    el: Pt = [sh[0] + dir * Math.sin(a) * K.upper, sh[1] + Math.cos(a) * K.upper];
  return [sh, el, [el[0] + dir * Math.sin(a + b) * K.fore, el[1] + Math.cos(a + b) * K.fore]];
}

export function turnSide(a: Walker, now: number): -1 | 0 | 1 {
  const q = now - (a.turnT ?? -9);
  const sideOf = (f: Face | undefined) => (f === 'left' ? -1 : 1);
  if (a.walking && a.g && a.g.delay > 0) {
    if (a._face === 'front' || a.turnFrom === 'front') return sideOf(a.face);
    return a.g.delay > FLIP / 2 ? sideOf(a.turnFrom) : sideOf(a.face);
  }
  if (q >= FLIP || a.turnFrom === undefined) return 0;
  if (a.turnTo === 'front' && q < TURN) return sideOf(a.turnFrom);
  if (a.turnFrom === 'front' && a.turnTo !== 'front' && q < TURN && !a.walking)
    return sideOf(a.turnTo);
  return 0;
}

export function side(a: Walker, now: number): boolean {
  if (turnSide(a, now)) return false;
  if (a.walking && a.g) return true;
  return a.face === 'left' || a.face === 'right';
}

type Seg = [number, string, string, number];
export const HABITS: Record<string, Seg[]> = {
  dust: [
    [0.25, 'down>dustA', 'smile', 0],
    [0.12, 'dustA', 'smile', 0],
    [0.3, 'dustA>dustB', 'smile', 0],
    [0.26, 'dustB>dustC', 'smile', 0],
    [0.1, 'dustC', 'smile', 0],
    [0.26, 'dustC>dustB', 'smile', 0],
    [0.26, 'dustB>dustA', 'smile', 0],
    [0.1, 'dustA', 'smile', 0],
    [0.3, 'dustA>dustB', 'smile', 0],
    [0.26, 'dustB>dustC', 'laugh', 0],
    [0.3, 'dustC', 'laugh', 0],
    [0.32, 'dustC>down', 'smile', 0],
  ],
  sneeze: [
    [0.3, 'down>nose', 'wow', 0],
    [0.3, 'nose', 'half', -1],
    [0.22, 'nose', 'wow', -2],
    [0.12, 'nose', 'sneeze', 2],
    [0.22, 'nose', 'blink', 1],
    [0.3, 'nose>down', 'laugh', 0],
    [0.3, 'down', 'laugh', 0],
  ],
  loupe: [
    [0.36, 'down>loupe', 'smile', 0],
    [0.14, 'loupe', 'wow', 0],
    [1.0, 'loupe', 'squint', 0],
    [0.4, 'loupe', 'wow', -1],
    [0.4, 'loupe>down', 'laugh', 0],
    [0.2, 'down', 'smile', 0],
  ],
  guns: [
    [0.26, 'down>gunsWind', 'smile', 1],
    [0.16, 'gunsWind', 'smile', 1],
    [0.08, 'gunsWind>guns', 'laugh', 0],
    [0.08, 'guns>gunsRecoil', 'laugh', -1],
    [0.16, 'gunsRecoil>guns', 'laugh', 0],
    [0.3, 'guns', 'laugh', 0],
    [0.08, 'guns>gunsRecoil', 'laugh', -1],
    [0.16, 'gunsRecoil>guns', 'laugh', 0],
    [0.36, 'guns', 'smile', 0],
    [0.36, 'guns>down', 'smile', 0],
  ],
  twirl: [
    [0.36, 'down>twirl', 'smile', 0],
    [0.15, 'twirl', 'laugh', 0],
    [0.15, 'twirl2', 'laugh', 0],
    [0.15, 'twirl', 'laugh', 0],
    [0.15, 'twirl2', 'laugh', 0],
    [0.15, 'twirl', 'laugh', 0],
    [0.22, 'twirl', 'smile', 0],
    [0.36, 'twirl>down', 'smile', 0],
  ],
  lean: [
    [0.4, 'down>lean', 'smile', 0],
    [0.2, 'lean', 'smile', 1],
    [1.2, 'lean', 'half', 1],
    [0.16, 'lean', 'smile', 1],
    [0.4, 'lean>down', 'smile', 0],
  ],
};
export const HABIT_OF: Record<CrewKey, string[]> = {
  clerk: ['dust'],
  appraiser: ['loupe'],
  dealer: ['guns'],
  magnate: ['twirl', 'lean'],
};
export const SNEEZE: Record<CrewKey, number> = {
  clerk: 0.45,
  appraiser: 0.15,
  dealer: 0.15,
  magnate: 0.15,
};

export function pickHabit(key: CrewKey, rnd: () => number = Math.random): string {
  if (rnd() < SNEEZE[key]) return 'sneeze';
  const list = HABIT_OF[key];
  return list[Math.floor(rnd() * list.length)];
}

export const habitLen = (kind: string): number => HABITS[kind].reduce((n, s) => n + s[0], 0);

export function habitFrame(
  kind: string,
  age: number,
): { pose: string; mood: string; dy: number } | null {
  let t = age;
  for (const [d, p, mood, dy] of HABITS[kind]) {
    if (t < d) {
      if (!p.includes('>')) return { pose: p, mood, dy };
      const k = Math.min(3, Math.floor((t / d) * 4)),
        [from, to] = p.split('>');
      return { pose: k ? `${from}>${to}:${k}` : from, mood, dy };
    }
    t -= d;
  }
  return null;
}
