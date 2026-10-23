import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { applyServerErrors } from '../../core/forms/server-errors';
import { HasUnsavedChanges } from '../../core/forms/unsaved-changes.guard';
import { phoneValidator, urlValidator } from '../../core/forms/validators';
import { ApiError } from '../../core/http/api-error';
import { fileUrl } from '../../core/http/file-url';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { FileUpload } from '../../shared/ui/file-upload/file-upload';
import { FormField } from '../../shared/ui/form-field/form-field';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { Company, CompanyService } from './company.service';

/** The company's public details (the site's "About us"): one record, created the first time and edited afterwards. */
@Component({
  selector: 'app-company-page',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    TextareaModule,
    FileUpload,
    FormField,
    PageHeader,
    HasPermissionDirective,
    TPipe,
  ],
  templateUrl: './company-page.html',
  styleUrl: './company-page.scss',
})
export class CompanyPage implements OnInit, HasUnsavedChanges {
  private readonly service = inject(CompanyService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly company = signal<Company | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly logoUrl = (url: string | null | undefined) => fileUrl(url);
  private logo: File | null = null;

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(4000)],
    }),
    mission: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
    location: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, urlValidator, Validators.maxLength(1000)],
    }),
    phoneNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, phoneValidator],
    }),
    phoneNumber2: new FormControl('', { nonNullable: true, validators: [phoneValidator] }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(150)],
    }),
    latitude: new FormControl<number | null>(null, {
      validators: [Validators.min(-90), Validators.max(90)],
    }),
    longitude: new FormControl<number | null>(null, {
      validators: [Validators.min(-180), Validators.max(180)],
    }),
  });

  ngOnInit(): void {
    this.service.current().subscribe({
      next: (company) => {
        this.company.set(company);
        if (company) this.fill(company);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.notify.error(error);
        this.loading.set(false);
      },
    });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty || this.logo !== null;
  }

  protected picked(files: File[]): void {
    this.logo = files[0] ?? null;
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const value = this.form.getRawValue();
    const input = {
      ...value,
      name: value.name.trim(),
      description: value.description.trim(),
      mission: value.mission.trim(),
      address: value.address.trim(),
      location: value.location.trim(),
      phoneNumber: value.phoneNumber.trim(),
      phoneNumber2: value.phoneNumber2.trim(),
      email: value.email.trim(),
      logo: this.logo,
    };
    const existing = this.company();
    this.busy.set(true);
    (existing ? this.service.update(existing.id, input) : this.service.create(input)).subscribe({
      next: (company) => {
        this.busy.set(false);
        this.company.set(company);
        this.logo = null;
        this.fill(company);
        this.notify.success(this.i18n.t('company.saved'));
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

  private fill(company: Company): void {
    this.form.reset({
      name: company.name ?? '',
      description: company.description ?? '',
      mission: company.mission ?? '',
      address: company.address ?? '',
      location: company.location ?? '',
      phoneNumber: company.phoneNumber ?? '',
      phoneNumber2: company.phoneNumber2 ?? '',
      email: company.email ?? '',
      latitude: company.latitude,
      longitude: company.longitude,
    });
  }
}
