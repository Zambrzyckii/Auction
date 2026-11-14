import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { OwnProfile as OwnProfileDto, Profile } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { PlayerProfile } from './player-profile';

const MY_ID = 'me-user';
const PLAYER_ID = 'deadbeef-1111-2222-3333-444444444444';
const PROFILE_URL = `/api/profiles/${PLAYER_ID}`;
const ME_URL = '/api/profiles/me';

function profile(overrides: Partial<Profile>): Profile {
  return {
    userId: PLAYER_ID,
    username: 'alice',
    isPrivate: false,
    level: 4,
    memberSince: '2026-11-01T00:00:00Z',
    avatarUrl: null,
    friends: [],
    socialLinks: [],
    ...overrides,
  };
}

function me(overrides: Partial<OwnProfileDto>): OwnProfileDto {
  return {
    userId: MY_ID,
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

describe('PlayerProfile', () => {
  let fixture: ComponentFixture<PlayerProfile>;
  let http: HttpTestingController;
  let remember: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    remember = vi.fn();
    await TestBed.configureTestingModule({
      imports: [PlayerProfile],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProfileDirectory, useValue: { remember } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: PLAYER_ID }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlayerProfile);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.useRealTimers();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function flushMe(overrides: Partial<OwnProfileDto>): void {
    http.expectOne(ME_URL).flush(me(overrides));
  }

  it('shows a public profile with level and social links', () => {
    flushMe({});
    http
      .expectOne(PROFILE_URL)
      .flush(profile({ socialLinks: [{ platform: 'GitHub', url: 'https://github.com/alice' }] }));
    fixture.detectChanges();
    const text = el().textContent ?? '';
    expect(text).toContain('alice');
    expect(text).toContain('4');
    expect(text).toContain('https://github.com/alice');
  });

  it('shows only the username and a note for a private profile', () => {
    flushMe({});
    http.expectOne(PROFILE_URL).flush(profile({ isPrivate: true, level: null, memberSince: null }));
    fixture.detectChanges();
    const text = el().textContent ?? '';
    expect(text).toContain('alice');
    expect(text).toContain('This profile is private');
    expect(text).not.toContain('Level');
  });

  it('shows the full profile of a private friend', () => {
    flushMe({ friends: [{ userId: PLAYER_ID, username: 'alice' }] });
    http.expectOne(PROFILE_URL).flush(profile({ isPrivate: true }));
    fixture.detectChanges();
    const text = el().textContent ?? '';
    expect(text).toContain('Level');
    expect(text).toContain('4');
    expect(text).not.toContain('This profile is private');
  });

  it('says the player was not found on a 404', () => {
    flushMe({});
    http
      .expectOne(PROFILE_URL)
      .flush({ error: 'Profile not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().querySelector('.error')?.textContent).toContain('Player not found');
  });

  it('remembers the player and their friends in the directory', () => {
    flushMe({});
    http
      .expectOne(PROFILE_URL)
      .flush(profile({ friends: [{ userId: 'friend-1', username: 'bob' }] }));
    expect(remember).toHaveBeenCalledWith(PLAYER_ID, 'alice');
    expect(remember).toHaveBeenCalledWith('friend-1', 'bob');
  });

  it('keeps polling every 10 seconds', () => {
    flushMe({});
    http.expectOne(PROFILE_URL).flush(profile({}));
    vi.advanceTimersByTime(5000);
    flushMe({});
    vi.advanceTimersByTime(5000);
    http.expectOne(PROFILE_URL).flush(profile({ level: 9 }));
    flushMe({});
    fixture.detectChanges();
    expect(el().textContent).toContain('9');
  });

  it('offers Add friend to a stranger and reports the sent request', () => {
    flushMe({});
    http.expectOne(PROFILE_URL).flush(profile({}));
    fixture.detectChanges();
    (el().querySelector('button.add-friend') as HTMLButtonElement).click();

    const post = http.expectOne('/api/profiles/friends/requests');
    expect(post.request.body).toEqual({ userId: PLAYER_ID });
    post.flush(
      { publicFriendshipId: 'fr-9', status: 'Pending' },
      { status: 201, statusText: 'Created' },
    );
    fixture.detectChanges();
    expect(el().textContent).toContain('Request sent.');

    flushMe({
      outgoingFriendRequests: [{ publicFriendshipId: 'fr-9', userId: PLAYER_ID, username: 'a' }],
    });
    http.expectOne(PROFILE_URL).flush(profile({}));
    fixture.detectChanges();
    expect(el().querySelector('button.cancel-request')).not.toBeNull();
  });

  it('offers Remove friend to a friend', () => {
    flushMe({ friends: [{ userId: PLAYER_ID, username: 'alice' }] });
    http.expectOne(PROFILE_URL).flush(profile({}));
    fixture.detectChanges();
    (el().querySelector('button.remove-friend') as HTMLButtonElement).click();

    const del = http.expectOne(`/api/profiles/friends/${PLAYER_ID}`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    flushMe({});
    http.expectOne(PROFILE_URL).flush(profile({}));
    fixture.detectChanges();
    expect(el().querySelector('button.add-friend')).not.toBeNull();
  });

  it('accepts an incoming request through the one button', () => {
    flushMe({
      incomingFriendRequests: [{ publicFriendshipId: 'fr-1', userId: PLAYER_ID, username: 'a' }],
    });
    http.expectOne(PROFILE_URL).flush(profile({}));
    fixture.detectChanges();
    (el().querySelector('button.accept') as HTMLButtonElement).click();

    http.expectOne('/api/profiles/friends/requests/fr-1/accept').flush(null);
    flushMe({ friends: [{ userId: PLAYER_ID, username: 'alice' }] });
    http.expectOne(PROFILE_URL).flush(profile({ isPrivate: true }));
    fixture.detectChanges();
    expect(el().querySelector('button.remove-friend')).not.toBeNull();
    expect(el().textContent).toContain('Level');
  });
});

describe('PlayerProfile with a crafted route id', () => {
  it('encodes the id in the request url', async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    await TestBed.configureTestingModule({
      imports: [PlayerProfile],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProfileDirectory, useValue: { remember: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'abc/../evil' }) } },
        },
      ],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(PlayerProfile);
    fixture.detectChanges();
    http.expectOne(ME_URL).flush(me({}));
    http.expectOne('/api/profiles/abc%2F..%2Fevil').flush(profile({}));
    fixture.destroy();
    http.verify();
    vi.useRealTimers();
  });
});
