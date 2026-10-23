import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { applyServerErrors } from '../../core/forms/server-errors';
import { HasUnsavedChanges } from '../../core/forms/unsaved-changes.guard';
import { ApiError } from '../../core/http/api-error';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { tashkentInputToUtcIso, utcIsoToTashkentInput } from '../../core/time/tashkent';
import { FormField } from '../../shared/ui/form-field/form-field';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { Property, PropertyService } from '../properties/property.service';
import { Auction, AuctionInput, AuctionService } from './auction.service';

const MIN_DURATION_MS = 5 * 60_000;

/** The rules the API enforces, checked before sending so the admin sees them next to the fields. */
export function auctionRules(
  value: {
    startingPrice: number | null;
    depositAmount: number | null;
    applicationDeadline: string;
    startsAt: string;
    endsAt: string;
  },
  now = Date.now(),
): string[] {
  const errors: string[] = [];
  const time = (text: string) => (text ? Date.parse(tashkentInputToUtcIso(text)) : NaN);
  const starts = time(value.startsAt);
  const ends = time(value.endsAt);
  const deadline = time(value.applicationDeadline);
  if (
    value.startingPrice !== null &&
    value.depositAmount !== null &&
    value.depositAmount >= value.startingPrice
  )
    errors.push('deposit');
  if (!Number.isNaN(deadline) && !Number.isNaN(starts) && deadline > starts)
    errors.push('deadline');
  if (!Number.isNaN(starts) && !Number.isNaN(ends) && ends - starts < MIN_DURATION_MS)
    errors.push('duration');
  if (!Number.isNaN(starts) && starts <= now) errors.push('future');
  return errors;
}

const rulesValidator = (group: AbstractControl): ValidationErrors | null => {
  const errors = auctionRules(group.getRawValue());
  return errors.length ? { rules: errors } : null;
};

@Component({
  selector: 'app-auction-form',
  imports: [
    ReactiveFormsModule,
    AutoCompleteModule,
    ButtonModule,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    TextareaModule,
    FormField,
    PageHeader,
    TPipe,
  ],
  templateUrl: './auction-form.html',
  styleUrl: './auction-form.scss',
})
export class AuctionForm implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auctions = inject(AuctionService);
  private readonly properties = inject(PropertyService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly editing = this.id !== null;
  protected readonly loading = signal(this.editing);
  protected readonly busy = signal(false);
  protected readonly title = computed(() =>
    this.i18n.t(this.editing ? 'auctions.edit' : 'auctions.new'),
  );
  protected readonly suggestions = signal<Property[]>([]);
  private saved = false;

  protected readonly form = new FormGroup(
    {
      property: new FormControl<Property | null>(null, { validators: [Validators.required] }),
      lotNumber: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
      title: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
      description: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(10_000)],
      }),
      startingPrice: new FormControl<number | null>(null, {
        validators: [Validators.required, Validators.min(0.01)],
      }),
      minBidStep: new FormControl<number | null>(null, {
        validators: [Validators.required, Validators.min(0.01)],
      }),
      depositAmount: new FormControl<number | null>(0, {
        validators: [Validators.required, Validators.min(0)],
      }),
      applicationDeadline: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      startsAt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      endsAt: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      extensionMinutes: new FormControl(5, {
        nonNullable: true,
        validators: [Validators.min(0), Validators.max(60)],
      }),
      offerToRunnerUp: new FormControl(true, { nonNullable: true }),
    },
    { validators: [rulesValidator] },
  );

  /** The broken cross-field rules, as texts. */
  protected readonly ruleMessages = computed(() => {
    this.formVersion();
    const errors = (this.form.errors?.['rules'] as string[] | undefined) ?? [];
    return errors.map((code) =>
      this.i18n.t(`auctions.errors.${code}` as 'auctions.errors.deposit'),
    );
  });
  protected readonly formVersion = signal(0);

  constructor() {
    this.form.valueChanges.subscribe(() => this.formVersion.update((n) => n + 1));
  }

  ngOnInit(): void {
    if (!this.id) return;
    this.auctions.get(this.id).subscribe({
      next: (auction) => {
        this.properties.get(auction.propertyId).subscribe({
          next: (property) => this.fill(auction, property),
          error: () => this.fill(auction, null),
        });
      },
      error: (error: unknown) => {
        this.notify.error(error);
        void this.router.navigate(['/auctions']);
      },
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.saved && this.form.dirty;
  }

  protected search(event: AutoCompleteCompleteEvent): void {
    this.properties
      .list({
        searchText: event.query,
        pageSize: 10,
        filters: { 'status.equals': 'PUBLISHED' },
        sortBy: 'CreatedAt',
        sortDirection: 'desc',
      })
      .subscribe({
        next: (page) => this.suggestions.set(page.items),
        error: () => this.suggestions.set([]),
      });
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const value = this.form.getRawValue();
    const input: AuctionInput = {
      propertyId: (value.property as Property).id,
      lotNumber: value.lotNumber,
      title: value.title,
      description: value.description,
      startingPrice: value.startingPrice as number,
      minBidStep: value.minBidStep as number,
      depositAmount: value.depositAmount as number,
      applicationDeadline: tashkentInputToUtcIso(value.applicationDeadline),
      startsAt: tashkentInputToUtcIso(value.startsAt),
      endsAt: tashkentInputToUtcIso(value.endsAt),
      extensionMinutes: value.extensionMinutes,
      offerToRunnerUp: value.offerToRunnerUp,
    };
    this.busy.set(true);
    (this.id ? this.auctions.update(this.id, input) : this.auctions.create(input)).subscribe({
      next: (auction) => {
        this.busy.set(false);
        this.saved = true;
        this.notify.success(this.i18n.t(this.id ? 'auctions.updated' : 'auctions.created'));
        void this.router.navigate(['/auctions', auction.id]);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        const rest = apiError.isValidation
          ? applyServerErrors(this.form, apiError, { PropertyId: 'property' })
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
    void this.router.navigate(this.id ? ['/auctions', this.id] : ['/auctions']);
  }

  private fill(auction: Auction, property: Property | null): void {
    this.form.reset({
      property,
      lotNumber: auction.lotNumber ?? '',
      title: auction.title ?? '',
      description: auction.description ?? '',
      startingPrice: auction.startingPrice,
      minBidStep: auction.minBidStep,
      depositAmount: auction.depositAmount,
      applicationDeadline: utcIsoToTashkentInput(auction.applicationDeadline),
      startsAt: utcIsoToTashkentInput(auction.startsAt),
      endsAt: utcIsoToTashkentInput(auction.endsAt),
      extensionMinutes: auction.extensionMinutes,
      offerToRunnerUp: auction.offerToRunnerUp,
    });
    this.loading.set(false);
  }
}
