import { craftOutcome, landedId, nextRarity } from './craft-watch';
import type { ShelfItem } from './shelf-item';

const item = (
  publicItemId: string,
  name: string,
  rarity: string,
  status: string,
  officialPrice: number,
): ShelfItem => ({ publicItemId, name, rarity, status, officialPrice });
const ids = (xs: readonly ShelfItem[]) => xs.map((x) => x.publicItemId);

const run = (picked: string[]) => ({ pending: true, picked });

describe('craftOutcome', () => {
  it('reads ok, fail and none from two snapshots', () => {
    expect(craftOutcome(run(['a', 'b', 'c']), { pending: false, picked: [] })).toBe('ok');
    expect(craftOutcome(run(['a', 'b', 'c']), { pending: false, picked: ['a', 'b', 'c'] })).toBe(
      'fail',
    );
    expect(craftOutcome(run([]), { pending: false, picked: [] })).toBe('fail');
    expect(craftOutcome({ pending: false, picked: ['a'] }, { pending: false, picked: [] })).toBe(
      'none',
    );
    expect(craftOutcome({ pending: false, picked: ['a'] }, run(['a']))).toBe('none');
    expect(craftOutcome(run(['a']), run(['a']))).toBe('none');
  });
});

describe('landedId', () => {
  const before = ['a', 'b', 'c', 'd'];
  it('finds the new card of the crafted rarity', () => {
    const landedOn = [
      item('d', 'Lamp', 'Rare', 'Available', 1),
      item('w', 'Warehouse Common Find', 'Common', 'Available', 2),
      item('n', 'Crafted Rare Item', 'Rare', 'Available', 1234),
    ];
    expect(landedId(before, landedOn, 'Rare')).toBe('n');
  });
  it('gives null when nothing new landed', () => {
    expect(landedId(before, [item('d', 'Lamp', 'Rare', 'Available', 1)], 'Rare')).toBeNull();
  });
});

describe('nextRarity', () => {
  it('steps one place up and stays at Legendary', () => {
    expect(['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'].map(nextRarity)).toEqual([
      'Rare',
      'Epic',
      'Legendary',
      'Legendary',
      'Rare',
    ]);
  });
});
