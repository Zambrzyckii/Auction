import { HttpInterceptorFn, HttpErrorResponse } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { ProfileDirectory } from "../profiles/profile-directory";
import { TokenStorage } from "./token-storage";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorage);
  const router = inject(Router);
  const directory = inject(ProfileDirectory);

  const token = storage.get();
  const request =
    token !== null && req.url.startsWith("/api/")
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      handleUnauthorized(err, storage, router, directory);
      return throwError(() => err);
    }),
  );
};

function handleUnauthorized(
  err: unknown,
  storage: TokenStorage,
  router: Router,
  directory: ProfileDirectory,
): void {
  if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
    return;
  }
  if (router.url.startsWith("/login")) {
    return;
  }
  storage.clear();
  directory.clear();
  router.navigate(["/login"], { queryParams: { returnUrl: router.url } });
}
