import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { actionState } from '../../core/actions/action-state';
import { avatarFileProblem } from './profile-rules';

@Component({
  selector: 'app-avatar-section',
  templateUrl: './avatar-section.html',
})
export class AvatarSection {
  private readonly http = inject(HttpClient);

  readonly avatarUrl = input.required<string | null>();
  readonly changed = output<void>();

  protected readonly avatarFile = signal<File | null>(null);
  readonly avatar = actionState();

  readonly avatarProblem = computed<string | null>(() => {
    const file = this.avatarFile();
    if (file === null) {
      return 'Choose a file.';
    }
    return avatarFileProblem(file);
  });

  onAvatarChange(event: Event): void {
    const picker = event.target as HTMLInputElement;
    this.avatarFile.set(picker.files?.[0] ?? null);
  }

  uploadAvatar(): void {
    const file = this.avatarFile();
    if (file === null || this.avatarProblem() !== null) {
      return;
    }
    const data = new FormData();
    data.append('file', file);
    this.avatar.run(this.http.put('/api/profiles/me/avatar', data), () => {
      this.avatarFile.set(null);
      this.changed.emit();
    });
  }

  deleteAvatar(): void {
    this.avatar.run(this.http.delete('/api/profiles/me/avatar'), () => this.changed.emit());
  }
}
