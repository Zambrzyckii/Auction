import { describe, expect, it } from 'vitest';
import type { BeatHost, BeatId, PlankGeo, Stamps } from './pawnshop-opening';
import {
  DONE,
  OPEN_BEATS,
  beatAge,
  beatK,
  bulbLevel,
  bulbSwing,
  facadeState,
  frameAt,
  plankFall,
  readyPose,
  runBeats,
  youPose,
} from './pawnshop-opening';

const emptyStamps = (): Stamps => ({ s: {}, e: {} });

function fakeClock(live: () => boolean = () => true) {
  let now = 0;
  let seq = 0;
  const queue: { at: number; seq: number; fn: () => void }[] = [];
  const host: BeatHost = {
    wait: (seconds, fn) => {
      queue.push({ at: now + seconds, seq: seq++, fn });
    },
    act: (id, dur, done) => host.wait(id === 'walkIn' ? 3.25 : dur, done),
    stamp: () => now,
    live,
  };
  const drain = () => {
    while (queue.length) {
      queue.sort((a, b) => a.at - b.at || a.seq - b.seq);
      const next = queue.shift() as { at: number; fn: () => void };
      now = next.at;
      next.fn();
    }
  };
  return { host, drain, time: () => now };
}

const round2 = (rec: Partial<Record<BeatId, number>>) =>
  Object.fromEntries(Object.entries(rec).map(([id, v]) => [id, Number((v as number).toFixed(2))]));

function fullRun() {
  const clock = fakeClock();
  const stamps = emptyStamps();
  const doneAt: number[] = [];
  runBeats(OPEN_BEATS, clock.host, stamps, () => doneAt.push(clock.time()));
  clock.drain();
  return { stamps, doneAt };
}

const geo = {
  planks: [
    { x: 4, y: 61, crooked: false },
    { x: 3, y: 76, crooked: false },
    { x: 5, y: 91, crooked: false },
    { x: 0, y: 107, crooked: true },
    { x: 4, y: 123, crooked: false },
    { x: 3, y: 140, crooked: false },
  ] as PlankGeo[],
  links: 16,
  staple: { x: 111, y: 119 },
  heap: { x: 104, y: 175 },
};

describe('runBeats', () => {
  it('stamps every start on the fake clock and fires done once at the last end', () => {
    const { stamps, doneAt } = fullRun();
    expect(round2(stamps.s)).toEqual({
      key: 0,
      jiggle: 0.45,
      click: 0.9,
      chain: 1.1,
      heap: 1.95,
      door: 1.5,
      stale: 1.8,
      kick: 2.12,
      boards: 2.34,
      walkIn: 2.72,
      cord: 6.09,
      bulb: 6.33,
      window: 7.38,
      cloth: 7.03,
      drape: 7.45,
      puff: 7.78,
      neon: 7.88,
      balls: 8.88,
      cheer: 8.08,
    });
    expect(Object.keys(stamps.e).length).toBe(OPEN_BEATS.length);
    expect(doneAt.map((v) => Number(v.toFixed(2)))).toEqual([9.18]);
  });

  it('drains synchronously on an instant host and stamps every beat -1e9', () => {
    const stamps = emptyStamps();
    let done = 0;
    const host: BeatHost = {
      wait: (_s, fn) => fn(),
      act: (_id, _dur, fn) => fn(),
      stamp: () => -1e9,
      live: () => true,
    };
    runBeats(OPEN_BEATS, host, stamps, () => done++);
    expect(done).toBe(1);
    for (const row of OPEN_BEATS) {
      expect(stamps.s[row.id]).toBe(-1e9);
      expect(stamps.e[row.id]).toBe(-1e9);
    }
  });

  it('stops stamping once the host is no longer live', () => {
    let alive = true;
    const clock = fakeClock(() => alive);
    const act = clock.host.act;
    clock.host.act = (id, dur, fn) => {
      if (id === 'door') alive = false;
      act(id, dur, fn);
    };
    const stamps = emptyStamps();
    let done = 0;
    runBeats(OPEN_BEATS, clock.host, stamps, () => done++);
    clock.drain();
    for (const id of [
      'kick',
      'boards',
      'walkIn',
      'cord',
      'bulb',
      'cloth',
      'neon',
      'balls',
      'cheer',
    ] as BeatId[]) {
      expect(stamps.s[id]).toBeUndefined();
    }
    expect(stamps.e['door']).toBeUndefined();
    expect(done).toBe(0);
  });
});

