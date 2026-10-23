import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { Session } from '../../core/auth/session';
import { TokenStore } from '../../core/auth/token-store';
import { ApiError } from '../../core/http/api-error';
import { NAV } from '../../core/layout/nav';
import { ThemeService } from '../../core/layout/theme.service';
import { Notify } from '../../core/notify/notify.service';
import { Shell } from './shell';
import { MessageService, ConfirmationService } from 'primeng/api';

const sessionWith = (permissions: string[]): Session => ({
  accessToken: `x.${btoa(JSON.stringify({ permission: permissions }))}.y`,
  refreshToken: 'r',
  accessTokenExpiration: new Date(Date.now() + 600_000).toISOString(),
  refreshTokenExpiration: new Date(Date.now() + 86_400_000).toISOString(),
  userId: 'u',
});

describe('Shell', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePrimeNG({}),
        MessageService,
        ConfirmationService,
      ],
    });
  });

  it('shows the menu items that exist and that the user may see, and loads the profile', async () => {
    TestBed.inject(TokenStore).set(sessionWith(['READ_USER', 'READ_AUDITLOG']));
    const fixture = TestBed.createComponent(Shell);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/Auth/me')
      .flush({ data: { fullName: 'Ali Valiyev' } });
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Bosh sahifa');
    expect(text).toContain('Ali Valiyev');
    // Held permissions show their items; a permission that is not held hides it.
    expect(text).toContain('Foydalanuvchilar');
    expect(text).toContain('Audit jurnali');
    expect(text).not.toContain('Bildirishnomalar');
    expect(NAV.flatMap((g) => g.items).every((i) => i.ready)).toBe(true);
    expect(text).not.toContain('Rollar');
  });
});

describe('Notify', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [MessageService, ConfirmationService] }),
  );

  it('describes API errors in plain words and keeps the request id for server errors', () => {
    const notify = TestBed.inject(Notify);
    expect(notify.describe(new ApiError(0, 'x')).summary).toBe(
      'Serverga ulanib bo‘lmadi. Internetni tekshiring.',
    );
    expect(notify.describe(new ApiError(403, 'Forbidden')).summary).toBe(
      'Bu amal uchun ruxsatingiz yo‘q',
    );
    expect(notify.describe(new ApiError(500, 'boom', [], null, 'req-9'))).toEqual({
      summary: 'Serverda xatolik yuz berdi',
      detail: 'So‘rov raqami: req-9',
    });
    expect(notify.describe(new ApiError(429, 'Too many', [], 12)).detail).toBe(
      '12 soniyadan keyin qayta urinib ko‘ring',
    );
    expect(
      notify.describe(new ApiError(400, 'Invalid', ['Title: required', 'Order: bad'])).detail,
    ).toBe('Title: required\nOrder: bad');
  });

  it('confirm resolves with the answer of the dialog', async () => {
    const notify = TestBed.inject(Notify);
    const confirmations = TestBed.inject(ConfirmationService);
    confirmations.requireConfirmation$.subscribe((confirmation) => confirmation?.accept?.());
    await expect(notify.confirm({ message: 'ok?' })).resolves.toBe(true);
  });
});

describe('ThemeService', () => {
  it('toggles the dark class and remembers the choice', () => {
    localStorage.clear();
    const theme = TestBed.inject(ThemeService);
    const before = theme.dark();
    theme.toggle();
    expect(theme.dark()).toBe(!before);
    expect(document.documentElement.classList.contains('app-dark')).toBe(!before);
    expect(localStorage.getItem('irieltor.admin.theme')).toBe(before ? 'light' : 'dark');
    theme.toggle();
    expect(document.documentElement.classList.contains('app-dark')).toBe(before);
  });
});
