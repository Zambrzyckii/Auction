import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { ItemTile } from './item-tile';

export interface PreviewItem {
  readonly publicItemId: string;
  readonly name: string;
  readonly rarity: string;
  readonly officialPrice: number;
}

@Component({
  selector: 'app-item-preview',
  templateUrl: './item-preview.html',
  styleUrl: './item-preview.scss',
  imports: [ItemTile, DecimalPipe],
})
export class ItemPreview {
  readonly items = input.required<readonly PreviewItem[]>();
  readonly picked = input.required<string>();

  protected readonly item = computed(
    () => this.items().find((i) => i.publicItemId === this.picked()) ?? null,
  );
}
