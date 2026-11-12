import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { OwnProfile as OwnProfileDto } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { OwnProfile } from './own-profile';

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

describe('OwnProfile', () => {
  let fixture: ComponentFixture<OwnProfile>;
  let http: HttpTestingController;
  let remember: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
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
});
