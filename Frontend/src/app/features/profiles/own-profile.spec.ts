import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { OwnProfile as OwnProfileDto } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { OwnProfile, addFriendProblem } from './own-profile';

const USER_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const ME_URL = '/api/profiles/me';

function ownProfile(overrides: Partial<OwnProfileDto>): OwnProfileDto {
  return {
    userId: USER_ID,
    username: 'probe1',
    isPrivate: false,
    level: 2,
    memberSince: '2026-11-01T00:00:00Z',
    avatarUrl: null,
    friends: [],
    incomingFriendRequests: [],
    outgoingFriendRequests: [],
    socialLinks: [],
    ...overrides,
  };
}

describe('addFriendProblem', () => {
  const GUID = 'deadbeef-1111-2222-3333-444444444444';
  const me = (overrides: Partial<OwnProfileDto>): OwnProfileDto => ({
    userId: USER_ID,
    username: 'probe1',
    isPrivate: false,
    level: 2,
    memberSince: '2026-11-01T00:00:00Z',
    avatarUrl: null,
    friends: [],
    incomingFriendRequests: [],
    outgoingFriendRequests: [],
    socialLinks: [],
    ...overrides,
  });

  it('accepts a fresh guid', () => {
    expect(addFriendProblem(GUID, me({}))).toBeNull();
  });

  it('rejects text that is not a guid', () => {
    expect(addFriendProblem('alice', me({}))).toMatch(/player id/i);
  });

  it('rejects my own id with the server text', () => {
    expect(addFriendProblem(USER_ID, me({}))).toBe('You cannot befriend yourself');
  });

  it('rejects an existing relation with the server text', () => {
    const existing = 'Friendship or a pending request already exists';
    expect(addFriendProblem(GUID, me({ friends: [{ userId: GUID, username: 'x' }] }))).toBe(
      existing,
    );
    expect(
      addFriendProblem(
        GUID,
        me({ incomingFriendRequests: [{ publicFriendshipId: 'f', userId: GUID, username: 'x' }] }),
      ),
    ).toBe(existing);
    expect(
      addFriendProblem(
        GUID,
        me({ outgoingFriendRequests: [{ publicFriendshipId: 'f', userId: GUID, username: 'x' }] }),
      ),
    ).toBe(existing);
  });

  it('rejects the 101st friend', () => {
    const friends = Array.from({ length: 100 }, (_, i) => ({
      userId: `user-${i}`,
      username: `u${i}`,
    }));
    expect(addFriendProblem(GUID, me({ friends }))).toMatch(/100/);
  });
});

