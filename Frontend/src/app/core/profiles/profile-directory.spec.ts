import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { ProfileSummary } from '../api/models';
import { Session } from '../auth/session';
import { TokenStorage } from '../auth/token-storage';
import { BATCH_SIZE, MISS_RETRY_MS, ProfileDirectory, shortId } from './profile-directory';

const MY_ID = 'me-user';
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';
const C = 'cccccccc-1111-2222-3333-444444444444';
const LOOKUP_URL = '/api/profiles';

function summary(userId: string, username: string): ProfileSummary {
  return { userId, username, avatarUrl: null };
}

function batchUrl(...ids: string[]): string {
  return `${LOOKUP_URL}?${ids.map((id) => `ids=${id}`).join('&')}`;
}

describe('shortId', () => {
  it('keeps the first eight characters of the guid', () => {
    expect(shortId(A)).toBe('aaaaaaaa');
  });
});

describe('labelWithId', () => {
  it('appends the short id to a known name and falls back to the short id alone', () => {
    installStorageStub();
    const directory = TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).inject(ProfileDirectory);
    directory.remember(A, 'alice');
    expect(directory.labelWithId(A)).toBe('alice (aaaaaaaa)');
    expect(directory.labelWithId(B)).toBe('bbbbbbbb');
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

  function flushBatch(): void {
    vi.advanceTimersByTime(0);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('sends one batch for the ids ensured within a tick, deduplicated', () => {
    const directory = setup();
    directory.ensure([A, A, B]);
    directory.ensure([A, C]);
    flushBatch();
    http
      .expectOne(batchUrl(A, B, C))
      .flush([summary(A, 'alice'), summary(B, 'bob'), summary(C, 'carol')]);
    expect(directory.label(A)).toBe('alice');
    expect(directory.label(B)).toBe('bob');
    expect(directory.label(C)).toBe('carol');
  });

  it('does not ask again for an id still in flight', () => {
    const directory = setup();
    directory.ensure([A]);
    flushBatch();
    const first = http.expectOne(batchUrl(A));
    directory.ensure([A]);
    flushBatch();
    http.expectNone(batchUrl(A));
    first.flush([summary(A, 'alice')]);
    expect(directory.label(A)).toBe('alice');
  });

  it('splits more than BATCH_SIZE ids into several requests', () => {
    const directory = setup();
    const ids = Array.from(
      { length: BATCH_SIZE + 1 },
      (_, i) => `${i.toString(16).padStart(8, '0')}-1111-2222-3333-444444444444`,
    );
    directory.ensure(ids);
    flushBatch();
    const requests = http.match((req) => req.url === LOOKUP_URL);
    expect(requests.map((req) => req.request.params.getAll('ids')?.length)).toEqual([
      BATCH_SIZE,
      1,
    ]);
    for (const req of requests) req.flush([]);
  });

  it('labels with the short id before the response and after a miss', () => {
    const directory = setup();
    directory.ensure([A, B]);
    expect(directory.label(A)).toBe('aaaaaaaa');
    flushBatch();
    http.expectOne(batchUrl(A, B)).flush([summary(A, 'alice')]);
    expect(directory.label(A)).toBe('alice');
    expect(directory.label(B)).toBe('bbbbbbbb');
  });

  it('does not refetch a name it already knows', () => {
    const directory = setup();
    directory.remember(A, 'alice');
    directory.ensure([A]);
    flushBatch();
    http.expectNone(batchUrl(A));
    expect(directory.label(A)).toBe('alice');
  });

  it('sends nothing while logged out', () => {
    const directory = setup(false);
    directory.ensure([A]);
    flushBatch();
    http.expectNone(batchUrl(A));
    expect(directory.label(A)).toBe('aaaaaaaa');
  });

  it('retries an id missing from the response only once MISS_RETRY_MS has passed', () => {
    const directory = setup();
    directory.ensure([A]);
    flushBatch();
    http.expectOne(batchUrl(A)).flush([]);

    directory.ensure([A]);
    flushBatch();
    http.expectNone(batchUrl(A));

    vi.advanceTimersByTime(MISS_RETRY_MS + 1);
    directory.ensure([A]);
    flushBatch();
    http.expectOne(batchUrl(A)).flush([summary(A, 'alice')]);
    expect(directory.label(A)).toBe('alice');
  });

  it('forgets the names on logout', () => {
    const directory = setup();
    directory.remember(A, 'alice');
    TestBed.inject(Session).logout();
    TestBed.tick();
    expect(directory.label(A)).toBe('aaaaaaaa');
  });

  it('drops a response that lands after logout', () => {
    const directory = setup();
    directory.ensure([A]);
    flushBatch();
    const request = http.expectOne(batchUrl(A));
    TestBed.inject(Session).logout();
    TestBed.tick();
    request.flush([summary(A, 'alice')]);
    expect(directory.label(A)).toBe('aaaaaaaa');
  });

  it('does not remember a failed request as a miss', () => {
    const directory = setup();
    directory.ensure([A]);
    flushBatch();
    http.expectOne(batchUrl(A)).flush('boom', { status: 500, statusText: 'Server Error' });

    directory.ensure([A]);
    flushBatch();
    http.expectOne(batchUrl(A)).flush([summary(A, 'alice')]);
    expect(directory.label(A)).toBe('alice');
  });
});
