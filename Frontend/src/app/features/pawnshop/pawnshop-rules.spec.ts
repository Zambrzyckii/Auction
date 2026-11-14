import {
  BotTier,
  Pawnshop as PawnshopDto,
  PawnshopOffers,
  StockItem,
  Wallet,
} from '../../core/api/models';
import {
  pawnshopPollMs,
  premisesProblem,
  stockPayout,
  upgradeOptions,
  withdrawBlockReason,
} from './pawnshop-rules';

function offers(overrides: Partial<PawnshopOffers>): PawnshopOffers {
  return {
    premisesPrice: 100_000,
    premisesRequiredTurnover: 1_000_000,
    stockSellDelay: '00:05:00',
    botTiers: [
      {
        name: 'Pawn Clerk',
        rarity: 'Common',
        price: 50_000,
        spawnInterval: '00:00:30',
        payoutRate: 0.5,
      },
      {
        name: 'Appraiser',
        rarity: 'Rare',
        price: 300_000,
        spawnInterval: '00:01:00',
        payoutRate: 0.5,
      },
    ],
    ...overrides,
  };
}

function shop(overrides: Partial<PawnshopDto>): PawnshopDto {
  return {
    publicPawnshopId: 'shop-1',
    status: 'Active',
    requestedOn: '2026-11-14T10:00:00Z',
    activatedOn: '2026-11-14T10:00:10Z',
    rejectionReason: null,
    botTierName: null,
    botRarity: null,
    botSpawnInterval: null,
    botPayoutRate: null,
    botPurchasedOn: null,
    nextSpawnOn: null,
    pendingBotTierName: null,
    stock: [],
    ...overrides,
  };
}

function wallet(overrides: Partial<Wallet>): Wallet {
  return { availableFunds: 200_000, lockedFunds: 0, lifetimeTurnover: 1_200_000, ...overrides };
}

function stockItem(overrides: Partial<StockItem>): StockItem {
  return {
    publicStockItemId: 'stock-1',
    name: 'Rusty Kettle',
    rarity: 'Common',
    price: 101,
    payoutRate: 0.5,
    status: 'InStock',
    spawnedOn: '2026-11-14T10:00:00Z',
    sellAfter: new Date(Date.now() + 120_000).toISOString(),
    resolvedOn: null,
    payoutAmount: null,
    ...overrides,
  };
}

describe('pawnshopPollMs', () => {
  it('polls fast while a payment or a bot purchase is pending', () => {
    expect(pawnshopPollMs(shop({ status: 'PendingPayment' }))).toBe(2000);
    expect(pawnshopPollMs(shop({ pendingBotTierName: 'Appraiser' }))).toBe(2000);
  });

  it('polls slow otherwise', () => {
    expect(pawnshopPollMs(null)).toBe(5000);
    expect(pawnshopPollMs('none')).toBe(5000);
    expect(pawnshopPollMs(shop({}))).toBe(5000);
    expect(pawnshopPollMs(shop({ status: 'Rejected' }))).toBe(5000);
  });
});

describe('premisesProblem', () => {
  it('allows the purchase with the turnover and the funds in place', () => {
    expect(premisesProblem(offers({}), wallet({}))).toBeNull();
  });

  it('blocks a turnover below the gate and names both numbers', () => {
    expect(premisesProblem(offers({}), wallet({ lifetimeTurnover: 0 }))).toBe(
      'Needs lifetime turnover 1000000, you have 0',
    );
  });

  it('blocks missing funds with the wallet text', () => {
    expect(premisesProblem(offers({}), wallet({ availableFunds: 99_999 }))).toBe(
      'Not enough funds on account',
    );
  });
});

describe('upgradeOptions', () => {
  const TIERS: readonly BotTier[] = [
    {
      name: 'Pawn Clerk',
      rarity: 'Common',
      price: 50_000,
      spawnInterval: '00:00:30',
      payoutRate: 0.5,
    },
    {
      name: 'Appraiser',
      rarity: 'Rare',
      price: 300_000,
      spawnInterval: '00:01:00',
      payoutRate: 0.5,
    },
    {
      name: 'Dealer',
      rarity: 'Epic',
      price: 1_500_000,
      spawnInterval: '00:02:00',
      payoutRate: 0.5,
    },
  ];

  it('offers every affordable tier to an active shop without a bot', () => {
    const names = upgradeOptions(TIERS, shop({}), wallet({ availableFunds: 400_000 })).map(
      (tier) => tier.name,
    );
    expect(names).toEqual(['Pawn Clerk', 'Appraiser']);
  });

  it('offers only strictly higher rarities, with skipping allowed', () => {
    const current = shop({ botTierName: 'Pawn Clerk', botRarity: 'Common' });
    const names = upgradeOptions(TIERS, current, wallet({ availableFunds: 2_000_000 })).map(
      (tier) => tier.name,
    );
    expect(names).toEqual(['Appraiser', 'Dealer']);
  });

  it('caps the price at the available funds, not at the rarity', () => {
    const current = shop({ botTierName: 'Pawn Clerk', botRarity: 'Common' });
    expect(upgradeOptions(TIERS, current, wallet({ availableFunds: 299_999 }))).toEqual([]);
  });

  it('offers nothing while a purchase is in flight or the shop is not active', () => {
    const funds = wallet({ availableFunds: 2_000_000 });
    expect(upgradeOptions(TIERS, shop({ pendingBotTierName: 'Appraiser' }), funds)).toEqual([]);
    expect(upgradeOptions(TIERS, shop({ status: 'PendingPayment' }), funds)).toEqual([]);
    expect(upgradeOptions(TIERS, 'none', funds)).toEqual([]);
  });
});

describe('stockPayout', () => {
  it('rounds the price times the payout rate to two decimals', () => {
    expect(stockPayout(stockItem({ price: 101, payoutRate: 0.5 }))).toBe(50.5);
    expect(stockPayout(stockItem({ price: 33.33, payoutRate: 0.5 }))).toBe(16.67);
  });
});

describe('withdrawBlockReason', () => {
  const soon = Date.parse('2026-11-14T12:00:00Z');

  it('allows a withdrawal well before the sale', () => {
    const item = stockItem({ sellAfter: new Date(soon + 60_000).toISOString() });
    expect(withdrawBlockReason(item, soon)).toBeNull();
  });

  it('blocks an item that already left the stock with the server text', () => {
    const gone = new Date(soon + 60_000).toISOString();
    for (const status of ['Withdrawn', 'Sold'] as const) {
      expect(withdrawBlockReason(stockItem({ status, sellAfter: gone }), soon)).toBe(
        'Stock item is no longer in stock',
      );
    }
  });

  it('blocks the margin before the sale and anything after it', () => {
    const item = stockItem({ sellAfter: new Date(soon + 1000).toISOString() });
    expect(withdrawBlockReason(item, soon)).toBe(
      'The withdrawal window for this stock item has closed',
    );
    const past = stockItem({ sellAfter: new Date(soon - 1).toISOString() });
    expect(withdrawBlockReason(past, soon)).toBe(
      'The withdrawal window for this stock item has closed',
    );
  });
});
