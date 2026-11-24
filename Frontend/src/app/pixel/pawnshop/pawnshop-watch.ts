export interface PawnItem {
  readonly publicStockItemId: string;
  readonly rarity: string;
  readonly price: number;
  readonly status: string;
  readonly spawnedOn: string;
  readonly sellAfter: string;
  readonly payoutAmount: number | null;
}
export interface PawnShop {
  readonly publicPawnshopId: string;
  readonly status: string;
  readonly rejectionReason: string | null;
  readonly botTierName: string | null;
  readonly botRarity: string | null;
  readonly nextSpawnOn: string | null;
  readonly pendingBotTierName: string | null;
  readonly stock: readonly PawnItem[];
}
export type PawnState = PawnShop | 'none';
export interface PawnTier {
  readonly name: string;
  readonly rarity: string;
  readonly price: number;
}
export interface PawnOffers {
  readonly botTiers: readonly PawnTier[];
}
export type PawnStep =
  | { readonly kind: 'snap'; readonly shop: PawnState }
  | { readonly kind: 'paying' | 'opened' | 'rejected'; readonly shop: PawnShop }
  | { readonly kind: 'hiring'; readonly tier: string; readonly shop: PawnShop }
  | {
      readonly kind: 'workerHired';
      readonly from: string | null;
      readonly to: string | null;
      readonly shop: PawnShop;
    }
  | {
      readonly kind: 'workerRejected';
      readonly tier: string | null;
      readonly reason: string | null;
      readonly shop: PawnShop;
    }
  | {
      readonly kind: 'itemDelivered' | 'itemWithdrawn';
      readonly items: readonly PawnItem[];
      readonly shop: PawnShop;
    }
  | {
      readonly kind: 'itemSold';
      readonly items: readonly PawnItem[];
      readonly payout: number;
      readonly shop: PawnShop;
    };

export const STAGED_KINDS: ReadonlySet<PawnStep['kind']> = new Set<PawnStep['kind']>([
  'opened',
  'rejected',
  'workerHired',
  'workerRejected',
]);

