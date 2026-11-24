import { describe, expect, it } from 'vitest';
import type { PawnItem, PawnShop, PawnStep, PawnTier } from './pawnshop-watch';
import {
  STAGED_KINDS,
  boardRows,
  countdown,
  dustLevel,
  ledRows,
  shopSteps,
  tierRarity,
} from './pawnshop-watch';

const NOW = Date.parse('2026-11-24T12:00:00Z');

function shop(over: Partial<PawnShop> = {}): PawnShop {
  return {
    publicPawnshopId: 's1',
    status: 'Active',
    rejectionReason: null,
    botTierName: null,
    botRarity: null,
    nextSpawnOn: null,
    pendingBotTierName: null,
    stock: [],
    ...over,
  };
}

function item(id: string, over: Partial<PawnItem> = {}): PawnItem {
  return {
    publicStockItemId: id,
    rarity: 'Common',
    price: 42,
    status: 'InStock',
    spawnedOn: '2026-11-24T11:55:00Z',
    sellAfter: '2026-11-24T12:00:00Z',
    payoutAmount: null,
    ...over,
  };
}

const TIERS: readonly PawnTier[] = [
  { name: 'Pawn Clerk', rarity: 'Common', price: 50000 },
  { name: 'Appraiser', rarity: 'Rare', price: 300000 },
  { name: 'Dealer', rarity: 'Epic', price: 1500000 },
  { name: 'Magnate', rarity: 'Legendary', price: 5000000 },
];

function kinds(steps: readonly PawnStep[]): string[] {
  return steps.map((s) => s.kind);
}

function stockOf(step: PawnStep): readonly PawnItem[] {
  if (step.shop === 'none') throw new Error('no shop');
  return step.shop.stock;
}

function paying(after: PawnShop): PawnShop {
  return {
    ...after,
    status: 'PendingPayment',
    rejectionReason: null,
    botTierName: null,
    botRarity: null,
    nextSpawnOn: null,
    pendingBotTierName: null,
    stock: [],
  };
}

describe('shopSteps premises', () => {
  it('gives nothing from none to none', () => {
    expect(shopSteps('none', 'none')).toEqual([]);
  });

  it('gives paying from none to PendingPayment', () => {
    const after = shop({ status: 'PendingPayment' });
    expect(shopSteps('none', after)).toEqual([{ kind: 'paying', shop: after }]);
  });

  it('gives paying then opened from none to Active', () => {
    const after = shop({ botTierName: 'Pawn Clerk', botRarity: 'Common', stock: [item('a')] });
    const steps = shopSteps('none', after);
    expect(kinds(steps)).toEqual(['paying', 'opened']);
    expect(steps[0].shop).toEqual(paying(after));
    expect(steps[1].shop).toBe(after);
  });

  it('gives paying then rejected from none to Rejected', () => {
    const after = shop({ status: 'Rejected', rejectionReason: 'No funds' });
    const steps = shopSteps('none', after);
    expect(kinds(steps)).toEqual(['paying', 'rejected']);
    expect(steps[0].shop).toEqual(paying(after));
    expect(steps[1].shop).toBe(after);
  });

  it('gives opened from PendingPayment to Active on the same id', () => {
    const after = shop();
    const steps = shopSteps(shop({ status: 'PendingPayment' }), after);
    expect(steps).toEqual([{ kind: 'opened', shop: after }]);
    expect(steps[0].shop).toBe(after);
  });

  it('gives rejected from PendingPayment to Rejected on the same id', () => {
    const after = shop({ status: 'Rejected', rejectionReason: 'No funds' });
    const steps = shopSteps(shop({ status: 'PendingPayment' }), after);
    expect(steps).toEqual([{ kind: 'rejected', shop: after }]);
  });

  it('gives paying from Rejected to a PendingPayment retry on a new id', () => {
    const after = shop({ publicPawnshopId: 's2', status: 'PendingPayment' });
    const steps = shopSteps(shop({ publicPawnshopId: 's1', status: 'Rejected' }), after);
    expect(steps).toEqual([{ kind: 'paying', shop: after }]);
  });

  it('gives paying then rejected from Rejected to another Rejected shop', () => {
    const before = shop({
      publicPawnshopId: 's1',
      status: 'Rejected',
      rejectionReason: 'No funds',
    });
    const after = shop({ publicPawnshopId: 's2', status: 'Rejected', rejectionReason: 'No funds' });
    expect(kinds(shopSteps(before, after))).toEqual(['paying', 'rejected']);
  });

  it('gives paying then opened from another shop to Active', () => {
    const before = shop({ publicPawnshopId: 's1', status: 'Rejected' });
    const after = shop({ publicPawnshopId: 's2' });
    expect(kinds(shopSteps(before, after))).toEqual(['paying', 'opened']);
  });

  it('gives nothing for the same Rejected shop with the same reason', () => {
    const read = shop({ status: 'Rejected', rejectionReason: 'No funds' });
    expect(shopSteps(read, shop({ status: 'Rejected', rejectionReason: 'No funds' }))).toEqual([]);
  });

  it('gives nothing for the same PendingPayment shop', () => {
    expect(
      shopSteps(shop({ status: 'PendingPayment' }), shop({ status: 'PendingPayment' })),
    ).toEqual([]);
  });

  it('gives snap from Active to PendingPayment on the same id', () => {
    const after = shop({ status: 'PendingPayment' });
    expect(shopSteps(shop(), after)).toEqual([{ kind: 'snap', shop: after }]);
  });

  it('gives snap from Active to none', () => {
    expect(shopSteps(shop(), 'none')).toEqual([{ kind: 'snap', shop: 'none' }]);
  });
});

