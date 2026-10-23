import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from './permission.service';
import { TokenStore } from './token-store';

/** Route data key: a permission name or a list of them (any one is enough). */
export const PERMISSION_DATA = 'permission';

/** Only for a signed-in user; others go to the sign-in page and come back afterwards (`returnUrl`). */
export const authGuard: CanActivateFn = (_route, state) => {
  const store = inject(TokenStore);
  const router = inject(Router);
  return store.session()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** For pages a signed-in user has no reason to see (sign-in). */
export const guestGuard: CanActivateFn = () => {
  const store = inject(TokenStore);
  const router = inject(Router);
  return store.session() ? router.createUrlTree(['/']) : true;
};

/** Needs `data: { permission: 'READ_USER' }` (or an array) on the route; without the permission the user sees the 403 page. */
export const permissionGuard: CanActivateFn = (route) => {
  const permissions = inject(PermissionService);
  const router = inject(Router);
  const required = route.data[PERMISSION_DATA] as string | string[] | undefined;
  const list = required === undefined ? [] : Array.isArray(required) ? required : [required];
  return permissions.hasAny(list) ? true : router.createUrlTree(['/forbidden']);
};
