import { NATURAL_DIR, SortItemsPipe, sortShelf } from './sort-items';
import type { ShelfItem } from './shelf-item';

const item = (
  publicItemId: string,
  name: string,
  rarity: string,
  status: string,
  officialPrice: number,
): ShelfItem => ({ publicItemId, name, rarity, status, officialPrice });
const ids = (xs: readonly ShelfItem[]) => xs.map((x) => x.publicItemId);

const shelf = [
  item('b', 'Old Radio', 'Rare', 'Available', 300),
  item('a', 'Old Radio', 'Rare', 'Available', 300),
  item('c', 'Banjo', 'Legendary', 'LockedForAuction', 9000),
  item('d', 'Zippo', 'Common', 'Available', 12),
];

describe('sortShelf', () => {
  it('sorts by rarity both ways, ties by name then id', () => {
    expect(ids(sortShelf(shelf, 'rarity', 'desc'))).toEqual(['c', 'a', 'b', 'd']);
    expect(ids(sortShelf(shelf, 'rarity', 'asc'))).toEqual(['d', 'a', 'b', 'c']);
  });
  it('sorts by price both ways', () => {
    expect(ids(sortShelf(shelf, 'price', 'desc'))).toEqual(['c', 'a', 'b', 'd']);
    expect(ids(sortShelf(shelf, 'price', 'asc'))).toEqual(['d', 'a', 'b', 'c']);
  });
  it('sorts by name both ways', () => {
    expect(ids(sortShelf(shelf, 'name', 'asc'))).toEqual(['c', 'a', 'b', 'd']);
    expect(ids(sortShelf(shelf, 'name', 'desc'))).toEqual(['d', 'a', 'b', 'c']);
  });
  it('sorts by status with Available first and unknown statuses last', () => {
    expect(ids(sortShelf(shelf, 'status', 'asc'))).toEqual(['a', 'b', 'd', 'c']);
    expect(ids(sortShelf(shelf, 'status', 'desc'))).toEqual(['c', 'a', 'b', 'd']);
    expect(
      ids(sortShelf([...shelf, item('e', 'Kazoo', 'Rare', 'SoldToShop', 5)], 'status', 'asc')),
    ).toEqual(['a', 'b', 'd', 'c', 'e']);
  });
  it('returns a copy and leaves the input alone', () => {
    const input = [...shelf];
    expect(sortShelf(input, 'name', 'asc')).not.toBe(input);
    expect(ids(input)).toEqual(['b', 'a', 'c', 'd']);
  });
  it('gives the same order for a reshuffled poll', () => {
    expect(ids(sortShelf([...shelf].reverse(), 'rarity', 'desc'))).toEqual(['c', 'a', 'b', 'd']);
  });
  it('names the natural direction of each key', () => {
    expect(NATURAL_DIR).toEqual({ rarity: 'desc', price: 'desc', name: 'asc', status: 'asc' });
  });
  it('sorts through the pipe', () => {
    expect(ids(new SortItemsPipe().transform(shelf, 'price', 'asc'))).toEqual(['d', 'a', 'b', 'c']);
  });
});
