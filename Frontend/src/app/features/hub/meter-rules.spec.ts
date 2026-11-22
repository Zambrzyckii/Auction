import type { HudState } from '../../pixel/street/hud';
import { buildFx, newestTopic, rewardBetween } from './meter-rules';

const at = (cash: number, level: number): HudState => ({
  name: 'Bob',
  cash,
  level,
  share: 0.31,
  nextAt: 16000,
});

describe('buildFx', () => {
  it('maps a topic and the cash direction to a building and a word', () => {
    expect(buildFx(at(2840, 3), at(7090, 3), 'AuctionChanged')).toMatchObject({
      kind: 'event',
      at: 'auction',
      word: 'SOLD',
      amount: 4250,
    });
    expect(buildFx(at(2840, 3), at(2530, 3), 'AuctionListChanged')).toMatchObject({
      at: 'auction',
      word: 'YOU WON',
      amount: -310,
    });
    expect(buildFx(at(2840, 3), at(5740, 3), 'WarehouseChanged')).toMatchObject({
      at: 'storage',
      word: 'WAR WON',
    });
    expect(buildFx(at(2840, 3), at(2340, 3), 'WarehouseChanged')).toMatchObject({
      at: 'storage',
      word: 'WAR ENTRY',
    });
    expect(buildFx(at(2840, 3), at(3040, 3), 'CasinoChanged')).toMatchObject({
      at: 'casino',
      word: 'CASHED OUT',
    });
    expect(buildFx(at(2840, 3), at(2640, 3), 'CasinoChanged')).toMatchObject({
      at: 'casino',
      word: 'CHIPS',
    });
    expect(buildFx(at(2840, 3), at(3840, 3), 'LoanChanged')).toMatchObject({
      at: 'bank',
      word: 'LOAN',
    });
    expect(buildFx(at(2840, 3), at(2640, 3), 'PawnshopChanged')).toMatchObject({
      at: 'pawn',
      word: 'PAWNSHOP',
    });
  });

  it('falls back to a wire at the bank without a matching topic', () => {
    expect(buildFx(at(2840, 3), at(3040, 3), null)).toMatchObject({ at: 'bank', word: 'WIRE IN' });
    expect(buildFx(at(2840, 3), at(2640, 3), null)).toMatchObject({
      at: 'bank',
      word: 'WIRE OUT',
    });
  });

  it('scales bills, spotlight and particle counts with the amount', () => {
    expect(buildFx(at(0, 3), at(999, 3), null)).toMatchObject({ bills: 0, spotlight: false });
    expect(buildFx(at(0, 3), at(1000, 3), null)).toMatchObject({ bills: 1 });
    expect(buildFx(at(0, 3), at(2000, 3), null)).toMatchObject({ spotlight: true });
    expect(buildFx(at(0, 3), at(40000, 3), null)).toMatchObject({ coins: 34, bills: 16 });
    expect(buildFx(at(2840, 3), at(2640, 3), null)).toMatchObject({
      kind: 'event',
      part: 'spark',
      coins: 12,
    });
  });

  it('lets a level jump win over the event and sums the rewards', () => {
    const prev = at(2840, 3);
    const next = at(20000, 5);
    const fx = buildFx(prev, next, 'AuctionChanged');
    expect(fx).toEqual({
      kind: 'levelup',
      from: prev,
      hud: next,
      reward: 410,
      rain: 26,
      crowdStop: 4,
    });
    expect((fx as { hud: HudState }).hud).toBe(next);
  });

  it('plays a single level with its own reward', () => {
    expect(buildFx(at(2840, 3), at(3000, 4), null)).toMatchObject({
      kind: 'levelup',
      reward: 160,
      rain: 24,
      crowdStop: 4,
    });
  });

  it('plays nothing on an unchanged wallet', () => {
    expect(buildFx(at(2840, 3), at(2840, 3), 'AuctionChanged')).toBeNull();
  });
});

describe('rewardBetween', () => {
  it('sums 10 * n squared for every level crossed', () => {
    expect(rewardBetween(3, 4)).toBe(160);
    expect(rewardBetween(3, 5)).toBe(410);
  });
});

describe('newestTopic', () => {
  const seen = new Map([
    ['CasinoChanged', 1000],
    ['AuctionChanged', 4000],
  ]);

  it('returns the newest topic inside the window', () => {
    expect(newestTopic(seen, 5000)).toBe('AuctionChanged');
  });

  it('returns null when every topic is outside the window', () => {
    expect(newestTopic(seen, 11000)).toBeNull();
  });
});
