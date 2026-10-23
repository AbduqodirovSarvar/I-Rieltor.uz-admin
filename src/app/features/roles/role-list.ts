import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { applyServerErrors } from '../../core/forms/server-errors';
import { ApiError } from '../../core/http/api-error';
import { ListQuery } from '../../core/http/response-model';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { DataTable, RowActionsTemplate, TableColumn } from '../../shared/ui/data-table/data-table';
import { FormField } from '../../shared/ui/form-field/form-field';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { Role, RoleService } from './role.service';

@Component({
  selector: 'app-role-list',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DataTable,
    RowActionsTemplate,
    FormField,
    PageHeader,
    HasPermissionDirective,
    TPipe,
  ],
  templateUrl: './role-list.html',
})
export class RoleList {
  private readonly roles = inject(RoleService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly reload = signal(0);
  protected readonly dialog = signal(false);
  protected readonly busy = signal(false);
  private editingId: string | null = null;

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  protected readonly columns: TableColumn<Role>[] = [
    { field: 'name', header: this.i18n.t('roles.name') },
    { field: 'description', header: this.i18n.t('roles.description'), sortField: false },
  ];

  protected readonly defaultSort = { field: 'Name', direction: 'asc' as const };
  protected readonly fetch = (query: ListQuery) => this.roles.list(query);

  protected get dialogTitle(): string {
    return this.i18n.t(this.editingId ? 'roles.edit' : 'roles.new');
  }

  protected open(role?: Role): void {
    this.editingId = role?.id ?? null;
    this.form.reset({ name: role?.name ?? '', description: role?.description ?? '' });
    this.dialog.set(true);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const { name, description } = this.form.getRawValue();
    const body = { name: name.trim(), description: description.trim() || null };
    this.busy.set(true);
    const request = this.editingId
      ? this.roles.update(this.editingId, body)
      : this.roles.create(body);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.dialog.set(false);
        this.notify.success(this.i18n.t(this.editingId ? 'roles.updated' : 'roles.created'));
        this.reload.update((n) => n + 1);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const apiError = ApiError.from(error);
        const rest = apiError.isValidation
          ? applyServerErrors(this.form, apiError)
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

  protected async remove(role: Role): Promise<void> {
    if (
      !(await this.notify.confirmDelete(
        this.i18n.t('roles.deleteConfirm', { name: role.name ?? '' }),
      ))
    )
      return;
    this.roles.delete(role.id).subscribe({
      next: () => {
        this.notify.success(this.i18n.t('common.deleted'));
        this.reload.update((n) => n + 1);
      },
      error: (error: unknown) => this.notify.error(error),
    });
  }
}
