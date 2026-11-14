import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { catchError, of, throwError } from 'rxjs';
import { actionState } from '../../core/actions/action-state';
import { toApiError } from '../../core/api/api-error';
import {
  BotTier,
  Pawnshop as PawnshopDto,
  PawnshopOffers,
  StockItem,
  Wallet as WalletDto,
} from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { timeLeft } from '../../core/format/time-left';
import { startPolling } from '../../core/polling/poll';
import { clock } from '../../core/time/clock';
import {
  PawnshopState,
  pawnshopPollMs,
  premisesProblem,
  stockPayout,
  upgradeOptions,
  withdrawBlockReason,
} from './pawnshop-rules';

const WALLET_POLL_MS = 5000;

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

  readonly buy = actionState();
  readonly bot = actionState();
  readonly stock = actionState();
  readonly now = clock();
  readonly timeLeft = timeLeft;
  readonly stockPayout = stockPayout;
  readonly withdrawBlockReason = withdrawBlockReason;

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
    if (this.buyProblem() !== null) {
      return;
    }
    this.buy.run(this.http.post('/api/pawnshop', null), () => this.shopPoller.refresh());
  }

  buyBot(tier: BotTier): void {
    this.bot.run(this.http.post('/api/pawnshop/bot', { tierName: tier.name }), () =>
      this.shopPoller.refresh(),
    );
  }

  withdraw(item: StockItem): void {
    if (withdrawBlockReason(item, this.now()) !== null) {
      return;
    }
    this.stock.run(
      this.http.post(`/api/pawnshop/stock/${item.publicStockItemId}/withdraw`, null),
      () => {
        this.stock.notice.set('The item reaches your inventory in a few seconds');
        this.shopPoller.refresh();
      },
    );
  }

  constructor() {
    this.http.get<PawnshopOffers>('/api/pawnshop/offers').subscribe({
      next: (catalog) => this.offers.set(catalog),
      error: (err: unknown) => this.offersError.set(toApiError(err).message),
    });
  }
}
