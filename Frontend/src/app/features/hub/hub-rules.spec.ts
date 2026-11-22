import { playerXp, stripWhere } from './hub-rules';

describe('stripWhere', () => {
  it('names the building for a path under it', () => {
    expect(stripWhere('/auctions')).toBe('Auction hall');
    expect(stripWhere('/warehouses/9')).toBe('Storage yard');
    expect(stripWhere('/pawnshop')).toBe('Pawnshop');
    expect(stripWhere('/casino/roulette')).toBe('Card room');
  });

  it('groups the personal pages under the room', () => {
    expect(stripWhere('/inventory')).toBe('Your room');
    expect(stripWhere('/wallet')).toBe('Your room');
    expect(stripWhere('/profile')).toBe('Your room');
    expect(stripWhere('/profiles/abc')).toBe('Your room');
  });

  it('groups transfers and the bank under the bank building', () => {
    expect(stripWhere('/transfers')).toBe('Checks cashed');
    expect(stripWhere('/bank')).toBe('Checks cashed');
  });

  it('ignores the query string and the fragment', () => {
    expect(stripWhere('/auctions/5?returnUrl=%2Fx')).toBe('Auction hall');
    expect(stripWhere('/bank#top')).toBe('Checks cashed');
  });

  it('returns null outside the street', () => {
    for (const url of ['/hub', '/welcome', '/login', '/register', '/', '/nowhere']) {
      expect(stripWhere(url)).toBeNull();
    }
  });
});

describe('playerXp', () => {
  it('measures progress between two level thresholds', () => {
    expect(playerXp(3, 11200)).toEqual({ share: (11200 - 9000) / 7000, nextAt: 16000 });
    expect(playerXp(0, 300)).toEqual({ share: 0.3, nextAt: 1000 });
  });

  it('clamps the share to the range 0 to 1', () => {
    expect(playerXp(3, 8000).share).toBe(0);
    expect(playerXp(3, 17000).share).toBe(1);
  });
});
