import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { plainParams } from '../../core/http/query-params';
import { ListQuery, Page } from '../../core/http/response-model';

export type UserRole = components['schemas']['UserRoleViewModel'];
/** The API schema does not mark `userRole` nullable, but a user without a role has none. */
export type User = Omit<components['schemas']['UserViewModel'], 'userRole'> & {
  userRole: UserRole | null;
};

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiClient);

  list(query: ListQuery): Observable<Page<User>> {
    return this.api.getPage<User>('api/User/list', query);
  }

  get(id: string): Observable<User> {
    return this.api.get<User>('api/User', plainParams({ Id: id }));
  }

  /** Multipart, like the backend wants. */
  create(form: FormData): Observable<User> {
    return this.api.postForm<User>('api/User', form);
  }

  /** Partial update: the form holds only the fields that changed (plus `ClearFields`). */
  update(form: FormData): Observable<User> {
    return this.api.putForm<User>('api/User', form);
  }

  delete(id: string): Observable<boolean> {
    return this.api.delete<boolean>('api/User', { id });
  }

  assignRole(userId: string, userRoleId: string): Observable<User> {
    return this.api.put<User>('api/User/role', { userId, userRoleId });
  }
}
