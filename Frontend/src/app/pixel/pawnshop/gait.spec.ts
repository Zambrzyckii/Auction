import { describe, expect, it } from 'vitest';
import type { Stairs, Walker, WalkerId } from './gait';
import { GAIT, beginWalk, feetOf, habitFrame, habitLen, pickHabit, step, turnSide } from './gait';

interface Frame {
  t: number;
  feet: ReturnType<typeof feetOf>;
}

const DT = 1 / 60;

const stairs: Stairs = {
  plants: [
    { x: 163, y: 194 },
    { x: 173, y: 184 },
    { x: 183, y: 174 },
    { x: 194, y: 164 },
  ],
  at: (x) => {
    if (x >= 188) return 164;
    if (x >= 178) return 174;
    if (x >= 168) return 184;
    return 194;
  },
};

const make = (id: WalkerId, from: number): Walker => {
  const a: Walker = { x: from, face: 'front', walking: false, _face: 'front' };
  if (id === 'you' || id === 'cust0') a.feet = 194;
  else a.top = 90;
  return a;
};

const walkOnce = (a: Walker, id: WalkerId, to: number, speed: number, st: Stairs | null) => {
  let done = false;
  const frames: Frame[] = [];
  beginWalk(a, id, to, speed, st, () => (done = true));
  let t = 0;
  for (let n = 0; n < 1200 && a.walking; n++) {
    step(a, DT, t);
    t += DT;
    if (a.walking && a.g && a.g.delay <= 0) frames.push({ t, feet: feetOf(a, t) });
  }
  return { frames, done };
};

const runsOf = (frames: Frame[], foot: 'near' | 'far') => {
  const runs: number[][] = [];
  let open: number[] | null = null;
  for (const f of frames) {
    const p = f.feet.find((x) => x.foot === foot)!;
    if (p.planted) {
      if (!open) runs.push((open = []));
      open.push(p.x);
    } else open = null;
  }
  return runs;
};

const IDS: WalkerId[] = ['clerk', 'appraiser', 'dealer', 'magnate', 'cust0', 'you'];

describe('gait', () => {
  for (const id of IDS) {
    for (const [from, to] of [
      [150, 380],
      [380, 150],
    ]) {
      it(`${id} keeps planted feet fixed walking ${from} to ${to}`, () => {
        const a = make(id, from);
        const { frames, done } = walkOnce(a, id, to, 40, null);
        const runs = [...runsOf(frames, 'near'), ...runsOf(frames, 'far')];
        for (const r of runs) {
          expect(Math.max(...r) - Math.min(...r)).toBe(0);
          expect(r.length).toBeGreaterThanOrEqual(5);
        }
        expect(runs.length).toBeGreaterThanOrEqual(18);
        expect(runs.length).toBeLessThanOrEqual(27);
        expect(done).toBe(true);
        expect(a.x).toBe(to);
        expect(a.walking).toBe(false);
        expect(a.settleT).toBeDefined();
      });
    }
  }

  it('gives the tiers their own cadence factor', () => {
    expect(GAIT.appraiser.k).toBe(0.85);
    expect(GAIT.magnate.k).toBe(0.8);
  });

  it('plants fewer feet at speed 60 than at 40', () => {
    const count = (speed: number) => {
      const { frames } = walkOnce(make('clerk', 150), 'clerk', 380, speed, null);
      return runsOf(frames, 'near').length + runsOf(frames, 'far').length;
    };
    expect(count(60)).toBeLessThan(count(40));
  });

  it('plants the feet on the stairs at the stair heights', () => {
    const a = make('clerk', 120);
    a.track = 'stairs';
    const { frames } = walkOnce(a, 'clerk', 182, 40, stairs);
    const ys = new Set<number>();
    for (const f of frames) for (const p of f.feet) if (p.planted) ys.add(p.y);
    expect(ys.has(184)).toBe(true);
    expect(ys.has(174)).toBe(true);
  });

  it('turns through a side frame at the start of a walk from front', () => {
    const a = make('clerk', 150);
    beginWalk(a, 'clerk', 380, 40, null, () => undefined);
    step(a, DT, 0);
    expect(turnSide(a, 0)).not.toBe(0);
  });

  it('times and picks habits', () => {
    expect(habitLen('sneeze')).toBeCloseTo(1.76, 10);
    expect(habitFrame('dust', 0.1)?.pose).toBe('down>dustA:1');
    expect(pickHabit('magnate', () => 0.9)).toBe('lean');
    expect(pickHabit('clerk', () => 0.1)).toBe('sneeze');
  });
});
