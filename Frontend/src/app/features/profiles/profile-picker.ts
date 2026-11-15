import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, model, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProfileSummary } from '../../core/api/models';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { searchQuery } from './profile-rules';

export const SEARCH_DEBOUNCE_MS = 300;

export interface PickerOption {
  readonly userId: string;
  readonly username: string;
}

let nextListId = 0;

@Component({
  selector: 'app-profile-picker',
  templateUrl: './profile-picker.html',
})
export class ProfilePicker {
  private readonly http = inject(HttpClient);
  private readonly directory = inject(ProfileDirectory);

  readonly seed = input<readonly PickerOption[]>([]);
  readonly value = model<string>('');

  protected readonly listId = `profile-picker-${nextListId++}`;
  private readonly matches = signal<readonly PickerOption[]>([]);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private request: Subscription | null = null;

  readonly options = computed<readonly PickerOption[]>(() => {
    const seen = new Set<string>();
    const merged: PickerOption[] = [];
    for (const option of [...this.seed(), ...this.matches()]) {
      if (!seen.has(option.userId)) {
        seen.add(option.userId);
        merged.push(option);
      }
    }
    return merged;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.value.set(text);
    this.cancel();
    const query = searchQuery(text);
    if (query === null) {
      this.matches.set([]);
      return;
    }
    this.timer = setTimeout(() => this.search(query), SEARCH_DEBOUNCE_MS);
  }

  private search(query: string): void {
    this.request = this.http
      .get<ProfileSummary[]>('/api/profiles/search', { params: { q: query } })
      .subscribe({
        next: (rows) => {
          for (const row of rows) {
            this.directory.remember(row.userId, row.username);
          }
          this.matches.set(rows);
        },
        error: () => this.matches.set([]),
      });
  }

  private cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.request?.unsubscribe();
    this.request = null;
  }
}
