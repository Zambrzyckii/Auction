import {
  BOUNCER_FRAMES,
  DOOR_LINES,
  bouncerFrame,
  bouncerState,
  doorLayout,
  sceneScale,
} from './door-rules';

describe('bouncerState', () => {
  it('lets pending win over a refusal', () => {
    expect(bouncerState(false, false)).toBe('idle');
    expect(bouncerState(true, false)).toBe('check');
    expect(bouncerState(false, true)).toBe('refuse');
    expect(bouncerState(true, true)).toBe('check');
  });
});

describe('DOOR_LINES', () => {
  it('keeps the approved lines', () => {
    expect(DOOR_LINES.login).toEqual({
      idle: ['On the list?', 'Email and password.'],
      check: ['Checking the list.'],
      refuse: ['No dice.', 'Check the red stamp.'],
    });
    expect(DOOR_LINES.register).toEqual({
      idle: ['New face?', 'Put your name down.'],
      check: ['Checking the list.'],
      refuse: ['Hold up.', 'Check the red stamp.'],
    });
  });
});

describe('bouncerFrame', () => {
  it('alternates the check frames every 380 ms', () => {
    expect([0, 379, 380, 760].map((t) => bouncerFrame('check', 1000, 1000 + t, false))).toEqual([
      0, 0, 1, 0,
    ]);
  });
  it('shakes through frames 1 to 5 and holds frame 0 from 450 ms', () => {
    expect(
      [0, 89, 90, 449, 450, 5000].map((t) => bouncerFrame('refuse', 1000, 1000 + t, false)),
    ).toEqual([1, 1, 2, 5, 0, 0]);
  });
  it('glints in the first 240 ms of every 6400 ms and breathes every 1100 ms', () => {
    expect(
      [0, 80, 239, 240, 1100, 2200, 6400].map((now) => bouncerFrame('idle', 0, now, false)),
    ).toEqual([2, 3, 4, 0, 1, 0, 2]);
  });
  it('holds frame 0 under reduced motion', () => {
    expect(bouncerFrame('idle', 0, 80, true)).toBe(0);
    expect(bouncerFrame('check', 0, 380, true)).toBe(0);
    expect(bouncerFrame('refuse', 0, 100, true)).toBe(0);
  });
  it('never asks for a frame the sprite set lacks', () => {
    for (const state of ['idle', 'check', 'refuse'] as const)
      for (let t = 0; t < 13000; t += 7)
        expect(bouncerFrame(state, 0, t, false)).toBeLessThan(BOUNCER_FRAMES[state]);
  });
});

describe('sceneScale', () => {
  it('picks the largest scale that leaves 360 art pixels', () => {
    expect([1920, 1440, 1439, 1080, 1079, 760, 400, 320].map(sceneScale)).toEqual([
      4, 4, 3, 3, 2, 2, 2, 2,
    ]);
  });
});

describe('doorLayout', () => {
  it('follows the viewport, not the host, so a scrollbar cannot flip the scale', () => {
    expect(doorLayout(1440, 1425)).toEqual({
      scale: 4,
      stacked: false,
      cols: 357,
      center: 178,
      top: 0,
      rows: 180,
    });
  });
  it('switches to the stacked strip below 760 px of viewport', () => {
    expect(doorLayout(760, 745)).toEqual({
      scale: 2,
      stacked: false,
      cols: 373,
      center: 186,
      top: 0,
      rows: 180,
    });
    expect(doorLayout(759, 744)).toEqual({
      scale: 2,
      stacked: true,
      cols: 372,
      center: 236,
      top: 77,
      rows: 75,
    });
    expect(doorLayout(400, 400)).toEqual({
      scale: 2,
      stacked: true,
      cols: 200,
      center: 150,
      top: 77,
      rows: 75,
    });
    expect(doorLayout(360, 360)).toEqual({
      scale: 2,
      stacked: true,
      cols: 180,
      center: 140,
      top: 77,
      rows: 75,
    });
  });
});
