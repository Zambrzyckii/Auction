export type DoorMode = 'login' | 'register';
export type BouncerState = 'idle' | 'check' | 'refuse';

export const DOOR_LINES: Readonly<
  Record<DoorMode, Readonly<Record<BouncerState, readonly string[]>>>
> = {
  login: {
    idle: ['On the list?', 'Email and password.'],
    check: ['Checking the list.'],
    refuse: ['No dice.', 'Check the red stamp.'],
  },
  register: {
    idle: ['New face?', 'Put your name down.'],
    check: ['Checking the list.'],
    refuse: ['Hold up.', 'Check the red stamp.'],
  },
};

export const BOUNCER_FRAMES: Readonly<Record<BouncerState, number>> = {
  idle: 5,
  check: 2,
  refuse: 6,
};

const ART_ROWS = 180;
const GROUND_ROW = 138;
const ROWS_ABOVE_GROUND_STACKED = 61;
const STACKED_ROWS = 75;
const MIN_ART_COLS = 360;
const STACKED_BREAKPOINT = 760;
const SCALES = [4, 3, 2] as const;
const MIN_SCALE = 2;

const CHECK_FRAME_MS = 380;
const REFUSE_FRAME_MS = 90;
const REFUSE_SHAKE_MS = 450;
const GLINT_CYCLE_MS = 6400;
const GLINT_MS = 240;
const GLINT_FRAME_MS = 80;
const BREATH_MS = 1100;

export function bouncerState(pending: boolean, refused: boolean): BouncerState {
  if (pending) return 'check';
  return refused ? 'refuse' : 'idle';
}

export function bouncerFrame(
  state: BouncerState,
  sinceMs: number,
  nowMs: number,
  reduced: boolean,
): number {
  if (reduced) return 0;
  const elapsedMs = Math.max(0, nowMs - sinceMs);
  switch (state) {
    case 'check':
      return Math.floor(elapsedMs / CHECK_FRAME_MS) % 2;
    case 'refuse':
      return refuseFrame(elapsedMs);
    case 'idle':
      return idleFrame(nowMs);
  }
}

function refuseFrame(elapsedMs: number): number {
  if (elapsedMs >= REFUSE_SHAKE_MS) return 0;
  return 1 + Math.floor(elapsedMs / REFUSE_FRAME_MS);
}

function idleFrame(nowMs: number): number {
  const inCycle = nowMs % GLINT_CYCLE_MS;
  if (inCycle < GLINT_MS) return 2 + Math.floor(inCycle / GLINT_FRAME_MS);
  return Math.floor(nowMs / BREATH_MS) % 2;
}

export function sceneScale(viewportWidth: number): number {
  return SCALES.find((scale) => viewportWidth / scale >= MIN_ART_COLS) ?? MIN_SCALE;
}

export interface DoorLayout {
  scale: number;
  stacked: boolean;
  cols: number;
  center: number;
  top: number;
  rows: number;
}

function doorCenter(cols: number, stacked: boolean): number {
  if (stacked) return Math.min(cols - 30, Math.floor(cols / 2) + 50);
  return Math.floor(cols / 2);
}

export function doorLayout(viewportWidth: number, hostWidth: number): DoorLayout {
  const scale = sceneScale(viewportWidth);
  const stacked = viewportWidth < STACKED_BREAKPOINT;
  const cols = Math.ceil(hostWidth / scale);
  return {
    scale,
    stacked,
    cols,
    center: doorCenter(cols, stacked),
    top: stacked ? GROUND_ROW - ROWS_ABOVE_GROUND_STACKED : 0,
    rows: stacked ? STACKED_ROWS : ART_ROWS,
  };
}
