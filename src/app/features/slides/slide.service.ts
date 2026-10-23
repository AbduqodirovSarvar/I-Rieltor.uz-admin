import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { ListQuery, Page } from '../../core/http/response-model';

export type Slide = components['schemas']['SlideViewModel'];

export interface SlideInput {
  title: string;
  subtitle: string;
  content: string;
  order: number;
  durationMs: number;
  /** Required on create; on update only when the picture is replaced. */
  file: File | null;
}

@Injectable({ providedIn: 'root' })
export class SlideService {
  private readonly api = inject(ApiClient);

  list(query: ListQuery): Observable<Page<Slide>> {
    return this.api.getPage<Slide>('api/Slide/list', query);
  }

  create(input: SlideInput): Observable<Slide> {
    return this.api.postForm<Slide>('api/Slide', this.form(input));
  }

  /** The update replaces everything except the picture, which stays when no file is sent. */
  update(id: string, input: SlideInput): Observable<Slide> {
    const form = this.form(input);
    form.append('Id', id);
    return this.api.putForm<Slide>('api/Slide', form);
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<boolean>('api/Slide', { id });
  }

  private form(input: SlideInput): FormData {
    const form = new FormData();
    form.append('Title', input.title);
    form.append('Subtitle', input.subtitle);
    form.append('Content', input.content);
    form.append('Order', String(input.order));
    form.append('DurationMs', String(input.durationMs));
    if (input.file) form.append('File', input.file);
    return form;
  }
}
