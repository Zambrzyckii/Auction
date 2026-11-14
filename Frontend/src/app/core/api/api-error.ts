import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  readonly status: number;
  readonly message: string;
  readonly retryAfterSeconds?: number;
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    const retryAfterSeconds = parseRetryAfter(err.headers.get('Retry-After'));
    const body: unknown = err.error;
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const message = (body as { error: unknown }).error;
      if (typeof message === 'string' && message.length > 0) {
        return { status: err.status, message, retryAfterSeconds };
      }
    }
    return { status: err.status, message: fallbackMessage(err.status), retryAfterSeconds };
  }
  return { status: 0, message: fallbackMessage(0) };
}

function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

function fallbackMessage(status: number): string {
  switch (status) {
    case 0:
      return "Can't connect to the server";
    case 400:
      return 'Invalid request';
    case 401:
      return 'Token expired, relogin please';
    case 403:
      return 'Access denied';
    case 404:
      return "Doesn't exist";
    case 429:
      return 'Too many requests';
    case 502:
      return 'Server is down';
    case 503:
      return 'Server is down';
    default:
      return 'Something went wrong';
  }
}
