import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { ListQuery, Page } from '../../core/http/response-model';

export type Role = components['schemas']['UserRoleViewModel'];

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly api = inject(ApiClient);

  list(query: ListQuery): Observable<Page<Role>> {
    return this.api.getPage<Role>('api/UserRole/list', query);
  }

  /** All roles for a select (there are few). */
  all(): Observable<Role[]> {
    return this.list({ pageSize: 100, sortBy: 'Name', sortDirection: 'asc' }).pipe(
      map((page) => page.items),
    );
  }

  create(role: { name: string; description: string | null }): Observable<Role> {
    return this.api.postForm<Role>('api/UserRole', this.form(role));
  }

  update(id: string, role: { name: string; description: string | null }): Observable<Role> {
    const form = this.form(role);
    form.append('Id', id);
    return this.api.putForm<Role>('api/UserRole', form);
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<boolean>('api/UserRole', { id });
  }

  private form(role: { name: string; description: string | null }): FormData {
    const form = new FormData();
    form.append('Name', role.name);
    if (role.description) form.append('Description', role.description);
    return form;
  }
}
