import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { REAL_TOKEN, REAL_TOKEN_USER_ID } from '../../../testing/token-fixture';
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
    req.flush({ token: REAL_TOKEN });

    expect(completed).toBe(true);
    expect(session.isLoggedIn()).toBe(true);
    expect(session.email()).toBe('probe1@test.local');
    expect(new TokenStorage().get()).toBe(REAL_TOKEN);
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

  it('syncFromStorage picks up an outside change', () => {
    new TokenStorage().set(REAL_TOKEN);
    const session = TestBed.inject(Session);
    new TokenStorage().clear();
    expect(session.isLoggedIn()).toBe(true);
    session.syncFromStorage();
    expect(session.isLoggedIn()).toBe(false);
  });
});
