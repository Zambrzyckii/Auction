import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ProfileDirectory } from '../profiles/profile-directory';
import { TokenStorage } from './token-storage';
import { handleUnauthorized } from './unauthorized';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorage);
  const router = inject(Router);
  const directory = inject(ProfileDirectory);

  const token = storage.get();
  const request =
    token !== null && req.url.startsWith('/api/')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        handleUnauthorized(router, storage, directory);
      }
      return throwError(() => err);
    }),
  );
};
