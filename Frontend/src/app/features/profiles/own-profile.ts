import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { Observable, retry, tap, throwError, timer } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { OwnProfile as OwnProfileDto, SocialLink, SocialPlatform } from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { ProfileAvatar, avatarFileProblem } from './avatar';
import { MAX_SOCIAL_LINKS, SOCIAL_PLATFORMS, socialLinkProblem } from './social-links';

const POLL_MS = 5000;
const PROVISIONING_RETRY_MS = 1500;
const PROVISIONING_WINDOW_MS = 30_000;

@Component({
  selector: 'app-own-profile',
  imports: [DatePipe, FormField, ProfileAvatar],
  templateUrl: './own-profile.html',
})
export class OwnProfile {
  private readonly http = inject(HttpClient);
  private readonly directory = inject(ProfileDirectory);
  private readonly provisioningDeadline = Date.now() + PROVISIONING_WINDOW_MS;

  readonly poller = startPolling(() => this.loadProfile(), POLL_MS);

  readonly privacyPending = signal(false);
  readonly notice = signal<string | null>(null);

  togglePrivacy(): void {
    const profile = this.poller.value();
    if (profile === null) {
      return;
    }
    this.privacyPending.set(true);
    this.notice.set(null);
    this.http.put('/api/profiles/me/privacy', { isPrivate: !profile.isPrivate }).subscribe({
      next: () => {
        this.privacyPending.set(false);
        this.poller.refresh();
      },
      error: (err: unknown) => {
        this.notice.set(toApiError(err).message);
        this.privacyPending.set(false);
      },
    });
  }

  protected readonly avatarFile = signal<File | null>(null);
  readonly avatarPending = signal(false);

  readonly avatarProblem = computed<string | null>(() => {
    const file = this.avatarFile();
    if (file === null) {
      return 'Choose a file.';
    }
    return avatarFileProblem(file);
  });

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.avatarFile.set(input.files?.[0] ?? null);
  }

  uploadAvatar(): void {
    const file = this.avatarFile();
    if (file === null || this.avatarProblem() !== null) {
      return;
    }
    const data = new FormData();
    data.append('file', file);
    this.avatarPending.set(true);
    this.notice.set(null);
    this.http.put('/api/profiles/me/avatar', data).subscribe({
      next: () => {
        this.avatarPending.set(false);
        this.avatarFile.set(null);
        this.poller.refresh();
      },
      error: (err: unknown) => {
        this.notice.set(toApiError(err).message);
        this.avatarPending.set(false);
      },
    });
  }

  deleteAvatar(): void {
    this.avatarPending.set(true);
    this.notice.set(null);
    this.http.delete('/api/profiles/me/avatar').subscribe({
      next: () => {
        this.avatarPending.set(false);
        this.poller.refresh();
      },
      error: (err: unknown) => {
        this.notice.set(toApiError(err).message);
        this.avatarPending.set(false);
      },
    });
  }

  protected readonly platforms = SOCIAL_PLATFORMS;
  readonly workingLinks = signal<readonly SocialLink[] | null>(null);
  readonly linksPending = signal(false);
  private linksDirty = false;

  private readonly linkModel = signal<{ platform: SocialPlatform; url: string }>({
    platform: 'Twitch',
    url: '',
  });
  protected readonly linkForm = form(this.linkModel);

  readonly addProblem = computed<string | null>(() => {
    const links = this.workingLinks();
    if (links === null) {
      return 'Loading…';
    }
    const { platform, url } = this.linkModel();
    if (links.length >= MAX_SOCIAL_LINKS) {
      return `You can keep at most ${MAX_SOCIAL_LINKS} links.`;
    }
    if (links.some((link) => link.platform === platform)) {
      return `You already have a ${platform} link.`;
    }
    if (url === '') {
      return 'Enter a url.';
    }
    return socialLinkProblem(platform, url);
  });

  addLink(): void {
    const links = this.workingLinks();
    if (links === null || this.addProblem() !== null) {
      return;
    }
    const { platform, url } = this.linkModel();
    this.linksDirty = true;
    this.workingLinks.set([...links, { platform, url }]);
    this.linkModel.update((model) => ({ ...model, url: '' }));
  }

  removeLink(platform: SocialPlatform): void {
    const links = this.workingLinks();
    if (links === null) {
      return;
    }
    this.linksDirty = true;
    this.workingLinks.set(links.filter((link) => link.platform !== platform));
  }

  saveLinks(): void {
    const links = this.workingLinks();
    if (links === null) {
      return;
    }
    this.linksPending.set(true);
    this.notice.set(null);
    this.http.put('/api/profiles/me/socials', { links }).subscribe({
      next: () => {
        this.linksPending.set(false);
        this.linksDirty = false;
        this.poller.refresh();
      },
      error: (err: unknown) => {
        this.notice.set(toApiError(err).message);
        this.linksPending.set(false);
      },
    });
  }

  private loadProfile(): Observable<OwnProfileDto> {
    return this.http.get<OwnProfileDto>('/api/profiles/me').pipe(
      retry({
        delay: (err: unknown) =>
          toApiError(err).status === 404 && Date.now() < this.provisioningDeadline
            ? timer(PROVISIONING_RETRY_MS)
            : throwError(() => err),
      }),
      tap((profile) => {
        for (const friend of profile.friends) {
          this.directory.remember(friend.userId, friend.username);
        }
        if (!this.linksDirty) {
          this.workingLinks.set([...profile.socialLinks]);
        }
      }),
    );
  }
}
