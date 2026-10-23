import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/auth/permission.service';
import { TokenResponse } from '../../core/auth/session';
import { applyServerErrors } from '../../core/forms/server-errors';
import { matchesValidator, passwordValidator } from '../../core/forms/validators';
import { PhonePipe } from '../../core/format/format';
import { ApiClient } from '../../core/http/api-client';
import { ApiError } from '../../core/http/api-error';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { FormField } from '../../shared/ui/form-field/form-field';

/** The signed-in user's own page: details, e-mail (set / confirm) and password. */
@Component({
  selector: 'app-profile-page',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
    FormField,
    PhonePipe,
    TPipe,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);
  protected readonly role = inject(PermissionService).role;

  protected readonly user = this.auth.currentUser;
  protected readonly emailBusy = signal(false);
  protected readonly resendBusy = signal(false);
  protected readonly passwordBusy = signal(false);
  protected readonly emailUnconfirmed = computed(
    () => !!this.user()?.email && !this.user()?.emailConfirmedAt,
  );

  protected readonly emailForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(150)],
    }),
  });

  protected readonly passwordForm = new FormGroup(
    {
      currentPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(128)],
      }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, passwordValidator, Validators.maxLength(128)],
      }),
      repeat: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: matchesValidator('newPassword', 'repeat') },
  );

  ngOnInit(): void {
    this.auth
      .loadProfile()
      .subscribe((user) => this.emailForm.controls.email.setValue(user?.email ?? ''));
  }

  protected saveEmail(): void {
    this.emailForm.markAllAsTouched();
    if (this.emailForm.invalid || this.emailBusy()) return;
    this.emailBusy.set(true);
    this.api
      .put<boolean>('api/Auth/me/email', { email: this.emailForm.controls.email.value.trim() })
      .subscribe({
        next: () => {
          this.emailBusy.set(false);
          this.notify.success(this.i18n.t('profile.emailSaved'));
          this.auth.loadProfile().subscribe();
        },
        error: (error: unknown) =>
          this.fail(error, this.emailForm, () => this.emailBusy.set(false)),
      });
  }

  protected resend(): void {
    if (this.resendBusy()) return;
    this.resendBusy.set(true);
    this.api.post<boolean>('api/Auth/me/email/resend-confirmation').subscribe({
      next: () => {
        this.resendBusy.set(false);
        this.notify.success(this.i18n.t('profile.resent'));
      },
      error: (error: unknown) => {
        this.resendBusy.set(false);
        this.notify.error(error);
      },
    });
  }

  protected changePassword(): void {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.passwordBusy()) return;
    this.passwordBusy.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.api
      .put<TokenResponse>('api/Auth/me/password', { currentPassword, newPassword })
      .subscribe({
        next: (token) => {
          // The server closed every other session and issued fresh tokens for this one.
          this.auth.adoptTokens(token);
          this.passwordBusy.set(false);
          this.passwordForm.reset({ currentPassword: '', newPassword: '', repeat: '' });
          this.notify.success(this.i18n.t('profile.passwordChanged'));
        },
        error: (error: unknown) =>
          this.fail(error, this.passwordForm, () => this.passwordBusy.set(false)),
      });
  }

  private fail(error: unknown, form: FormGroup, done: () => void): void {
    done();
    const apiError = ApiError.from(error);
    const rest = apiError.isValidation ? applyServerErrors(form, apiError) : [apiError.message];
    if (rest.length > 0)
      this.notify.error(
        new ApiError(apiError.status, rest.join('\n'), [], apiError.retryAfter, apiError.requestId),
      );
  }
}
