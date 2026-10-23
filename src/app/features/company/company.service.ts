import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';

export type Company = components['schemas']['CompanyViewModel'];

export interface CompanyInput {
  name: string;
  description: string;
  mission: string;
  address: string;
  location: string;
  phoneNumber: string;
  phoneNumber2: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  logo: File | null;
}

/** There is one company record: the page edits it, or creates it the first time. */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly api = inject(ApiClient);

  current(): Observable<Company | null> {
    return this.api
      .getPage<Company>('api/Company/list', { pageSize: 1 })
      .pipe(map((page) => page.items[0] ?? null));
  }

  create(input: CompanyInput): Observable<Company> {
    return this.api.postForm<Company>('api/Company', this.form(input));
  }

  /** A full replacement; the logo stays when no file is sent. */
  update(id: string, input: CompanyInput): Observable<Company> {
    const form = this.form(input);
    form.append('Id', id);
    return this.api.putForm<Company>('api/Company', form);
  }

  private form(input: CompanyInput): FormData {
    const form = new FormData();
    form.append('Name', input.name);
    form.append('Description', input.description);
    form.append('Address', input.address);
    form.append('Location', input.location);
    form.append('PhoneNumber', input.phoneNumber);
    if (input.mission) form.append('Mission', input.mission);
    if (input.phoneNumber2) form.append('PhoneNumber2', input.phoneNumber2);
    if (input.email) form.append('Email', input.email);
    if (input.latitude !== null) form.append('Latitude', String(input.latitude));
    if (input.longitude !== null) form.append('Longitude', String(input.longitude));
    if (input.logo) form.append('Logo', input.logo);
    return form;
  }
}
