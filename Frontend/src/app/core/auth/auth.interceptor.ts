import { HttpInterceptorFn, HttpErrorResponse } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { TokenStorage } from "./token-storage";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorage);
  const router = inject(Router);

  const token = storage.get();
  const request =
    token !== null && req.url.startsWith("/api/")
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      handleUnauthorized(err, storage, router);
      return throwError(() => err);
    }),
  );
};

function handleUnauthorized(
  err: unknown,
  storage: TokenStorage,
  router: Router,
): void {
  if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
    return;
  }
  if (router.url.startsWith("/login")) {
    return;
  }
  storage.clear();
  router.navigate(["/login"], { queryParams: { returnUrl: router.url } });
}
