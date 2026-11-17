import { BUILDING_LINKS, BUILDING_PATHS } from './welcome-rules';

describe('welcome rules', () => {
  it('gives every street building a path, in street order', () => {
    expect(BUILDING_LINKS.map((link) => link.id)).toEqual([
      'room',
      'auction',
      'pawn',
      'bank',
      'casino',
      'storage',
    ]);
    for (const link of BUILDING_LINKS) {
      expect(BUILDING_PATHS[link.id].startsWith('/')).toBe(true);
    }
  });
});
