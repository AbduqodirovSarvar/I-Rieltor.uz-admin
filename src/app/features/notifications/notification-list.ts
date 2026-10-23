import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import type { components } from '../../api/schema';
import { DateTimePipe } from '../../core/format/format';
import { ApiClient } from '../../core/http/api-client';
import { ListQuery } from '../../core/http/response-model';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { QueryState } from '../../core/state/query-state';
import { CellTemplate, DataTable, TableColumn } from '../../shared/ui/data-table/data-table';
import { FilterBar, FilterField, FilterValues } from '../../shared/ui/filter-bar/filter-bar';
import { KeyValue } from '../../shared/ui/misc/key-value';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { StatusBadge } from '../../shared/ui/misc/status-badge';

export type NotificationItem = components['schemas']['NotificationViewModel'];
type View = 'all' | 'failed';

const VIEWS: Record<View, FilterValues> = { all: {}, failed: { 'status.equals': 'FAILED' } };

/** The delivery log of emails and SMS: what was sent to whom, and what failed and why. */
@Component({
  selector: 'app-notification-list',
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
    StatusBadge,
    DateTimePipe,
    TPipe,
  ],
  templateUrl: './notification-list.html',
  styleUrl: './notification-list.scss',
})
export class NotificationList {
  private readonly api = inject(ApiClient);
  private readonly query = inject(QueryState);
  private readonly i18n = inject(I18n);

  protected readonly views = (['all', 'failed'] as const).map((value) => ({
    value,
    label: this.i18n.t(`notifications.views.${value}`),
  }));
  protected readonly view = signal<View>(this.query.get('view') === 'failed' ? 'failed' : 'all');
  protected readonly barFilters = signal<FilterValues>({});
  protected readonly filters = computed<FilterValues>(() => ({
    ...VIEWS[this.view()],
    ...this.barFilters(),
  }));

  protected readonly detail = signal<NotificationItem | null>(null);
  protected readonly detailOpen = signal(false);

  protected readonly fields: FilterField[] = [
    {
      key: 'status',
      label: this.i18n.t('notifications.status'),
      type: 'select',
      options: this.i18n.enumOptions('NotificationStatus'),
    },
    {
      key: 'channel',
      label: this.i18n.t('notifications.channel'),
      type: 'select',
      options: this.i18n.enumOptions('NotificationChannel'),
    },
    {
      key: 'type',
      label: this.i18n.t('notifications.type'),
      type: 'select',
      options: this.i18n.enumOptions('NotificationType'),
    },
    { key: 'createdAt', label: this.i18n.t('notifications.createdAt'), type: 'date-range' },
  ];

  protected readonly columns: TableColumn<NotificationItem>[] = [
    { field: 'createdAt', header: this.i18n.t('notifications.createdAt'), type: 'datetime' },
    {
      field: 'userFullName',
      header: this.i18n.t('notifications.recipient'),
      type: 'custom',
      sortField: false,
    },
    {
      field: 'channel',
      header: this.i18n.t('notifications.channel'),
      type: 'enum',
      enumName: 'NotificationChannel',
    },
    {
      field: 'type',
      header: this.i18n.t('notifications.type'),
      type: 'enum',
      enumName: 'NotificationType',
    },
    {
      field: 'status',
      header: this.i18n.t('notifications.status'),
      type: 'enum',
      enumName: 'NotificationStatus',
    },
    { field: 'attempts', header: this.i18n.t('notifications.attempts'), align: 'right' },
    { field: 'lastError', header: this.i18n.t('notifications.lastError'), sortField: false },
  ];

  protected readonly fetch = (query: ListQuery) =>
    this.api.getPage<NotificationItem>('api/Notification/list', query);

  protected setView(view: View): void {
    this.view.set(view);
    this.query.patch({ view: view === 'all' ? null : view, page: null });
  }

  protected open(item: NotificationItem): void {
    this.detail.set(item);
    this.detailOpen.set(true);
  }
}
