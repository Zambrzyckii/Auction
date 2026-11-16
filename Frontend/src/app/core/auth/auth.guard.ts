import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { decodeJwtClaims } from './jwt';
import { TokenStorage } from './token-storage';

export const authGuard: CanActivateFn = (route, state) => {
  const storage = inject(TokenStorage);
  const token = storage.get();
  const claims = token === null ? null : decodeJwtClaims(token);
  const live = claims !== null && claims.exp > Date.now() / 1000;
  if (live || storage.getRefresh() !== null) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
