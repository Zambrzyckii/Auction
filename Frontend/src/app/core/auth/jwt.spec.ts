import { decodeJwtClaims } from './jwt';

// Header and payload of a real token issued by the local stack; the signature is irrelevant here.
const REAL_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJ1bmlxdWVfbmFtZSI6InByb2JlMUB0ZXN0LmxvY2FsIiwibmFtZWlkIjoiMjZhNDUxZDQtZGQ3NC00YTU4LTg1OWYtNjM2YWNhMjU4NDQzIiwicm9sZSI6IlVzZXIiLCJuYmYiOjE3OTQxNDgxNjcsImV4cCI6MTc5NDE0OTA2NywiaWF0IjoxNzk0MTQ4MTY3LCJpc3MiOiJBdWN0aW9uU2VydmVyIiwiYXVkIjoiQXVjdGlvblNlcnZlci5DbGllbnQifQ.' +
  'x';

function tokenWithPayload(payload: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const segment = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `h.${segment}.s`;
}

describe('decodeJwtClaims', () => {
  it('reads the claims of a token issued by the backend', () => {
    const claims = decodeJwtClaims(REAL_TOKEN);
    expect(claims?.nameid).toBe('26a451d4-dd74-4a58-859f-636aca258443');
    expect(claims?.unique_name).toBe('probe1@test.local');
    expect(claims?.role).toBe('User');
    expect(claims?.exp).toBe(1794149067);
  });

  it('decodes url-safe characters, stripped padding and UTF-8', () => {
    const claims = decodeJwtClaims(
      tokenWithPayload({ nameid: 'x', unique_name: 'zażółć@test.local', role: 'User', exp: 1 }),
    );
    expect(claims?.unique_name).toBe('zażółć@test.local');
  });

  it('returns null for malformed input', () => {
    expect(decodeJwtClaims('garbage')).toBeNull();
    expect(decodeJwtClaims('only.two')).toBeNull();
    expect(decodeJwtClaims('a.!!!not-base64!!!.c')).toBeNull();
  });
});
