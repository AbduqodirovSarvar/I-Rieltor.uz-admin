import { Injectable, computed, inject } from '@angular/core';
import { readClaims } from './jwt';
import { TokenStore } from './token-store';

/**
 * What the signed-in user may do, read from the `permission` claims of the access token (the same claims the backend's
 * policies check). A permission granted while the user is signed in appears at the next token refresh.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly store = inject(TokenStore);

  private readonly claims = computed(() => readClaims(this.store.session()?.accessToken));

  readonly permissions = computed(() => new Set(this.claims().permissions));
  readonly role = computed(() => this.claims().role);
  readonly userId = computed(() => this.claims().userId);

  has(permission: string): boolean {
    return this.permissions().has(permission);
  }

  /** True when the user has at least one of them (an empty list means "no requirement"). */
  hasAny(permissions: readonly string[]): boolean {
    return permissions.length === 0 || permissions.some((p) => this.permissions().has(p));
  }
}
