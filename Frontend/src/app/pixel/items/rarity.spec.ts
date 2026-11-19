import { rarityOf, RARITIES } from './rarity';

describe('rarityOf', () => {
  it('keeps a known rarity', () => {
    expect(rarityOf('Legendary')).toBe('Legendary');
  });
  it('turns null, undefined and unknown strings into Common', () => {
    expect(rarityOf(null)).toBe('Common');
    expect(rarityOf(undefined)).toBe('Common');
    expect(rarityOf('Mythic')).toBe('Common');
  });
  it('lists the four rarities in order', () => {
    expect(RARITIES).toEqual(['Common', 'Rare', 'Epic', 'Legendary']);
  });
});
