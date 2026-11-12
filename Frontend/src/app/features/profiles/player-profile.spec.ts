import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Profile } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { PlayerProfile } from './player-profile';

const MY_ID = 'me-user';
const PLAYER_ID = 'deadbeef-1111-2222-3333-444444444444';
const PROFILE_URL = `/api/profiles/${PLAYER_ID}`;

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

  it('shows a public profile with level and social links', () => {
    http.expectOne(PROFILE_URL).flush(
      profile({ socialLinks: [{ platform: 'GitHub', url: 'https://github.com/alice' }] }),
    );
    fixture.detectChanges();
    const text = el().textContent ?? '';
    expect(text).toContain('alice');
    expect(text).toContain('4');
    expect(text).toContain('https://github.com/alice');
  });

  it('shows only the username and a note for a private profile', () => {
    http.expectOne(PROFILE_URL).flush(
      profile({ isPrivate: true, level: null, memberSince: null }),
    );
    fixture.detectChanges();
    const text = el().textContent ?? '';
    expect(text).toContain('alice');
    expect(text).toContain('This profile is private');
    expect(text).not.toContain('Level');
  });

  it('says the player was not found on a 404', () => {
    http
      .expectOne(PROFILE_URL)
      .flush({ error: 'Profile not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().querySelector('.error')?.textContent).toContain('Player not found');
  });

  it('remembers the player and their friends in the directory', () => {
    http.expectOne(PROFILE_URL).flush(
      profile({ friends: [{ userId: 'friend-1', username: 'bob' }] }),
    );
    expect(remember).toHaveBeenCalledWith(PLAYER_ID, 'alice');
    expect(remember).toHaveBeenCalledWith('friend-1', 'bob');
  });

  it('keeps polling every 10 seconds', () => {
    http.expectOne(PROFILE_URL).flush(profile({}));
    vi.advanceTimersByTime(10_000);
    http.expectOne(PROFILE_URL).flush(profile({ level: 9 }));
    fixture.detectChanges();
    expect(el().textContent).toContain('9');
  });
});
