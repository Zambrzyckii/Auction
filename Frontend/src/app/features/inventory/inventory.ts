import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { toApiError } from '../../core/api/api-error';
import { InventoryItem } from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';

const POLL_MS = 5000;

@Component({
  selector: 'app-inventory',
  imports: [DecimalPipe],
  templateUrl: './inventory.html',
})
export class Inventory {
  private readonly http = inject(HttpClient);

  readonly poller = startPolling(() => this.http.get<InventoryItem[]>('/api/inventory'), POLL_MS);
  readonly notice = signal<string | null>(null);
  readonly sellingId = signal<string | null>(null);

  sell(id: string): void {
    this.sellingId.set(id);
    this.http.post(`/api/inventory/${id}/sell`, null).subscribe({
      next: () => {
        this.notice.set('Sold to the shop. The funds arrive in a few seconds.');
        this.sellingId.set(null);
      },
      error: (err: unknown) => {
        this.notice.set(toApiError(err).message);
        this.sellingId.set(null);
      },
    });
  }
}
