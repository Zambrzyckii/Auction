import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form } from '@angular/forms/signals';
import { Observable } from 'rxjs';
import { actionState } from '../../core/actions/action-state';
import { FriendRequestResult, OwnProfile as OwnProfileDto } from '../../core/api/models';
import { addFriendProblem } from './profile-rules';

@Component({
  selector: 'app-friends-section',
  imports: [FormField, RouterLink],
  templateUrl: './friends-section.html',
})
export class FriendsSection {
  private readonly http = inject(HttpClient);

  readonly profile = input.required<OwnProfileDto>();
  readonly changed = output<void>();

  readonly friendship = actionState();
  private readonly friendModel = signal({ userId: '' });
  protected readonly friendForm = form(this.friendModel);

  readonly friendProblem = computed<string | null>(() =>
    addFriendProblem(this.friendModel().userId, this.profile()),
  );

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
        this.changed.emit();
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
    this.friendship.run(request, () => this.changed.emit());
  }
}
