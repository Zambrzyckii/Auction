import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import {
  REAL_TOKEN,
  REAL_TOKEN_EXP,
  REAL_TOKEN_USER_ID,
  tokenWithClaims,
} from '../../../testing/token-fixture';
import { Session } from './session';
import { TokenStorage } from './token-storage';

describe('Session', () => {
  beforeEach(() => {
    installStorageStub();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('starts logged out with an empty storage', () => {
    const session = TestBed.inject(Session);
    expect(session.isLoggedIn()).toBe(false);
    expect(session.userId()).toBeNull();
  });

  it('a stored token logs the user in at startup', () => {
    new TokenStorage().set(REAL_TOKEN);
    const session = TestBed.inject(Session);
    expect(session.isLoggedIn()).toBe(true);
    expect(session.userId()).toBe(REAL_TOKEN_USER_ID);
  });

  it('login posts the credentials, stores the token and exposes the claims', () => {
    const session = TestBed.inject(Session);
    let completed = false;
    session.login('probe1@test.local', 'pw').subscribe(() => (completed = true));

    const req = TestBed.inject(HttpTestingController).expectOne('/api/users/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'probe1@test.local', password: 'pw' });
    req.flush({ token: REAL_TOKEN, refreshToken: 'r1' });

    expect(completed).toBe(true);
    expect(session.isLoggedIn()).toBe(true);
    expect(session.email()).toBe('probe1@test.local');
    expect(new TokenStorage().get()).toBe(REAL_TOKEN);
    expect(new TokenStorage().getRefresh()).toBe('r1');
  });

  it('login of a bot stores no refresh token', () => {
    const session = TestBed.inject(Session);
    session.login('bot@test.local', 'pw').subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/users/login')
      .flush({ token: REAL_TOKEN, refreshToken: null });

    expect(session.isLoggedIn()).toBe(true);
    expect(new TokenStorage().getRefresh()).toBeNull();
  });

  it('applyTokens replaces both keys and the signal', () => {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const session = TestBed.inject(Session);
    const other = tokenWithClaims({
      nameid: 'other-user',
      unique_name: 'other@test.local',
      role: 'User',
      exp: REAL_TOKEN_EXP,
    });

    session.applyTokens(other, 'r2');

    expect(session.userId()).toBe('other-user');
    expect(storage.get()).toBe(other);
    expect(storage.getRefresh()).toBe('r2');
  });

  it('clear drops both keys and the signal', () => {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const session = TestBed.inject(Session);

    session.clear();

    expect(session.isLoggedIn()).toBe(false);
    expect(storage.get()).toBeNull();
    expect(storage.getRefresh()).toBeNull();
  });

  it('register posts the payload unchanged', () => {
    const session = TestBed.inject(Session);
    const data = {
      email: 'a@b.c',
      password: 'Zaq1@wsx',
      username: 'abc',
      name: 'A',
      surname: 'B',
      birthday: '1999-01-01',
    };
    session.register(data).subscribe();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/users/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(data);
    req.flush(null, { status: 201, statusText: 'Created' });
    expect(session.isLoggedIn()).toBe(false);
  });

  it('logout clears the token and the state', () => {
    new TokenStorage().set(REAL_TOKEN);
    const session = TestBed.inject(Session);
    session.logout();
    expect(session.isLoggedIn()).toBe(false);
    expect(new TokenStorage().get()).toBeNull();
  });

  it('logout posts the stored refresh token and clears both keys', () => {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const session = TestBed.inject(Session);

    session.logout();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/users/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'r1' });
    req.flush(null);
    expect(session.isLoggedIn()).toBe(false);
    expect(storage.get()).toBeNull();
    expect(storage.getRefresh()).toBeNull();
  });

  it('logout survives a failing logout request', () => {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const session = TestBed.inject(Session);

    session.logout();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/users/logout')
      .flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(session.isLoggedIn()).toBe(false);
    expect(storage.getRefresh()).toBeNull();
  });

  it('login over a session with a refresh token revokes the previous one once the new pair is stored', () => {
    new TokenStorage().setRefresh('r1');
    const session = TestBed.inject(Session);

    session.login('probe1@test.local', 'pw').subscribe();

    const http = TestBed.inject(HttpTestingController);
    http.expectNone('/api/users/logout');
    http.expectOne('/api/users/login').flush({ token: REAL_TOKEN, refreshToken: 'r2' });
    const revoke = http.expectOne('/api/users/logout');
    expect(revoke.request.body).toEqual({ refreshToken: 'r1' });
    revoke.flush(null);
    expect(session.isLoggedIn()).toBe(true);
    expect(new TokenStorage().getRefresh()).toBe('r2');
  });

  it('a failed login keeps the stored pair and revokes nothing', () => {
    const storage = new TokenStorage();
    storage.set(REAL_TOKEN);
    storage.setRefresh('r1');
    const session = TestBed.inject(Session);
    let failed = false;

    session.login('probe1@test.local', 'wrong').subscribe({ error: () => (failed = true) });

    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/users/login')
      .flush({ error: 'Invalid credentials provided' }, { status: 400, statusText: 'Bad Request' });
    http.expectNone('/api/users/logout');
    expect(failed).toBe(true);
    expect(session.token()).toBe(REAL_TOKEN);
    expect(storage.get()).toBe(REAL_TOKEN);
    expect(storage.getRefresh()).toBe('r1');
  });

  it('adopts a token rotated in another tab', () => {
    new TokenStorage().set(REAL_TOKEN);
    const session = TestBed.inject(Session);
    const fresh = tokenWithClaims({
      nameid: 'other-user',
      unique_name: 'other@test.local',
      role: 'User',
      exp: REAL_TOKEN_EXP,
    });
    new TokenStorage().set(fresh);

    window.dispatchEvent(new StorageEvent('storage', { key: 'auction.token', newValue: fresh }));

    expect(session.userId()).toBe('other-user');
  });

  it('follows a logout in another tab', () => {
    new TokenStorage().set(REAL_TOKEN);
    const session = TestBed.inject(Session);
    new TokenStorage().clear();

    window.dispatchEvent(new StorageEvent('storage', { key: null }));

    expect(session.isLoggedIn()).toBe(false);
  });

  it('ignores storage events for other keys', () => {
    new TokenStorage().set(REAL_TOKEN);
    const session = TestBed.inject(Session);
    new TokenStorage().clear();

    window.dispatchEvent(new StorageEvent('storage', { key: 'auction.theme', newValue: 'dark' }));

    expect(session.isLoggedIn()).toBe(true);
  });

  it('syncFromStorage picks up an outside change', () => {
    new TokenStorage().set(REAL_TOKEN);
    const session = TestBed.inject(Session);
    new TokenStorage().clear();
    expect(session.isLoggedIn()).toBe(true);
    session.syncFromStorage();
    expect(session.isLoggedIn()).toBe(false);
  });
});
