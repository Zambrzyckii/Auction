import type { PoseName } from './player-actions';

export type BeatId =
  | 'key'
  | 'jiggle'
  | 'click'
  | 'chain'
  | 'heap'
  | 'door'
  | 'stale'
  | 'kick'
  | 'boards'
  | 'walkIn'
  | 'cord'
  | 'bulb'
  | 'window'
  | 'cloth'
  | 'drape'
  | 'puff'
  | 'neon'
  | 'balls'
  | 'cheer';

export interface BeatRow {
  readonly id: BeatId;
  readonly anchor: BeatId | null;
  readonly on: 'start' | 'end';
  readonly delay: number;
  readonly actor: string;
  readonly action: string;
  readonly dur: number;
  readonly easing: string;
}

const row = (
  id: BeatId,
  anchor: BeatId | null,
  on: 'start' | 'end',
  delay: number,
  actor: string,
  action: string,
  dur: number,
  easing: string,
): BeatRow => ({ id, anchor, on, delay, actor, action, dur, easing });

export const OPEN_BEATS: readonly BeatRow[] = [
  row('key', null, 'start', 0, 'you', 'hand to pocket, key out to the padlock', 0.45, 'step'),
  row('jiggle', 'key', 'end', 0, 'lock', 'two jiggles in the hasp', 0.4, 'sine'),
  row('click', 'jiggle', 'end', 0.05, 'lock', 'shackle pops up 1 px', 0.12, 'step'),
  row(
    'chain',
    'click',
    'end',
    0.08,
    'chain',
    'slides through the staple link by link',
    0.85,
    'gravity',
  ),
  row('heap', 'chain', 'end', 0, 'chain', 'heap bounces 1 px, small puff', 0.3, 'bounce'),
  row(
    'door',
    'chain',
    'start',
    0.4,
    'you',
    'pulls, door swings in 4 drawn frames',
    0.5,
    'easeInOut',
  ),
  row('stale', 'door', 'start', 0.3, 'dust', 'stale air rolls out low', 1.2, 'linear'),
  row('kick', 'door', 'end', 0.12, 'you', 'turns, chambers, kicks, recovers', 0.55, 'step'),
  row('boards', 'kick', 'start', 0.22, 'front', 'planks pop out and fall flat', 1.4, 'gravity'),
  row('walkIn', 'kick', 'end', 0.05, 'you', 'walks to the bulb at 40 px/s', 0, 'walk'),
  row('cord', 'walkIn', 'end', 0.12, 'you', 'up on his toes, tugs the chain switch', 0.4, 'step'),
  row('bulb', 'cord', 'start', 0.24, 'bulb', 'on, dim, on, dim, steady', 1.05, 'step'),
  row('window', 'bulb', 'end', 0, 'front', 'windows and doorway glow warm', 0.3, 'step'),
  row('cloth', 'bulb', 'start', 0.7, 'you', 'grabs the counter cloth, yanks it down', 0.85, 'step'),
  row(
    'drape',
    'cloth',
    'start',
    0.42,
    'cloth',
    'shelf drape follows behind the counter',
    0.4,
    'step',
  ),
  row(
    'puff',
    'cloth',
    'start',
    0.75,
    'dust',
    'puffs off the counter, shelf and pile',
    0.5,
    'linear',
  ),
  row('neon', 'window', 'end', 0.2, 'front', 'neon letter by letter, each stutters', 1.0, 'step'),
  row('balls', 'neon', 'end', 0, 'front', 'the three balls catch the neon', 0.3, 'step'),
  row('cheer', 'cloth', 'end', 0.2, 'you', 'turns to us, dips, arms up on a hop', 0.9, 'step'),
];

export interface Stamps {
  s: Partial<Record<BeatId, number>>;
  e: Partial<Record<BeatId, number>>;
}

export interface BeatHost {
  wait(seconds: number, fn: () => void): void;
  act(id: BeatId, dur: number, done: () => void): void;
  stamp(): number;
  live(): boolean;
}

