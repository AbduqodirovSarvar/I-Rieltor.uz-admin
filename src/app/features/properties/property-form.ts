import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { forkJoin } from 'rxjs';
import { applyServerErrors } from '../../core/forms/server-errors';
import { HasUnsavedChanges } from '../../core/forms/unsaved-changes.guard';
import { ApiError } from '../../core/http/api-error';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { FormField } from '../../shared/ui/form-field/form-field';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { CategoryService, toTree } from '../categories/category.service';
import {
  EDITABLE_STATUSES,
  Property,
  PropertyInput,
  PropertyService,
  PropertyStatus,
} from './property.service';

const num = (min: number, max: number) => [Validators.min(min), Validators.max(max)];

@Component({
  selector: 'app-property-form',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    FormField,
    PageHeader,
    TPipe,
  ],
  templateUrl: './property-form.html',
  styleUrl: './property-form.scss',
})
export class PropertyForm implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly properties = inject(PropertyService);
  private readonly categories = inject(CategoryService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly editing = this.id !== null;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly title = computed(() =>
    this.i18n.t(this.editing ? 'properties.edit' : 'properties.new'),
  );
  protected readonly categoryOptions = signal<{ id: string; label: string }[]>([]);
  /** IN_AUCTION and SOLD follow the auction: the status cannot be changed by hand then. */
  protected readonly statusLocked = signal(false);
  private saved = false;

  protected readonly statusOptions = signal(
    EDITABLE_STATUSES.map((value) => ({
      value,
      label: this.i18n.enumLabel('PropertyStatus', value),
    })),
  );

  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(10_000)],
    }),
    categoryId: new FormControl<string | null>(null, { validators: [Validators.required] }),
    status: new FormControl<PropertyStatus>('DRAFT', { nonNullable: true }),
    region: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    district: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
    latitude: new FormControl<number | null>(null, { validators: num(-90, 90) }),
    longitude: new FormControl<number | null>(null, { validators: num(-180, 180) }),
    cadastralNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
    areaSqm: new FormControl<number | null>(null, { validators: num(0.01, 10_000_000) }),
    landAreaSotix: new FormControl<number | null>(null, { validators: num(0.01, 10_000_000) }),
    rooms: new FormControl<number | null>(null, { validators: num(0, 1000) }),
    floor: new FormControl<number | null>(null, { validators: num(-5, 300) }),
    totalFloors: new FormControl<number | null>(null, { validators: num(1, 300) }),
    buildYear: new FormControl<number | null>(null, { validators: num(1800, 2100) }),
    estimatedValue: new FormControl<number | null>(null, {
      validators: num(0, 1_000_000_000_000_000),
    }),
    sellerName: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  protected get mapLink(): string | null {
    const { latitude, longitude } = this.form.getRawValue();
    return latitude !== null && longitude !== null
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : null;
  }

  ngOnInit(): void {
    const property$ = this.id ? this.properties.get(this.id) : null;
    forkJoin({ categories: this.categories.all(), property: property$ ?? [null] }).subscribe({
      next: ({ categories, property }) => {
        this.categoryOptions.set(
          toTree(categories).map((n) => ({
            id: n.category.id,
            label: `${'— '.repeat(n.depth)}${n.category.name ?? ''}`,
          })),
        );
        if (property) this.fill(property as Property);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.notify.error(error, this.i18n.t('properties.notFound'));
        void this.router.navigate(['/properties']);
      },
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.saved && this.form.dirty;
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const value = this.form.getRawValue();
    const input: PropertyInput = { ...value, categoryId: value.categoryId as string };
    this.busy.set(true);
    (this.id ? this.properties.update(this.id, input) : this.properties.create(input)).subscribe({
      next: (property) => {
        this.busy.set(false);
        this.saved = true;
        this.notify.success(this.i18n.t(this.id ? 'properties.updated' : 'properties.created'));
        void this.router.navigate(['/properties', property.id]);
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
    void this.router.navigate(this.id ? ['/properties', this.id] : ['/properties']);
  }

  private fill(property: Property): void {
    this.statusLocked.set(!EDITABLE_STATUSES.includes(property.status));
    this.form.reset({
      title: property.title ?? '',
      description: property.description ?? '',
      categoryId: property.categoryId,
      status: property.status,
      region: property.region ?? '',
      district: property.district ?? '',
      address: property.address ?? '',
      latitude: property.latitude,
      longitude: property.longitude,
      cadastralNumber: property.cadastralNumber ?? '',
      areaSqm: property.areaSqm,
      landAreaSotix: property.landAreaSotix,
      rooms: property.rooms,
      floor: property.floor,
      totalFloors: property.totalFloors,
      buildYear: property.buildYear,
      estimatedValue: property.estimatedValue,
      sellerName: property.sellerName ?? '',
    });
    if (this.statusLocked()) this.form.controls.status.disable();
  }
}
