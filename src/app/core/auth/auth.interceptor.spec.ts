import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { Session } from './session';
import { SKIP_AUTH } from './token-refresher';
import { TokenStore } from './token-store';

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const session = (suffix: string, accessMinutes = 20): Session => ({
  accessToken: `access-${suffix}`,
  refreshToken: `refresh-${suffix}`,
  accessTokenExpiration: minutesFromNow(accessMinutes),
  refreshTokenExpiration: minutesFromNow(60 * 24),
  userId: 'u1',
});

const tokenResponse = (suffix: string) => ({
  success: true,
  statusCode: 200,
  message: null,
  errors: null,
  data: {
    accessToken: `access-${suffix}`,
    refreshToken: `refresh-${suffix}`,
    accessTokenExpiration: minutesFromNow(30),
    refreshTokenExpiration: minutesFromNow(60 * 24 * 14),
    userId: 'u1',
  },
});

const unauthorized = { status: 401, statusText: 'Unauthorized' };

/** The refresh runs through promises, so its request appears a moment after the call that needed it. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let store: TokenStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(TokenStore);
  });

  afterEach(() => backend.verify());

  it('sends API calls without a session as they are', () => {
    http.get('/api/Slide/public').subscribe();
    expect(backend.expectOne('/api/Slide/public').request.headers.has('Authorization')).toBe(false);
  });

  it('adds the access token to API calls and leaves other addresses alone', () => {
    store.set(session('1'));
    http.get('/api/User/list').subscribe();
    http.get('/assets/logo.svg').subscribe();
    expect(backend.expectOne('/api/User/list').request.headers.get('Authorization')).toBe(
      'Bearer access-1',
    );
    expect(backend.expectOne('/assets/logo.svg').request.headers.has('Authorization')).toBe(false);
  });

  it('does not add the token or refresh for requests marked SKIP_AUTH (sign-in)', () => {
    store.set(session('1'));
    let status = 0;
    http
      .post('/api/Auth/sign-in', {}, { context: new HttpContext().set(SKIP_AUTH, true) })
      .subscribe({ error: (e) => (status = e.status) });
    const request = backend.expectOne('/api/Auth/sign-in');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({}, unauthorized);
    expect(status).toBe(401);
    expect(store.session()).not.toBeNull();
  });

  it('renews a token that is about to expire before sending the call', async () => {
    store.set(session('old', 0));
    let done = false;
    http.get('/api/User/list').subscribe(() => (done = true));
    await tick();
    backend.expectOne('/api/Auth/refresh-token').flush(tokenResponse('new'));
    await tick();
    const request = backend.expectOne('/api/User/list');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-new');
    request.flush({ data: [] });
    expect(done).toBe(true);
  });

  it('on a 401 renews once and repeats the call', async () => {
    store.set(session('1'));
    let result: unknown;
    http.get('/api/User/list').subscribe((value) => (result = value));
    backend.expectOne('/api/User/list').flush({}, unauthorized);
    await tick();

    const refresh = backend.expectOne('/api/Auth/refresh-token');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    refresh.flush(tokenResponse('2'));
    await tick();

    const repeated = backend.expectOne('/api/User/list');
    expect(repeated.request.headers.get('Authorization')).toBe('Bearer access-2');
    repeated.flush({ data: 'ok' });
    expect(result).toEqual({ data: 'ok' });
    expect(store.session()?.refreshToken).toBe('refresh-2');
  });

  it('five calls refused at once cause ONE refresh request', async () => {
    store.set(session('1'));
    const results: unknown[] = [];
    for (let i = 0; i < 5; i++)
      http.get(`/api/Item/${i}`).subscribe((value) => results.push(value));
    for (let i = 0; i < 5; i++) backend.expectOne(`/api/Item/${i}`).flush({}, unauthorized);
    await tick();

    const refreshes = backend.match('/api/Auth/refresh-token');
    expect(refreshes.length).toBe(1);
    refreshes[0].flush(tokenResponse('2'));
    await tick();

    for (let i = 0; i < 5; i++) {
      const repeated = backend.expectOne(`/api/Item/${i}`);
      expect(repeated.request.headers.get('Authorization')).toBe('Bearer access-2');
      repeated.flush({ i });
    }
    expect(results.length).toBe(5);
  });

  it('uses the session another tab already refreshed instead of refreshing again', async () => {
    store.set(session('1'));
    let result: unknown;
    http.get('/api/User/list').subscribe((value) => (result = value));
    // The other tab stores new tokens before this tab handles the 401.
    localStorage.setItem('irieltor.admin.session', JSON.stringify(session('other')));
    backend.expectOne('/api/User/list').flush({}, unauthorized);
    await tick();

    backend.expectNone('/api/Auth/refresh-token');
    const repeated = backend.expectOne('/api/User/list');
    expect(repeated.request.headers.get('Authorization')).toBe('Bearer access-other');
    repeated.flush({ data: 1 });
    expect(result).toEqual({ data: 1 });
  });

  it('drops the session when the server refuses the refresh token', async () => {
    store.set(session('1'));
    let status = 0;
    http.get('/api/User/list').subscribe({ error: (e) => (status = e.status) });
    backend.expectOne('/api/User/list').flush({}, unauthorized);
    await tick();
    backend.expectOne('/api/Auth/refresh-token').flush({ message: 'revoked' }, unauthorized);
    await tick();

    expect(status).toBe(401);
    expect(store.session()).toBeNull();
    expect(localStorage.getItem('irieltor.admin.session')).toBeNull();
  });

  it('keeps the session when the refresh fails only because the network is down', async () => {
    store.set(session('1'));
    let failed = false;
    http.get('/api/User/list').subscribe({ error: () => (failed = true) });
    backend.expectOne('/api/User/list').flush({}, unauthorized);
    await tick();
    backend.expectOne('/api/Auth/refresh-token').error(new ProgressEvent('error'));
    await tick();

    expect(failed).toBe(true);
    expect(store.session()).not.toBeNull();
  });
});
