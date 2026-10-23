import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Observable, firstValueFrom, from } from 'rxjs';
import { ApiError } from '../http/api-error';
import { ApiClient } from '../http/api-client';
import { SKIP_AUTH } from '../http/skip-auth';
import { ResponseModel } from '../http/response-model';
import { Session, TokenResponse, toSession } from './session';
import { TokenStore } from './token-store';

export { SKIP_AUTH };

const LOCK_NAME = 'irieltor-admin-refresh';

/**
 * Renews the tokens with exactly ONE refresh request, however many calls (or tabs) need it at once. The backend rotates the
 * refresh token on every use and treats a second use of the old one as theft, closing all sessions; so:
 *  - calls in this tab share one in-flight promise;
 *  - tabs take turns through a Web Lock, and the one that comes second finds the new tokens in the storage and uses them.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefresher {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiClient);
  private readonly store = inject(TokenStore);
  private readonly navigator = inject(DOCUMENT).defaultView?.navigator;
  private inFlight: Promise<Session> | null = null;

  /** @param usedRefreshToken the refresh token the caller's session had; if the storage already holds a newer one, that session is returned. */
  refresh(usedRefreshToken: string): Observable<Session> {
    return from(
      (this.inFlight ??= this.run(usedRefreshToken).finally(() => (this.inFlight = null))),
    );
  }

  /** The session is over: forget the tokens (the app then shows the sign-in page). */
  expire(): void {
    this.store.clear();
  }

  private run(usedRefreshToken: string): Promise<Session> {
    const locks = this.navigator?.locks;
    return locks
      ? locks.request(LOCK_NAME, () => this.renew(usedRefreshToken))
      : this.renew(usedRefreshToken);
  }

  private async renew(usedRefreshToken: string): Promise<Session> {
    const current = this.store.reload();
    if (!current) throw new ApiError(401, 'Sessiya tugagan');
    // Another tab (or an earlier call) already exchanged that token: its result is the new session.
    if (current.refreshToken !== usedRefreshToken) return current;

    try {
      const response = await firstValueFrom(
        this.http.post<ResponseModel<TokenResponse>>(
          this.api.url('api/Auth/refresh-token'),
          { refreshToken: current.refreshToken },
          { context: new HttpContext().set(SKIP_AUTH, true) },
        ),
      );
      const session = toSession(response.data);
      this.store.set(session);
      return session;
    } catch (error) {
      const apiError = ApiError.from(error);
      // The server refused the token (expired, revoked, reused): the session cannot be saved. A network failure keeps it.
      if (apiError.status === 400 || apiError.status === 401 || apiError.status === 403)
        this.store.clear();
      throw apiError;
    }
  }
}
