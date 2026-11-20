import { BenchFitPipe, benchFit } from './bench-fit';
import type { ShelfItem } from './shelf-item';

const item = (
  publicItemId: string,
  name: string,
  rarity: string,
  status: string,
  officialPrice: number,
): ShelfItem => ({ publicItemId, name, rarity, status, officialPrice });
const ids = (xs: readonly ShelfItem[]) => xs.map((x) => x.publicItemId);

const common = (id: string) => item(id, 'Old Radio', 'Common', 'Available', 10);

describe('benchFit', () => {
  it('fits a free item on an empty belt', () => {
    expect(benchFit(common('a'), [])).toBeNull();
  });
  it('an item on the belt fits', () => {
    expect(benchFit(common('a'), [common('a'), common('b'), common('c')])).toBeNull();
  });
  it('names why an item does not fit', () => {
    expect(benchFit(item('x', 'Banjo', 'Legendary', 'LockedForAuction', 9), [])).toBe('On auction');
    expect(benchFit(item('x', 'Banjo', 'Legendary', 'Available', 9), [])).toBe('Top rarity');
    expect(benchFit(item('x', 'Lamp', 'Rare', 'Available', 9), [common('a')])).toBe('Needs Common');
    expect(benchFit(common('d'), [common('a'), common('b'), common('c')])).toBe('Belt is full');
  });
  it('answers through the pipe', () => {
    expect(
      new BenchFitPipe().transform(item('x', 'Lamp', 'Rare', 'Available', 9), [common('a')]),
    ).toBe('Needs Common');
  });
});
