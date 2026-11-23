import {
  ORDER,
  R_POCKET,
  REDS,
  colorOf,
  create,
  indexOf,
  landNow,
  launch,
  place,
  pocketIndexAt,
  step,
} from './wheel-math';

const FRAME = 1 / 60;
const THROW = 4.8;
const NUMBERS = Array.from({ length: 37 }, (_, n) => n);
const STARTS = [
  { theta: 0, W: 0 },
  { theta: 1.7, W: 2.2 },
  { theta: 3.9, W: 4.4 },
  { theta: 5.5, W: 0.3 },
];

const run = (st: ReturnType<typeof create>, from: number, to: number) => {
  let t = from;
  while (t < to) {
    t += FRAME;
    step(st, t, FRAME);
  }
  return t;
};

describe('wheel-math', () => {
  it('orders 37 pockets covering 0 to 36', () => {
    expect(ORDER.length).toBe(37);
    expect([...ORDER].sort((a, b) => a - b)).toEqual(NUMBERS);
  });

  it('knows the red numbers', () => {
    expect(REDS).toEqual(
      new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]),
    );
  });

  it('colours the pockets', () => {
    expect(colorOf(0)).toBe('green');
    expect(colorOf(32)).toBe('red');
    expect(colorOf(15)).toBe('black');
  });

  for (const n of NUMBERS) {
    for (const start of STARTS) {
      it(`lands ${n} from theta ${start.theta} and W ${start.W}`, () => {
        const st = create(0);
        st.theta = start.theta;
        st.W = start.W;
        const onLand = vi.fn();
        launch(st, 0, n, THROW, onLand);
        const t = run(st, 0, THROW + FRAME);
        expect(st.spin).toBeNull();
        expect(st.r).toBe(R_POCKET);
        expect(pocketIndexAt(st.theta, st.W)).toBe(indexOf(n));
        expect(onLand).toHaveBeenCalledTimes(1);

        const wAtLanding = st.W;
        run(st, t, t + 3);
        expect(pocketIndexAt(st.theta, st.W)).toBe(indexOf(n));
        expect(st.W).not.toBe(wAtLanding);
      });
    }
  }

  it('lands at once with landNow mid-throw', () => {
    for (const n of NUMBERS) {
      const st = create(0);
      const onLand = vi.fn();
      launch(st, 0, n, THROW, onLand);
      run(st, 0, 2);
      landNow(st, 2);
      expect(st.spin).toBeNull();
      expect(st.r).toBe(R_POCKET);
      expect(pocketIndexAt(st.theta, st.W)).toBe(indexOf(n));
      expect(st.landedAt).toBe(2);
      expect(onLand).toHaveBeenCalledTimes(1);
    }
  });

  it('ignores landNow without a throw', () => {
    const st = create(7);
    const before = { ...st };
    landNow(st, 3);
    expect(st).toEqual(before);
  });

  it('places the ball in its pocket at once', () => {
    const st = create(0);
    st.W = 1.3;
    place(st, 26);
    expect(st.r).toBe(R_POCKET);
    expect(pocketIndexAt(st.theta, st.W)).toBe(indexOf(26));
  });
});
