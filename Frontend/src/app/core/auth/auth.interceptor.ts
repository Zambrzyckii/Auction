import { HttpErrorResponse, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { ProfileDirectory } from '../profiles/profile-directory';
import { Session } from './session';
import { SessionRefresher } from './session-refresher';
import { TokenStorage } from './token-storage';
import { handleUnauthorized } from './unauthorized';

export const AUTH_ROUTES = new Set([
  '/api/users/login',
  '/api/users/register',
  '/api/users/refresh',
  '/api/users/logout',
]);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') || AUTH_ROUTES.has(req.url)) return next(req);
  const storage = inject(TokenStorage);
  const refresher = inject(SessionRefresher);
  const session = inject(Session);
  const router = inject(Router);
  const directory = inject(ProfileDirectory);

  const send = (token: string | null): Observable<HttpEvent<unknown>> => {
    const request =
      token === null ? req : req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    return next(request).pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          handleUnauthorized(router, session, directory);
        }
        return throwError(() => err);
      }),
    );
  };

  return refresher.shouldRefresh()
    ? from(refresher.ensureFresh()).pipe(switchMap(send))
    : send(storage.get());
};
