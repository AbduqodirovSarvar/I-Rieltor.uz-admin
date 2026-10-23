import { effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenStore } from './token-store';

const PUBLIC_PATHS = ['/login'];

/**
 * Call once from the root component. When the session disappears while a page is open (the refresh token was refused,
 * the user signed out in another tab) the user is taken to the sign-in page, with a note, and returns to the same page
 * afterwards. A sign-out the user chose themself is handled where it happens.
 */
export function watchSession(): void {
  const store = inject(TokenStore);
  const router = inject(Router);
  const auth = inject(AuthService);
  effect(() => {
    if (store.session()) return;
    const path = router.url.split('?')[0];
    if (auth.isLeaving || !router.navigated || PUBLIC_PATHS.includes(path)) return;
    void router.navigate(['/login'], { queryParams: { returnUrl: router.url, reason: 'expired' } });
  });
}
