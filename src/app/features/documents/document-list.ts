import { Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { formatFileSize } from '../../core/format/format';
import { ListQuery } from '../../core/http/response-model';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { DataTable, RowActionsTemplate, TableColumn } from '../../shared/ui/data-table/data-table';
import { FilterBar, FilterField, FilterValues } from '../../shared/ui/filter-bar/filter-bar';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { DocumentService, PrivateDocument } from './document.service';

@Component({
  selector: 'app-document-list',
  imports: [
    ButtonModule,
    DataTable,
    RowActionsTemplate,
    FilterBar,
    PageHeader,
    HasPermissionDirective,
    TPipe,
  ],
  templateUrl: './document-list.html',
})
export class DocumentList {
  private readonly documents = inject(DocumentService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly filters = signal<FilterValues>({});
  protected readonly reload = signal(0);

  protected readonly fields: FilterField[] = [
    {
      key: 'purpose',
      label: this.i18n.t('documents.purpose'),
      type: 'select',
      options: this.i18n.enumOptions('DocumentPurpose'),
    },
    { key: 'createdAt', label: this.i18n.t('documents.uploadedAt'), type: 'date-range' },
  ];

  protected readonly columns: TableColumn<PrivateDocument>[] = [
    { field: 'originalName', header: this.i18n.t('documents.name') },
    { field: 'ownerFullName', header: this.i18n.t('documents.owner'), sortField: false },
    {
      field: 'purpose',
      header: this.i18n.t('documents.purpose'),
      type: 'enum',
      enumName: 'DocumentPurpose',
    },
    {
      field: 'size',
      header: this.i18n.t('documents.size'),
      align: 'right',
      value: (d) => formatFileSize(d.size),
    },
    { field: 'createdAt', header: this.i18n.t('documents.uploadedAt'), type: 'datetime' },
  ];

  protected readonly fetch = (query: ListQuery) => this.documents.list(query);

  protected open(document: PrivateDocument): void {
    this.documents.open(document);
  }

  protected download(document: PrivateDocument): void {
    this.documents.save(document);
  }

  protected async remove(document: PrivateDocument): Promise<void> {
    if (
      !(await this.notify.confirmDelete(
        this.i18n.t('documents.deleteConfirm', { name: document.originalName ?? '' }),
      ))
    )
      return;
    this.documents.delete(document.id).subscribe({
      next: () => {
        this.notify.success(this.i18n.t('documents.deleted'));
        this.reload.update((n) => n + 1);
      },
      error: (error: unknown) => this.notify.error(error),
    });
  }
}
