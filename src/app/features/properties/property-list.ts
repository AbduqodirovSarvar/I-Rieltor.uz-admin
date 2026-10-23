import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { fileUrl } from '../../core/http/file-url';
import { ListQuery } from '../../core/http/response-model';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { CellTemplate, DataTable, TableColumn } from '../../shared/ui/data-table/data-table';
import { FilterBar, FilterField, FilterValues } from '../../shared/ui/filter-bar/filter-bar';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { CategoryService, toTree } from '../categories/category.service';
import { Property, PropertyService } from './property.service';

@Component({
  selector: 'app-property-list',
  imports: [
    RouterLink,
    ButtonModule,
    CellTemplate,
    DataTable,
    FilterBar,
    PageHeader,
    HasPermissionDirective,
    TPipe,
  ],
  templateUrl: './property-list.html',
  styleUrl: './property-list.scss',
})
export class PropertyList implements OnInit {
  private readonly properties = inject(PropertyService);
  private readonly categories = inject(CategoryService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);

  protected readonly filters = signal<FilterValues>({});
  protected readonly fields = signal<FilterField[]>(this.baseFields());
  private names = new Map<string, string>();

  protected readonly columns: TableColumn<Property>[] = [
    { field: 'cover', header: '', type: 'custom', sortField: false, width: '5rem' },
    { field: 'title', header: this.i18n.t('properties.titleField') },
    {
      field: 'category',
      header: this.i18n.t('properties.category'),
      sortField: false,
      value: (p) => this.names.get(p.categoryId) ?? '',
    },
    {
      field: 'status',
      header: this.i18n.t('properties.status'),
      type: 'enum',
      enumName: 'PropertyStatus',
    },
    { field: 'region', header: this.i18n.t('properties.region') },
    { field: 'areaSqm', header: this.i18n.t('properties.areaSqm'), align: 'right' },
    {
      field: 'estimatedValue',
      header: this.i18n.t('properties.estimatedValue'),
      type: 'money',
      align: 'right',
    },
    { field: 'createdAt', header: this.i18n.t('users.createdAt'), type: 'datetime' },
  ];

  protected readonly fetch = (query: ListQuery) => this.properties.list(query);
  protected readonly url = fileUrl;

  ngOnInit(): void {
    this.categories.all().subscribe({
      next: (all) => {
        this.names = new Map(all.map((c) => [c.id, c.name ?? '']));
        this.fields.set([
          ...this.baseFields(),
          {
            key: 'categoryId',
            label: this.i18n.t('properties.category'),
            type: 'select',
            options: toTree(all).map((n) => ({
              value: n.category.id,
              label: `${'— '.repeat(n.depth)}${n.category.name ?? ''}`,
            })),
          },
        ]);
      },
      error: () => undefined,
    });
  }

  /** The cover picture, else the first picture. */
  protected cover(property: Property): string {
    const images = (property.media ?? []).filter((m) => m.kind === 'IMAGE');
    return fileUrl((images.find((m) => m.isCover) ?? images[0])?.uploadedFile?.url);
  }

  protected open(property: Property): void {
    void this.router.navigate(['/properties', property.id]);
  }

  private baseFields(): FilterField[] {
    return [
      {
        key: 'status',
        label: this.i18n.t('properties.status'),
        type: 'select',
        options: this.i18n.enumOptions('PropertyStatus'),
      },
      { key: 'region', label: this.i18n.t('properties.region'), type: 'text', op: 'contains' },
      { key: 'createdAt', label: this.i18n.t('users.createdAt'), type: 'date-range' },
    ];
  }
}
