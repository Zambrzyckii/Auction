export interface JwtClaims {
  readonly nameid: string;
  readonly unique_name: string;
  readonly role: string;
  readonly exp: number;
}

export function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const json = decodeBase64Url(parts[1]);
  if (json === null) {
    return null;
  }
  try {
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

function decodeBase64Url(segment: string): string | null {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='); 
  try {
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } 
  catch {
    return null
  }         
}
