import { WarehouseSummary } from '../../core/api/models';
import { WAREHOUSE_TIERS, warehousePollMs } from './warehouse-rules';

function war(overrides: Partial<WarehouseSummary>): WarehouseSummary {
  return {
    publicWarehouseId: 'war-1',
    tier: 'Small',
    status: 'Open',
    estimateMin: 400,
    estimateMax: 900,
    entryFee: 500,
    currentPrice: 0,
    itemCount: 4,
    players: 0,
    maxPlayers: 5,
    biddingStartsOn: null,
    biddingEndsOn: null,
    ...overrides,
  };
}

describe('WAREHOUSE_TIERS', () => {
  it('keeps each tier entry fee next to its increments', () => {
    expect(WAREHOUSE_TIERS.get('Small')).toEqual({ entryFee: 500, increments: [10, 50, 100] });
    expect(WAREHOUSE_TIERS.get('Large')?.increments).toEqual([100, 250, 500, 1000]);
    expect(WAREHOUSE_TIERS.has('Haunted')).toBe(false);
  });
});

describe('warehousePollMs', () => {
  it('polls fast during the countdown and the bidding', () => {
    expect(warehousePollMs(war({ status: 'Open', biddingStartsOn: '2026-11-14T12:00:00Z' }))).toBe(
      2000,
    );
    expect(warehousePollMs(war({ status: 'Bidding' }))).toBe(2000);
  });

  it('polls slow otherwise', () => {
    expect(warehousePollMs(null)).toBe(5000);
    expect(warehousePollMs(war({}))).toBe(5000);
    expect(warehousePollMs(war({ status: 'Settled' }))).toBe(5000);
  });
});
