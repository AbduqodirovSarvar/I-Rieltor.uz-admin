import { effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TokenStore } from './token-store';

const PUBLIC_PATHS = ['/login', '/forbidden'];

/**
 * Call once from the root component. When the session disappears while a page is open (the refresh token was refused,
 * the user signed out in another tab) the user is taken to the sign-in page and returns to the same page afterwards.
 */
export function watchSession(): void {
  const store = inject(TokenStore);
  const router = inject(Router);
  effect(() => {
    if (store.session()) return;
    const path = router.url.split('?')[0];
    if (router.navigated && !PUBLIC_PATHS.includes(path)) {
      void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
    }
  });
}