export const DONE = 1e9;
export const PULL_BACK = -16;
const FLICKER: readonly (readonly [number, number])[] = [
  [0, 0.75],
  [0.18, 0.35],
  [0.55, 0.9],
  [0.7, 0.45],
  [1.05, 1],
];
const FALL_G = 520;
const CHAIN_RATE = 26;
const CHAIN_G = 900;
const READY_CYCLE = 7;
const NEON_LETTERS = 4;

const DUR = new Map<BeatId, number>(OPEN_BEATS.map((r) => [r.id, r.dur]));

const clamp = (v: number, a: number, z: number) => Math.max(a, Math.min(z, v));
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function runBeats(
  rows: readonly BeatRow[],
  host: BeatHost,
  stamps: Stamps,
  done: () => void,
): void {
  const starts = new Map<BeatId, (() => void)[]>();
  const ends = new Map<BeatId, (() => void)[]>();
  let left = rows.length;
  const listen = (lists: Map<BeatId, (() => void)[]>, id: BeatId, fn: () => void) => {
    const list = lists.get(id);
    if (list) list.push(fn);
    else lists.set(id, [fn]);
  };
  const fire = (lists: Map<BeatId, (() => void)[]>, id: BeatId) => {
    for (const fn of lists.get(id) ?? []) fn();
  };
  const begin = (r: BeatRow) => {
    if (!host.live()) return;
    stamps.s[r.id] = host.stamp();
    fire(starts, r.id);
    host.act(r.id, r.dur, () => {
      if (!host.live()) return;
      stamps.e[r.id] = host.stamp();
      fire(ends, r.id);
      left--;
      if (left === 0) done();
    });
  };
  const launch = (r: BeatRow) => {
    if (r.delay > 0) host.wait(r.delay, () => begin(r));
    else begin(r);
  };
  for (const r of rows) {
    if (r.anchor !== null) listen(r.on === 'start' ? starts : ends, r.anchor, () => launch(r));
  }
  for (const r of rows) {
    if (r.anchor === null) launch(r);
  }
}

export function beatAge(
  stamps: Stamps | null,
  id: BeatId,
  t: number,
  open: boolean,
  reduced: boolean,
): number {
  if (!stamps) return open ? DONE : -1;
  const s = stamps.s[id];
  if (s === undefined) return -1;
  if (reduced) return DONE;
  return t - s;
}

export const beatK = (age: number, id: BeatId) => clamp(age / (DUR.get(id) || 1), 0, 1);

export const frameAt = (age: number, starts: readonly number[]) =>
  starts.filter((s) => age >= s).length;

export function bulbLevel(bulbAge: number): number {
  let v = 0;
  for (const [t, l] of FLICKER) if (bulbAge >= t) v = l;
  return v;
}

export function bulbSwing(cordAge: number, reduced: boolean): number {
  const a = cordAge - 0.22;
  if (reduced || a < 0 || a > 6) return 0;
  return Math.sin(a * 5) * 2.5 * Math.exp(-a * 0.9);
}

export interface PlankGeo {
  readonly x: number;
  readonly y: number;
  readonly crooked: boolean;
}

export function plankFall(i: number, planks: readonly PlankGeo[]) {
  const p = planks[i];
  const order = planks.length - 1 - i;
  const delay = order * 0.07 + (p.crooked ? 0.22 : 0);
  const y1 = 190 - order * 2 - (i % 2);
  const x1 = p.x + (i % 3) * 2 - 2;
  return {
    delay,
    x0: p.x,
    y0: p.y,
    x1,
    y1,
    tl: Math.sqrt((2 * Math.max(4, y1 - p.y)) / FALL_G),
  };
}

export type YouAction = 'ready' | 'stand' | 'key' | 'pull' | 'kick' | 'cord' | 'cloth' | 'cheer';

export function readyPose(t: number, reduced: boolean): 'glance' | 'pat' | null {
  if (reduced) return 'pat';
  const c = t % READY_CYCLE;
  if (c < 5.1) return null;
  if (c < 5.45 || c > 6.7) return 'glance';
  return 'pat';
}

