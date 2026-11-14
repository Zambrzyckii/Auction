import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { catchError, of, throwError } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import {
  BotTier,
  Pawnshop as PawnshopDto,
  PawnshopOffers,
  PawnshopRarity,
  StockItem,
  Wallet as WalletDto,
} from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { clock } from '../../core/time/clock';

const WALLET_POLL_MS = 5000;

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

@Component({
  selector: 'app-pawnshop',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './pawnshop.html',
})
export class Pawnshop {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);

  readonly shopPoller = startPolling<PawnshopState>(
    () =>
      this.http.get<PawnshopDto>('/api/pawnshop').pipe(
        catchError((err: unknown) =>
          toApiError(err).status === 404 ? of('none' as const) : throwError(() => err),
        ),
      ),
    (latest) => pawnshopPollMs(latest),
  );

  readonly walletPoller = startPolling(
    () => this.http.get<WalletDto>(`/api/wallets/${this.session.userId()}`),
    WALLET_POLL_MS,
  );

  readonly offers = signal<PawnshopOffers | null>(null);
  readonly offersError = signal<string | null>(null);

  readonly buyPending = signal(false);
  readonly shopNotice = signal<string | null>(null);
  readonly botPending = signal(false);
  readonly botNotice = signal<string | null>(null);
  readonly now = clock();
  readonly timeLeft = timeLeft;
  readonly stockPayout = stockPayout;
  readonly withdrawBlockReason = withdrawBlockReason;
  readonly withdrawPending = signal(false);
  readonly stockNotice = signal<string | null>(null);

  readonly upgrades = computed<readonly BotTier[]>(() => {
    const catalog = this.offers();
    const state = this.shopPoller.value();
    const funds = this.walletPoller.value();
    if (catalog === null || state === null || funds === null) {
      return [];
    }
    return upgradeOptions(catalog.botTiers, state, funds);
  });

  readonly buyProblem = computed<string | null>(() => {
    const catalog = this.offers();
    const funds = this.walletPoller.value();
    if (catalog === null || funds === null) {
      return 'Loading…';
    }
    return premisesProblem(catalog, funds);
  });

  showsBuy(shop: PawnshopState): boolean {
    return shop === 'none' || shop.status === 'Rejected';
  }

  buyPremises(): void {
    if (this.buyPending() || this.buyProblem() !== null) {
      return;
    }
    this.buyPending.set(true);
    this.shopNotice.set(null);
    this.http.post('/api/pawnshop', null).subscribe({
      next: () => {
        this.buyPending.set(false);
        this.shopNotice.set('Payment pending…');
        this.shopPoller.refresh();
      },
      error: (err: unknown) => {
        this.shopNotice.set(toApiError(err).message);
        this.buyPending.set(false);
      },
    });
  }

  buyBot(tier: BotTier): void {
    if (this.botPending()) {
      return;
    }
    this.botPending.set(true);
    this.botNotice.set(null);
    this.http.post('/api/pawnshop/bot', { tierName: tier.name }).subscribe({
      next: () => {
        this.botPending.set(false);
        this.botNotice.set(`Buying ${tier.name}…`);
        this.shopPoller.refresh();
      },
      error: (err: unknown) => {
        this.botNotice.set(toApiError(err).message);
        this.botPending.set(false);
      },
    });
  }

  withdraw(item: StockItem): void {
    if (this.withdrawPending() || withdrawBlockReason(item, this.now()) !== null) {
      return;
    }
    this.withdrawPending.set(true);
    this.stockNotice.set(null);
    this.http.post(`/api/pawnshop/stock/${item.publicStockItemId}/withdraw`, null).subscribe({
      next: () => {
        this.withdrawPending.set(false);
        this.stockNotice.set('The item reaches your inventory in a few seconds');
        this.shopPoller.refresh();
      },
      error: (err: unknown) => {
        this.stockNotice.set(toApiError(err).message);
        this.withdrawPending.set(false);
      },
    });
  }

  constructor() {
    this.http.get<PawnshopOffers>('/api/pawnshop/offers').subscribe({
      next: (catalog) => this.offers.set(catalog),
      error: (err: unknown) => this.offersError.set(toApiError(err).message),
    });
  }
}
