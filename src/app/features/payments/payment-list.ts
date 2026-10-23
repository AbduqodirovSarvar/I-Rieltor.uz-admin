import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { ListQuery } from '../../core/http/response-model';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { QueryState } from '../../core/state/query-state';
import {
  CellTemplate,
  DataTable,
  RowActionsTemplate,
  TableColumn,
} from '../../shared/ui/data-table/data-table';
import { FilterBar, FilterField, FilterValues } from '../../shared/ui/filter-bar/filter-bar';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { PaymentConfirmDialog } from './payment-confirm-dialog';
import { PaymentManualDialog } from './payment-manual-dialog';
import { Payment, PaymentService, isHandRecorded } from './payment.service';

type View = 'all' | 'pending' | 'refunds' | 'extra';

/** What each quick view asks the API for. */
const VIEWS: Record<View, FilterValues> = {
  all: {},
  pending: { 'status.equals': 'PENDING', 'purpose.notequals': 'REFUND' },
  refunds: { 'status.equals': 'PENDING', 'purpose.equals': 'REFUND' },
  // Money that arrived when it could not be used (after the buyer defaulted, a second deposit...) and is queued to go back.
  extra: {
    'status.equals': 'PENDING',
    'purpose.equals': 'REFUND',
    'note.startswith': "Qaytarish: to'lov ",
  },
};

@Component({
  selector: 'app-payment-list',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    SelectButtonModule,
    CellTemplate,
    DataTable,
    RowActionsTemplate,
    FilterBar,
    PageHeader,
    PaymentConfirmDialog,
    PaymentManualDialog,
    HasPermissionDirective,
    TPipe,
  ],
  templateUrl: './payment-list.html',
  styleUrl: './payment-list.scss',
})
export class PaymentList implements OnInit {
  private readonly payments = inject(PaymentService);
  private readonly query = inject(QueryState);
  private readonly i18n = inject(I18n);

  protected readonly views = (['all', 'pending', 'refunds', 'extra'] as const).map((value) => ({
    value,
    label: this.i18n.t(`payments.views.${value}`),
  }));
  protected readonly view = signal<View>('all');
  protected readonly barFilters = signal<FilterValues>({});
  protected readonly reload = signal(0);
  protected readonly filters = computed<FilterValues>(() => ({
    ...VIEWS[this.view()],
    ...this.barFilters(),
  }));

  protected readonly confirming = signal<Payment | null>(null);
  protected readonly confirmOpen = signal(false);
  protected readonly confirmMode = signal<'confirm' | 'refund'>('confirm');
  protected readonly manualOpen = signal(false);

  protected readonly fields: FilterField[] = [
    {
      key: 'purpose',
      label: this.i18n.t('payments.purpose'),
      type: 'select',
      options: this.i18n.enumOptions('PaymentPurpose'),
    },
    {
      key: 'provider',
      label: this.i18n.t('payments.provider'),
      type: 'select',
      options: this.i18n.enumOptions('PaymentProvider'),
    },
    {
      key: 'status',
      label: this.i18n.t('payments.status'),
      type: 'select',
      options: this.i18n.enumOptions('PaymentStatus'),
    },
    { key: 'createdAt', label: this.i18n.t('payments.createdAt'), type: 'date-range' },
  ];

  protected readonly columns: TableColumn<Payment>[] = [
    {
      field: 'userFullName',
      header: this.i18n.t('payments.payer'),
      type: 'custom',
      sortField: false,
    },
    { field: 'lotNumber', header: this.i18n.t('payments.lot'), type: 'custom', sortField: false },
    {
      field: 'purpose',
      header: this.i18n.t('payments.purpose'),
      type: 'enum',
      enumName: 'PaymentPurpose',
    },
    {
      field: 'provider',
      header: this.i18n.t('payments.provider'),
      type: 'enum',
      enumName: 'PaymentProvider',
    },
    { field: 'amount', header: this.i18n.t('payments.amount'), type: 'money', align: 'right' },
    {
      field: 'status',
      header: this.i18n.t('payments.status'),
      type: 'enum',
      enumName: 'PaymentStatus',
    },
    {
      field: 'receipts',
      header: this.i18n.t('payments.receipts'),
      type: 'custom',
      sortField: false,
      align: 'center',
    },
    { field: 'createdAt', header: this.i18n.t('payments.createdAt'), type: 'datetime' },
  ];

  protected readonly fetch = (query: ListQuery) => this.payments.list(query);

  ngOnInit(): void {
    const saved = this.query.get('view');
    if (saved === 'pending' || saved === 'refunds' || saved === 'extra') this.view.set(saved);
  }

  protected setView(view: View): void {
    this.view.set(view);
    this.query.patch({ view: view === 'all' ? null : view, page: null });
  }

  /** A bank / card / manual payment still waiting for the staff. */
  protected canConfirm(payment: Payment): boolean {
    return payment.status === 'PENDING' && payment.purpose !== 'REFUND' && isHandRecorded(payment);
  }

  protected canCompleteRefund(payment: Payment): boolean {
    return payment.status === 'PENDING' && payment.purpose === 'REFUND';
  }

  protected openConfirm(payment: Payment, mode: 'confirm' | 'refund'): void {
    this.confirming.set(payment);
    this.confirmMode.set(mode);
    this.confirmOpen.set(true);
  }

  protected openManual(): void {
    this.manualOpen.set(true);
  }

  protected changed(): void {
    this.reload.update((n) => n + 1);
  }
}