export function youPose(
  action: YouAction,
  age: (id: BeatId) => number,
  t: number,
  reduced: boolean,
): { name: PoseName | null; dx: number; left: boolean } {
  switch (action) {
    case 'ready':
      return { name: readyPose(t, reduced), dx: 0, left: false };
    case 'stand':
      return { name: 'stand', dx: 0, left: false };
    case 'key': {
      const k = age('key'),
        j = age('jiggle'),
        c = age('click');
      const names: PoseName[] = ['keyDig', 'keyReach', 'keyTurn'];
      const name = names[frameAt(k, [0.22]) + (c >= 0 ? 1 : 0)];
      const dx = j >= 0 && c < 0 ? Math.round(Math.sin((j / 0.4) * Math.PI * 4)) : 0;
      return { name, dx, left: false };
    }
    case 'pull': {
      const k = beatK(age('door'), 'door');
      const names: PoseName[] = ['pull0', 'pull1', 'pull2'];
      return {
        name: names[frameAt(k, [0.3, 0.65])],
        dx: Math.round(PULL_BACK * easeInOut(k)),
        left: false,
      };
    }
    case 'kick': {
      const names: PoseName[] = ['kick0', 'kick1', 'kick2'];
      return { name: names[frameAt(age('kick'), [0.2, 0.32])], dx: 0, left: true };
    }
    case 'cord': {
      const names: PoseName[] = ['reach', 'yank', 'stand'];
      return { name: names[frameAt(age('cord'), [0.22, 0.75])], dx: 0, left: false };
    }
    case 'cloth': {
      const names: PoseName[] = ['clothReach', 'clothYank0', 'clothYank1'];
      return { name: names[frameAt(age('cloth'), [0.25, 0.5])], dx: 0, left: false };
    }
    case 'cheer': {
      const names: (PoseName | null)[] = ['cheer0', 'cheer1', 'cheer2', null];
      return { name: names[frameAt(age('cheer'), [0.18, 0.55, 0.8])], dx: 0, left: false };
    }
  }
}

export interface PlankState {
  mode: 'mounted' | 'falling' | 'landed';
  x: number;
  y: number;
  frame: number;
}

export type LinkState =
  | { mode: 'rest'; along: number }
  | { mode: 'thread'; along: number }
  | { mode: 'fall'; x: number; y: number }
  | { mode: 'landed' };

export interface LockState {
  open: boolean;
  x: number;
  y: number;
}

export interface FacadeState {
  windowAlpha: number;
  seams: boolean;
  planks: PlankState[];
  neon: boolean[];
  ballsAlpha: number;
  help: boolean;
  doorFrame: number;
  doorGlassAlpha: number;
  links: LinkState[];
  landed: number;
  heapFrame: number;
  heapHop: number;
  lock: LockState;
  drape: number;
  cloth: number;
  bulbLevel: number;
  bulbSwing: number;
  cordTug: number;
}

interface FacadeGeo {
  planks: readonly PlankGeo[];
  links: number;
  staple: { x: number; y: number };
  heap: { x: number; y: number };
}

function plankState(i: number, planks: readonly PlankGeo[], boardsAge: number): PlankState {
  const p = planks[i];
  const f = plankFall(i, planks);
  const a = boardsAge - f.delay;
  if (a < 0) return { mode: 'mounted', x: p.x, y: p.y, frame: -1 };
  if (a < f.tl) {
    const k = a / f.tl;
    return {
      mode: 'falling',
      x: f.x0 + (f.x1 - f.x0) * k,
      y: f.y0 + 0.5 * FALL_G * a * a - (a < 0.06 ? 2 : 0),
      frame: frameAt(k, [0.3, 0.7]),
    };
  }
  const b = a - f.tl;
  const hop = b < 0.14 ? Math.round(Math.sin((b / 0.14) * Math.PI) * 2) : 0;
  return { mode: 'landed', x: f.x1, y: f.y1 - hop, frame: 2 };
}

function neonLetterOn(neonAge: number, i: number): boolean {
  const a = neonAge - i * 0.24;
  if (a < 0) return false;
  return !(a > 0.05 && a < 0.13);
}