describe('beatAge', () => {
  it('reads the end state with no stamps, by whether the shop is open', () => {
    expect(beatAge(null, 'key', 3, true, false)).toBe(DONE);
    expect(beatAge(null, 'key', 3, false, false)).toBe(-1);
  });

  it('reads -1 for an unstamped beat', () => {
    expect(beatAge(emptyStamps(), 'key', 3, true, false)).toBe(-1);
  });

  it('reads done when reduced and the time since the start otherwise', () => {
    const stamps: Stamps = { s: { door: 1.5 }, e: {} };
    expect(beatAge(stamps, 'door', 4, true, true)).toBe(DONE);
    expect(beatAge(stamps, 'door', 4, true, false)).toBeCloseTo(2.5, 10);
  });
});

describe('beatK and frameAt', () => {
  it('clamps the age over the beat duration, with a duration of 1 for walkIn', () => {
    expect(beatK(-1, 'door')).toBe(0);
    expect(beatK(0.25, 'door')).toBeCloseTo(0.5, 10);
    expect(beatK(DONE, 'door')).toBe(1);
    expect(beatK(0.5, 'walkIn')).toBe(0.5);
  });

  it('counts the start times an age has passed', () => {
    expect(frameAt(0.1, [0.2, 0.4])).toBe(0);
    expect(frameAt(0.2, [0.2, 0.4])).toBe(1);
    expect(frameAt(9, [0.2, 0.4])).toBe(2);
  });
});

describe('bulb', () => {
  it('steps the level through the flicker table', () => {
    expect(bulbLevel(-1)).toBe(0);
    expect(bulbLevel(0)).toBe(0.75);
    expect(bulbLevel(0.18)).toBe(0.35);
    expect(bulbLevel(0.55)).toBe(0.9);
    expect(bulbLevel(0.7)).toBe(0.45);
    expect(bulbLevel(1.05)).toBe(1);
    expect(bulbLevel(DONE)).toBe(1);
  });

  it('stops swinging under reduced motion and past 6.22 s after the tug', () => {
    expect(bulbSwing(1, true)).toBe(0);
    expect(bulbSwing(6.3, false)).toBe(0);
    expect(bulbSwing(DONE, false)).toBe(0);
    expect(bulbSwing(0.6, false)).not.toBe(0);
  });
});

describe('plankFall', () => {
  it('drops the bottom plank first and the crooked one last', () => {
    expect(plankFall(5, geo.planks).delay).toBe(0);
    expect(plankFall(3, geo.planks).delay).toBeCloseTo(2 * 0.07 + 0.22, 10);
    expect(plankFall(5, geo.planks)).toMatchObject({ x0: 3, y0: 140, x1: 5, y1: 189 });
  });
});

describe('youPose', () => {
  const ages = (map: Partial<Record<BeatId, number>>) => (id: BeatId) => map[id] ?? -1;

  it('walks the key pose from dig to reach to turn', () => {
    expect(youPose('key', ages({ key: 0.1 }), 0, false).name).toBe('keyDig');
    expect(youPose('key', ages({ key: 0.22 }), 0, false).name).toBe('keyReach');
    expect(youPose('key', ages({ key: 0.5, click: 0 }), 0, false).name).toBe('keyTurn');
  });

  it('kicks with the left foot', () => {
    expect(youPose('kick', ages({ kick: 0.25 }), 0, false)).toEqual({
      name: 'kick1',
      dx: 0,
      left: true,
    });
  });

  it('pulls the door back by 16 px at the end of the beat', () => {
    expect(youPose('pull', ages({ door: DONE }), 0, false)).toEqual({
      name: 'pull2',
      dx: -16,
      left: false,
    });
  });
});

describe('readyPose', () => {
  it('pats under reduced motion, rests, then glances', () => {
    expect(readyPose(1, true)).toBe('pat');
    expect(readyPose(1, false)).toBeNull();
    expect(readyPose(5.2, false)).toBe('glance');
  });
});

describe('facadeState', () => {
  it('equals the all-done state once every beat and the bulb swing are over', () => {
    const { stamps } = fullRun();
    const at = (t: number) => (id: BeatId) => beatAge(stamps, id, t, true, false);
    expect(facadeState(at(12.5), geo, false)).toEqual(facadeState(() => DONE, geo, false));
  });

  it('differs while the balls are not yet lit', () => {
    const { stamps } = fullRun();
    const at = (id: BeatId) => beatAge(stamps, id, 9.0, true, false);
    expect(facadeState(at, geo, false)).not.toEqual(facadeState(() => DONE, geo, false));
  });
});
