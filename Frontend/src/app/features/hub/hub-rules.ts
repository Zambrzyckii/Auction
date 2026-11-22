import type { BuildingId } from '../../pixel/street/city';
import { BUILDING_LINKS } from '../welcome/welcome-rules';

const SEGMENT_BUILDINGS: ReadonlyMap<string, BuildingId> = new Map([
  ['auctions', 'auction'],
  ['warehouses', 'storage'],
  ['inventory', 'room'],
  ['wallet', 'room'],
  ['profile', 'room'],
  ['profiles', 'room'],
  ['transfers', 'bank'],
  ['bank', 'bank'],
  ['pawnshop', 'pawn'],
  ['casino', 'casino'],
]);

export function stripWhere(url: string): string | null {
  const path = url.split(/[?#]/)[0];
  const segment = path.split('/').find((part) => part !== '');
  if (segment === undefined) return null;
  const id = SEGMENT_BUILDINGS.get(segment);
  if (id === undefined) return null;
  return BUILDING_LINKS.find((link) => link.id === id)?.name ?? null;
}

export function playerXp(level: number, turnover: number): { share: number; nextAt: number } {
  const from = 1000 * level * level;
  const nextAt = 1000 * (level + 1) * (level + 1);
  const share = (turnover - from) / (nextAt - from);
  return { share: Math.min(1, Math.max(0, share)), nextAt };
}
