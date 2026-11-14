import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form } from '@angular/forms/signals';
import { Observable, retry, tap, throwError, timer } from 'rxjs';
import { actionState } from '../../core/actions/action-state';
import { toApiError } from '../../core/api/api-error';
import {
  FriendRequestResult,
  OwnProfile as OwnProfileDto,
  SocialLink,
  SocialPlatform,
} from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { ProfileAvatar } from './avatar';
import { addFriendProblem, avatarFileProblem } from './profile-rules';
import { MAX_SOCIAL_LINKS, SOCIAL_PLATFORMS, socialLinkProblem } from './social-links';

const POLL_MS = 5000;
const PROVISIONING_RETRY_MS = 1500;
const PROVISIONING_WINDOW_MS = 30_000;

@Component({
  selector: 'app-own-profile',
  imports: [DatePipe, FormField, ProfileAvatar, RouterLink],
  templateUrl: './own-profile.html',
})
export class OwnProfile {
  private readonly http = inject(HttpClient);
  private readonly directory = inject(ProfileDirectory);
  private readonly provisioningDeadline = Date.now() + PROVISIONING_WINDOW_MS;

  readonly poller = startPolling(() => this.loadProfile(), POLL_MS);

  readonly privacy = actionState();

  togglePrivacy(): void {
    const profile = this.poller.value();
    if (profile === null) {
      return;
    }
    this.privacy.run(
      this.http.put('/api/profiles/me/privacy', { isPrivate: !profile.isPrivate }),
      () => this.poller.refresh(),
    );
  }

  readonly friendship = actionState();
  private readonly friendModel = signal({ userId: '' });
  protected readonly friendForm = form(this.friendModel);

  readonly friendProblem = computed<string | null>(() => {
    const profile = this.poller.value();
    if (profile === null) {
      return 'Loading…';
    }
    return addFriendProblem(this.friendModel().userId, profile);
  });

  addFriend(): void {
    if (this.friendProblem() !== null) {
      return;
    }
    this.friendship.run(
      this.http.post<FriendRequestResult>('/api/profiles/friends/requests', {
        userId: this.friendModel().userId,
      }),
      (result) => {
        this.friendship.notice.set(
          result.status === 'Accepted' ? 'You are now friends.' : 'Request sent.',
        );
        this.friendModel.set({ userId: '' });
        this.poller.refresh();
      },
    );
  }

  acceptRequest(publicFriendshipId: string): void {
    this.friendAction(
      this.http.post(`/api/profiles/friends/requests/${publicFriendshipId}/accept`, null),
    );
  }

  declineRequest(publicFriendshipId: string): void {
    this.friendAction(
      this.http.post(`/api/profiles/friends/requests/${publicFriendshipId}/decline`, null),
    );
  }

  removeFriend(userId: string): void {
    this.friendAction(this.http.delete(`/api/profiles/friends/${userId}`));
  }

  private friendAction(request: Observable<unknown>): void {
    this.friendship.run(request, () => this.poller.refresh());
  }

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
    this.avatar.run(this.http.put('/api/profiles/me/avatar', data), () => {
      this.avatarFile.set(null);
      this.poller.refresh();
    });
  }

  deleteAvatar(): void {
    this.avatar.run(this.http.delete('/api/profiles/me/avatar'), () => this.poller.refresh());
  }

  protected readonly platforms = SOCIAL_PLATFORMS;
  readonly workingLinks = signal<readonly SocialLink[] | null>(null);
  readonly social = actionState();
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
    this.social.run(this.http.put('/api/profiles/me/socials', { links }), () => {
      this.linksDirty = false;
      this.poller.refresh();
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
