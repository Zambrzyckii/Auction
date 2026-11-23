// The roulette model: the pocket geometry, the ball's throw and its landing.
// Pure, no canvas. The painter in wheel.ts and the ball both read the same pocket
// geometry, so a resting ball always sits in the pocket the painter drew for its number.
export interface WheelSpin {
  t0: number;
  dur: number;
  j: number;
  phi0: number;
  delta: number;
  onLand?: () => void;
}
export interface WheelState {
  W: number;
  wSpeed: number;
  restIdx: number;
  theta: number;
  r: number;
  spin: WheelSpin | null;
  landedAt: number;
  trail: { theta: number; r: number }[];
}

export const ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const REDS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
export const TAU = Math.PI * 2,
  N = ORDER.length,
  STEP = TAU / N;
export const RIM = 40,
  TRACK_OUT = 37,
  TRACK_IN = 32,
  R_TRACK = 34.5;
export const HEAD = 30,
  NUM_IN = 27,
  POCKET_IN = 21,
  R_POCKET = 24,
  CONE_IN = 9;

export const mod = (a: number, m: number) => ((a % m) + m) % m;
const clamp = (v: number, a: number, z: number) => Math.max(a, Math.min(z, v));

export function colorOf(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  if (REDS.has(n)) return 'red';
  return 'black';
}
export const pocketAngle = (i: number, wheelAngle: number) => wheelAngle + (i + 0.5) * STEP;
export const pocketIndexAt = (angle: number, wheelAngle: number) =>
  Math.floor(mod(angle - wheelAngle, TAU) / STEP);
export const indexOf = (n: number) => ORDER.indexOf(n);

// ----- the model -----
export function create(restNumber: number): WheelState {
  return {
    W: 0,
    wSpeed: -0.35,
    restIdx: indexOf(restNumber),
    theta: 0,
    r: R_POCKET,
    spin: null,
    landedAt: -10,
    trail: [],
  };
}
function radiusAt(k: number): number {
  if (k < 0.04) return R_POCKET + (R_TRACK - R_POCKET) * (k / 0.04);
  if (k < 0.62) return R_TRACK;
  if (k < 0.8) {
    const u = (k - 0.62) / 0.18;
    const fall = R_TRACK - (R_TRACK - R_POCKET) * u * u;
    const kick = u > 0.35 && u < 0.6 ? Math.sin(((u - 0.35) / 0.25) * Math.PI) * 3 : 0;
    return fall + kick;
  }
  const u = (k - 0.8) / 0.2;
  return R_POCKET + Math.abs(Math.sin(u * Math.PI * 3.5)) * 2.6 * (1 - u) * (1 - u);
}
// Plans a throw that ends in the pocket of `number` exactly when the spin ends.
export function launch(
  st: WheelState,
  t: number,
  number: number,
  dur: number,
  onLand?: () => void,
): void {
  const j = indexOf(number);
  const phi0 = mod(st.theta - st.W, TAU);
  const target = (j + 0.5) * STEP;
  const delta = mod(target - phi0, TAU) + TAU * 5;
  st.spin = { t0: t, dur, j, phi0, delta, onLand };
  st.trail = [];
}
function settle(st: WheelState, sp: WheelSpin, t: number): void {
  st.spin = null;
  st.restIdx = sp.j;
  st.landedAt = t;
  st.theta = pocketAngle(st.restIdx, st.W);
  st.r = R_POCKET;
  if (sp.onLand) sp.onLand();
}
export function step(st: WheelState, t: number, dt: number): void {
  const want = st.spin ? -1.25 : -0.35;
  st.wSpeed += (want - st.wSpeed) * clamp(dt * 1.5, 0, 1);
  st.W = mod(st.W + st.wSpeed * dt, TAU);
  const prev = { theta: st.theta, r: st.r };
  if (st.spin) {
    const sp = st.spin,
      k = clamp((t - sp.t0) / sp.dur, 0, 1);
    const e = 1 - (1 - k) * (1 - k);
    let phi = sp.phi0 + sp.delta * e;
    if (k > 0.8 && k < 1) {
      const a = (1 - k) / 0.2;
      phi += Math.sin(k * 95) * 0.05 * a * a;
    }
    st.theta = st.W + phi;
    st.r = radiusAt(k);
    st.trail = k < 0.75 ? [prev] : [];
    if (k >= 1) settle(st, sp, t);
  } else {
    st.theta = pocketAngle(st.restIdx, st.W);
    st.r = R_POCKET;
    st.trail = [];
  }
}
export function landNow(st: WheelState, t: number): void {
  if (!st.spin) return;
  st.trail = [];
  settle(st, st.spin, t);
}
// Puts the ball straight into the pocket, for reduced motion.
export function place(st: WheelState, number: number): void {
  st.spin = null;
  st.restIdx = indexOf(number);
  st.theta = pocketAngle(st.restIdx, st.W);
  st.r = R_POCKET;
}
