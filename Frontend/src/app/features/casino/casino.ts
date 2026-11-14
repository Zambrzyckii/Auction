import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { actionState } from '../../core/actions/action-state';
import { Casino as CasinoDto, Wallet as WalletDto } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { startPolling } from '../../core/polling/poll';
import { casinoPollMs, cashOutProblem, purchaseNotice, purchaseProblem } from './casino-rules';

const WALLET_POLL_MS = 5000;

@Component({
  selector: 'app-casino',
  imports: [DecimalPipe, FormField, RouterLink],
  templateUrl: './casino.html',
})
export class Casino {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);

  readonly casinoPoller = startPolling(
    () => this.http.get<CasinoDto>('/api/casino'),
    (latest) => casinoPollMs(latest),
  );

  readonly walletPoller = startPolling(
    () => this.http.get<WalletDto>(`/api/wallets/${this.session.userId()}`),
    WALLET_POLL_MS,
  );

  readonly notice = computed(() => purchaseNotice(this.casinoPoller.value()?.latestPurchase ?? null));

  private readonly buyModel = signal({ amount: 0 });
  protected readonly buyForm = form(this.buyModel);
  readonly purchase = actionState();

  readonly buyProblem = computed<string | null>(() => {
    const casino = this.casinoPoller.value();
    const funds = this.walletPoller.value();
    if (casino === null || funds === null) {
      return 'Loading…';
    }
    return purchaseProblem(this.buyModel().amount, funds, casino);
  });

  buy(): void {
    if (this.buyProblem() !== null) {
      return;
    }
    const { amount } = this.buyModel();
    this.purchase.run(this.http.post('/api/casino/chips/purchases', { amount }), () =>
      this.casinoPoller.refresh(),
    );
  }

  private readonly cashOutModel = signal({ amount: 0 });
  protected readonly cashOutForm = form(this.cashOutModel);
  readonly cashout = actionState();

  readonly cashOutFormProblem = computed<string | null>(() => {
    const casino = this.casinoPoller.value();
    if (casino === null) {
      return 'Loading…';
    }
    return cashOutProblem(this.cashOutModel().amount, casino);
  });

  cashOut(): void {
    if (this.cashOutFormProblem() !== null) {
      return;
    }
    const { amount } = this.cashOutModel();
    this.cashout.run(this.http.post('/api/casino/chips/cashouts', { amount }), () => {
      this.cashout.notice.set('Funds reach your wallet in a few seconds');
      this.casinoPoller.refresh();
    });
  }
}
