import type { BuildingId } from '../../pixel/street/city';

export const BUILDING_PATHS: Readonly<Record<BuildingId, string>> = {
  room: '/inventory',
  auction: '/auctions',
  pawn: '/pawnshop',
  bank: '/bank',
  casino: '/casino',
  storage: '/warehouses',
};

export const BUILDING_LINKS: readonly { id: BuildingId; name: string }[] = [
  { id: 'room', name: 'Your room' },
  { id: 'auction', name: 'Auction hall' },
  { id: 'pawn', name: 'Pawnshop' },
  { id: 'bank', name: 'Checks cashed' },
  { id: 'casino', name: 'Card room' },
  { id: 'storage', name: 'Storage yard' },
];
