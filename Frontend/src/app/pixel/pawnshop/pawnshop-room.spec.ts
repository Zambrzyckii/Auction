import type * as RoomModule from './pawnshop-room';
import type * as Rooms from './rooms';
import type { PawnItem, PawnOffers, PawnShop, PawnStep, PawnTier } from './pawnshop-watch';
import { DONE, facadeState } from './pawnshop-opening';

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

const NOW = new Date('2026-11-24T12:00:00Z').getTime();
const iso = (ms: number) => new Date(ms).toISOString();

const shop = (over: Partial<PawnShop> = {}): PawnShop => ({
  publicPawnshopId: 'shop-1',
  status: 'Active',
  rejectionReason: null,
  botTierName: null,
  botRarity: null,
  nextSpawnOn: null,
  pendingBotTierName: null,
  stock: [],
  ...over,
});

const clerkShop = (over: Partial<PawnShop> = {}): PawnShop =>
  shop({
    botTierName: 'Pawn Clerk',
    botRarity: 'Common',
    nextSpawnOn: iso(NOW + 25_000),
    ...over,
  });

const item = (id: string, over: Partial<PawnItem> = {}): PawnItem => ({
  publicStockItemId: id,
  rarity: 'Common',
  price: 42,
  status: 'InStock',
  spawnedOn: iso(NOW),
  sellAfter: iso(NOW + 300_000),
  payoutAmount: null,
  ...over,
});

const CLERK: PawnTier = { name: 'Pawn Clerk', rarity: 'Common', price: 100_000 };
const APPRAISER: PawnTier = { name: 'Appraiser', rarity: 'Rare', price: 300_000 };
const DEALER: PawnTier = { name: 'Dealer', rarity: 'Epic', price: 1_500_000 };
const MAGNATE: PawnTier = { name: 'Magnate', rarity: 'Legendary', price: 5_000_000 };
const offers: PawnOffers = { botTiers: [CLERK, APPRAISER, DEALER, MAGNATE] };

