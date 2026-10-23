import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { catchError, concatMap, from, of, tap, toArray } from 'rxjs';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { DateTimePipe, PhonePipe } from '../../core/format/format';
import { ApiError } from '../../core/http/api-error';
import { ListQuery } from '../../core/http/response-model';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import {
  CellTemplate,
  DataTable,
  RowActionsTemplate,
  TableColumn,
} from '../../shared/ui/data-table/data-table';
import { FilterBar, FilterField, FilterValues } from '../../shared/ui/filter-bar/filter-bar';
import { KeyValue } from '../../shared/ui/misc/key-value';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { StatusBadge } from '../../shared/ui/misc/status-badge';
import { AuctionService } from '../auctions/auction.service';
import { DocumentService, PrivateDocument } from '../documents/document.service';
import { ParticipantActions } from './participant-actions';
import { Participant, ParticipantService } from './participant.service';

/** The review queue: applications of all auctions, newest first; the pending ones are shown by default. */
@Component({
  selector: 'app-participant-list',
  imports: [
    RouterLink,
    ButtonModule,
    DialogModule,
    CellTemplate,
    DataTable,
    RowActionsTemplate,
    FilterBar,
    KeyValue,
    PageHeader,
    StatusBadge,
    ParticipantActions,
    HasPermissionDirective,
    DateTimePipe,
    PhonePipe,
    TPipe,
  ],
  templateUrl: './participant-list.html',
  styleUrl: './participant-list.scss',
})
export class ParticipantList implements OnInit {
  private readonly participants = inject(ParticipantService);
  private readonly auctions = inject(AuctionService);
  private readonly documents = inject(DocumentService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly filters = signal<FilterValues>({});
  protected readonly reload = signal(0);
  protected readonly fields = signal<FilterField[]>(this.baseFields());
  protected readonly defaultSort = { field: 'CreatedAt', direction: 'desc' as const };

  // Selection for approving many at once.
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly bulkBusy = signal(false);
  private page: Participant[] = [];

  // Detail dialog
  protected readonly detail = signal<Participant | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly documentsOf = signal<PrivateDocument[]>([]);

  protected readonly columns: TableColumn<Participant>[] = [
    { field: 'select', header: '', type: 'custom', sortField: false, width: '3rem' },
    { field: 'lotNumber', header: this.i18n.t('participants.lot'), sortField: false },
    { field: 'participantNumber', header: this.i18n.t('participants.number') },
    {
      field: 'userFullName',
      header: this.i18n.t('participants.person'),
      type: 'custom',
      sortField: false,
    },
    { field: 'userIdentifier', header: this.i18n.t('participants.identifier'), sortField: false },
    {
      field: 'status',
      header: this.i18n.t('participants.status'),
      type: 'enum',
      enumName: 'ParticipantStatus',
    },
    {
      field: 'depositStatus',
      header: this.i18n.t('participants.deposit'),
      type: 'enum',
      enumName: 'DepositStatus',
    },
    { field: 'signedAt', header: this.i18n.t('participants.signedAt'), type: 'datetime' },
  ];

  protected readonly fetch = (query: ListQuery) =>
    this.participants.list(query).pipe(tap((page) => (this.page = page.items)));

  ngOnInit(): void {
    this.auctions.list({ pageSize: 100, sortBy: 'CreatedAt', sortDirection: 'desc' }).subscribe({
      next: (page) =>
        this.fields.set([
          ...this.baseFields(),
          {
            key: 'auctionId',
            label: this.i18n.t('participants.auction'),
            type: 'select',
            options: page.items.map((a) => ({
              value: a.id,
              label: `${a.lotNumber} · ${a.title ?? ''}`,
            })),
          },
        ]),
      error: () => undefined,
    });
  }

  protected toggle(participant: Participant): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(participant.id)) next.add(participant.id);
      return next;
    });
  }

  protected isSelected(participant: Participant): boolean {
    return this.selected().has(participant.id);
  }

  protected selectPending(): void {
    this.selected.set(new Set(this.page.filter((p) => p.status === 'PENDING').map((p) => p.id)));
  }

  protected async approveSelected(): Promise<void> {
    const ids = [...this.selected()];
    if (ids.length === 0 || this.bulkBusy()) return;
    if (
      !(await this.notify.confirm({
        message: this.i18n.t('participants.bulkConfirm', { count: ids.length }),
      }))
    )
      return;
    this.bulkBusy.set(true);
    const failures: string[] = [];
    from(ids)
      .pipe(
        concatMap((id) =>
          this.participants.approve(id).pipe(
            catchError((error: unknown) => {
              failures.push(ApiError.from(error).message);
              return of(null);
            }),
          ),
        ),
        toArray(),
      )
      .subscribe(() => {
        this.bulkBusy.set(false);
        this.selected.set(new Set());
        const done = ids.length - failures.length;
        if (done > 0) this.notify.success(this.i18n.t('participants.bulkDone', { count: done }));
        if (failures.length > 0)
          this.notify.error(
            new ApiError(409, [...new Set(failures)].join('\n')),
            this.i18n.t('participants.bulkFailed', { count: failures.length }),
          );
        this.reload.update((n) => n + 1);
      });
  }

  protected view(participant: Participant): void {
    this.detail.set(participant);
    this.documentsOf.set([]);
    this.detailOpen.set(true);
    this.documents.ofOwner(participant.userId, participant.auctionId).subscribe({
      next: (page) => this.documentsOf.set(page.items),
      error: () => undefined,
    });
  }

  protected downloadSignature(participant: Participant): void {
    this.participants.downloadSignature(participant);
  }

  protected openDocument(document: PrivateDocument): void {
    this.documents.open(document);
  }

  protected reviewed(): void {
    this.detailOpen.set(false);
    this.reload.update((n) => n + 1);
  }

  private baseFields(): FilterField[] {
    return [
      {
        key: 'status',
        label: this.i18n.t('participants.status'),
        type: 'select',
        options: this.i18n.enumOptions('ParticipantStatus'),
        default: 'PENDING',
      },
      {
        key: 'depositStatus',
        label: this.i18n.t('participants.deposit'),
        type: 'select',
        options: this.i18n.enumOptions('DepositStatus'),
      },
      { key: 'createdAt', label: this.i18n.t('users.createdAt'), type: 'date-range' },
    ];
  }
}