export interface BoardRow {
  readonly name: string;
  readonly rarity: string;
  readonly price: number;
  readonly on: boolean;
  readonly live: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function progressive(after: PawnShop, stock: readonly PawnItem[]): PawnShop {
  return { ...after, stock };
}

function pendingShop(after: PawnShop): PawnShop {
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

function premisesSteps(before: PawnState, after: PawnShop): readonly PawnStep[] {
  const fresh = before === 'none' || before.publicPawnshopId !== after.publicPawnshopId;
  if (after.status === 'PendingPayment') {
    return fresh ? [{ kind: 'paying', shop: after }] : sameStatus(before, after);
  }
  if (after.status === 'Active') {
    if (fresh) {
      return [
        { kind: 'paying', shop: pendingShop(after) },
        { kind: 'opened', shop: after },
      ];
    }
    return before.status === 'PendingPayment'
      ? [{ kind: 'opened', shop: after }]
      : [{ kind: 'snap', shop: after }];
  }
  if (after.status === 'Rejected') {
    if (fresh) {
      return [
        { kind: 'paying', shop: pendingShop(after) },
        { kind: 'rejected', shop: after },
      ];
    }
    if (before.status === 'PendingPayment') {
      return [{ kind: 'rejected', shop: after }];
    }
    return sameStatus(before, after);
  }
  return [{ kind: 'snap', shop: after }];
}

function sameStatus(before: PawnShop, after: PawnShop): readonly PawnStep[] {
  return before.status === after.status ? [] : [{ kind: 'snap', shop: after }];
}

function pendingOf(before: PawnShop, after: PawnShop, shop: PawnShop): readonly PawnStep[] {
  const bp = before.pendingBotTierName;
  const hired = after.botTierName !== before.botTierName;
  const hire: PawnStep = { kind: 'workerHired', from: before.botRarity, to: after.botRarity, shop };
  if (bp !== null) {
    if (after.pendingBotTierName === bp) {
      return [];
    }
    return [
      hired ? hire : { kind: 'workerRejected', tier: bp, reason: after.rejectionReason, shop },
    ];
  }
  if (hired) {
    const name = after.botTierName;
    return name === null ? [hire] : [{ kind: 'hiring', tier: name, shop }, hire];
  }
  const reason = after.rejectionReason;
  if (reason !== null && reason !== before.rejectionReason) {
    return [{ kind: 'workerRejected', tier: null, reason, shop }];
  }
  return [];
}

function botSteps(before: PawnShop, after: PawnShop): readonly PawnStep[] {
  const shop = progressive(after, before.stock);
  const steps = [...pendingOf(before, after, shop)];
  const ap = after.pendingBotTierName;
  if (ap !== null && ap !== before.pendingBotTierName) {
    steps.push({ kind: 'hiring', tier: ap, shop });
  }
  return steps;
}

function stockSteps(before: PawnShop, after: PawnShop): readonly PawnStep[] {
  const inStock = new Set(
    before.stock.filter((i) => i.status === 'InStock').map((i) => i.publicStockItemId),
  );
  const known = new Set(before.stock.map((i) => i.publicStockItemId));
  const sold = after.stock.filter((i) => i.status === 'Sold' && inStock.has(i.publicStockItemId));
  const delivered = after.stock.filter(
    (i) => i.status === 'InStock' && !known.has(i.publicStockItemId),
  );
  const withdrawn = after.stock.filter(
    (i) => i.status === 'Withdrawn' && inStock.has(i.publicStockItemId),
  );
  const steps: PawnStep[] = [];
  let stock = before.stock;
  if (sold.length > 0) {
    const replaced = new Map(sold.map((i) => [i.publicStockItemId, i]));
    stock = stock.map((i) => replaced.get(i.publicStockItemId) ?? i);
    const payout = sold.reduce((sum, i) => sum + (i.payoutAmount ?? 0), 0);
    steps.push({ kind: 'itemSold', items: sold, payout, shop: progressive(after, stock) });
  }
  if (delivered.length > 0) {
    stock = [...stock, ...delivered];
    steps.push({ kind: 'itemDelivered', items: delivered, shop: progressive(after, stock) });
  }
  if (withdrawn.length > 0) {
    steps.push({ kind: 'itemWithdrawn', items: withdrawn, shop: after });
  }
  return steps;
}

export function shopSteps(before: PawnState, after: PawnState): readonly PawnStep[] {
  if (after === 'none') {
    return before === 'none' ? [] : [{ kind: 'snap', shop: after }];
  }
  const sameShop = before !== 'none' && before.publicPawnshopId === after.publicPawnshopId;
  if (!sameShop || before.status !== 'Active' || after.status !== 'Active') {
    return premisesSteps(before, after);
  }
  const steps = [...botSteps(before, after), ...stockSteps(before, after)];
  const last = steps.pop();
  return last === undefined ? [] : [...steps, { ...last, shop: after }];
}

export function boardRows(
  tiers: readonly PawnTier[],
  upgrades: readonly PawnTier[],
  botTierName: string | null,
): readonly BoardRow[] {
  return tiers.slice(0, 4).map((t) => ({
    name: t.name,
    rarity: t.rarity,
    price: t.price,
    on: t.name === botTierName,
    live: upgrades.some((u) => u.name === t.name),
  }));
}

export function countdown(endsOn: string, now: number): string {
  const ms = new Date(endsOn).getTime() - now;
  if (Number.isNaN(ms)) {
    return '';
  }
  if (ms <= 0) {
    return 'ending...';
  }
  const totalMinutes = Math.floor(ms / 60_000);
  const seconds = Math.floor(ms / 1000) % 60;
  if (totalMinutes >= 60) {
    return `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`;
  }
  return `${totalMinutes} min ${seconds} s`;
}

export function ledRows(shop: PawnShop, now: number): readonly string[] | null {
  if (shop.nextSpawnOn !== null) {
    return ['NEXT DELIVERY', countdown(shop.nextSpawnOn, now)];
  }
  if (shop.botTierName === null) {
    return ['NO DELIVERIES', 'NO CREW YET'];
  }
  return null;
}

export function dustLevel(item: PawnItem, now: number): number {
  const from = new Date(item.spawnedOn).getTime();
  const to = new Date(item.sellAfter).getTime();
  const level = Math.floor(((now - from) / (to - from)) * 5);
  if (Number.isNaN(level)) {
    return 0;
  }
  return clamp(level, 0, 4);
}

export function tierRarity(tiers: readonly PawnTier[], name: string): string | null {
  return tiers.find((t) => t.name === name)?.rarity ?? null;
}
