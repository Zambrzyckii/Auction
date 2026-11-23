import { feltStacks, zoneOf } from './roulette-watch';
import type { FeltBet } from './roulette-watch';

const bet = (type: string, selection: number | null, stake = 10): FeltBet => ({
  type,
  selection,
  stake,
});

describe('zoneOf', () => {
  it.each([
    [bet('Straight', 17), 'n17'],
    [bet('Straight', 0), 'n0'],
    [bet('Red', null), 'red'],
    [bet('Black', null), 'black'],
    [bet('Odd', null), 'odd'],
    [bet('Even', null), 'even'],
    [bet('Low', null), 'low'],
    [bet('High', null), 'high'],
    [bet('Dozen', 2), 'dozen2'],
    [bet('Column', 3), 'col3'],
  ])('maps %o to %s', (b, zone) => {
    expect(zoneOf(b)).toBe(zone);
  });

  it.each([
    bet('Straight', 37),
    bet('Straight', null),
    bet('Dozen', 0),
    bet('Column', 4),
    bet('Corner', 1),
  ])('gives null for %o', (b) => {
    expect(zoneOf(b)).toBeNull();
  });
});

describe('feltStacks', () => {
  it('groups by zone in first-seen order', () => {
    expect(
      feltStacks([bet('Red', null, 10), bet('Straight', 17, 5), bet('Red', null, 10)]),
    ).toEqual([
      { zone: 'red', stake: 20, count: 2 },
      { zone: 'n17', stake: 5, count: 1 },
    ]);
  });

  it('leaves out bets with an invalid selection', () => {
    expect(feltStacks([bet('Straight', 37), bet('Dozen', 0), bet('Odd', null, 4)])).toEqual([
      { zone: 'odd', stake: 4, count: 1 },
    ]);
  });
});