describe('shopSteps bots', () => {
  it('gives hiring when a purchase becomes pending', () => {
    const after = shop({ pendingBotTierName: 'Pawn Clerk' });
    const steps = shopSteps(shop(), after);
    expect(steps).toEqual([{ kind: 'hiring', tier: 'Pawn Clerk', shop: after }]);
    expect(steps[0].shop).toBe(after);
  });

  it('gives workerHired with both rarities when a pending purchase resolves to a new bot', () => {
    const before = shop({
      botTierName: 'Pawn Clerk',
      botRarity: 'Common',
      pendingBotTierName: 'Appraiser',
    });
    const after = shop({ botTierName: 'Appraiser', botRarity: 'Rare' });
    expect(shopSteps(before, after)).toEqual([
      { kind: 'workerHired', from: 'Common', to: 'Rare', shop: after },
    ]);
  });

  it('gives workerRejected when a pending purchase resolves with the bot unchanged', () => {
    const before = shop({
      botTierName: 'Pawn Clerk',
      botRarity: 'Common',
      pendingBotTierName: 'Appraiser',
    });
    const after = shop({
      botTierName: 'Pawn Clerk',
      botRarity: 'Common',
      rejectionReason: 'Not enough funds on account',
    });
    expect(shopSteps(before, after)).toEqual([
      {
        kind: 'workerRejected',
        tier: 'Appraiser',
        reason: 'Not enough funds on account',
        shop: after,
      },
    ]);
  });

  it('gives nothing when a reason persists across two Active reads with no pending purchase', () => {
    const before = shop({ rejectionReason: 'Payment timed out' });
    const after = shop({ rejectionReason: 'Payment timed out' });
    expect(shopSteps(before, after)).toEqual([]);
  });

  it('gives workerRejected with a null tier when a new reason appears with no pending seen', () => {
    const after = shop({ rejectionReason: 'Payment timed out' });
    expect(shopSteps(shop(), after)).toEqual([
      { kind: 'workerRejected', tier: null, reason: 'Payment timed out', shop: after },
    ]);
  });

  it('gives hiring then workerHired when the bot changes with no pending seen', () => {
    const after = shop({ botTierName: 'Pawn Clerk', botRarity: 'Common' });
    const steps = shopSteps(shop(), after);
    expect(steps).toEqual([
      { kind: 'hiring', tier: 'Pawn Clerk', shop: expect.anything() },
      { kind: 'workerHired', from: null, to: 'Common', shop: after },
    ]);
    expect(steps[1].shop).toBe(after);
  });

  it('gives workerHired then hiring when one purchase resolves and the next is pending', () => {
    const before = shop({ pendingBotTierName: 'Pawn Clerk' });
    const after = shop({
      botTierName: 'Pawn Clerk',
      botRarity: 'Common',
      pendingBotTierName: 'Appraiser',
    });
    const steps = shopSteps(before, after);
    expect(steps).toEqual([
      { kind: 'workerHired', from: null, to: 'Common', shop: expect.anything() },
      { kind: 'hiring', tier: 'Appraiser', shop: after },
    ]);
    expect(steps[1].shop).toBe(after);
  });

  it('gives nothing while the same purchase stays pending', () => {
    const read = () => shop({ pendingBotTierName: 'Pawn Clerk' });
    expect(shopSteps(read(), read())).toEqual([]);
  });
});

