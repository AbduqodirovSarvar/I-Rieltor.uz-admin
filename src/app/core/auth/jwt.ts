const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const USER_ID_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

export interface JwtClaims {
  userId: string | null;
  role: string | null;
  permissions: string[];
}

/** Reads the payload of a JWT (no signature check: the server does that; this only drives what the UI shows). */
export function readClaims(token: string | null | undefined): JwtClaims {
  const empty: JwtClaims = { userId: null, role: null, permissions: [] };
  if (!token) return empty;
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) =>
      c.charCodeAt(0),
    );
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const permission = claims['permission'];
    return {
      userId: typeof claims[USER_ID_CLAIM] === 'string' ? (claims[USER_ID_CLAIM] as string) : null,
      role: typeof claims[ROLE_CLAIM] === 'string' ? (claims[ROLE_CLAIM] as string) : null,
      // One permission is a string, several are an array.
      permissions: Array.isArray(permission)
        ? permission.filter((p): p is string => typeof p === 'string')
        : typeof permission === 'string'
          ? [permission]
          : [],
    };
  } catch {
    return empty;
  }
}
