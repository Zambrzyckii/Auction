import { TestBed } from '@angular/core/testing';
import { RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { REAL_TOKEN, tokenWithClaims } from '../../../testing/token-fixture';
import { authGuard } from './auth.guard';
import { TokenStorage } from './token-storage';

describe('authGuard', () => {
  beforeEach(() => {
    installStorageStub();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function runGuard(url: string): unknown {
    return TestBed.runInInjectionContext(() =>
      authGuard(null as never, { url } as RouterStateSnapshot),
    );
  }

  it('lets a request through with a live token', () => {
    const inTenMinutes = Math.floor(Date.now() / 1000) + 600;
    new TokenStorage().set(tokenWithClaims({ nameid: 'x', exp: inTenMinutes }));
    expect(runGuard('/wallet')).toBe(true);
  });

  it('redirects to login with a returnUrl when there is no token', () => {
    const result = runGuard('/wallet');
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe('/login?returnUrl=%2Fwallet');
  });

  it('redirects when the stored token is expired', () => {
    // the fixture token expired on 2026-11-08
    new TokenStorage().set(REAL_TOKEN);
    const result = runGuard('/inventory');
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toContain('returnUrl=%2Finventory');
  });

  it('redirects when the stored token is garbage', () => {
    new TokenStorage().set('not.a.jwt');
    expect(runGuard('/wallet')).toBeInstanceOf(UrlTree);
  });
});
