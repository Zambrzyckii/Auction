import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Profile } from '../api/models';
import { TokenStorage } from '../auth/token-storage';
import { MISS_RETRY_MS, ProfileDirectory, shortId } from './profile-directory';

const MY_ID = 'me-user';
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';

function profile(overrides: Partial<Profile>): Profile {
  return {
    userId: A,
    username: 'alice',
    isPrivate: false,
    level: 3,
    memberSince: '2026-11-01T00:00:00Z',
    avatarUrl: null,
    friends: [],
    socialLinks: [],
    ...overrides,
  };
}

describe('shortId', () => {
  it('keeps the first eight characters of the guid', () => {
    expect(shortId(A)).toBe('aaaaaaaa');
  });
});

describe('ProfileDirectory', () => {
  let http: HttpTestingController;

  function setup(loggedIn = true): ProfileDirectory {
    installStorageStub();
    if (loggedIn) {
      new TokenStorage().set(
        tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
      );
    }
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(ProfileDirectory);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('fetches each id once, deduplicating repeats and requests in flight', () => {
    const directory = setup();
    directory.ensure([A, A, B]);
    directory.ensure([A]);
    http.expectOne(`/api/profiles/${A}`).flush(profile({ userId: A }));
    http.expectOne(`/api/profiles/${B}`).flush(profile({ userId: B, username: 'bob' }));
  });

  it('labels with the short id before the response and after a 404', () => {
    const directory = setup();
    directory.ensure([A]);
    expect(directory.label(A)).toBe('aaaaaaaa');
    http
      .expectOne(`/api/profiles/${A}`)
      .flush({ error: 'Player not found' }, { status: 404, statusText: 'Not Found' });
    expect(directory.label(A)).toBe('aaaaaaaa');
  });

  it('labels with the username after a 200', () => {
    const directory = setup();
    directory.ensure([A]);
    http.expectOne(`/api/profiles/${A}`).flush(profile({ username: 'alice' }));
    expect(directory.label(A)).toBe('alice');
  });

  it('does not refetch a name it already knows', () => {
    const directory = setup();
    directory.remember(A, 'alice');
    directory.ensure([A]);
    http.expectNone(`/api/profiles/${A}`);
    expect(directory.label(A)).toBe('alice');
  });

  it('sends nothing while logged out', () => {
    const directory = setup(false);
    directory.ensure([A]);
    http.expectNone(`/api/profiles/${A}`);
    expect(directory.label(A)).toBe('aaaaaaaa');
  });

  it('retries after a 404 only once MISS_RETRY_MS has passed', () => {
    const directory = setup();
    directory.ensure([A]);
    http
      .expectOne(`/api/profiles/${A}`)
      .flush({ error: 'Player not found' }, { status: 404, statusText: 'Not Found' });

    directory.ensure([A]);
    http.expectNone(`/api/profiles/${A}`);

    vi.advanceTimersByTime(MISS_RETRY_MS + 1);
    directory.ensure([A]);
    http.expectOne(`/api/profiles/${A}`).flush(profile({ username: 'alice' }));
    expect(directory.label(A)).toBe('alice');
  });

  it('does not remember a 5xx as a missing profile', () => {
    const directory = setup();
    directory.ensure([A]);
    http.expectOne(`/api/profiles/${A}`).flush('boom', { status: 500, statusText: 'Server Error' });

    directory.ensure([A]);
    http.expectOne(`/api/profiles/${A}`).flush(profile({ username: 'alice' }));
    expect(directory.label(A)).toBe('alice');
  });
});
