export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export const RARITIES: readonly Rarity[] = ['Common', 'Rare', 'Epic', 'Legendary'] as const;

export function rarityOf(value: string | null | undefined): Rarity {
  return RARITIES.find((r) => r === value) ?? 'Common';
}
