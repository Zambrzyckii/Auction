import { WarehouseSummary } from '../../core/api/models';

export interface WarehouseTier {
  readonly entryFee: number;
  readonly increments: readonly number[];
}

export const WAREHOUSE_TIERS: ReadonlyMap<string, WarehouseTier> = new Map([
  ['Small', { entryFee: 500, increments: [10, 50, 100] }],
  ['Medium', { entryFee: 2500, increments: [50, 100, 250, 500] }],
  ['Large', { entryFee: 15_000, increments: [100, 250, 500, 1000] }],
]);

export const MIN_PLAYERS = 3;

export function warehousePollMs(war: Pick<WarehouseSummary, 'status' | 'biddingStartsOn'> | null): number {
  if (war === null) {
    return 5000;
  }
  if (war.status === 'Bidding' || (war.status === 'Open' && war.biddingStartsOn !== null)) {
    return 2000;
  }
  return 5000;
}
