import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { forkJoin, tap } from 'rxjs';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { applyServerErrors } from '../../core/forms/server-errors';
import { fileUrl } from '../../core/http/file-url';
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
import { FileUpload } from '../../shared/ui/file-upload/file-upload';
import { FormField } from '../../shared/ui/form-field/form-field';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { Slide, SlideInput, SlideService } from './slide.service';

@Component({
  selector: 'app-slide-list',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    TextareaModule,
    CellTemplate,
    DataTable,
    RowActionsTemplate,
    FileUpload,
    FormField,
    PageHeader,
    HasPermissionDirective,
    TPipe,
  ],
  templateUrl: './slide-list.html',
  styleUrl: './slide-list.scss',
})
export class SlideList {
  private readonly slides = inject(SlideService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);

  protected readonly reload = signal(0);
  protected readonly dialog = signal(false);
  protected readonly busy = signal(false);
  protected readonly editing = signal<Slide | null>(null);
  protected readonly fileError = signal(false);
  private file: File | null = null;
  /** The rows of the page on screen, in order, for moving a slide up or down. */
  private rows: Slide[] = [];

  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    subtitle: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    content: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
    order: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(10_000)],
    }),
    durationMs: new FormControl(3000, {
      nonNullable: true,
      validators: [Validators.min(500), Validators.max(60_000)],
    }),
  });

  protected readonly columns: TableColumn<Slide>[] = [
    {
      field: 'uploadedFile',
      header: this.i18n.t('slides.image'),
      type: 'custom',
      sortField: false,
      width: '6rem',
    },
    { field: 'title', header: this.i18n.t('slides.titleField') },
    { field: 'subtitle', header: this.i18n.t('slides.subtitle') },
    { field: 'order', header: this.i18n.t('slides.order'), align: 'right' },
    { field: 'durationMs', header: this.i18n.t('slides.duration'), align: 'right' },
  ];
  protected readonly defaultSort = { field: 'Order', direction: 'asc' as const };

  protected readonly fetch = (query: ListQuery) =>
    this.slides.list(query).pipe(tap((page) => (this.rows = page.items)));

  protected readonly url = fileUrl;

  protected get dialogTitle(): string {
    return this.i18n.t(this.editing() ? 'slides.edit' : 'slides.new');
  }

  protected open(slide?: Slide): void {
    this.editing.set(slide ?? null);
    this.file = null;
    this.fileError.set(false);
    this.form.reset({
      title: slide?.title ?? '',
      subtitle: slide?.subtitle ?? '',
      content: slide?.content ?? '',
      order: slide?.order ?? 0,
      durationMs: slide?.durationMs ?? 3000,
    });
    this.dialog.set(true);
  }

  protected picked(files: File[]): void {
    this.file = files[0] ?? null;
    if (this.file) this.fileError.set(false);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    const editing = this.editing();
    if (!editing && !this.file) this.fileError.set(true);
    if (this.form.invalid || (!editing && !this.file) || this.busy()) return;
    const value = this.form.getRawValue();
    const input: SlideInput = { ...value, title: value.title.trim(), file: this.file };
    this.busy.set(true);
    const request = editing ? this.slides.update(editing.id, input) : this.slides.create(input);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.dialog.set(false);
        this.notify.success(this.i18n.t(editing ? 'slides.updated' : 'slides.created'));
        this.reload.update((n) => n + 1);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected async remove(slide: Slide): Promise<void> {
    if (
      !(await this.notify.confirmDelete(
        this.i18n.t('slides.deleteConfirm', { name: slide.title ?? '' }),
      ))
    )
      return;
    this.slides.delete(slide.id).subscribe({
      next: () => {
        this.notify.success(this.i18n.t('common.deleted'));
        this.reload.update((n) => n + 1);
      },
      error: (error: unknown) => this.notify.error(error),
    });
  }

  /** Swap the order numbers of a slide and its neighbour. */
  protected move(slide: Slide, direction: -1 | 1): void {
    const index = this.rows.findIndex((row) => row.id === slide.id);
    const other = this.rows[index + direction];
    if (!other) return;
    const as = (s: Slide, order: number): SlideInput => ({
      title: s.title ?? '',
      subtitle: s.subtitle ?? '',
      content: s.content ?? '',
      order,
      durationMs: s.durationMs,
      file: null,
    });
    // Equal order numbers cannot be told apart by swapping: spread them by position first.
    const same = slide.order === other.order;
    const first = same ? index : other.order;
    const second = same ? index + direction : slide.order;
    forkJoin([
      this.slides.update(slide.id, as(slide, same ? second : first)),
      this.slides.update(other.id, as(other, same ? first : second)),
    ]).subscribe({
      next: () => this.reload.update((n) => n + 1),
      error: (error: unknown) => this.notify.error(error),
    });
  }

  protected canMove(slide: Slide, direction: -1 | 1): boolean {
    const index = this.rows.findIndex((row) => row.id === slide.id);
    return index >= 0 && !!this.rows[index + direction];
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    const apiError = ApiError.from(error);
    const rest = apiError.isValidation
      ? applyServerErrors(this.form, apiError)
      : [apiError.message];
    if (rest.length > 0)
      this.notify.error(
        new ApiError(apiError.status, rest.join('\n'), [], apiError.retryAfter, apiError.requestId),
      );
  }
}
