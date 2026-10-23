import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { AuthService } from '../../core/auth/auth.service';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { Session } from '../../core/auth/session';
import { TokenStore } from '../../core/auth/token-store';
import { LoginPage, safeReturnUrl } from './login-page';

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const jwt = (permissions: string[]) => `x.${btoa(JSON.stringify({ permission: permissions }))}.y`;
const tokens = (permissions: string[]) => ({
  success: true,
  statusCode: 200,
  message: null,
  errors: null,
  data: {
    accessToken: jwt(permissions),
    refreshToken: 'refresh-1',
    accessTokenExpiration: minutes(30),
    refreshTokenExpiration: minutes(60 * 24 * 14),
    userId: 'u1',
  },
});
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('safeReturnUrl', () => {
  it('lets only addresses inside the panel through', () => {
    expect(safeReturnUrl('/auctions?page=2')).toBe('/auctions?page=2');
    expect(safeReturnUrl(null)).toBe('/');
    expect(safeReturnUrl('https://evil.example')).toBe('/');
    expect(safeReturnUrl('//evil.example')).toBe('/');
    expect(safeReturnUrl('/login?returnUrl=/x')).toBe('/');
  });
});

describe('sign-in', () => {
  let backend: HttpTestingController;
  let store: TokenStore;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        providePrimeNG({}),
        MessageService,
        ConfirmationService,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(TokenStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  function fill(login: string, password: string) {
    const fixture = TestBed.createComponent(LoginPage);
    const el = fixture.nativeElement as HTMLElement;
    const set = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    return {
      fixture,
      el,
      set,
      login,
      password,
      submit: () => el.querySelector('form')!.dispatchEvent(new Event('submit')),
    };
  }

  it('signs a staff member in and goes back to where they were going', async () => {
    await router.navigateByUrl('/login?returnUrl=%2Fauctions');
    const page = fill('admin', 'Secret1!');
    await page.fixture.whenStable();
    page.set('login', ' admin ');
    page.set('password', 'Secret1!');
    page.submit();

    const signIn = backend.expectOne('/api/Auth/sign-in');
    expect(signIn.request.body).toEqual({ login: 'admin', password: 'Secret1!' });
    expect(signIn.request.headers.has('Authorization')).toBe(false);
    signIn.flush(tokens(['READ_USER']));
    backend.expectOne('/api/Auth/me').flush({ data: { fullName: 'Ali' } });
    await tick();
    await tick();

    expect(store.session()?.refreshToken).toBe('refresh-1');
    expect(router.url).toBe('/auctions');
  });

  it('shows one message for a wrong login or password and does not keep the password', async () => {
    const page = fill('a', 'b');
    await page.fixture.whenStable();
    page.set('login', 'admin');
    page.set('password', 'wrong');
    page.submit();
    backend
      .expectOne('/api/Auth/sign-in')
      .flush({ message: 'Invalid' }, { status: 401, statusText: 'Unauthorized' });
    await tick();
    page.fixture.detectChanges();

    expect(page.el.textContent).toContain('Login yoki parol noto‘g‘ri');
    const form = (
      page.fixture.componentInstance as unknown as {
        form: { controls: { password: { value: string } } };
      }
    ).form;
    expect(form.controls.password.value).toBe('');
    expect(store.session()).toBeNull();
  });

  it('refuses an account without permissions and ends its session', async () => {
    const page = fill('a', 'b');
    await page.fixture.whenStable();
    page.set('login', 'client');
    page.set('password', 'Secret1!');
    page.submit();
    backend.expectOne('/api/Auth/sign-in').flush(tokens([]));
    backend.expectOne('/api/Auth/me').flush({ data: { fullName: 'Mijoz' } });
    await tick();
    backend.expectOne('/api/Auth/logout').flush({ data: true });
    await tick();
    page.fixture.detectChanges();

    expect(page.el.textContent).toContain('Panel faqat xodimlar uchun');
    expect(store.session()).toBeNull();
  });

  it('on a rate limit shows the wait and disables the button', async () => {
    const page = fill('a', 'b');
    await page.fixture.whenStable();
    page.set('login', 'admin');
    page.set('password', 'x');
    page.submit();
    backend
      .expectOne('/api/Auth/sign-in')
      .flush(
        { message: 'Too many' },
        { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '30' } },
      );
    await tick();
    page.fixture.detectChanges();

    expect(page.el.textContent).toContain('30 soniyadan keyin');
    expect(page.el.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
    page.fixture.destroy();
  });
});

describe('AuthService.restore', () => {
  const session = (accessMinutes: number, refreshMinutes: number): Session => ({
    accessToken: jwt(['READ_USER']),
    refreshToken: 'refresh-1',
    accessTokenExpiration: minutes(accessMinutes),
    refreshTokenExpiration: minutes(refreshMinutes),
    userId: 'u',
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  it('keeps a healthy session and drops one whose refresh token has expired', async () => {
    const store = TestBed.inject(TokenStore);
    const auth = TestBed.inject(AuthService);
    store.set(session(20, 60));
    await auth.restore();
    expect(store.session()).not.toBeNull();

    store.set(session(-5, -1));
    await auth.restore();
    expect(store.session()).toBeNull();
  });

  it('renews an access token that is about to expire before the first page is built', async () => {
    const store = TestBed.inject(TokenStore);
    const backend = TestBed.inject(HttpTestingController);
    store.set(session(0, 60 * 24));
    const done = TestBed.inject(AuthService).restore();
    await tick();
    backend.expectOne('/api/Auth/refresh-token').flush(tokens(['READ_USER', 'READ_AUCTION']));
    await done;
    expect(store.session()?.refreshToken).toBe('refresh-1');
    expect(store.session()?.accessTokenExpiration).toBeDefined();
    backend.verify();
  });

  it('a sign-out the user chose does not look like an expired session', async () => {
    const auth = TestBed.inject(AuthService);
    const store = TestBed.inject(TokenStore);
    const backend = TestBed.inject(HttpTestingController);
    store.set(session(20, 60));
    auth.signOut().subscribe();
    backend.expectOne('/api/Auth/logout').flush({ data: true });
    expect(auth.isLeaving).toBe(true);
    expect(store.session()).toBeNull();
  });
});
