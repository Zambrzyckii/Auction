import { DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
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

  readonly selection = signal<readonly string[]>([]);
  readonly selectedItems = computed(() => {
    const items = this.poller.value() ?? [];
    return items.filter((i) => this.selection().includes(i.publicItemId));
  });
  readonly canCraft = computed(() => {
    const items = this.selectedItems();
    
    if (items.length !== 3) return false;
    if (!(items[0].rarity === items[1].rarity && items[0].rarity === items[2].rarity)) return false;
    if (!(items.every((i) => i.status === 'Available' && i.rarity !== 'Legendary'))) return false;
    
    return true;
  });

  toggle(id: string): void {
    this.selection.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  craft(): void {
    this.http
      .post<{ publicItemId: string }>('/api/inventory/craft', { ingredientsIds: this.selection() })
      .subscribe({
        next: () => {
          this.selection.set([]);
          this.notice.set('Crafted. The new item appears in the list shortly.');
        },
        error: (err: unknown) => this.notice.set(toApiError(err).message),
      });
  }

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
