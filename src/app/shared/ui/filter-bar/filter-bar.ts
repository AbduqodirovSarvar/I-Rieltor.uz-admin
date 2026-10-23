import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18n } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { QueryState } from '../../../core/state/query-state';
import {
  calendarDay,
  endOfTashkentDayUtc,
  startOfTashkentDayUtc,
} from '../../../core/time/tashkent';

export interface FilterOption {
  value: string;
  label: string;
}

export type FilterField =
  | { key: string; label: string; type: 'text'; op?: 'contains' | 'equals' | 'startswith' }
  | { key: string; label: string; type: 'select'; options: FilterOption[] }
  | { key: string; label: string; type: 'bool' }
  | { key: string; label: string; type: 'date-range' };

/** The filters as the API wants them: `{ 'status.equals': 'ONGOING', 'createdAt.greaterthan': '...' }`. */
export type FilterValues = Record<string, string>;

const URL_PREFIX = 'f.';

/**
 * A row of filter inputs. It emits ready-made `Filters[...]` entries, keeps its values in the address (`?f.status=ONGOING`),
 * and restores them from there.
 */
@Component({
  selector: 'app-filter-bar',
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule, DatePickerModule, TPipe],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss',
})
export class FilterBar implements OnInit {
  readonly fields = input.required<readonly FilterField[]>();
  readonly filtersChange = output<FilterValues>();

  private readonly query = inject(QueryState);
  private readonly i18n = inject(I18n);
  private readonly changes = new Subject<void>();

  /** Raw values by field key: text/select/bool as strings, date-range as `[Date, Date | null]`. */
  protected readonly values = signal<Record<string, unknown>>({});

  protected readonly boolOptions: FilterOption[] = [
    { value: 'true', label: this.i18n.t('common.yes') },
    { value: 'false', label: this.i18n.t('common.no') },
  ];

  constructor() {
    this.changes.pipe(debounceTime(250), takeUntilDestroyed()).subscribe(() => this.emit());
  }

  ngOnInit(): void {
    const restored: Record<string, unknown> = {};
    for (const field of this.fields()) {
      const raw = this.query.get(URL_PREFIX + field.key);
      if (!raw) continue;
      if (field.type === 'date-range') {
        const [from, to] = raw.split('..');
        restored[field.key] = [this.parseDay(from), to ? this.parseDay(to) : null];
      } else {
        restored[field.key] = raw;
      }
    }
    this.values.set(restored);
    this.emit(false);
  }

  protected value(key: string): unknown {
    return this.values()[key] ?? null;
  }

  protected set(key: string, value: unknown): void {
    this.values.update((current) => ({ ...current, [key]: value }));
    this.changes.next();
  }

  protected clear(): void {
    this.values.set({});
    this.emit();
  }

  protected get hasValues(): boolean {
    return Object.values(this.values()).some((v) => v !== null && v !== undefined && v !== '');
  }

  private emit(updateUrl = true): void {
    const result: FilterValues = {};
    const urlValues: Record<string, string | null> = {};
    for (const field of this.fields()) {
      const value = this.values()[field.key];
      urlValues[URL_PREFIX + field.key] = null;
      if (value === null || value === undefined || value === '') continue;

      if (field.type === 'date-range') {
        const [from, to] = value as [Date, Date | null];
        if (!from) continue;
        // The API has only "greater than" / "less than": widen by one millisecond to include the first and the last instant.
        const start = calendarDay(from);
        const end = calendarDay(to ?? from);
        result[`${field.key}.greaterthan`] = new Date(
          Date.parse(startOfTashkentDayUtc(start)) - 1,
        ).toISOString();
        result[`${field.key}.lessthan`] = new Date(
          Date.parse(endOfTashkentDayUtc(end)) + 1,
        ).toISOString();
        urlValues[URL_PREFIX + field.key] = `${start}..${to ? end : ''}`;
      } else {
        const text = String(value).trim();
        if (!text) continue;
        result[`${field.key}.${field.type === 'text' ? (field.op ?? 'contains') : 'equals'}`] =
          text;
        urlValues[URL_PREFIX + field.key] = text;
      }
    }
    if (updateUrl) this.query.patch({ ...urlValues, page: null });
    this.filtersChange.emit(result);
  }

  private parseDay(day: string): Date {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }
}
