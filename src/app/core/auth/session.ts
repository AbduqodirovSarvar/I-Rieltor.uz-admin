/** What the backend returns on sign-in and refresh (TokenViewModel). */
export interface TokenResponse {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiration: string | null;
  refreshTokenExpiration: string | null;
  tokenType?: string | null;
  userId?: string | null;
}

/** The signed-in session as kept in the browser. Times are ISO UTC strings. */
export interface Session {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiration: string;
  refreshTokenExpiration: string;
  userId: string;
}

export function toSession(token: TokenResponse): Session {
  if (
    !token.accessToken ||
    !token.refreshToken ||
    !token.accessTokenExpiration ||
    !token.refreshTokenExpiration
  ) {
    throw new Error('The server returned an incomplete token response.');
  }
  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    accessTokenExpiration: token.accessTokenExpiration,
    refreshTokenExpiration: token.refreshTokenExpiration,
    userId: token.userId ?? '',
  };
}

/** The access token is renewed this long before it expires, so a request never leaves with a dying token. */
export const EXPIRY_SKEW_MS = 30_000;

export function isAccessTokenExpiring(session: Session, now = Date.now()): boolean {
  return Date.parse(session.accessTokenExpiration) - now <= EXPIRY_SKEW_MS;
}

export function isRefreshTokenExpired(session: Session, now = Date.now()): boolean {
  return Date.parse(session.refreshTokenExpiration) <= now;
}