describe('shopSteps stock', () => {
  it('gives itemDelivered for one new InStock item', () => {
    const a = item('a');
    const after = shop({ stock: [a] });
    const steps = shopSteps(shop(), after);
    expect(steps).toEqual([{ kind: 'itemDelivered', items: [a], shop: after }]);
    expect(steps[0].shop).toBe(after);
  });

  it('gives one itemDelivered with every new item in API order', () => {
    const items = [item('c'), item('a'), item('b')];
    const steps = shopSteps(shop(), shop({ stock: items }));
    expect(steps).toHaveLength(1);
    const step = steps[0];
    if (step.kind !== 'itemDelivered') throw new Error('wrong kind');
    expect(step.items.map((i) => i.publicStockItemId)).toEqual(['c', 'a', 'b']);
  });

  it('sums the payouts of sold items', () => {
    const before = shop({ stock: [item('a'), item('b')] });
    const soldA = item('a', { status: 'Sold', payoutAmount: 21 });
    const soldB = item('b', { status: 'Sold', payoutAmount: 34.5 });
    const after = shop({ stock: [soldA, soldB] });
    const steps = shopSteps(before, after);
    expect(steps).toEqual([{ kind: 'itemSold', items: [soldA, soldB], payout: 55.5, shop: after }]);
  });

  it('gives itemWithdrawn for a withdrawn item', () => {
    const before = shop({ stock: [item('a')] });
    const gone = item('a', { status: 'Withdrawn' });
    const after = shop({ stock: [gone] });
    expect(shopSteps(before, after)).toEqual([
      { kind: 'itemWithdrawn', items: [gone], shop: after },
    ]);
  });

  it('gives nothing for a new item that is already Sold', () => {
    const after = shop({ stock: [item('a', { status: 'Sold', payoutAmount: 21 })] });
    expect(shopSteps(shop(), after)).toEqual([]);
  });

  it('gives nothing when a resolved item disappears from the list', () => {
    const before = shop({ stock: [item('a', { status: 'Sold', payoutAmount: 21 })] });
    expect(shopSteps(before, shop())).toEqual([]);
  });

  it('gives nothing for a resolved item that was already resolved before', () => {
    const resolved = () => shop({ stock: [item('a', { status: 'Sold', payoutAmount: 21 })] });
    expect(shopSteps(resolved(), resolved())).toEqual([]);
  });

  it('shows the sale on the before stock and then the delivery on the read', () => {
    const kept = item('k');
    const before = shop({ stock: [item('a'), kept] });
    const soldA = item('a', { status: 'Sold', payoutAmount: 21 });
    const fresh = item('n');
    const after = shop({ stock: [soldA, kept, fresh] });
    const steps = shopSteps(before, after);
    expect(kinds(steps)).toEqual(['itemSold', 'itemDelivered']);
    expect(steps[0].shop).toEqual({ ...after, stock: [soldA, kept] });
    expect(steps[1].shop).toBe(after);
  });

  it('adds the delivered items before a later withdrawal', () => {
    const before = shop({ stock: [item('a'), item('b')] });
    const soldA = item('a', { status: 'Sold', payoutAmount: 21 });
    const gone = item('b', { status: 'Withdrawn' });
    const fresh = item('n');
    const after = shop({ stock: [soldA, gone, fresh] });
    const steps = shopSteps(before, after);
    expect(kinds(steps)).toEqual(['itemSold', 'itemDelivered', 'itemWithdrawn']);
    expect(stockOf(steps[0]).map((i) => i.status)).toEqual(['Sold', 'InStock']);
    expect(stockOf(steps[1]).map((i) => i.publicStockItemId)).toEqual(['a', 'b', 'n']);
    expect(steps[2].shop).toBe(after);
  });

  it('carries the before stock on a bot step that is followed by a delivery', () => {
    const before = shop({ stock: [item('a')] });
    const after = shop({
      botTierName: 'Pawn Clerk',
      botRarity: 'Common',
      stock: [item('a'), item('n')],
    });
    const steps = shopSteps(before, after);
    expect(kinds(steps)).toEqual(['hiring', 'workerHired', 'itemDelivered']);
    expect(steps[0].shop).toEqual({ ...after, stock: before.stock });
    expect(stockOf(steps[1])).toBe(before.stock);
    expect(steps[2].shop).toBe(after);
  });

  it('carries the after shop by identity on the last step of every transition', () => {
    const cases: [ReturnType<typeof shop> | 'none', ReturnType<typeof shop>][] = [
      ['none', shop()],
      ['none', shop({ status: 'Rejected', rejectionReason: 'x' })],
      [shop({ status: 'PendingPayment' }), shop()],
      [shop(), shop({ pendingBotTierName: 'Dealer', stock: [item('a')] })],
      [
        shop({ stock: [item('a')] }),
        shop({ stock: [item('a', { status: 'Sold', payoutAmount: 1 }), item('b')] }),
      ],
    ];
    for (const [before, after] of cases) {
      const steps = shopSteps(before, after);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[steps.length - 1].shop).toBe(after);
    }
  });
});

