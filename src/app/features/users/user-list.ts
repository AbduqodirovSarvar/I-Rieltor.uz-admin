import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { ListQuery } from '../../core/http/response-model';
import { DataTable, TableColumn } from '../../shared/ui/data-table/data-table';
import { FilterBar, FilterField, FilterValues } from '../../shared/ui/filter-bar/filter-bar';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { RoleService } from '../roles/role.service';
import { User, UserService } from './user.service';

@Component({
  selector: 'app-user-list',
  imports: [
    RouterLink,
    ButtonModule,
    DataTable,
    FilterBar,
    PageHeader,
    HasPermissionDirective,
    TPipe,
  ],
  templateUrl: './user-list.html',
})
export class UserList implements OnInit {
  private readonly users = inject(UserService);
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18n);

  protected readonly filters = signal<FilterValues>({});
  protected readonly fields = signal<FilterField[]>(this.baseFields());

  protected readonly columns: TableColumn<User>[] = [
    { field: 'fullName', header: this.i18n.t('users.fullName') },
    { field: 'login', header: this.i18n.t('users.login') },
    { field: 'type', header: this.i18n.t('users.type'), type: 'enum', enumName: 'ClientType' },
    { field: 'phone', header: this.i18n.t('users.phone'), type: 'phone' },
    { field: 'email', header: this.i18n.t('users.email') },
    {
      field: 'userRole',
      header: this.i18n.t('users.role'),
      sortField: 'UserRole.Name',
      value: (user) => user.userRole?.name ?? '',
    },
    { field: 'createdAt', header: this.i18n.t('users.createdAt'), type: 'datetime' },
  ];

  protected readonly fetch = (query: ListQuery) => this.users.list(query);

  ngOnInit(): void {
    // The role filter needs the roles; until they arrive the bar has the other filters.
    this.roles.all().subscribe({
      next: (roles) =>
        this.fields.set([
          ...this.baseFields(),
          {
            key: 'userRoleId',
            label: this.i18n.t('users.role'),
            type: 'select',
            options: roles.map((r) => ({ value: r.id, label: r.name ?? '' })),
          },
        ]),
      error: () => undefined,
    });
  }

  protected open(user: User): void {
    void this.router.navigate(['/users', user.id]);
  }

  private baseFields(): FilterField[] {
    return [
      {
        key: 'type',
        label: this.i18n.t('users.type'),
        type: 'select',
        options: this.i18n.enumOptions('ClientType'),
      },
      { key: 'createdAt', label: this.i18n.t('users.createdAt'), type: 'date-range' },
    ];
  }
}
