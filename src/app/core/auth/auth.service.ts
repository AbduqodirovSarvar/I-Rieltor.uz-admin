import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../http/api-client';
import { PermissionService } from './permission.service';
import { TokenStore } from './token-store';

export type CurrentUser = components['schemas']['UserViewModel'];

/** Who is signed in, and ending the session. Sign-in itself is in the sign-in feature. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly store = inject(TokenStore);
  private readonly permissions = inject(PermissionService);

  private readonly user = signal<CurrentUser | null>(null);

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.store.session() !== null);
  readonly displayName = computed(() => this.user()?.fullName || this.user()?.login || '');
  readonly role = this.permissions.role;

  /** Loads the profile (name, role) of the signed-in user. */
  loadProfile(): Observable<CurrentUser | null> {
    return this.api.get<CurrentUser>('api/Auth/me').pipe(
      tap((user) => this.user.set(user)),
      catchError(() => of(null)),
    );
  }

  /** Ends the session on the server (best effort) and on this device. */
  signOut(): Observable<unknown> {
    const refreshToken = this.store.session()?.refreshToken;
    const request$ = refreshToken ? this.api.post('api/Auth/logout', { refreshToken }) : of(null);
    return request$.pipe(
      catchError(() => of(null)),
      finalize(() => {
        this.store.clear();
        this.user.set(null);
      }),
    );
  }
}
