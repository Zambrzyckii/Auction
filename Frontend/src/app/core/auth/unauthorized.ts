import { Router } from '@angular/router';
import { ProfileDirectory } from '../profiles/profile-directory';
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
