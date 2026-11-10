import {
  REAL_TOKEN,
  REAL_TOKEN_EMAIL,
  REAL_TOKEN_EXP,
  REAL_TOKEN_USER_ID,
} from '../../../testing/token-fixture';
import { decodeJwtClaims } from './jwt';

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
    expect(claims?.nameid).toBe(REAL_TOKEN_USER_ID);
    expect(claims?.unique_name).toBe(REAL_TOKEN_EMAIL);
    expect(claims?.role).toBe('User');
    expect(claims?.exp).toBe(REAL_TOKEN_EXP);
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
