import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { AVATAR_TYPES } from './profile-rules';

@Component({
  selector: 'app-profile-avatar',
  template: `
    @if (objectUrl(); as src) {
      <img class="avatar" [src]="src" alt="Avatar" />
    }
  `,
})
export class ProfileAvatar {
  private readonly http = inject(HttpClient);

  readonly avatarUrl = input<string | null>(null);
  protected readonly objectUrl = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const url = this.avatarUrl();
      this.objectUrl.set(null);
      if (url === null) {
        return;
      }
      const sub = this.http.get(url, { responseType: 'blob' }).subscribe({
        next: (blob) =>
          this.objectUrl.set(AVATAR_TYPES.includes(blob.type) ? URL.createObjectURL(blob) : null),
        error: () => this.objectUrl.set(null),
      });
      onCleanup(() => {
        sub.unsubscribe();
        const current = this.objectUrl();
        if (current !== null) {
          URL.revokeObjectURL(current);
        }
      });
    });
  }
}
