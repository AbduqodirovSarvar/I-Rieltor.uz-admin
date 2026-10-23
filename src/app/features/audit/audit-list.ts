import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { ListQuery } from '../../core/http/response-model';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { QueryState } from '../../core/state/query-state';
import { CellTemplate, DataTable, TableColumn } from '../../shared/ui/data-table/data-table';
import { FilterBar, FilterField, FilterValues } from '../../shared/ui/filter-bar/filter-bar';
import { KeyValue } from '../../shared/ui/misc/key-value';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { DateTimePipe } from '../../core/format/format';

export type AuditEntry = components['schemas']['AuditLogViewModel'];
type View = 'all' | 'errors';

const VIEWS: Record<View, FilterValues> = {
  all: {},
  // 4xx and 5xx: refused or failed calls.
  errors: { 'statusCode.greaterthan': '399' },
};

/** Who did what: every change made through the API, with the result and the request id the backend log can be searched by. */
@Component({
  selector: 'app-audit-list',
  imports: [
    FormsModule,
    RouterLink,
    DialogModule,
    SelectButtonModule,
    CellTemplate,
    DataTable,
    FilterBar,
    KeyValue,
    PageHeader,
    DateTimePipe,
    TPipe,
  ],
  templateUrl: './audit-list.html',
  styleUrl: './audit-list.scss',
})
export class AuditList {
  private readonly api = inject(ApiClient);
  private readonly query = inject(QueryState);
  private readonly i18n = inject(I18n);

  protected readonly views = (['all', 'errors'] as const).map((value) => ({
    value,
    label: this.i18n.t(`audit.views.${value}`),
  }));
  protected readonly view = signal<View>(this.query.get('view') === 'errors' ? 'errors' : 'all');
  protected readonly barFilters = signal<FilterValues>({});
  protected readonly filters = computed<FilterValues>(() => ({
    ...VIEWS[this.view()],
    ...this.barFilters(),
  }));
  protected readonly defaultSort = { field: 'OccurredAt', direction: 'desc' as const };

  protected readonly detail = signal<AuditEntry | null>(null);
  protected readonly detailOpen = signal(false);

  protected readonly fields: FilterField[] = [
    {
      key: 'method',
      label: this.i18n.t('audit.method'),
      type: 'select',
      options: ['POST', 'PUT', 'PATCH', 'DELETE', 'GET'].map((m) => ({ value: m, label: m })),
    },
    { key: 'userId', label: this.i18n.t('audit.userId'), type: 'text', op: 'equals' },
    { key: 'correlationId', label: this.i18n.t('audit.correlationId'), type: 'text', op: 'equals' },
    { key: 'occurredAt', label: this.i18n.t('audit.when'), type: 'date-range' },
  ];

  protected readonly columns: TableColumn<AuditEntry>[] = [
    { field: 'occurredAt', header: this.i18n.t('audit.when'), type: 'datetime' },
    { field: 'userFullName', header: this.i18n.t('audit.who'), type: 'custom', sortField: false },
    { field: 'action', header: this.i18n.t('audit.action') },
    { field: 'method', header: this.i18n.t('audit.method') },
    { field: 'path', header: this.i18n.t('audit.path') },
    { field: 'statusCode', header: this.i18n.t('audit.status'), type: 'custom', align: 'center' },
    { field: 'durationMs', header: this.i18n.t('audit.duration'), align: 'right' },
  ];

  protected readonly fetch = (query: ListQuery) =>
    this.api.getPage<AuditEntry>('api/AuditLog/list', query);

  protected setView(view: View): void {
    this.view.set(view);
    this.query.patch({ view: view === 'all' ? null : view, page: null });
  }

  protected open(entry: AuditEntry): void {
    this.detail.set(entry);
    this.detailOpen.set(true);
  }

  /** green 2xx, blue 3xx, orange 4xx, red 5xx. */
  protected tone(code: number): string {
    return code >= 500 ? 'danger' : code >= 400 ? 'warn' : code >= 300 ? 'info' : 'ok';
  }
}
