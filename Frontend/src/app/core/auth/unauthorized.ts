import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { ProfileDirectory } from '../profiles/profile-directory';
import { authGuard } from './auth.guard';
import { TokenStorage } from './token-storage';

export function handleUnauthorized(
  router: Router,
  storage: TokenStorage,
  directory: ProfileDirectory,
): void {
  if (router.url.startsWith('/login')) {
    return;
  }
  storage.clear();
  directory.clear();
  router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
}

export function isOnGuardedRoute(router: Router): boolean {
  let route: ActivatedRouteSnapshot | null = router.routerState.snapshot.root;
  while (route !== null) {
    if (route.routeConfig?.canActivate?.includes(authGuard)) return true;
    route = route.firstChild;
  }
  return false;
}
