import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { HasUnsavedChanges } from '../../core/forms/unsaved-changes.guard';
import { applyServerErrors } from '../../core/forms/server-errors';
import { phoneValidator } from '../../core/forms/validators';
import { passwordValidator } from '../../core/forms/validators';
import { ApiError } from '../../core/http/api-error';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { FormField } from '../../shared/ui/form-field/form-field';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { User, UserService } from './user.service';

/** Names of the API fields by form control (the update is multipart with the API's names). */
const API_NAME: Record<string, string> = {
  type: 'Type',
  fullName: 'FullName',
  login: 'Login',
  legalName: 'LegalName',
  innpinfl: 'INNPINFL',
  phone: 'Phone',
  secondaryPhone: 'SecondaryPhone',
  address: 'Address',
  email: 'Email',
  password: 'Password',
};

/** Optional values the API lets an update remove (`ClearFields`). */
const CLEARABLE = new Set([
  'login',
  'legalName',
  'innpinfl',
  'phone',
  'secondaryPhone',
  'address',
  'email',
]);

const innPinflValidator = (control: { value: unknown }) =>
  !control.value || /^(\d{9}|\d{14})$/.test(String(control.value)) ? null : { pinfl: true };

@Component({
  selector: 'app-user-form',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    FormField,
    PageHeader,
    TPipe,
  ],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly users = inject(UserService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly editing = this.id !== null;
  protected readonly busy = signal(false);
  protected readonly loading = signal(this.editing);
  protected readonly types = this.i18n.enumOptions('ClientType');
  protected readonly title = computed(() => this.i18n.t(this.editing ? 'users.edit' : 'users.new'));

  private initial: Record<string, string> = {};
  private saved = false;

  protected readonly form = new FormGroup({
    type: new FormControl('NONE', { nonNullable: true }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: this.editing ? [] : [Validators.required, Validators.maxLength(100)],
    }),
    firstName: new FormControl('', {
      nonNullable: true,
      validators: this.editing ? [] : [Validators.required, Validators.maxLength(100)],
    }),
    middleName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    login: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^[A-Za-z][A-Za-z0-9_.]{2,49}$/)],
    }),
    legalName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    innpinfl: new FormControl('', { nonNullable: true, validators: [innPinflValidator] }),
    phone: new FormControl('', { nonNullable: true, validators: [phoneValidator] }),
    secondaryPhone: new FormControl('', { nonNullable: true, validators: [phoneValidator] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: this.editing
        ? [Validators.email, Validators.maxLength(150)]
        : [Validators.required, Validators.email, Validators.maxLength(150)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.editing ? [passwordValidator] : [Validators.required, passwordValidator],
    }),
  });

  ngOnInit(): void {
    if (!this.id) return;
    this.users.get(this.id).subscribe({
      next: (user) => {
        this.fill(user);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.notify.error(error, this.i18n.t('users.notFound'));
        void this.router.navigate(['/users']);
      },
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.saved && this.form.dirty;
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const body = this.editing ? this.changes() : this.newUser();
    if (body === null) {
      this.notify.info(this.i18n.t('users.nothingChanged'));
      this.saved = true;
      void this.router.navigate(['/users', this.id]);
      return;
    }
    this.busy.set(true);
    const request = this.editing ? this.users.update(body) : this.users.create(body);
    request.subscribe({
      next: (user) => {
        this.busy.set(false);
        this.saved = true;
        this.notify.success(this.i18n.t(this.editing ? 'users.updated' : 'users.created'));
        void this.router.navigate(['/users', user.id]);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        const rest = apiError.isValidation
          ? applyServerErrors(this.form, apiError)
          : [apiError.message];
        if (rest.length > 0)
          this.notify.error(
            new ApiError(
              apiError.status,
              rest.join('\n'),
              [],
              apiError.retryAfter,
              apiError.requestId,
            ),
          );
      },
    });
  }

  protected cancel(): void {
    void this.router.navigate(this.id ? ['/users', this.id] : ['/users']);
  }

  private fill(user: User): void {
    this.initial = {
      type: user.type,
      fullName: user.fullName ?? '',
      login: user.login ?? '',
      legalName: user.legalName ?? '',
      innpinfl: user.innpinfl ?? '',
      phone: user.phone ?? '',
      secondaryPhone: user.secondaryPhone ?? '',
      address: user.address ?? '',
      email: user.email ?? '',
      password: '',
    };
    this.form.patchValue(this.initial);
    this.form.markAsPristine();
  }

  private newUser(): FormData {
    const form = new FormData();
    const value = this.form.getRawValue();
    form.append('Type', value.type);
    form.append('LastName', value.lastName.trim());
    form.append('FirstName', value.firstName.trim());
    form.append('Email', value.email.trim());
    form.append('Password', value.password);
    const optional: [string, string][] = [
      ['MiddleName', value.middleName],
      ['Login', value.login],
      ['LegalName', value.legalName],
      ['INNPINFL', value.innpinfl],
      ['Phone', value.phone],
      ['SecondaryPhone', value.secondaryPhone],
      ['Address', value.address],
    ];
    for (const [name, text] of optional) if (text.trim()) form.append(name, text.trim());
    return form;
  }

  /** Only what changed; a cleared optional field is named in `ClearFields`. `null`: nothing changed. */
  private changes(): FormData | null {
    const form = new FormData();
    form.append('Id', this.id as string);
    let any = false;
    for (const [control, apiName] of Object.entries(API_NAME)) {
      const now = (this.form.get(control)?.value as string).trim();
      const before = this.initial[control] ?? '';
      if (control === 'password' ? now === '' : now === before) continue;
      if (now === '') {
        if (CLEARABLE.has(control)) {
          form.append('ClearFields', apiName);
          any = true;
        }
        continue;
      }
      form.append(apiName, now);
      any = true;
    }
    return any ? form : null;
  }
}
