import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { formatDate, formatDateTime } from '../../../core/time/tashkent';
import { formatMoney, formatPhone } from '../../../core/format/format';
import { enumSeverity } from '../../../core/i18n/enum-severity';
import { EnumName, I18n } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ListQuery, Page } from '../../../core/http/response-model';
import { Notify } from '../../../core/notify/notify.service';
import { QueryState } from '../../../core/state/query-state';

export type ColumnType =
  'text' | 'money' | 'datetime' | 'date' | 'phone' | 'enum' | 'bool' | 'custom';

export interface TableColumn<T> {
  /** Name of the row property (also the default sort field, in PascalCase as the API wants it). */
  field: string;
  header: string;
  type?: ColumnType;
  /** For `enum` columns: which enum gives the label and the colour. */
  enumName?: EnumName;
  /** Different sort field than `field` (for example a joined name). Omit to sort by `field`; `false` disables sorting. */
  sortField?: string | false;
  /** Computes the value instead of reading `field`. */
  value?: (row: T) => unknown;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

/** `<ng-template appCell="status" let-row>...</ng-template>` renders the cell of a `custom` column. */
@Directive({ selector: 'ng-template[appCell]' })
export class CellTemplate {
  readonly appCell = input.required<string>();
  readonly template = inject(TemplateRef);
}

/** `<ng-template appRowActions let-row>...buttons...</ng-template>` fills the last (actions) column. */
@Directive({ selector: 'ng-template[appRowActions]' })
export class RowActionsTemplate {
  readonly template = inject(TemplateRef);
}

const PAGE_SIZES = [10, 20, 50, 100];

/**
 * A list page's table: the server pages, sorts and searches; the state lives in the address (`?page=2&q=ali&sort=CreatedAt&dir=desc`).
 * Give it the columns and a `fetch` function; changing `filters` or `reloadKey` reloads from the first page.
 */
@Component({
  selector: 'app-data-table',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    TPipe,
  ],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTable<T extends object> {
  readonly columns = input.required<readonly TableColumn<T>[]>();
  readonly fetch = input.required<(query: ListQuery) => Observable<Page<T>>>();
  /** Filter entries from the filter bar (`{ 'status.equals': 'ONGOING' }`). */
  readonly filters = input<Record<string, string>>({});
  readonly searchable = input(true);
  readonly searchPlaceholder = input<string | null>(null);
  /** Change it to force a reload (after a save or a delete). */
  readonly reloadKey = input(0);
  readonly defaultSort = input<{ field: string; direction: 'asc' | 'desc' } | null>({
    field: 'CreatedAt',
    direction: 'desc',
  });
  /** Rows look and act clickable (cursor, hover) when set. */
  readonly clickable = input(false);
  readonly rowClick = output<T>();

  private readonly query = inject(QueryState);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly cells = contentChildren(CellTemplate);
  protected readonly actions = contentChild(RowActionsTemplate);

  protected readonly pageSizes = PAGE_SIZES;
  protected readonly rows = signal<T[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly refreshTick = signal(0);

  protected readonly pageIndex = signal(this.readInt('page', 0));
  protected readonly pageSize = signal(this.readPageSize());
  protected readonly search = signal(this.query.get('q') ?? '');
  protected readonly sortBy = signal<string | null>(this.query.get('sort'));
  protected readonly sortDirection = signal<'asc' | 'desc'>(
    this.query.get('dir') === 'asc' ? 'asc' : 'desc',
  );

  private readonly searchInput = new Subject<string>();

  protected readonly first = computed(() => this.pageIndex() * this.pageSize());

  /** The query sent to the server. */
  protected readonly current = computed<ListQuery>(() => {
    const sortBy = this.sortBy() ?? this.defaultSort()?.field ?? null;
    return {
      pageIndex: this.pageIndex(),
      pageSize: this.pageSize(),
      searchText: this.search(),
      sortBy,
      sortDirection: this.sortBy()
        ? this.sortDirection()
        : (this.defaultSort()?.direction ?? 'desc'),
      filters: this.filters(),
    };
  });

  constructor() {
    this.searchInput
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((text) => {
        this.search.set(text);
        this.goToFirstPage();
        this.sync();
      });

    // Filters or the reload key changed: back to the first page.
    let seen = untracked(() => JSON.stringify(this.filters()) + this.reloadKey());
    effect(() => {
      const signature = JSON.stringify(this.filters()) + this.reloadKey();
      if (signature === seen) return;
      seen = signature;
      untracked(() => {
        this.pageIndex.set(0);
        this.sync();
      });
    });

    toObservable(
      computed(() => ({ query: this.current(), key: this.reloadKey() + this.refreshTick() })),
    )
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.failed.set(false);
        }),
        switchMap(({ query }) =>
          this.fetch()(query).pipe(
            catchError((error) => {
              this.notify.error(error);
              this.failed.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.loading.set(false);
        if (!page) return;
        // The last row of the last page was deleted: step back instead of showing an empty page.
        if (page.items.length === 0 && page.totalCount > 0 && this.pageIndex() > 0) {
          this.pageIndex.set(Math.max(0, Math.ceil(page.totalCount / this.pageSize()) - 1));
          this.sync();
          return;
        }
        this.rows.set([...page.items]);
        this.total.set(page.totalCount);
      });
  }

  protected onSearch(text: string): void {
    this.searchInput.next(text.trim());
  }

  protected onPage(event: TableLazyLoadEvent): void {
    const size = event.rows ?? this.pageSize();
    this.pageSize.set(size);
    this.pageIndex.set(Math.floor((event.first ?? 0) / size));
    this.sync();
  }

  protected onSort(field: string): void {
    if (this.sortBy() === field) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(field);
      this.sortDirection.set('asc');
    }
    this.goToFirstPage();
    this.sync();
  }

  protected sortField(column: TableColumn<T>): string | null {
    if (column.sortField === false) return null;
    if (column.sortField) return column.sortField;
    return column.field.charAt(0).toUpperCase() + column.field.slice(1);
  }

  protected sortIcon(column: TableColumn<T>): string {
    const field = this.sortField(column);
    const active = this.sortBy() ?? this.defaultSort()?.field ?? null;
    if (!field || active !== field) return 'pi pi-sort-alt';
    const direction = this.sortBy()
      ? this.sortDirection()
      : (this.defaultSort()?.direction ?? 'desc');
    return direction === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down';
  }

  protected cellTemplate(column: TableColumn<T>): TemplateRef<unknown> | null {
    return this.cells().find((c) => c.appCell() === column.field)?.template ?? null;
  }

  protected raw(row: T, column: TableColumn<T>): unknown {
    return column.value ? column.value(row) : (row as Record<string, unknown>)[column.field];
  }

  protected text(row: T, column: TableColumn<T>): string {
    const value = this.raw(row, column);
    switch (column.type) {
      case 'money':
        return formatMoney(value as number | string | null);
      case 'datetime':
        return formatDateTime(value as string | null);
      case 'date':
        return formatDate(value as string | null);
      case 'phone':
        return formatPhone(value as string | null);
      case 'bool':
        return value === null || value === undefined
          ? ''
          : this.i18n.t(value ? 'common.yes' : 'common.no');
      case 'enum':
        return this.i18n.enumLabel(column.enumName as EnumName, value as string | null);
      default:
        return value === null || value === undefined ? '' : String(value);
    }
  }

  protected severity(row: T, column: TableColumn<T>) {
    return enumSeverity(column.enumName as EnumName, this.raw(row, column) as string | null);
  }

  protected trackRow(index: number, row: T): unknown {
    return (row as { id?: unknown }).id ?? index;
  }

  private goToFirstPage(): void {
    this.pageIndex.set(0);
  }

  private sync(): void {
    this.query.patch({
      page: this.pageIndex() > 0 ? this.pageIndex() + 1 : null,
      size: this.pageSize() !== 20 ? this.pageSize() : null,
      q: this.search() || null,
      sort: this.sortBy(),
      dir: this.sortBy() ? this.sortDirection() : null,
    });
  }

  private readInt(name: string, fallback: number): number {
    const value = Number(this.query.get(name));
    return Number.isInteger(value) && value >= 1 ? value - 1 : fallback;
  }

  private readPageSize(): number {
    const value = Number(this.query.get('size'));
    return PAGE_SIZES.includes(value) ? value : 20;
  }
}
