import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, input, output } from '@angular/core';
import { actionState } from '../../core/actions/action-state';
import { StockItem } from '../../core/api/models';
import { timeLeft } from '../../core/format/time-left';
import { clock } from '../../core/time/clock';
import { stockPayout, withdrawBlockReason } from './pawnshop-rules';

@Component({
  selector: 'app-stock-section',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './stock-section.html',
})
export class StockSection {
  private readonly http = inject(HttpClient);

  readonly stock = input.required<readonly StockItem[]>();
  readonly changed = output<void>();

  readonly withdrawals = actionState();
  readonly now = clock();
  readonly timeLeft = timeLeft;
  readonly stockPayout = stockPayout;
  readonly withdrawBlockReason = withdrawBlockReason;

  withdraw(item: StockItem): void {
    if (withdrawBlockReason(item, this.now()) !== null) {
      return;
    }
    this.withdrawals.run(
      this.http.post(`/api/pawnshop/stock/${item.publicStockItemId}/withdraw`, null),
      () => {
        this.withdrawals.notice.set('The item reaches your inventory in a few seconds');
        this.changed.emit();
      },
    );
  }
}
