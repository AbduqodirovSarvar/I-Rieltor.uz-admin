import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../http/api-client';
import { ApiError } from '../http/api-error';
import { I18n } from '../i18n/i18n.service';
import { PermissionService } from './permission.service';
import {
  Session,
  TokenResponse,
  isAccessTokenExpiring,
  isRefreshTokenExpired,
  toSession,
} from './session';
import { TokenRefresher } from './token-refresher';
import { TokenStore } from './token-store';

export type CurrentUser = components['schemas']['UserViewModel'];

/** Who is signed in; signing in and out; picking the session up again after a page reload. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly store = inject(TokenStore);
  private readonly permissions = inject(PermissionService);
  private readonly refresher = inject(TokenRefresher);
  private readonly i18n = inject(I18n);

  private readonly user = signal<CurrentUser | null>(null);

  /** True while the user themself is leaving, so the "your session expired" redirect stays quiet. */
  private leaving = false;

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.store.session() !== null);
  readonly displayName = computed(() => this.user()?.fullName || this.user()?.login || '');
  readonly role = this.permissions.role;

  get isLeaving(): boolean {
    return this.leaving;
  }

  /**
   * Signs in with login and password. The panel is for staff: an account without any permission is refused and its session
   * is ended at once.
   */
  signIn(login: string, password: string): Observable<CurrentUser> {
    this.leaving = false;
    return this.api
      .post<TokenResponse>('api/Auth/sign-in', { login, password }, { skipAuth: true })
      .pipe(
        tap((token) => this.store.set(toSession(token))),
        switchMap(() => this.api.get<CurrentUser>('api/Auth/me')),
        tap((user) => this.user.set(user)),
        switchMap((user) => {
          if (this.permissions.permissions().size > 0) return of(user);
          return this.signOut().pipe(
            switchMap(() => throwError(() => new ApiError(403, this.i18n.t('auth.staffOnly')))),
          );
        }),
      );
  }

  /** Loads the profile (name, role, e-mail) of the signed-in user. */
  loadProfile(): Observable<CurrentUser | null> {
    return this.api.get<CurrentUser>('api/Auth/me').pipe(
      tap((user) => this.user.set(user)),
      catchError(() => of(null)),
    );
  }

  /** The tokens came from a password change; the profile is unchanged. */
  adoptTokens(token: TokenResponse): void {
    this.store.set(toSession(token));
  }

  /** Ends the session on the server (best effort) and on this device; other tabs notice through the storage event. */
  signOut(): Observable<unknown> {
    this.leaving = true;
    const refreshToken = this.store.session()?.refreshToken;
    const request$ = refreshToken
      ? this.api.post('api/Auth/logout', { refreshToken }, { skipAuth: true })
      : of(null);
    return request$.pipe(
      catchError(() => of(null)),
      finalize(() => {
        this.store.clear();
        this.user.set(null);
      }),
    );
  }

  /**
   * At application start: a stored session whose refresh token is already dead is dropped; one whose access token is
   * (nearly) dead is renewed now, so the first page is built with fresh permissions.
   */
  async restore(): Promise<void> {
    const session: Session | null = this.store.reload();
    if (!session) return;
    if (isRefreshTokenExpired(session)) {
      this.store.clear();
      return;
    }
    if (isAccessTokenExpiring(session)) {
      try {
        await firstValueFrom(this.refresher.refresh(session.refreshToken));
      } catch {
        // Refused: the store was cleared (sign-in page). Network down: the session stays, the first call retries.
      }
    }
  }
}
