import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { TokenStore } from '../../core/auth/token-store';
import { Notify } from '../../core/notify/notify.service';
import { ProfilePage } from './profile-page';

const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

interface PageApi {
  emailForm: { setValue(value: { email: string }): void; controls: { email: { value: string } } };
  passwordForm: {
    setValue(value: { currentPassword: string; newPassword: string; repeat: string }): void;
    invalid: boolean;
  };
  saveEmail(): void;
  resend(): void;
  changePassword(): void;
}

describe('ProfilePage', () => {
  let backend: HttpTestingController;
  let store: TokenStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        providePrimeNG({}),
        MessageService,
        ConfirmationService,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(TokenStore);
    store.set({
      accessToken: `x.${btoa(JSON.stringify({ permission: ['READ_USER'] }))}.y`,
      refreshToken: 'refresh-old',
      accessTokenExpiration: minutes(20),
      refreshTokenExpiration: minutes(60),
      userId: 'u1',
    });
  });

  afterEach(() => backend.verify());

  async function open(email: string | null, confirmedAt: string | null) {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    backend.expectOne('/api/Auth/me').flush({
      data: {
        fullName: 'Ali Valiyev',
        login: 'ali',
        phone: '+998901234567',
        email,
        emailConfirmedAt: confirmedAt,
      },
    });
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
      page: fixture.componentInstance as unknown as PageApi,
    };
  }

  it('shows the details and warns that an e-mail is not confirmed, offering to resend', async () => {
    const { el, page } = await open('ali@example.com', null);
    expect(el.textContent).toContain('Ali Valiyev');
    expect(el.textContent).toContain('+998 90 123 45 67');
    expect(el.textContent).toContain('Tasdiqlanmagan');
    expect(page.emailForm.controls.email.value).toBe('ali@example.com');

    const notify = vi.spyOn(TestBed.inject(Notify), 'success');
    page.resend();
    backend.expectOne('/api/Auth/me/email/resend-confirmation').flush({ data: true });
    expect(notify).toHaveBeenCalledWith('Tasdiqlash xati qayta yuborildi');
  });

  it('saves a new e-mail and reloads the profile', async () => {
    const { page } = await open(null, null);
    page.emailForm.setValue({ email: 'new@example.com' });
    page.saveEmail();
    const request = backend.expectOne('/api/Auth/me/email');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ email: 'new@example.com' });
    request.flush({ data: true });
    backend
      .expectOne('/api/Auth/me')
      .flush({ data: { email: 'new@example.com', emailConfirmedAt: null } });
  });

  it('does not send a weak or mismatching password, and takes the new tokens after a change', async () => {
    const { page } = await open('a@b.co', minutes(-1));

    page.passwordForm.setValue({
      currentPassword: 'Old1!pass',
      newPassword: 'weak',
      repeat: 'weak',
    });
    page.changePassword();
    backend.expectNone('/api/Auth/me/password');

    page.passwordForm.setValue({
      currentPassword: 'Old1!pass',
      newPassword: 'New1!pass',
      repeat: 'Other1!pass',
    });
    page.changePassword();
    backend.expectNone('/api/Auth/me/password');

    page.passwordForm.setValue({
      currentPassword: 'Old1!pass',
      newPassword: 'New1!pass',
      repeat: 'New1!pass',
    });
    page.changePassword();
    const request = backend.expectOne('/api/Auth/me/password');
    expect(request.request.body).toEqual({
      currentPassword: 'Old1!pass',
      newPassword: 'New1!pass',
    });
    request.flush({
      data: {
        accessToken: `x.${btoa(JSON.stringify({ permission: ['READ_USER'] }))}.y`,
        refreshToken: 'refresh-new',
        accessTokenExpiration: minutes(30),
        refreshTokenExpiration: minutes(60 * 24),
        userId: 'u1',
      },
    });
    await tick();
    expect(store.session()?.refreshToken).toBe('refresh-new');
  });
});