describe('PawnshopRoom', () => {
  let mod: typeof RoomModule;
  let rooms: typeof Rooms;
  let Probe: new (
    cv: HTMLCanvasElement,
    opts?: RoomModule.PawnshopRoomOpts,
  ) => RoomModule.PawnshopRoom & {
    draws: number;
  };
  let queued: FrameRequestCallback[] = [];
  let clock = 0;
  let requests = 0;
  let cancels = 0;
  let made: RoomModule.PawnshopRoom[] = [];

  beforeAll(async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => looseContext() as never,
    );
    vi.resetModules();
    mod = await import('./pawnshop-room');
    rooms = await import('./rooms');
    Probe = class extends mod.PawnshopRoom {
      draws = 0;
      protected override draw(): void {
        this.draws++;
        super.draw();
      }
    };
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
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(NOW);
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

  const make = (opts?: RoomModule.PawnshopRoomOpts) => {
    const r = new Probe(document.createElement('canvas'), opts);
    made.push(r);
    return r;
  };

  const reduced = () => make({ reduced: true });

  it('builds, resizes to scale 2 and centres the counter', () => {
    const r = make();
    expect(requests).toBe(0);
    r.resize(1906, 458);
    expect(r.size).toEqual({ scale: 2, width: 960, height: 400 });
    expect(r.focusX).toBe(238);
    expect(mod.FOCUS_X).toBe(238);
  });

  describe('placement', () => {
    it('puts you on the sidewalk before the first read', () => {
      const r = reduced();
      r.place(null);
      r.setCanBuy(true);
      const p = r.painted;
      expect(p.open).toBe(false);
      expect(p.you).toEqual({ x: 22, face: 'front', action: null, pose: null, carry: null });
      expect(p.note).toBeNull();
      expect(p.led).toBeNull();
      expect(p.buddy).toBeNull();
      expect(p.cand).toBeNull();
    });

    it('shows the ready pose for a player with no shop who can buy', () => {
      const r = reduced();
      r.place('none');
      r.setCanBuy(true);
      expect(r.painted.you.pose).toBe('pat');
      expect(r.painted.you.action).toBe('ready');
      r.setCanBuy(false);
      expect(r.painted.you.pose).toBeNull();
    });

    it('takes the ready pose back for a rejected player and denies it to an Active one', () => {
      const r = reduced();
      r.setCanBuy(true);
      r.place(shop({ status: 'Rejected', rejectionReason: 'Payment timed out' }));
      expect(r.painted.you.pose).toBe('pat');
      r.place(clerkShop());
      expect(r.painted.you.pose).toBeNull();
    });

    it('sends a pending payment to the door with the keys and a rattling padlock', () => {
      const r = reduced();
      r.place(shop({ status: 'PendingPayment' }));
      const p = r.painted;
      expect(p.open).toBe(false);
      expect(p.you).toEqual({ x: 70, face: 'right', action: null, pose: null, carry: 'keys' });
      expect(p.lockRattle).toBe(true);
      expect(p.led).toBeNull();
    });

    it('sends a rejected player to the corner with the reason on the door', () => {
      const r = reduced();
      r.place(shop({ status: 'Rejected', rejectionReason: 'Payment timed out' }));
      const p = r.painted;
      expect(p.you.x).toBe(2);
      expect(p.you.face).toBe('front');
      expect(p.note).toBe('Payment timed out');
      expect(p.open).toBe(false);
      expect(p.lockRattle).toBe(false);
    });

    it('opens an Active shop with its clerk, LED, prints and the finished facade', () => {
      const r = reduced();
      r.place(clerkShop());
      const p = r.painted;
      const art = rooms.build();
      const geo = {
        planks: art.planks,
        links: art.chainPts.length,
        staple: rooms.L.staple,
        heap: rooms.L.heap,
      };
      expect(p.open).toBe(true);
      expect(p.you.x).toBe(366);
      expect(p.buddy).toEqual({ key: 'clerk', x: 182, top: 60, behind: true });
      expect(p.led).toEqual(['NEXT DELIVERY', '0 min 25 s']);
      expect(p.help).toBe(false);
      expect(p.facade).toEqual(facadeState(() => DONE, geo, true));
      expect(p.prints).toBe(6);
      expect(p.stamps).toBeNull();
      expect(p.plate).toBeNull();
      expect(p.drawer).toBe(false);
      expect(p.flap).toBe(false);
    });

    it('draws HELP WANTED and the NO CREW LED while an Active shop has no bot', () => {
      const r = reduced();
      r.place(shop());
      const p = r.painted;
      expect(p.led).toEqual(['NO DELIVERIES', 'NO CREW YET']);
      expect(p.help).toBe(true);
      expect(p.buddy).toBeNull();
    });

    it('draws no LED for a crew shop that has no delivery pending', () => {
      const r = reduced();
      r.place(clerkShop({ nextSpawnOn: null }));
      expect(r.painted.led).toBeNull();
    });

    it('resolves a pending tier through the offers, and again when they arrive late', () => {
      const r = reduced();
      const pending = clerkShop({ pendingBotTierName: 'Appraiser' });
      r.setOffers(offers);
      r.place(pending);
      expect(r.painted.cand).toEqual({ key: 'appraiser', x: 60 });
      const late = reduced();
      late.place(pending);
      expect(late.painted.cand).toEqual({ key: 'clerk', x: 60 });
      late.setOffers(offers);
      expect(late.painted.cand).toEqual({ key: 'appraiser', x: 60 });
    });

    it('seats every crew look by the rarity of the bot', () => {
      const r = reduced();
      const keys = (['Common', 'Rare', 'Epic', 'Legendary'] as const).map((rarity) => {
        r.place(clerkShop({ botRarity: rarity }));
        return r.painted.buddy?.key;
      });
      expect(keys).toEqual(['clerk', 'appraiser', 'dealer', 'magnate']);
    });

    it('forgets the opening when a new shop is placed after an Active one', () => {
      const r = reduced();
      r.place(clerkShop());
      r.place(shop({ status: 'PendingPayment' }));
      expect(r.painted.open).toBe(false);
      expect(r.painted.buddy).toBeNull();
      expect(r.painted.prints).toBe(0);
    });
  });

  describe('the board and the shelf', () => {
    it('lists the four tiers as on shift, lit or locked', () => {
      const r = reduced();
      r.setOffers(offers);
      r.setUpgrades([APPRAISER]);
      r.place(clerkShop());
      expect(r.painted.board).toEqual([
        { name: 'Pawn Clerk', tag: 'ON SHIFT', state: 'on' },
        { name: 'Appraiser', tag: '300,000', state: 'live' },
        { name: 'Dealer', tag: '1,500,000', state: 'locked' },
        { name: 'Magnate', tag: '5,000,000', state: 'locked' },
      ]);
    });

    it('has an empty board until the offers arrive', () => {
      const r = reduced();
      r.place(clerkShop());
      expect(r.painted.board).toEqual([]);
    });

    it('fills the shelf with the InStock items, their tags and their dust', () => {
      const r = reduced();
      r.place(
        clerkShop({
          stock: [
            item('a'),
            item('b', {
              price: 1234,
              spawnedOn: iso(NOW - 150_000),
              sellAfter: iso(NOW + 150_000),
            }),
            item('c', { status: 'Sold', payoutAmount: 30 }),
          ],
        }),
      );
      const first = r.painted.shelf;
      expect(first).toEqual([
        { id: 'a', slot: 0, dust: 0, tag: '42' },
        { id: 'b', slot: 1, dust: 2, tag: '1,234' },
      ]);
      expect(r.painted.shelf).toEqual(first);
    });

    it('shows no shelf in a locked shop', () => {
      const r = reduced();
      r.place(shop({ status: 'PendingPayment', stock: [item('a')] }));
      expect(r.painted.shelf).toEqual([]);
    });
  });

  describe('the clock under reduced motion', () => {
    it('redraws an Active shop with a countdown every second', () => {
      const r = reduced();
      r.place(clerkShop());
      const before = r.draws;
      vi.advanceTimersByTime(1000);
      expect(r.draws).toBe(before + 1);
    });

    it('redraws a shop that only has stock to age', () => {
      const r = reduced();
      r.place(shop({ stock: [item('a')] }));
      const before = r.draws;
      vi.advanceTimersByTime(1000);
      expect(r.draws).toBe(before + 1);
    });

    it('arms no clock without a bot and without stock', () => {
      const r = reduced();
      r.place(shop());
      expect(vi.getTimerCount()).toBe(0);
    });

    it('arms no clock for a shop that is not Active', () => {
      const r = reduced();
      r.place(shop({ status: 'PendingPayment', nextSpawnOn: iso(NOW + 5000) }));
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops the clock when the shop leaves Active', () => {
      const r = reduced();
      r.place(clerkShop());
      expect(vi.getTimerCount()).toBe(1);
      r.place(shop({ status: 'Rejected', rejectionReason: 'no' }));
      expect(vi.getTimerCount()).toBe(0);
    });

    it('skips the tick while paused and resumes after', () => {
      const r = reduced();
      r.place(clerkShop());
      r.pause();
      const before = r.draws;
      vi.advanceTimersByTime(3000);
      expect(r.draws).toBe(before);
      r.resume();
      const resumed = r.draws;
      vi.advanceTimersByTime(1000);
      expect(r.draws).toBe(resumed + 1);
    });

    it('stops on destroy', () => {
      const r = reduced();
      r.place(clerkShop());
      r.destroy();
      expect(vi.getTimerCount()).toBe(0);
      const before = r.draws;
      vi.advanceTimersByTime(3000);
      expect(r.draws).toBe(before);
    });

    it('arms no clock in a room that is not reduced', () => {
      const r = make();
      r.place(clerkShop());
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('the loop', () => {
    it('requests a frame on place', () => {
      const r = make();
      r.place(clerkShop());
      expect(requests).toBe(1);
    });

    it('never requests a frame under reduced motion', () => {
      const r = reduced();
      r.place(clerkShop());
      step(500);
      expect(requests).toBe(0);
    });

    it('steps the blinks, habits, motes, spider and mouse for ten seconds without throwing', () => {
      const r = make();
      r.place(clerkShop({ stock: [item('a')] }));
      expect(() => step(10_000)).not.toThrow();
      expect(r.t).toBeGreaterThan(9);
      expect(r.draws).toBeGreaterThan(100);
    });

    it('steps the locked room too', () => {
      const r = make();
      r.place('none');
      r.setCanBuy(true);
      expect(() => step(10_000)).not.toThrow();
    });

    it('cancels the frame on pause', () => {
      const r = make();
      r.place(clerkShop());
      r.pause();
      expect(cancels).toBeGreaterThan(0);
      const draws = r.draws;
      step(500);
      expect(r.draws).toBe(draws);
    });
  });

  describe('premises steps', () => {
    const pendingShop = () => shop({ status: 'PendingPayment' });
    const paying: PawnStep = { kind: 'paying', shop: pendingShop() };
    const opened: PawnStep = { kind: 'opened', shop: clerkShop() };
    const rejectedShop = shop({
      status: 'Rejected',
      rejectionReason: 'Not enough funds on account',
    });
    const rig = (reducedMotion = false) => {
      const rec = {
        reveals: [] as number[],
        idles: [] as { t: number; x: number }[],
      };
      const r: InstanceType<typeof Probe> = make({
        reduced: reducedMotion,
        onReveal: () => rec.reveals.push(r.t),
        onIdle: () => rec.idles.push({ t: r.t, x: r.painted.you.x }),
      });
      return { r, rec };
    };
    const activeReference = () => {
      const ref = reduced();
      ref.place(clerkShop());
      return ref.painted.facade;
    };

    it('snaps to the step shop at once, with one reveal and one idle', () => {
      const { r, rec } = rig();
      r.place('none');
      r.run([{ kind: 'snap', shop: clerkShop() }]);
      expect(rec.reveals).toHaveLength(1);
      expect(rec.idles).toHaveLength(1);
      expect(r.idle).toBe(true);
      expect(r.painted.open).toBe(true);
      expect(r.painted.you.x).toBe(366);
      expect(r.painted.buddy?.key).toBe('clerk');
    });

    it('reveals paying inside run, then walks to the door with the keys', () => {
      const { r, rec } = rig();
      r.place('none');
      r.run([paying]);
      expect(rec.reveals).toEqual([0]);
      expect(r.idle).toBe(false);
      step(3000);
      const p = r.painted;
      expect(p.you.x).toBe(70);
      expect(p.you.face).toBe('right');
      expect(p.you.carry).toBe('keys');
      expect(p.lockRattle).toBe(true);
      expect(p.note).toBeNull();
      expect(rec.idles).toHaveLength(1);
    });

    describe('opened', () => {
      const start = () => {
        const rig1 = rig();
        rig1.r.place(pendingShop());
        rig1.r.run([opened]);
        return rig1;
      };

      it('reveals once, between 9.1 and 9.8 s, and not before 9.0 s', () => {
        const { rec } = start();
        step(9000);
        expect(rec.reveals).toHaveLength(0);
        step(1500);
        expect(rec.reveals).toHaveLength(1);
        expect(rec.reveals[0]).toBeGreaterThan(9.1);
        expect(rec.reveals[0]).toBeLessThan(9.8);
      });

      it('opens the shop from the bulb stamp on', () => {
        const { r } = start();
        const st = r.painted.stamps!;
        let early = false,
          late = false;
        for (let i = 0; i < 700; i++) {
          step(16);
          const open = r.painted.open;
          if (open && st.s.bulb === undefined) early = true;
          if (!open && st.s.bulb !== undefined) late = true;
        }
        expect(st.s.bulb).toBeDefined();
        expect(early).toBe(false);
        expect(late).toBe(false);
      });

      it('starts the beats in the table order, the door 0.4 s after the chain', () => {
        const { r } = start();
        const st = r.painted.stamps!;
        step(10_000);
        const order = [
          'key',
          'jiggle',
          'click',
          'chain',
          'door',
          'kick',
          'walkIn',
          'cord',
          'bulb',
          'cloth',
          'cheer',
        ] as const;
        const seen = Object.entries(st.s)
          .sort((a, b) => (a[1] as number) - (b[1] as number))
          .map(([id]) => id)
          .filter((id) => (order as readonly string[]).includes(id));
        expect(seen).toEqual([...order]);
        expect(Math.abs((st.s.door ?? 0) - (st.s.chain ?? 0) - 0.4)).toBeLessThan(0.05);
      });

      it('goes idle once, after you reach your corner, in the end-state facade', () => {
        const { r, rec } = start();
        step(20_000);
        expect(rec.idles).toHaveLength(1);
        expect(rec.idles[0].x).toBe(366);
        expect(rec.idles[0].t).toBeGreaterThan(rec.reveals[0]);
        expect(r.painted.stamps).toBeNull();
        expect(r.painted.facade).toEqual(activeReference());
      });

      it('holds the end state from the frame before idle', () => {
        const { r, rec } = start();
        let before = r.painted.facade;
        for (let i = 0; i < 1500 && rec.idles.length === 0; i++) {
          before = r.painted.facade;
          step(16);
        }
        expect(rec.idles).toHaveLength(1);
        expect(before).toEqual(r.painted.facade);
      });

      it('leaves a shop placed afterwards closed', () => {
        const { r } = start();
        step(20_000);
        expect(r.painted.open).toBe(true);
        r.place(pendingShop());
        expect(r.painted.open).toBe(false);
      });
    });

    it('plays [paying, opened] as two reveals and one idle', () => {
      const { r, rec } = rig();
      r.place('none');
      r.run([paying, opened]);
      step(25_000);
      expect(rec.reveals).toHaveLength(2);
      expect(rec.reveals[0]).toBeLessThan(rec.reveals[1]);
      expect(rec.idles).toHaveLength(1);
      expect(r.painted.you.x).toBe(366);
    });

    it('reveals a rejection after the walk and leaves the note in the corner', () => {
      const { r, rec } = rig();
      r.place(pendingShop());
      r.run([{ kind: 'rejected', shop: rejectedShop }]);
      step(3900);
      expect(rec.reveals).toHaveLength(0);
      step(1100);
      expect(rec.reveals).toHaveLength(1);
      expect(rec.reveals[0]).toBeGreaterThan(4.0);
      expect(rec.reveals[0]).toBeLessThan(5.0);
      step(2000);
      expect(rec.idles).toHaveLength(1);
      const p = r.painted;
      expect(p.note).toBe('Not enough funds on account');
      expect(p.you.x).toBe(2);
      expect(p.lockRattle).toBe(false);
    });

    it('drains a reduced room in one call without a frame', () => {
      const { r, rec } = rig(true);
      r.place('none');
      r.run([paying, opened]);
      expect(rec.reveals).toHaveLength(2);
      expect(rec.idles).toHaveLength(1);
      expect(requests).toBe(0);
      expect(r.painted.you.x).toBe(366);
      expect(r.painted.facade).toEqual(activeReference());
    });

    it('lands the run when paused four seconds in', () => {
      const { r, rec } = rig();
      r.place(pendingShop());
      r.run([opened]);
      step(4000);
      expect(rec.reveals).toHaveLength(0);
      const asked = requests;
      r.pause();
      expect(rec.reveals).toHaveLength(1);
      expect(rec.idles).toHaveLength(1);
      expect(r.painted.you.x).toBe(366);
      expect(r.painted.facade).toEqual(activeReference());
      expect(requests).toBe(asked);
    });

    it('lands a run started while paused at once', () => {
      const { r, rec } = rig();
      r.place('none');
      r.pause();
      r.run([paying, opened]);
      expect(rec.reveals).toHaveLength(2);
      expect(rec.idles).toHaveLength(1);
      expect(r.painted.you.x).toBe(366);
    });

    it('stops a run that is replaced by place', () => {
      const { r, rec } = rig();
      r.place(pendingShop());
      r.run([opened]);
      step(3000);
      r.place('none');
      step(20_000);
      expect(rec.reveals).toHaveLength(0);
      expect(rec.idles).toHaveLength(0);
      expect(r.painted.stamps).toBeNull();
    });

    it('leaves no timer and no callback after destroy', () => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
      });
      vi.setSystemTime(NOW);
      const { r, rec } = rig();
      r.place(pendingShop());
      r.run([opened]);
      step(2000);
      r.destroy();
      expect(vi.getTimerCount()).toBe(0);
      step(20_000);
      expect(rec.reveals).toHaveLength(0);
      expect(rec.idles).toHaveLength(0);
    });
  });
});