function windowAlpha(glow: number): number {
  if (glow <= 0) return 0;
  if (glow >= 1) return 0.42;
  return 0.2;
}

function ballsAlpha(k: number): number {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  return 0.5;
}

function lockAndChain(
  age: (id: BeatId) => number,
  geo: FacadeGeo,
): Pick<FacadeState, 'links' | 'landed' | 'heapFrame' | 'heapHop' | 'lock'> {
  const st = geo.staple,
    hp = geo.heap,
    n = geo.links - 1;
  const c = age('chain'),
    click = age('click'),
    jig = age('jiggle');
  const lockX = st.x - 4,
    lockY = st.y - 1;
  const links: LinkState[] = [];
  if (c < 0) {
    for (let i = 0; i <= n; i++) links.push({ mode: 'rest', along: i });
    const jx = jig >= 0 && click < 0 ? Math.round(Math.sin((jig / 0.4) * Math.PI * 4)) : 0;
    const lock =
      click >= 0
        ? { open: true, x: lockX, y: lockY - 2 }
        : { open: false, x: lockX + jx, y: lockY };
    return { links, landed: 0, heapFrame: -1, heapHop: 0, lock };
  }
  let landed = 0;
  for (let i = 0; i <= n; i++) {
    const along = i + c * CHAIN_RATE;
    if (along < n) {
      links.push({ mode: 'thread', along });
      continue;
    }
    const tf = (along - n) / CHAIN_RATE;
    const y = st.y + 0.5 * CHAIN_G * tf * tf;
    if (y >= hp.y - 3) {
      landed++;
      links.push({ mode: 'landed' });
      continue;
    }
    links.push({ mode: 'fall', x: st.x - 1 + Math.sin(i) * 2, y });
  }
  const heapAge = age('heap');
  const lf = Math.sqrt((2 * (hp.y - 12 - lockY)) / CHAIN_G);
  return {
    links,
    landed,
    heapFrame: landed ? frameAt(landed, [6, 12]) : -1,
    heapHop: heapAge >= 0 && heapAge < 0.1 ? 1 : 0,
    lock: lockFall(c, lf, lockX, lockY, hp),
  };
}

function lockFall(
  la: number,
  lf: number,
  lockX: number,
  lockY: number,
  hp: { x: number; y: number },
): LockState {
  if (la < lf) return { open: true, x: lockX, y: lockY - 2 + 0.5 * CHAIN_G * la * la };
  const b = la - lf;
  const hop = b < 0.12 ? Math.round(Math.sin((b / 0.12) * Math.PI) * 2) : 0;
  return { open: true, x: hp.x + 5, y: hp.y - 12 - hop };
}

export function facadeState(
  age: (id: BeatId) => number,
  geo: FacadeGeo,
  reduced: boolean,
): FacadeState {
  const glow = beatK(age('window'), 'window');
  const boards = age('boards');
  const door = age('door');
  const doorFrame = door < 0 ? 0 : Math.min(4, 1 + Math.floor(beatK(door, 'door') * 4));
  const level = bulbLevel(age('bulb'));
  const ballsK = beatK(age('balls'), 'balls');
  const cord = age('cord');
  const neonAge = age('neon');
  return {
    windowAlpha: windowAlpha(glow),
    seams: glow >= 1,
    planks: geo.planks.map((_, i) => plankState(i, geo.planks, boards)),
    neon: Array.from({ length: NEON_LETTERS }, (_, i) => neonLetterOn(neonAge, i)),
    ballsAlpha: ballsAlpha(ballsK),
    help: boards > 2,
    doorFrame,
    doorGlassAlpha: doorFrame > 0 ? Math.max(0.25, level) : 0,
    ...lockAndChain(age, geo),
    drape: frameAt(age('drape'), [0.04, 0.16, 0.28]),
    cloth: frameAt(age('cloth'), [0.3, 0.45, 0.6, 0.75]),
    bulbLevel: level,
    bulbSwing: bulbSwing(cord, reduced),
    cordTug: cord >= 0.22 && cord < 0.42 ? 4 : 0,
  };
}
