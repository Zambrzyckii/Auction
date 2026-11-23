import type * as RoomModule from './bank-room';
import type { BankLoan, BankOffer, BankShown, BankStep, DueFormat } from './bank-watch';

const looseContext = () => {
  const target: Record<string | symbol, unknown> = {
    measureText: () => ({ width: 0 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4).fill(255),
      width: w,
      height: h,
    }),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
  };
  return new Proxy(target, {
    get: (t, prop) => (prop in t ? t[prop] : () => undefined),
    set: (t, prop, value) => {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
};

const loan = (over: Partial<BankLoan> = {}): BankLoan => ({
  publicLoanId: 'loan-1',
  principal: 200,
  totalDue: 220,
  penalty: 0,
  amountRepaid: 0,
  outstanding: 220,
  status: 'Active',
  dueOn: '2026-11-23T12:05:00Z',
  overdueSince: null,
  rejectionReason: null,
  ...over,
});

const overdue = (over: Partial<BankLoan> = {}): BankLoan =>
  loan({
    status: 'Overdue',
    penalty: 44,
    outstanding: 264,
    overdueSince: '2026-11-23T11:00:00Z',
    ...over,
  });

const shown = (l: BankLoan | null, over: Partial<BankShown> = {}): BankShown => ({
  loan: l,
  known: true,
  slips: [],
  ...over,
});

const offers: readonly BankOffer[] = [
  { name: 'Quick', principal: 200, totalDue: 220, term: '00:01:00', requiredTurnover: 400 },
  { name: 'Standard', principal: 1000, totalDue: 1150, term: '00:10:00', requiredTurnover: 2000 },
  { name: 'Long', principal: 5000, totalDue: 6250, term: '00:30:00', requiredTurnover: 10000 },
];

describe('BankRoom', () => {
  let mod: typeof RoomModule;
  let queued: FrameRequestCallback[] = [];
  let clock = 0;
  let requests = 0;
  let cancels = 0;
  let made: RoomModule.BankRoom[] = [];

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    mod = await import('./bank-room');
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  beforeEach(() => {
    queued = [];
    clock = 0;
    requests = 0;
    cancels = 0;
    made = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      requests++;
      return queued.push(cb);
    });
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn(() => {
        cancels++;
        queued = [];
      }),
    );
    vi.stubGlobal('performance', { now: () => 0 });
  });

  afterEach(() => {
    for (const r of made) r.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const step = (ms: number) => {
    for (let i = 0; i < ms / 16; i++) {
      const due = queued;
      queued = [];
      clock += 16;
      due.forEach((cb) => cb(clock));
    }
  };

  const make = (opts?: RoomModule.BankRoomOpts) => {
    const r = new mod.BankRoom(document.createElement('canvas'), opts);
    made.push(r);
    return r;
  };

  it('pins the focus columns of the two windows', () => {
    expect(mod.FOCUS_X).toEqual({ loans: 244, wires: 372 });
  });

  it('pins the three stamp ramps', () => {
    expect(mod.STAMP_OK).toEqual(['#173328', '#2a5a3c', '#4a8a4a', '#8cc063']);
    expect(mod.STAMP_NO).toEqual(['#43142a', '#7a2034', '#b0383a', '#ff8a6a']);
    expect(mod.STAMP_PAID).toEqual(['#3a2a08', '#7a5a14', '#d9a520', '#ffd75e']);
  });

  it('builds, resizes to scale 2 and focuses the loan window', () => {
    const r = make();
    expect(requests).toBe(0);
    r.resize(1906, 458);
    expect(r.size).toEqual({ scale: 2, width: 960, height: 400 });
    expect(r.focusX).toBe(244);
  });

  it('focuses the wires window on request', () => {
    expect(make({ focus: 'wires' }).focusX).toBe(372);
  });

  it('places you at the head of the queue when there is no loan', () => {
    const r = make({ reduced: true });
    r.place(shown(null));
    expect(r.painted.led).toEqual(['NO LOAN', 'NEXT!', '']);
    expect(r.painted.you).toEqual({ x: 128, spot: 'queue' });
    expect(r.painted.brute.inside).toBe(true);
    expect(r.painted.redLight).toBe(false);
    expect(r.painted.polaroid).toBe(false);
    expect(r.painted.stamp).toBeNull();
    expect(r.painted.plate).toBeNull();
  });

  it('shows an empty LED but NEXT! while the loans are unknown', () => {
    const r = make({ reduced: true });
    r.place(shown(null, { known: false }));
    expect(r.painted.led).toEqual(['', 'NEXT!', '']);
  });

  it('places an overdue loan with the enforcer outside, the red light and the polaroid', () => {
    const r = make({ reduced: true });
    r.place(shown(overdue()));
    expect(r.painted.led).toEqual(['OVERDUE', 'FEE $44', 'OWED $264']);
    expect(r.painted.you).toEqual({ x: 214, spot: 'loan' });
    expect(r.painted.brute).toEqual({ x: 149, inside: false, pose: 'stand' });
    expect(r.painted.redLight).toBe(true);
    expect(r.painted.polaroid).toBe(true);
  });

  it('lights the beacon for a collection only when the loan was overdue', () => {
    const r = make({ reduced: true });
    r.place(shown(loan({ status: 'CollectionPending' })));
    expect(r.painted.redLight).toBe(false);
    expect(r.painted.brute.inside).toBe(true);
    expect(r.painted.polaroid).toBe(false);
    r.place(shown(overdue({ status: 'CollectionPending' })));
    expect(r.painted.redLight).toBe(true);
    expect(r.painted.brute.inside).toBe(false);
    expect(r.painted.polaroid).toBe(true);
  });

  it('hangs the polaroid of a repaid loan that was once overdue', () => {
    const r = make({ reduced: true });
    r.place(shown(overdue({ status: 'Repaid', penalty: 44, outstanding: 0 })));
    expect(r.painted.polaroid).toBe(true);
    expect(r.painted.redLight).toBe(false);
    expect(r.painted.you.spot).toBe('queue');
  });

  it('gives the shark the loupe for a pending loan and the count for a collection', () => {
    const r = make({ reduced: true });
    r.place(shown(loan({ status: 'PendingApproval' })));
    expect(r.painted.shark).toBe('inspect');
    expect(r.painted.you.spot).toBe('loan');
    r.place(shown(loan({ status: 'CollectionPending' })));
    expect(r.painted.shark).toBe('count');
    r.place(shown(loan()));
    expect(r.painted.shark).toBe('idle');
  });

  it('keeps you in the queue after a rejection found at load', () => {
    const r = make({ reduced: true });
    r.place(shown(loan({ status: 'Rejected', rejectionReason: 'No' })));
    expect(r.painted.you).toEqual({ x: 128, spot: 'queue' });
    expect(r.painted.led).toEqual(['DENIED', 'NEXT!', '']);
  });

  it('clears the calculator when a new state is placed', () => {
    const r = make({ reduced: true });
    r.place(shown(loan()));
    r.run([{ kind: 'collecting', by: 'keeper', loan: loan({ status: 'CollectionPending' }) }]);
    expect(r.painted.calc).toBe('220');
    r.place(shown(loan({ status: 'PendingApproval' })));
    expect(r.painted.calc).toBe('');
  });

  it('paints the board and the facade neon from the offers and the wallet', () => {
    const r = make({ reduced: true });
    r.setOffers(offers);
    r.setWallet({ availableFunds: 300, lifetimeTurnover: 650 });
    expect(r.painted.board).toEqual([
      'QUICK $200 $220 1 MIN',
      'STANDARD $1,000 $1,150 10 MIN 2,000+',
      'LONG $5,000 $6,250 30 MIN 10,000+',
    ]);
    expect(r.painted.neon).toEqual(['QUICK $200', 'STD $1,000', 'LONG $5,000']);
    r.setOffers(null);
    expect(r.painted.board).toEqual([]);
    expect(r.painted.neon).toEqual([]);
  });

  it('unlocks the rows when the turnover grows', () => {
    const r = make({ reduced: true });
    r.setOffers(offers);
    r.setWallet({ availableFunds: 300, lifetimeTurnover: 650 });
    r.setWallet({ availableFunds: 300, lifetimeTurnover: 12000 });
    expect(r.painted.board).toEqual([
      'QUICK $200 $220 1 MIN',
      'STANDARD $1,000 $1,150 10 MIN',
      'LONG $5,000 $6,250 30 MIN',
    ]);
  });

  it('paints the newest wire slips first', () => {
    const r = make({ reduced: true });
    r.place(
      shown(null, {
        slips: [
          { out: true, amount: 40 },
          { out: false, amount: 120 },
        ],
      }),
    );
    expect(r.painted.slips).toEqual(['-40', '+120']);
  });

  it('paints the countdown through the format of the page', () => {
    const format = vi.fn<DueFormat>(() => '0 min 42 s');
    const r = make({ reduced: true, format });
    r.place(shown(loan()));
    expect(r.painted.led).toEqual(['DUE IN', '0 MIN 42 S', 'OWED $220']);
    expect(format).toHaveBeenCalledWith('2026-11-23T12:05:00Z', expect.any(Number));
  });

  it('leaves the countdown empty without a format', () => {
    const r = make({ reduced: true });
    r.place(shown(loan()));
    expect(r.painted.led).toEqual(['DUE IN', '', 'OWED $220']);
  });

  describe('the LED clock under reduced motion', () => {
    const fakeInterval = () =>
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });

    it('redraws an active countdown every second', () => {
      fakeInterval();
      const format = vi.fn<DueFormat>(() => '0 min 42 s');
      const r = make({ reduced: true, format });
      r.place(shown(loan()));
      const before = format.mock.calls.length;
      vi.advanceTimersByTime(1000);
      expect(format.mock.calls.length).toBeGreaterThan(before);
      const mid = format.mock.calls.length;
      vi.advanceTimersByTime(2000);
      expect(format.mock.calls.length).toBeGreaterThan(mid);
    });

    it('arms no clock for a repaid loan', () => {
      fakeInterval();
      const r = make({ reduced: true });
      r.place(shown(loan({ status: 'Repaid', amountRepaid: 220, outstanding: 0 })));
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops the clock when the loan leaves Active', () => {
      fakeInterval();
      const r = make({ reduced: true });
      r.place(shown(loan()));
      expect(vi.getTimerCount()).toBe(1);
      r.place(shown(loan({ status: 'Repaid' })));
      expect(vi.getTimerCount()).toBe(0);
    });

    it('skips the tick while paused', () => {
      fakeInterval();
      const format = vi.fn<DueFormat>(() => '0 min 42 s');
      const r = make({ reduced: true, format });
      r.place(shown(loan()));
      r.pause();
      const before = format.mock.calls.length;
      vi.advanceTimersByTime(3000);
      expect(format.mock.calls.length).toBe(before);
      r.resume();
      const resumed = format.mock.calls.length;
      vi.advanceTimersByTime(1000);
      expect(format.mock.calls.length).toBeGreaterThan(resumed);
    });

    it('stops on destroy', () => {
      fakeInterval();
      const format = vi.fn<DueFormat>(() => '0 min 42 s');
      const r = make({ reduced: true, format });
      r.place(shown(loan()));
      r.destroy();
      expect(vi.getTimerCount()).toBe(0);
      const before = format.mock.calls.length;
      vi.advanceTimersByTime(3000);
      expect(format.mock.calls.length).toBe(before);
    });

    it('arms no clock in a room that is not reduced', () => {
      fakeInterval();
      const r = make();
      r.place(shown(loan()));
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('the loop', () => {
    it('requests a frame on place and steps ten seconds of ambient life', () => {
      const r = make();
      r.place(shown(overdue()));
      expect(requests).toBe(1);
      expect(() => step(10000)).not.toThrow();
      expect(r.painted.led).toEqual(['OVERDUE', 'FEE $44', 'OWED $264']);
      expect(r.painted.brute.pose).toBe('stand');
      expect(r.t).toBeGreaterThan(5);
    });

    it('cancels the frame on pause and requests none after it', () => {
      const r = make();
      r.place(shown(loan()));
      step(100);
      const before = requests;
      r.pause();
      expect(cancels).toBe(1);
      step(500);
      expect(requests).toBe(before);
    });

    it('requests no frame in a reduced room', () => {
      const r = make({ reduced: true });
      r.resize(960, 400);
      r.place(shown(overdue()));
      r.setOffers(offers);
      r.setWallet({ availableFunds: 1, lifetimeTurnover: 1 });
      expect(requests).toBe(0);
    });

    it('ignores place after destroy', () => {
      const r = make();
      r.destroy();
      r.place(shown(loan()));
      expect(requests).toBe(0);
    });

    it('stops the room clock on pause', () => {
      const r = make();
      r.place(shown(loan()));
      step(200);
      expect(r.t).toBeGreaterThan(0);
      r.pause();
      const frozen = r.t;
      step(500);
      expect(r.t).toBe(frozen);
    });

    it('paints and steps nothing after destroy', () => {
      const r = make();
      r.place(shown(loan()));
      step(200);
      r.destroy();
      const before = r.painted;
      const frozen = r.t;
      r.place(shown(overdue()));
      r.run([{ kind: 'wireIn', amount: 5, slips: [{ out: false, amount: 5 }] }]);
      step(500);
      expect(r.painted).toEqual(before);
      expect(r.t).toBe(frozen);
    });
  });

  describe('run', () => {
    const pending = () => loan({ status: 'PendingApproval' });
    const stepLog = (opts: Partial<RoomModule.BankRoomOpts> = {}) => {
      const log: string[] = [];
      const at: number[] = [];
      const seen: RoomModule.BankPainted[] = [];
      const room: RoomModule.BankRoom = make({
        ...opts,
        onReveal: () => {
          log.push('reveal');
          at.push(clock);
          seen.push(room.painted);
        },
        onIdle: () => log.push('idle'),
      });
      return { room, log, at, seen };
    };
    const requested = (): BankStep => ({ kind: 'requested', loan: pending() });

    it('plays a request from the queue and reveals at its end', () => {
      const { room, log, at } = stepLog();
      room.place(shown(null));
      room.run([requested()]);
      step(5400);
      expect(log).toEqual([]);
      step(700);
      expect(log).toEqual(['reveal', 'idle']);
      expect(at[0]).toBeGreaterThanOrEqual(5500);
      expect(at[0]).toBeLessThanOrEqual(6000);
      expect(room.painted.you.spot).toBe('loan');
      expect(room.painted.led).toEqual(['IN REVIEW', 'LOAN $200', '']);
    });

    it('reveals an approval at the slam and shows the payout plate once the bundle lands', () => {
      const { room, log, seen } = stepLog();
      room.place(shown(pending()));
      room.run([{ kind: 'approved', loan: loan() }]);
      step(300);
      expect(log).toEqual([]);
      step(100);
      expect(log).toEqual(['reveal']);
      expect(seen[0].stamp).toBe('APPROVED');
      expect(seen[0].led[0]).toBe('DUE IN');
      expect(room.painted.plate).toBeNull();
      step(1500);
      expect(room.painted.plate).toEqual(['LOAN', '+$200']);
    });

    it('slams DENIED with the reason and ends on the curb', () => {
      const reason = 'Lifetime turnover 350.00 is below the required 400.00';
      const { room, log, seen } = stepLog();
      room.place(shown(pending()));
      room.run([{ kind: 'rejected', loan: loan({ status: 'Rejected', rejectionReason: reason }) }]);
      step(800);
      expect(log).toEqual(['reveal']);
      expect(seen[0].stamp).toBe('DENIED');
      expect(room.painted.plate).toEqual(['DENIED', reason]);
      step(6500);
      expect(log).toEqual(['reveal', 'idle']);
      expect(room.painted.you.spot).toBe('curb');
    });

    it('shows empty pockets when a collecting player has no funds', () => {
      const { room, seen } = stepLog({ reduced: true });
      room.setWallet({ availableFunds: 0, lifetimeTurnover: 0 });
      room.place(shown(loan()));
      room.run([{ kind: 'collecting', by: 'player', loan: loan({ status: 'CollectionPending' }) }]);
      expect(seen[0].plate).toEqual(['EMPTY POCKETS']);
      expect(seen[0].shark).toBe('count');
    });

    it('pushes a bundle and shows no plate when the player has funds', () => {
      const { room, seen } = stepLog({ reduced: true });
      room.setWallet({ availableFunds: 90, lifetimeTurnover: 0 });
      room.place(shown(loan()));
      room.run([{ kind: 'collecting', by: 'player', loan: loan({ status: 'CollectionPending' }) }]);
      expect(seen[0].plate).toBeNull();
      expect(seen[0].shark).toBe('count');
    });

    it('knocks for a retry with the enforcer outside and stands again', () => {
      const { room, log } = stepLog();
      room.place(shown(overdue()));
      room.run([
        { kind: 'collecting', by: 'retry', loan: overdue({ status: 'CollectionPending' }) },
      ]);
      step(500);
      expect(room.painted.brute.pose).toBe('knock');
      step(1000);
      expect(log).toEqual(['reveal', 'idle']);
      expect(room.painted.brute.pose).toBe('stand');
    });

    it('punches the outstanding into the calculator for the keeper', () => {
      const { room } = stepLog({ reduced: true });
      room.place(shown(loan()));
      room.run([{ kind: 'collecting', by: 'keeper', loan: loan({ status: 'CollectionPending' }) }]);
      expect(room.painted.calc).toBe('220');
    });

    it('sends the enforcer out for a first overdue', () => {
      const { room } = stepLog({ reduced: true });
      room.place(shown(loan()));
      room.run([{ kind: 'overdue', first: true, loan: overdue() }]);
      expect(room.painted.brute).toEqual({ x: 149, inside: false, pose: 'stand' });
      expect(room.painted.polaroid).toBe(true);
      expect(room.painted.redLight).toBe(true);
      expect(room.painted.plate).toEqual(['OVERDUE', 'LATE FEE $44']);
    });

    it('shows what is owed for a later overdue', () => {
      const { room } = stepLog({ reduced: true });
      room.place(shown(loan()));
      room.run([{ kind: 'overdue', first: false, loan: overdue() }]);
      expect(room.painted.plate).toEqual(['OVERDUE', 'OWED $264']);
      expect(room.painted.brute.inside).toBe(false);
    });

    it('slams PAID, kills the red light and sends the enforcer back in', () => {
      const { room, seen } = stepLog({ reduced: true });
      room.place(shown(overdue()));
      room.run([
        {
          kind: 'repaid',
          collected: 264,
          loan: overdue({ status: 'Repaid', amountRepaid: 264, outstanding: 0 }),
        },
      ]);
      expect(seen[0].stamp).toBe('PAID');
      expect(room.painted.plate).toEqual(['PAID BACK', '$264']);
      expect(room.painted.redLight).toBe(false);
      expect(room.painted.brute.inside).toBe(true);
    });

    it('shows the collected amount for a partial payment', () => {
      const { room, log } = stepLog({ reduced: true });
      room.place(shown(loan()));
      room.run([{ kind: 'partial', collected: 70, loan: loan({ amountRepaid: 70 }) }]);
      expect(log).toEqual(['reveal', 'idle']);
      expect(room.painted.plate).toEqual(['PAID BACK', '$70']);
    });

    it('reveals a wire out after the teletype and switches the slips then', () => {
      const { room, log, at, seen } = stepLog();
      room.place(shown(null));
      room.run([{ kind: 'wireOut', amount: 50, slips: [{ out: true, amount: 50 }] }]);
      step(7500);
      expect(log).toEqual([]);
      expect(room.painted.slips).toEqual([]);
      step(600);
      expect(at[0]).toBeGreaterThanOrEqual(7600);
      expect(at[0]).toBeLessThanOrEqual(8000);
      expect(seen[0].slips).toEqual(['-50']);
      expect(room.painted.plate).toEqual(['WIRE OUT', '-$50']);
      step(1000);
      expect(log).toEqual(['reveal', 'idle']);
      expect(room.painted.you.spot).toBe('wires');
    });

    it('shows an envelope plate for a wire in', () => {
      const { room, seen } = stepLog({ reduced: true });
      room.place(shown(null));
      room.run([{ kind: 'wireIn', amount: 150, slips: [{ out: false, amount: 150 }] }]);
      expect(room.painted.plate).toEqual(['WIRE IN', '+$150']);
      expect(seen[0].slips).toEqual(['+150']);
    });

    it('snaps a loan and the slips without motion', () => {
      const { room, log } = stepLog({ reduced: true });
      room.place(shown(null));
      room.run([
        { kind: 'snapLoan', loan: overdue() },
        { kind: 'snapSlips', slips: [{ out: true, amount: 9 }] },
      ]);
      expect(log).toEqual(['reveal', 'reveal', 'idle']);
      expect(room.painted.you.spot).toBe('loan');
      expect(room.painted.brute.inside).toBe(false);
      expect(room.painted.slips).toEqual(['-9']);
    });

    it('marks the loans known when a loan step reveals before the first poll', () => {
      const { room } = stepLog({ reduced: true });
      room.place({ loan: null, known: false, slips: [] });
      expect(room.painted.led).toEqual(['', 'NEXT!', '']);
      room.run([{ kind: 'snapLoan', loan: overdue() }]);
      expect(room.painted.led).toEqual(['OVERDUE', 'FEE $44', 'OWED $264']);
    });

    it('queues a second run behind the first and fires idle once', () => {
      const { room, log, seen } = stepLog();
      room.place(shown(null));
      room.run([requested()]);
      step(1000);
      room.run([{ kind: 'approved', loan: loan() }]);
      step(12000);
      expect(log).toEqual(['reveal', 'reveal', 'idle']);
      expect(seen[0].led[0]).toBe('IN REVIEW');
      expect(seen[1].led[0]).toBe('DUE IN');
      expect(room.idle).toBe(true);
    });

    it('is busy until the queue drains', () => {
      const { room } = stepLog();
      room.place(shown(null));
      expect(room.idle).toBe(true);
      room.run([requested()]);
      expect(room.idle).toBe(false);
      step(7000);
      expect(room.idle).toBe(true);
    });

    it('holds a wallet that arrives during a run until idle', () => {
      const { room } = stepLog();
      room.setOffers(offers);
      room.setWallet({ availableFunds: 300, lifetimeTurnover: 650 });
      room.place(shown(null));
      room.run([requested()]);
      step(500);
      room.setWallet({ availableFunds: 300, lifetimeTurnover: 12000 });
      expect(room.painted.board[1]).toBe('STANDARD $1,000 $1,150 10 MIN 2,000+');
      step(7000);
      expect(room.painted.board[1]).toBe('STANDARD $1,000 $1,150 10 MIN');
    });

    it('drains the whole queue on pause, lands you at the loan and clears the fx', () => {
      const { room, log } = stepLog();
      room.place(shown(null));
      room.run([requested(), { kind: 'approved', loan: loan() }]);
      step(300);
      expect(log).toEqual([]);
      const before = requests;
      room.pause();
      expect(log).toEqual(['reveal', 'reveal', 'idle']);
      expect(room.painted.you.spot).toBe('loan');
      expect(room.painted.stamp).toBeNull();
      expect(room.painted.plate).toBeNull();
      step(500);
      expect(requests).toBe(before);
    });

    it('lands a run that starts while paused', () => {
      const { room, log } = stepLog();
      room.place(shown(null));
      room.pause();
      room.run([requested(), { kind: 'approved', loan: loan() }]);
      expect(log).toEqual(['reveal', 'reveal', 'idle']);
      expect(room.painted.you.spot).toBe('loan');
      expect(room.painted.stamp).toBeNull();
      expect(room.painted.plate).toBeNull();
    });

    describe('under reduced motion', () => {
      beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));

      it('plays the whole run synchronously with no frame', () => {
        const { room, log } = stepLog({ reduced: true });
        room.place(shown(null));
        room.run([requested(), { kind: 'approved', loan: loan() }]);
        expect(log).toEqual(['reveal', 'reveal', 'idle']);
        expect(requests).toBe(0);
        expect(room.painted.stamp).toBe('APPROVED');
        expect(room.painted.plate).toEqual(['LOAN', '+$200']);
      });

      it('clears the stamp and the plate 2800 ms later', () => {
        const { room } = stepLog({ reduced: true });
        room.place(shown(null));
        room.run([requested(), { kind: 'approved', loan: loan() }]);
        vi.advanceTimersByTime(2799);
        expect(room.painted.stamp).toBe('APPROVED');
        vi.advanceTimersByTime(1);
        expect(room.painted.stamp).toBeNull();
        expect(room.painted.plate).toBeNull();
      });

      it('leaves no sweep timer after destroy', () => {
        const { room } = stepLog({ reduced: true });
        room.place(shown(pending()));
        room.run([{ kind: 'approved', loan: loan() }]);
        expect(vi.getTimerCount()).toBeGreaterThan(0);
        room.destroy();
        expect(vi.getTimerCount()).toBe(0);
      });

      it('leaves no sweep timer after place', () => {
        const { room } = stepLog({ reduced: true });
        room.place(shown(pending()));
        room.run([{ kind: 'approved', loan: loan() }]);
        room.place(shown(loan()));
        expect(vi.getTimerCount()).toBe(0);
        expect(room.painted.stamp).toBeNull();
      });
    });

    it('stops a run on place with no further reveal or idle', () => {
      const { room, log } = stepLog();
      room.place(shown(null));
      room.run([requested(), { kind: 'approved', loan: loan() }]);
      step(1000);
      room.place(shown(null));
      expect(room.idle).toBe(true);
      step(12000);
      expect(log).toEqual([]);
      expect(room.painted.you.spot).toBe('queue');
    });

    it('stops a run on destroy with no callback and no frame', () => {
      const { room, log } = stepLog();
      room.place(shown(null));
      room.run([requested()]);
      step(1000);
      room.destroy();
      const before = requests;
      step(12000);
      expect(log).toEqual([]);
      expect(requests).toBe(before);
    });

    it('ignores a run after destroy', () => {
      const { room, log } = stepLog({ reduced: true });
      room.destroy();
      room.run([requested()]);
      expect(log).toEqual([]);
    });
  });
});
