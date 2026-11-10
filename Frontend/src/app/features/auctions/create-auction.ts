import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormField,
  form,
  minDateError,
  minError,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { InventoryItem } from '../../core/api/models';

export const MIN_LEAD_MS = 60_000;
export const MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000;

export function endsOnUtc(local: string): string | null {
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const lead = date.getTime() - Date.now();
  if (lead < MIN_LEAD_MS || lead > MAX_LEAD_MS) {
    return null;
  }
  return date.toISOString();
}

@Component({
  selector: 'app-create-auction',
  imports: [FormField],
  templateUrl: './create-auction.html',
})
export class CreateAuction {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal(false);
  protected readonly items = signal<InventoryItem[] | null>(null);

  private readonly model = signal({ itemId: '', startingPrice: 1, endsOn: '' });
  protected readonly createForm = form(this.model, (path) => {
    required(path.itemId);
    validate(path.startingPrice, ({ value }) => (value() > 0 ? undefined : minError(0)));
    required(path.endsOn);
    validate(path.endsOn, ({ value }) =>
      value() === '' || endsOnUtc(value()) !== null ? undefined : minDateError(new Date()),
    );
  });

  constructor() {
    this.http.get<InventoryItem[]>('/api/inventory').subscribe({
      next: (all) => this.items.set(all.filter((i) => i.status === 'Available')),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected async submitForm(): Promise<void> {
    await submit(this.createForm, async () => {
      this.error.set(null);
      this.pending.set(true);
      try {
        const { itemId, startingPrice, endsOn } = this.model();
        const response = await firstValueFrom(
          this.http.post<{ publicAuctionId: string }>('/api/auctions', {
            itemId,
            startingPrice,
            endsOn: endsOnUtc(endsOn),
          }),
        );
        await this.router.navigate(['/auctions', response.publicAuctionId]);
      } catch (err) {
        this.error.set(toApiError(err).message);
      } finally {
        this.pending.set(false);
      }
    });
  }
}
