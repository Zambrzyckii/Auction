import {
  BotTier,
  Pawnshop as PawnshopDto,
  PawnshopOffers,
  PawnshopRarity,
  StockItem,
  Wallet as WalletDto,
} from '../../core/api/models';

export type PawnshopState = PawnshopDto | 'none';

export function pawnshopPollMs(state: PawnshopState | null): number {
  if (state !== null && state !== 'none') {
    if (state.status === 'PendingPayment' || state.pendingBotTierName !== null) {
      return 2000;
    }
  }
  return 5000;
}

const RARITY_ORDER: readonly PawnshopRarity[] = ['Common', 'Rare', 'Epic', 'Legendary'];

export function stockPayout(item: StockItem): number {
  return Math.round(item.price * item.payoutRate * 100) / 100;
}

export const WITHDRAW_MARGIN_MS = 2000;

export function withdrawBlockReason(item: StockItem, now: number): string | null {
  if (item.status !== 'InStock') {
    return 'Stock item is no longer in stock';
  }
  if (now >= Date.parse(item.sellAfter) - WITHDRAW_MARGIN_MS) {
    return 'The withdrawal window for this stock item has closed';
  }
  return null;
}

export function upgradeOptions(
  tiers: readonly BotTier[],
  shop: PawnshopState,
  wallet: WalletDto,
): readonly BotTier[] {
  if (shop === 'none' || shop.status !== 'Active' || shop.pendingBotTierName !== null) {
    return [];
  }
  const current = shop.botRarity === null ? -1 : RARITY_ORDER.indexOf(shop.botRarity);
  return tiers.filter(
    (tier) => RARITY_ORDER.indexOf(tier.rarity) > current && tier.price <= wallet.availableFunds,
  );
}

export function premisesProblem(offers: PawnshopOffers, wallet: WalletDto): string | null {
  if (wallet.lifetimeTurnover < offers.premisesRequiredTurnover) {
    return `Needs lifetime turnover ${offers.premisesRequiredTurnover}, you have ${wallet.lifetimeTurnover}`;
  }
  if (offers.premisesPrice > wallet.availableFunds) {
    return 'Not enough funds on account';
  }
  return null;
}
