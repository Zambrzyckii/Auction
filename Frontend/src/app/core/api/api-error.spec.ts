import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { toApiError } from './api-error';

function httpError(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('toApiError', () => {
  it('passes the backend {"error": ...} body through', () => {
    const result = toApiError(httpError(409, { error: 'Bid already in progress.' }));
    expect(result).toEqual({ status: 409, message: 'Bid already in progress.' });
  });

  it('keeps the gateway JSON bodies for 429 and 413', () => {
    expect(toApiError(httpError(429, { error: 'Too many requests' })).message).toBe(
      'Too many requests',
    );
    expect(toApiError(httpError(413, { error: 'Request body too large' })).message).toBe(
      'Request body too large',
    );
  });

  it('falls back on the empty 400 of a binding failure', () => {
    const result = toApiError(httpError(400, null));
    expect(result.status).toBe(400);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('falls back on the empty 401 and 403', () => {
    for (const status of [401, 403]) {
      const result = toApiError(httpError(status, null));
      expect(result.status).toBe(status);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('never shows the 502 HTML page to the player', () => {
    const html = '<html><body><h1>502 Bad Gateway</h1></body></html>';
    const result = toApiError(httpError(502, html));
    expect(result.status).toBe(502);
    expect(result.message).not.toContain('<');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('handles a network failure with status 0', () => {
    const result = toApiError(httpError(0, new ProgressEvent('error')));
    expect(result.status).toBe(0);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('carries a numeric Retry-After header into retryAfterSeconds', () => {
    const headers = new HttpHeaders({ 'Retry-After': '1' });
    const result = toApiError(new HttpErrorResponse({ status: 429, error: null, headers }));
    expect(result.retryAfterSeconds).toBe(1);
  });

  it('ignores a missing or malformed Retry-After header', () => {
    expect(toApiError(httpError(429, null)).retryAfterSeconds).toBeUndefined();
    const headers = new HttpHeaders({ 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' });
    const result = toApiError(new HttpErrorResponse({ status: 429, error: null, headers }));
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it('gives distinct texts to statuses a player acts on differently', () => {
    const m401 = toApiError(httpError(401, null)).message;
    const m429 = toApiError(httpError(429, null)).message;
    const m0 = toApiError(httpError(0, null)).message;
    expect(new Set([m401, m429, m0]).size).toBe(3);
  });
});
