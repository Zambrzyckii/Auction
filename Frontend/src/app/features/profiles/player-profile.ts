import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap } from 'rxjs';
import { Profile as ProfileDto } from '../../core/api/models';
import { startPolling } from '../../core/polling/poll';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { ProfileAvatar } from './avatar';

const POLL_MS = 10_000;

@Component({
  selector: 'app-player-profile',
  imports: [DatePipe, ProfileAvatar],
  templateUrl: './player-profile.html',
})
export class PlayerProfile {
  private readonly http = inject(HttpClient);
  private readonly directory = inject(ProfileDirectory);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');

  readonly poller = startPolling(
    () =>
      this.http.get<ProfileDto>(`/api/profiles/${this.id}`).pipe(
        tap((profile) => {
          this.directory.remember(profile.userId, profile.username);
          for (const friend of profile.friends) {
            this.directory.remember(friend.userId, friend.username);
          }
        }),
      ),
    POLL_MS,
  );
}
