import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { actionState } from '../../core/actions/action-state';
import {
  FriendRequestResult,
  OwnProfile as OwnProfileDto,
  Profile as ProfileDto,
} from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { ProfileAvatar } from './avatar';
import { Relation, relationTo } from './profile-rules';

const POLL_MS = 10_000;
const ME_POLL_MS = 5000;

@Component({
  selector: 'app-player-profile',
  imports: [DatePipe, ProfileAvatar],
  templateUrl: './player-profile.html',
})
export class PlayerProfile {
  private readonly http = inject(HttpClient);
  private readonly directory = inject(ProfileDirectory);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  private readonly encodedId = encodeURIComponent(this.id ?? '');

  readonly poller = startPolling(
    () =>
      this.http.get<ProfileDto>(`/api/profiles/${this.encodedId}`).pipe(
        tap((profile) => {
          this.directory.remember(profile.userId, profile.username);
          for (const friend of profile.friends) {
            this.directory.remember(friend.userId, friend.username);
          }
        }),
      ),
    POLL_MS,
  );

  readonly mePoller = startPolling(
    () => this.http.get<OwnProfileDto>('/api/profiles/me'),
    ME_POLL_MS,
  );

  readonly action = actionState();

  protected readonly relation = computed<Relation | null>(() => {
    const myProfile = this.mePoller.value();
    if (myProfile === null || this.id === null) {
      return null;
    }
    return relationTo(myProfile, this.id);
  });

  act(): void {
    const rel = this.relation();
    const myProfile = this.mePoller.value();
    if (rel === null || rel === 'self' || myProfile === null || this.id === null) {
      return;
    }
    if (rel === 'none') {
      this.sendRequest();
      return;
    }
    if (rel === 'incoming') {
      const incoming = myProfile.incomingFriendRequests.find((r) => r.userId === this.id);
      if (incoming === undefined) {
        return;
      }
      this.run(
        this.http.post(`/api/profiles/friends/requests/${incoming.publicFriendshipId}/accept`, null),
      );
      return;
    }
    this.run(this.http.delete(`/api/profiles/friends/${this.encodedId}`));
  }

  private sendRequest(): void {
    this.action.run(
      this.http.post<FriendRequestResult>('/api/profiles/friends/requests', { userId: this.id }),
      (result) => {
        this.action.notice.set(
          result.status === 'Accepted' ? 'You are now friends.' : 'Request sent.',
        );
        this.mePoller.refresh();
        this.poller.refresh();
      },
    );
  }

  private run(request: Observable<unknown>): void {
    this.action.run(request, () => {
      this.mePoller.refresh();
      this.poller.refresh();
    });
  }
}
