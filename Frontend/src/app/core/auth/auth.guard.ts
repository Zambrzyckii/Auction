import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { decodeJwtClaims } from './jwt';
import { TokenStorage } from './token-storage';

export const authGuard: CanActivateFn = (route, state) => {
  const token = inject(TokenStorage).get();
  const claims = token === null ? null : decodeJwtClaims(token);
  if (claims !== null && claims.exp > Date.now() / 1000) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
