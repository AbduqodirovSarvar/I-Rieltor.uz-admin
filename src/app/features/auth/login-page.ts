import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';
import { ThemeService } from '../../core/layout/theme.service';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { FormField } from '../../shared/ui/form-field/form-field';

/** Only addresses inside the panel: no `//host`, no `http://...`, never the sign-in page itself. */
export function safeReturnUrl(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login'))
    return '/';
  return value;
}

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
    FormField,
    TPipe,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18n);
  protected readonly theme = inject(ThemeService);

  protected readonly form = new FormGroup({
    login: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128)],
    }),
  });

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Seconds left of a rate-limit wait (429); the button is disabled meanwhile. */
  protected readonly wait = signal(0);
  protected readonly notice = computed(() => {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    return reason === 'expired' ? this.i18n.t('auth.sessionExpired') : null;
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy() || this.wait() > 0) return;
    this.busy.set(true);
    this.error.set(null);
    const { login, password } = this.form.getRawValue();
    this.auth.signIn(login.trim(), password).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl(
          safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        );
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.form.controls.password.reset('');
        this.showError(ApiError.from(error));
      },
    });
  }

  private showError(error: ApiError): void {
    if (error.status === 429) {
      const seconds = error.retryAfter ?? 30;
      this.error.set(this.i18n.t('auth.tooMany', { seconds }));
      this.startWait(seconds);
    } else if (error.status === 401 || error.status === 400) {
      this.error.set(this.i18n.t('auth.invalid'));
    } else {
      this.error.set(error.message);
    }
  }

  private startWait(seconds: number): void {
    this.wait.set(seconds);
    this.timer = setInterval(() => {
      this.wait.update((n) => n - 1);
      if (this.wait() <= 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
        this.error.set(null);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
