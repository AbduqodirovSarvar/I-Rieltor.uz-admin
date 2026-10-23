import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { EMPTY, Observable, catchError, concatMap, from, toArray } from 'rxjs';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { MoneyPipe, DateTimePipe } from '../../core/format/format';
import { fileUrl } from '../../core/http/file-url';
import { ApiError } from '../../core/http/api-error';
import { I18n } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { Notify } from '../../core/notify/notify.service';
import { FileRuleName } from '../../shared/ui/file-upload/file-rules';
import { FileUpload } from '../../shared/ui/file-upload/file-upload';
import { KeyValue } from '../../shared/ui/misc/key-value';
import { PageHeader } from '../../shared/ui/misc/page-header';
import { StatusBadge } from '../../shared/ui/misc/status-badge';
import { CategoryService } from '../categories/category.service';
import {
  EDITABLE_STATUSES,
  Property,
  PropertyInput,
  PropertyMedia,
  PropertyMediaKind,
  PropertyService,
} from './property.service';

const KIND_RULE: Record<PropertyMediaKind, FileRuleName> = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
};

@Component({
  selector: 'app-property-detail',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    FileUpload,
    KeyValue,
    PageHeader,
    StatusBadge,
    HasPermissionDirective,
    MoneyPipe,
    DateTimePipe,
    TPipe,
  ],
  templateUrl: './property-detail.html',
  styleUrl: './property-detail.scss',
})
export class PropertyDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly properties = inject(PropertyService);
  private readonly categories = inject(CategoryService);
  private readonly notify = inject(Notify);
  private readonly i18n = inject(I18n);
  private readonly uploader = viewChild(FileUpload);

  protected readonly id = this.route.snapshot.paramMap.get('id') as string;
  protected readonly property = signal<Property | null>(null);
  protected readonly loading = signal(true);
  protected readonly categoryName = signal('');
  protected readonly url = fileUrl;

  protected readonly locked = computed(() => {
    const status = this.property()?.status;
    return !!status && !EDITABLE_STATUSES.includes(status);
  });
  protected readonly media = computed(() =>
    [...(this.property()?.media ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  // Upload
  protected readonly kinds = (['IMAGE', 'VIDEO', 'DOCUMENT'] as const).map((value) => ({
    value,
    label: this.i18n.t(`properties.kinds.${value}`),
  }));
  protected kind: PropertyMediaKind = 'IMAGE';
  protected readonly uploading = signal(false);
  private picked: File[] = [];

  // Media edit dialog
  protected readonly editDialog = signal(false);
  protected editing: PropertyMedia | null = null;
  protected editTitle = '';
  protected editOrder = 0;

  protected get rule(): FileRuleName {
    return KIND_RULE[this.kind];
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.properties.get(this.id).subscribe({
      next: (property) => {
        this.property.set(property);
        this.loading.set(false);
        this.categories
          .all()
          .subscribe((all) =>
            this.categoryName.set(all.find((c) => c.id === property.categoryId)?.name ?? ''),
          );
      },
      error: (error: unknown) => {
        this.notify.error(error, this.i18n.t('properties.notFound'));
        void this.router.navigate(['/properties']);
      },
    });
  }

  protected async remove(): Promise<void> {
    const property = this.property();
    if (!property) return;
    if (
      !(await this.notify.confirmDelete(
        this.i18n.t('properties.deleteConfirm', { name: property.title ?? '' }),
      ))
    )
      return;
    this.properties.delete(property.id).subscribe({
      next: () => {
        this.notify.success(this.i18n.t('common.deleted'));
        void this.router.navigate(['/properties']);
      },
      // The API refuses a property that has auctions and says to archive it.
      error: (error: unknown) => this.notify.error(error),
    });
  }

  protected async archive(): Promise<void> {
    const property = this.property();
    if (!property) return;
    if (!(await this.notify.confirm({ message: this.i18n.t('properties.archive') + '?' }))) return;
    const input: PropertyInput = {
      title: property.title ?? '',
      description: property.description ?? '',
      categoryId: property.categoryId,
      status: 'ARCHIVED',
      region: property.region ?? '',
      district: property.district ?? '',
      address: property.address ?? '',
      latitude: property.latitude,
      longitude: property.longitude,
      cadastralNumber: property.cadastralNumber ?? '',
      areaSqm: property.areaSqm,
      landAreaSotix: property.landAreaSotix,
      rooms: property.rooms,
      floor: property.floor,
      totalFloors: property.totalFloors,
      buildYear: property.buildYear,
      estimatedValue: property.estimatedValue,
      sellerName: property.sellerName ?? '',
    };
    this.properties.update(property.id, input).subscribe({
      next: () => {
        this.notify.success(this.i18n.t('properties.archived'));
        this.load();
      },
      error: (error: unknown) => this.notify.error(error),
    });
  }

  // ---- media

  protected onKind(kind: PropertyMediaKind): void {
    this.kind = kind;
    this.uploader()?.clear();
    this.picked = [];
  }

  protected onPicked(files: File[]): void {
    this.picked = files;
  }

  protected upload(): void {
    if (this.picked.length === 0 || this.uploading()) return;
    const existing = this.media();
    const hasCover = existing.some((m) => m.isCover);
    const next = (existing.at(-1)?.sortOrder ?? -1) + 1;
    this.uploading.set(true);
    const failed: string[] = [];
    from(this.picked)
      .pipe(
        concatMap((file, index) =>
          this.properties
            .addMedia({
              propertyId: this.id,
              file,
              kind: this.kind,
              title: '',
              sortOrder: next + index,
              // The first picture of a property without a cover becomes its cover.
              isCover: this.kind === 'IMAGE' && !hasCover && index === 0,
            })
            .pipe(
              catchError((error: unknown) => {
                failed.push(`${file.name}: ${ApiError.from(error).message}`);
                return EMPTY;
              }),
            ),
        ),
        toArray(),
      )
      .subscribe(() => {
        this.uploading.set(false);
        this.uploader()?.clear();
        this.picked = [];
        if (failed.length === 0) this.notify.success(this.i18n.t('properties.mediaAdded'));
        else
          this.notify.error(
            new ApiError(400, failed.join('\n')),
            this.i18n.t('properties.mediaFailed'),
          );
        this.load();
      });
  }

  protected makeCover(media: PropertyMedia): void {
    this.run(
      this.properties.updateMedia(media.id, {
        title: media.title ?? '',
        sortOrder: media.sortOrder,
        isCover: true,
      }),
    );
  }

  protected openEdit(media: PropertyMedia): void {
    this.editing = media;
    this.editTitle = media.title ?? '';
    this.editOrder = media.sortOrder;
    this.editDialog.set(true);
  }

  protected saveEdit(): void {
    const media = this.editing;
    if (!media) return;
    this.editDialog.set(false);
    this.run(
      this.properties.updateMedia(media.id, {
        title: this.editTitle.trim(),
        sortOrder: this.editOrder,
        isCover: media.isCover,
      }),
    );
  }

  protected async removeMedia(media: PropertyMedia): Promise<void> {
    if (!(await this.notify.confirmDelete(media.title || media.uploadedFile?.name || ''))) return;
    this.run(this.properties.deleteMedia(media.id), 'properties.mediaDeleted');
  }

  private run(request: Observable<unknown>, success?: 'properties.mediaDeleted'): void {
    request.subscribe({
      next: () => {
        if (success) this.notify.success(this.i18n.t(success));
        this.load();
      },
      error: (error: unknown) => this.notify.error(error),
    });
  }
}
