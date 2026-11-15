import { Component, input } from '@angular/core';

@Component({
  selector: 'app-profile-avatar',
  template: `
    @if (avatarUrl(); as src) {
      <img class="avatar" [src]="src" alt="Avatar" />
    }
  `,
})
export class ProfileAvatar {
  readonly avatarUrl = input<string | null>(null);
}
