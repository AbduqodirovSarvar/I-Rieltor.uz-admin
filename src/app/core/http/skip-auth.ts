import { HttpContextToken } from '@angular/common/http';

/** Set on requests that must not carry the access token and must not trigger a refresh (sign-in, refresh itself). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