describe('STAGED_KINDS', () => {
  it('holds exactly the four staged kinds', () => {
    expect([...STAGED_KINDS].sort()).toEqual([
      'opened',
      'rejected',
      'workerHired',
      'workerRejected',
    ]);
  });
});

describe('countdown', () => {
  it('reads minutes and seconds under an hour', () => {
    expect(countdown('2026-11-24T12:00:25Z', NOW)).toBe('0 min 25 s');
  });

  it('reads hours and minutes from one hour on', () => {
    expect(countdown('2026-11-24T13:05:00Z', NOW)).toBe('1 h 5 min');
  });

  it('reads ending at zero and below', () => {
    expect(countdown('2026-11-24T12:00:00Z', NOW)).toBe('ending...');
    expect(countdown('2026-11-24T11:00:00Z', NOW)).toBe('ending...');
  });

  it('reads empty for a date that does not parse', () => {
    expect(countdown('soon', NOW)).toBe('');
  });
});

describe('ledRows', () => {
  it('gives the next delivery with its countdown', () => {
    const s = shop({ botTierName: 'Pawn Clerk', nextSpawnOn: '2026-11-24T12:00:25Z' });
    expect(ledRows(s, NOW)).toEqual(['NEXT DELIVERY', '0 min 25 s']);
  });

  it('gives no deliveries when there is no bot', () => {
    expect(ledRows(shop(), NOW)).toEqual(['NO DELIVERIES', 'NO CREW YET']);
  });

  it('gives null for a bot without a next spawn', () => {
    expect(ledRows(shop({ botTierName: 'Pawn Clerk', botRarity: 'Common' }), NOW)).toBeNull();
  });
});

describe('boardRows', () => {
  it('marks the working tier on and the affordable upgrades live', () => {
    const rows = boardRows(TIERS, [TIERS[1]], 'Pawn Clerk');
    expect(rows.map((r) => [r.name, r.on, r.live])).toEqual([
      ['Pawn Clerk', true, false],
      ['Appraiser', false, true],
      ['Dealer', false, false],
      ['Magnate', false, false],
    ]);
    expect(rows[1]).toMatchObject({ rarity: 'Rare', price: 300000 });
  });

  it('keeps only the first four tiers', () => {
    const five = [...TIERS, { name: 'Tycoon', rarity: 'Mythic', price: 9 }];
    expect(boardRows(five, [], null)).toHaveLength(4);
  });
});

describe('dustLevel', () => {
  const span = item('a', { spawnedOn: '2026-11-24T11:55:00Z', sellAfter: '2026-11-24T12:00:00Z' });
  const at = (s: number) => Date.parse('2026-11-24T11:55:00Z') + s * 1000;

  it('is 0 at spawn', () => {
    expect(dustLevel(span, at(0))).toBe(0);
  });

  it('is 2 halfway', () => {
    expect(dustLevel(span, at(150))).toBe(2);
  });

  it('is 4 at and after sellAfter', () => {
    expect(dustLevel(span, at(300))).toBe(4);
    expect(dustLevel(span, at(900))).toBe(4);
  });

  it('is 0 for dates that do not parse', () => {
    expect(dustLevel(item('a', { spawnedOn: 'x' }), NOW)).toBe(0);
    expect(dustLevel(item('a', { sellAfter: 'x' }), NOW)).toBe(0);
  });
});

describe('tierRarity', () => {
  it('finds the rarity of a tier by name', () => {
    expect(tierRarity(TIERS, 'Dealer')).toBe('Epic');
  });

  it('gives null for an unknown name', () => {
    expect(tierRarity(TIERS, 'Janitor')).toBeNull();
  });

  it('mirrors the rarities of the backend bot tiers', () => {
    expect(TIERS.map((t) => tierRarity(TIERS, t.name))).toEqual([
      'Common',
      'Rare',
      'Epic',
      'Legendary',
    ]);
  });
});
