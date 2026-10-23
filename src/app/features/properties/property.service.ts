import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { plainParams } from '../../core/http/query-params';
import { ListQuery, Page } from '../../core/http/response-model';

export type Property = components['schemas']['PropertyViewModel'];
export type PropertyMedia = components['schemas']['PropertyMediaViewModel'];
export type PropertyMediaKind = components['schemas']['PropertyMediaKind'];
export type PropertyStatus = components['schemas']['PropertyStatus'];

/** The statuses an admin may set by hand; IN_AUCTION and SOLD follow the auction. */
export const EDITABLE_STATUSES: readonly PropertyStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export interface PropertyInput {
  title: string;
  description: string;
  categoryId: string;
  status: PropertyStatus;
  region: string;
  district: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  cadastralNumber: string;
  areaSqm: number | null;
  landAreaSotix: number | null;
  rooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  buildYear: number | null;
  estimatedValue: number | null;
  sellerName: string;
}

export interface MediaInput {
  propertyId: string;
  file: File;
  kind: PropertyMediaKind;
  title: string;
  sortOrder: number;
  isCover: boolean;
}

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private readonly api = inject(ApiClient);

  list(query: ListQuery): Observable<Page<Property>> {
    return this.api.getPage<Property>('api/Property/list', query);
  }

  get(id: string): Observable<Property> {
    return this.api.get<Property>('api/Property', plainParams({ Id: id }));
  }

  create(input: PropertyInput): Observable<Property> {
    return this.api.postForm<Property>('api/Property', this.form(input));
  }

  /** A full replacement of the property's fields (media are separate). */
  update(id: string, input: PropertyInput): Observable<Property> {
    const form = this.form(input);
    form.append('Id', id);
    return this.api.putForm<Property>('api/Property', form);
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<boolean>('api/Property', { id });
  }

  addMedia(input: MediaInput): Observable<PropertyMedia> {
    const form = new FormData();
    form.append('PropertyId', input.propertyId);
    form.append('File', input.file);
    form.append('Kind', input.kind);
    form.append('SortOrder', String(input.sortOrder));
    form.append('IsCover', String(input.isCover));
    if (input.title) form.append('Title', input.title);
    return this.api.postForm<PropertyMedia>('api/Property/media', form);
  }

  updateMedia(
    id: string,
    media: { title: string; sortOrder: number; isCover: boolean },
  ): Observable<PropertyMedia> {
    const form = new FormData();
    form.append('Id', id);
    form.append('SortOrder', String(media.sortOrder));
    form.append('IsCover', String(media.isCover));
    if (media.title) form.append('Title', media.title);
    return this.api.putForm<PropertyMedia>('api/Property/media', form);
  }

  deleteMedia(id: string): Observable<boolean> {
    return this.api.delete<boolean>('api/Property/media', { id });
  }

  private form(input: PropertyInput): FormData {
    const form = new FormData();
    const text = (name: string, value: string) => {
      if (value.trim()) form.append(name, value.trim());
    };
    const number = (name: string, value: number | null) => {
      if (value !== null && value !== undefined) form.append(name, String(value));
    };
    text('Title', input.title);
    text('Description', input.description);
    form.append('CategoryId', input.categoryId);
    form.append('Status', input.status);
    text('Region', input.region);
    text('District', input.district);
    text('Address', input.address);
    text('CadastralNumber', input.cadastralNumber);
    text('SellerName', input.sellerName);
    number('Latitude', input.latitude);
    number('Longitude', input.longitude);
    number('AreaSqm', input.areaSqm);
    number('LandAreaSotix', input.landAreaSotix);
    number('Rooms', input.rooms);
    number('Floor', input.floor);
    number('TotalFloors', input.totalFloors);
    number('BuildYear', input.buildYear);
    number('EstimatedValue', input.estimatedValue);
    return form;
  }
}
