import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { applyServerErrors } from '../../core/forms/server-errors';
import { ApiError } from '../../core/http/api-error';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { FormField } from '../../shared/ui/form-field/form-field';
import { EmptyState } from '../../shared/ui/misc/empty-state';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { Category, CategoryService, descendantIds, toTree } from './category.service';

/** The categories as a tree: a parent, its children below it, each with add / edit / delete. */
@Component({
  selector: 'app-category-list',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    EmptyState,
    FormField,
    PageHeader,
    HasPermissionDirective,
    TPipe,
  ],
  templateUrl: './category-list.html',
  styleUrl: './category-list.scss',
})
export class CategoryList implements OnInit {
  private readonly service = inject(CategoryService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly dialog = signal(false);
  protected readonly busy = signal(false);
  protected readonly editing = signal<Category | null>(null);
  protected readonly tree = computed(() => toTree(this.categories()));

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    parentCategoryId: new FormControl<string | null>(null),
    sortOrder: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(10_000)],
    }),
  });

  /** Possible parents: everything except the category itself and its descendants. */
  protected readonly parentOptions = computed(() => {
    const editing = this.editing();
    const blocked = editing ? descendantIds(this.categories(), editing.id) : new Set<string>();
    return [
      { id: null as string | null, label: this.i18n.t('categories.noParent') },
      ...toTree(this.categories())
        .filter((node) => !blocked.has(node.category.id))
        .map((node) => ({
          id: node.category.id as string | null,
          label: `${'— '.repeat(node.depth)}${node.category.name ?? ''}`,
        })),
    ];
  });

  protected get dialogTitle(): string {
    return this.i18n.t(this.editing() ? 'categories.edit' : 'categories.new');
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.service.all().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.notify.error(error);
        this.loading.set(false);
      },
    });
  }

  protected open(category?: Category, parentId: string | null = null): void {
    this.editing.set(category ?? null);
    this.form.reset({
      name: category?.name ?? '',
      description: category?.description ?? '',
      parentCategoryId: category ? category.parentCategoryId : parentId,
      sortOrder: category?.sortOrder ?? 0,
    });
    this.dialog.set(true);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const value = this.form.getRawValue();
    const input = {
      name: value.name.trim(),
      description: value.description.trim(),
      parentCategoryId: value.parentCategoryId,
      sortOrder: value.sortOrder,
    };
    const editing = this.editing();
    this.busy.set(true);
    (editing ? this.service.update(editing.id, input) : this.service.create(input)).subscribe({
      next: () => {
        this.busy.set(false);
        this.dialog.set(false);
        this.notify.success(this.i18n.t(editing ? 'categories.updated' : 'categories.created'));
        this.load();
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

  protected async remove(category: Category): Promise<void> {
    if (
      !(await this.notify.confirmDelete(
        this.i18n.t('categories.deleteConfirm', { name: category.name ?? '' }),
      ))
    )
      return;
    this.service.delete(category.id).subscribe({
      next: () => {
        this.notify.success(this.i18n.t('common.deleted'));
        this.load();
      },
      // The API explains why it refuses (has subcategories / used by properties).
      error: (error: unknown) => this.notify.error(error),
    });
  }
}
