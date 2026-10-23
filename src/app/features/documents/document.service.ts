import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { previewBlob, saveBlob } from '../../core/http/download';
import { plainParams } from '../../core/http/query-params';
import { ListQuery, Page } from '../../core/http/response-model';

export type PrivateDocument = components['schemas']['PrivateDocumentViewModel'];
export type DocumentPurpose = components['schemas']['DocumentPurpose'];

export interface UploadOptions {
  purpose?: DocumentPurpose;
  auctionId?: string;
  paymentId?: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly api = inject(ApiClient);

  list(query: ListQuery): Observable<Page<PrivateDocument>> {
    return this.api.getPage<PrivateDocument>('api/Document/list', query);
  }

  /** Documents of one person (optionally of one auction). */
  ofOwner(
    ownerId: string,
    auctionId: string | null,
    query: ListQuery = {},
  ): Observable<Page<PrivateDocument>> {
    return this.list({
      pageSize: 50,
      ...query,
      filters: {
        ...query.filters,
        'ownerId.equals': ownerId,
        ...(auctionId ? { 'auctionId.equals': auctionId } : {}),
      },
    });
  }

  upload(file: File, options: UploadOptions = {}): Observable<PrivateDocument> {
    const form = new FormData();
    form.append('File', file);
    if (options.purpose) form.append('Purpose', options.purpose);
    if (options.auctionId) form.append('AuctionId', options.auctionId);
    if (options.paymentId) form.append('PaymentId', options.paymentId);
    if (options.description) form.append('Description', options.description);
    return this.api.postForm<PrivateDocument>('api/Document', form);
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<boolean>('api/Document', { id });
  }

  /** Fetches the file with the access token (a plain link would not carry it) and shows or saves it. */
  open(document: Pick<PrivateDocument, 'id' | 'originalName' | 'contentType'>): void {
    this.api.blob('api/Document/download', plainParams({ id: document.id })).subscribe((blob) => {
      if (isSafeToPreview(blob.type)) previewBlob(blob);
      else saveBlob(blob, document.originalName ?? 'document');
    });
  }

  save(document: Pick<PrivateDocument, 'id' | 'originalName'>): void {
    this.api
      .blob('api/Document/download', plainParams({ id: document.id }))
      .subscribe((blob) => saveBlob(blob, document.originalName ?? 'document'));
  }
}

/**
 * Only plain pictures and PDF open in a tab. A blob opens on the admin's own origin, so an uploaded SVG or HTML would run
 * its script with the admin's session: everything else is saved, never opened.
 */
export function isSafeToPreview(contentType: string | null | undefined): boolean {
  return /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/i.test(contentType ?? '');
}