describe('OwnProfile', () => {
  let fixture: ComponentFixture<OwnProfile>;
  let http: HttpTestingController;
  let remember: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    (URL as unknown as Record<string, unknown>)['createObjectURL'] = vi.fn(() => 'blob:fake-1');
    (URL as unknown as Record<string, unknown>)['revokeObjectURL'] = vi.fn();
    new TokenStorage().set(
      tokenWithClaims({ nameid: USER_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    remember = vi.fn();
    await TestBed.configureTestingModule({
      imports: [OwnProfile],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProfileDirectory, useValue: { remember } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OwnProfile);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    delete (URL as unknown as Record<string, unknown>)['createObjectURL'];
    delete (URL as unknown as Record<string, unknown>)['revokeObjectURL'];
    vi.useRealTimers();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the username, level and the player id', () => {
    http.expectOne(ME_URL).flush(ownProfile({}));
    fixture.detectChanges();
    const text = el().textContent ?? '';
    expect(text).toContain('probe1');
    expect(text).toContain('2');
    expect(text).toContain(USER_ID);
    expect(text).toContain('Public');
  });

  it('shows a provisioning note and retries after an early 404', () => {
    http
      .expectOne(ME_URL)
      .flush({ error: 'Player not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Setting up your profile');

    vi.advanceTimersByTime(1500);
    http.expectOne(ME_URL).flush(ownProfile({}));
    fixture.detectChanges();
    expect(el().textContent).toContain('probe1');
  });

  it('remembers friends in the profile directory', () => {
    http.expectOne(ME_URL).flush(
      ownProfile({
        friends: [{ userId: 'friend-1', username: 'alice' }],
      }),
    );
    expect(remember).toHaveBeenCalledWith('friend-1', 'alice');
  });

  it('lists friends and pending requests', () => {
    http.expectOne(ME_URL).flush(
      ownProfile({
        friends: [{ userId: 'friend-1', username: 'alice' }],
        incomingFriendRequests: [
          { publicFriendshipId: 'fr-1', userId: 'u-2', username: 'bob' },
        ],
        outgoingFriendRequests: [
          { publicFriendshipId: 'fr-2', userId: 'u-3', username: 'carol' },
        ],
      }),
    );
    fixture.detectChanges();
    const text = el().textContent ?? '';
    expect(text).toContain('alice');
    expect(text).toContain('bob');
    expect(text).toContain('carol');
  });

  it('keeps polling every 5 seconds', () => {
    http.expectOne(ME_URL).flush(ownProfile({}));
    vi.advanceTimersByTime(5000);
    http.expectOne(ME_URL).flush(ownProfile({ level: 7 }));
    fixture.detectChanges();
    expect(el().textContent).toContain('7');
  });

  it('sends the inverted privacy flag and refreshes', () => {
    http.expectOne(ME_URL).flush(ownProfile({ isPrivate: false }));
    fixture.detectChanges();
    (el().querySelector('button.privacy') as HTMLButtonElement).click();

    const put = http.expectOne('/api/profiles/me/privacy');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ isPrivate: true });
    put.flush(null, { status: 204, statusText: 'No Content' });

    http.expectOne(ME_URL).flush(ownProfile({ isPrivate: true }));
    fixture.detectChanges();
    expect(el().textContent).toContain('Private');
  });

  it('shows the server error when the privacy toggle fails', () => {
    http.expectOne(ME_URL).flush(ownProfile({}));
    fixture.detectChanges();
    (el().querySelector('button.privacy') as HTMLButtonElement).click();

    http
      .expectOne('/api/profiles/me/privacy')
      .flush({ error: 'Too many requests.' }, { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(el().querySelector('.notice')?.textContent).toContain('Too many requests.');
    expect((el().querySelector('button.privacy') as HTMLButtonElement).disabled).toBe(false);
  });

  describe('social links editor', () => {
    const GITHUB_LINK = { platform: 'GitHub' as const, url: 'https://github.com/probe' };

    function fillLink(platform: string, url: string): void {
      const select = el().querySelector('.link-form select') as HTMLSelectElement;
      select.value = platform;
      select.dispatchEvent(new Event('change'));
      select.dispatchEvent(new Event('input'));
      const input = el().querySelector('.link-form input') as HTMLInputElement;
      input.value = url;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('adds a link locally and keeps the edit across polls', () => {
      http.expectOne(ME_URL).flush(ownProfile({}));
      fixture.detectChanges();
      fillLink('GitHub', GITHUB_LINK.url);
      (el().querySelector('button.add-link') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().textContent).toContain(GITHUB_LINK.url);

      vi.advanceTimersByTime(5000);
      http.expectOne(ME_URL).flush(ownProfile({}));
      fixture.detectChanges();
      expect(el().textContent).toContain(GITHUB_LINK.url);
    });

    it('blocks a duplicate platform with a reason', () => {
      http.expectOne(ME_URL).flush(ownProfile({ socialLinks: [GITHUB_LINK] }));
      fixture.detectChanges();
      fillLink('GitHub', 'https://github.com/other');
      expect((el().querySelector('button.add-link') as HTMLButtonElement).disabled).toBe(true);
      expect(el().textContent).toContain('already have a GitHub link');
    });

    it('blocks the seventh link', () => {
      http.expectOne(ME_URL).flush(
        ownProfile({
          socialLinks: [
            { platform: 'Twitch', url: 'https://twitch.tv/probe' },
            { platform: 'YouTube', url: 'https://youtube.com/@probe' },
            { platform: 'X', url: 'https://x.com/probe' },
            { platform: 'Instagram', url: 'https://instagram.com/probe' },
            { platform: 'GitHub', url: 'https://github.com/probe' },
            { platform: 'Steam', url: 'https://steamcommunity.com/id/probe' },
          ],
        }),
      );
      fixture.detectChanges();
      fillLink('Website', 'https://example.org/me');
      expect((el().querySelector('button.add-link') as HTMLButtonElement).disabled).toBe(true);
      expect(el().textContent).toContain('at most 6');
    });

    it('removes a link from the working list', () => {
      http.expectOne(ME_URL).flush(ownProfile({ socialLinks: [GITHUB_LINK] }));
      fixture.detectChanges();
      (el().querySelector('button.remove-link') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el().textContent).not.toContain(GITHUB_LINK.url);
    });

    it('saves the whole working list and refreshes', () => {
      http.expectOne(ME_URL).flush(ownProfile({ socialLinks: [GITHUB_LINK] }));
      fixture.detectChanges();
      (el().querySelector('button.save-links') as HTMLButtonElement).click();

      const put = http.expectOne('/api/profiles/me/socials');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ links: [GITHUB_LINK] });
      put.flush(null, { status: 204, statusText: 'No Content' });

      http.expectOne(ME_URL).flush(ownProfile({ socialLinks: [GITHUB_LINK] }));
    });
  });

  describe('friend actions', () => {
    const FRIEND_ID = 'deadbeef-1111-2222-3333-444444444444';

    function fillFriendId(userId: string): void {
      const input = el().querySelector('.friend-form input') as HTMLInputElement;
      input.value = userId;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('accepts an incoming request and refreshes', () => {
      http.expectOne(ME_URL).flush(
        ownProfile({
          incomingFriendRequests: [
            { publicFriendshipId: 'fr-1', userId: 'u-2', username: 'bob' },
          ],
        }),
      );
      fixture.detectChanges();
      (el().querySelector('button.accept') as HTMLButtonElement).click();

      const post = http.expectOne('/api/profiles/friends/requests/fr-1/accept');
      expect(post.request.method).toBe('POST');
      post.flush(null);

      http.expectOne(ME_URL).flush(ownProfile({ friends: [{ userId: 'u-2', username: 'bob' }] }));
      fixture.detectChanges();
      expect(el().textContent).toContain('bob');
    });

    it('declines an incoming request', () => {
      http.expectOne(ME_URL).flush(
        ownProfile({
          incomingFriendRequests: [
            { publicFriendshipId: 'fr-1', userId: 'u-2', username: 'bob' },
          ],
        }),
      );
      fixture.detectChanges();
      (el().querySelector('button.decline') as HTMLButtonElement).click();

      http.expectOne('/api/profiles/friends/requests/fr-1/decline').flush(null);
      http.expectOne(ME_URL).flush(ownProfile({}));
    });

    it('removes a friend with the delete endpoint', () => {
      http.expectOne(ME_URL).flush(
        ownProfile({ friends: [{ userId: FRIEND_ID, username: 'alice' }] }),
      );
      fixture.detectChanges();
      (el().querySelector('button.remove-friend') as HTMLButtonElement).click();

      const del = http.expectOne(`/api/profiles/friends/${FRIEND_ID}`);
      expect(del.request.method).toBe('DELETE');
      del.flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne(ME_URL).flush(ownProfile({}));
    });

    it('cancels an outgoing request with the same delete endpoint', () => {
      http.expectOne(ME_URL).flush(
        ownProfile({
          outgoingFriendRequests: [
            { publicFriendshipId: 'fr-2', userId: 'u-3', username: 'carol' },
          ],
        }),
      );
      fixture.detectChanges();
      (el().querySelector('button.cancel-request') as HTMLButtonElement).click();

      const del = http.expectOne('/api/profiles/friends/u-3');
      expect(del.request.method).toBe('DELETE');
      del.flush(null, { status: 204, statusText: 'No Content' });
      http.expectOne(ME_URL).flush(ownProfile({}));
    });

    it('sends a request by id and reports the auto-accept branch', () => {
      http.expectOne(ME_URL).flush(ownProfile({}));
      fixture.detectChanges();
      fillFriendId(FRIEND_ID);
      (el().querySelector('button.add-friend') as HTMLButtonElement).click();

      const post = http.expectOne('/api/profiles/friends/requests');
      expect(post.request.body).toEqual({ userId: FRIEND_ID });
      post.flush({ publicFriendshipId: 'fr-9', status: 'Accepted' }, { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      expect(el().textContent).toContain('You are now friends.');
      http.expectOne(ME_URL).flush(ownProfile({ friends: [{ userId: FRIEND_ID, username: 'alice' }] }));
    });

    it('blocks my own id with the server text', () => {
      http.expectOne(ME_URL).flush(ownProfile({}));
      fixture.detectChanges();
      fillFriendId(USER_ID);
      expect((el().querySelector('button.add-friend') as HTMLButtonElement).disabled).toBe(true);
      expect(el().textContent).toContain('You cannot befriend yourself');
    });
  });

  describe('avatar', () => {
    const AVATAR_PATH = `/api/profiles/${USER_ID}/avatar?v=cafebabe1234`;

    function chooseFile(file: File): void {
      const input = el().querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    it('uploads the file as multipart without a content type and refreshes', () => {
      http.expectOne(ME_URL).flush(ownProfile({}));
      fixture.detectChanges();
      const file = new File([new Uint8Array(16)], 'a.png', { type: 'image/png' });
      chooseFile(file);
      (el().querySelector('button.upload-avatar') as HTMLButtonElement).click();

      const put = http.expectOne('/api/profiles/me/avatar');
      expect(put.request.method).toBe('PUT');
      expect((put.request.body as FormData).get('file')).toBe(file);
      expect(put.request.headers.get('Content-Type')).toBeNull();
      put.flush(null);

      http.expectOne(ME_URL).flush(ownProfile({}));
    });

    it('blocks an oversized file with the server text and sends nothing', () => {
      http.expectOne(ME_URL).flush(ownProfile({}));
      fixture.detectChanges();
      chooseFile(new File([new Uint8Array(2_097_153)], 'big.png', { type: 'image/png' }));

      expect((el().querySelector('button.upload-avatar') as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(el().textContent).toContain('exceeds the limit');
      http.expectNone('/api/profiles/me/avatar');
    });

    it('deletes the avatar and refreshes', () => {
      http.expectOne(ME_URL).flush(ownProfile({ avatarUrl: AVATAR_PATH }));
      fixture.detectChanges();
      http.expectOne(AVATAR_PATH).flush(new Blob(['x'], { type: 'image/png' }));
      fixture.detectChanges();

      (el().querySelector('button.delete-avatar') as HTMLButtonElement).click();
      const del = http.expectOne('/api/profiles/me/avatar');
      expect(del.request.method).toBe('DELETE');
      del.flush(null, { status: 204, statusText: 'No Content' });

      http.expectOne(ME_URL).flush(ownProfile({ avatarUrl: null }));
      fixture.detectChanges();
      expect(el().querySelector('button.delete-avatar')).toBeNull();
    });
  });
});
