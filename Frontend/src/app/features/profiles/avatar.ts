import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';

export const AVATAR_MAX_BYTES = 2_097_152;

export const AVATAR_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

export function avatarFileProblem(file: File): string | null {
  if (file.size > AVATAR_MAX_BYTES)
    return `Avatar file exceeds the limit of ${AVATAR_MAX_BYTES} bytes`;
  if (file.size === 0) return 'Avatar file is empty';
  if (!AVATAR_TYPES.some((a) => file.type === a))
    return 'Avatar file must be a jpeg, png or webp image';
  return null;
}

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
        next: (blob) => this.objectUrl.set(URL.createObjectURL(blob)),
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
