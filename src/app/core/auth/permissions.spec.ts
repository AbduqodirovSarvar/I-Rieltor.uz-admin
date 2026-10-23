import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { authGuard, guestGuard, permissionGuard } from './auth.guards';
import { readClaims } from './jwt';
import { PermissionService } from './permission.service';
import { Session } from './session';
import { TokenStore } from './token-store';

const ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const USER = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

function sessionWith(claims: Record<string, unknown>): Session {
  return {
    accessToken: makeToken(claims),
    refreshToken: 'r',
    accessTokenExpiration: new Date(Date.now() + 600_000).toISOString(),
    refreshTokenExpiration: new Date(Date.now() + 86_400_000).toISOString(),
    userId: 'u1',
  };
}

@Component({ template: 'page' })
class Page {}

describe('readClaims', () => {
  it('reads the user, the role and a list of permissions', () => {
    const claims = readClaims(
      makeToken({
        [USER]: 'user-1',
        [ROLE]: 'SUPER_ADMIN',
        permission: ['READ_USER', 'READ_AUCTION'],
      }),
    );
    expect(claims).toEqual({
      userId: 'user-1',
      role: 'SUPER_ADMIN',
      permissions: ['READ_USER', 'READ_AUCTION'],
    });
  });

  it('reads a single permission (a string, not an array)', () => {
    expect(readClaims(makeToken({ permission: 'READ_USER' })).permissions).toEqual(['READ_USER']);
  });

  it('survives non-ASCII text and tokens that are not tokens', () => {
    expect(readClaims(makeToken({ [ROLE]: 'Mudir Ўзбек' })).role).toBe('Mudir Ўзбек');
    expect(readClaims('garbage')).toEqual({ userId: null, role: null, permissions: [] });
    expect(readClaims(null).permissions).toEqual([]);
  });
});

describe('PermissionService and guards', () => {
  let store: TokenStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Page },
          { path: 'login', component: Page, canActivate: [guestGuard] },
          { path: 'forbidden', component: Page },
          { path: 'private', component: Page, canActivate: [authGuard] },
          {
            path: 'users',
            component: Page,
            canActivate: [authGuard, permissionGuard],
            data: { permission: 'READ_USER' },
          },
          {
            path: 'either',
            component: Page,
            canActivate: [permissionGuard],
            data: { permission: ['READ_USER', 'READ_AUCTION'] },
          },
          { path: 'open', component: Page, canActivate: [permissionGuard] },
        ]),
      ],
    });
    store = TestBed.inject(TokenStore);
  });

  it('answers from the permission claims of the current session and follows a new session', () => {
    const permissions = TestBed.inject(PermissionService);
    expect(permissions.has('READ_USER')).toBe(false);
    store.set(sessionWith({ [ROLE]: 'MANAGER', permission: ['READ_USER'] }));
    expect(permissions.has('READ_USER')).toBe(true);
    expect(permissions.has('DELETE_USER')).toBe(false);
    expect(permissions.hasAny(['DELETE_USER', 'READ_USER'])).toBe(true);
    expect(permissions.hasAny([])).toBe(true);
    expect(permissions.role()).toBe('MANAGER');
    store.clear();
    expect(permissions.has('READ_USER')).toBe(false);
  });

  it('sends a visitor from a private page to the sign-in page with the way back', async () => {
    await RouterTestingHarness.create('/private');
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/login?returnUrl=%2Fprivate');
  });

  it('keeps a signed-in user away from the sign-in page', async () => {
    store.set(sessionWith({ permission: [] }));
    await RouterTestingHarness.create('/login');
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('lets a user with the permission in and sends the others to /forbidden', async () => {
    store.set(sessionWith({ permission: ['READ_USER'] }));
    const harness = await RouterTestingHarness.create('/users');
    expect(TestBed.inject(Router).url).toBe('/users');

    await harness.navigateByUrl('/');
    store.set(sessionWith({ permission: ['READ_AUCTION'] }));
    await harness.navigateByUrl('/users');
    expect(TestBed.inject(Router).url).toBe('/forbidden');

    await harness.navigateByUrl('/either');
    expect(TestBed.inject(Router).url).toBe('/either');
  });

  it('a route without a permission requirement is open to everyone', async () => {
    await RouterTestingHarness.create('/open');
    expect(TestBed.inject(Router).url).toBe('/open');
  });
});
