import type { Sprite } from '../street/pix';
import type { Rarity } from './rarity';
import { EXACT, FAMILIES, mystery } from './sprites/catalog';

export interface IconCatalog {
  exact: Readonly<Record<string, () => Sprite>>;
  families: readonly (readonly [RegExp, (r: Rarity) => Sprite])[];
  mystery: (r: Rarity) => Sprite;
}

export function makeIconFor(catalog: IconCatalog): (name: string | null, rarity: Rarity) => Sprite {
  const cache = new Map<string, Sprite>();

  const draw = (name: string | null, rarity: Rarity): Sprite => {
    if (name !== null) {
      if (Object.hasOwn(catalog.exact, name)) return catalog.exact[name]();
      for (const [pattern, art] of catalog.families) if (pattern.test(name)) return art(rarity);
    }
    return catalog.mystery(rarity);
  };

  return (name, rarity) => {
    const key = `${name ?? ''}|${rarity}`;
    let sprite = cache.get(key);
    if (!sprite) {
      try {
        sprite = draw(name, rarity);
      } catch {
        sprite = catalog.mystery(rarity);
      }
      cache.set(key, sprite);
    }
    return sprite;
  };
}

export const iconFor = makeIconFor({ exact: EXACT, families: FAMILIES, mystery });
