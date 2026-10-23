import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import type { components } from '../../api/schema';
import { ApiClient } from '../../core/http/api-client';
import { Page } from '../../core/http/response-model';

export type RolePermission = components['schemas']['UserRolePermissionViewModel'];

const PAGE = 100;

@Injectable({ providedIn: 'root' })
export class RolePermissionService {
  private readonly api = inject(ApiClient);

  /** Every permission the system knows (the answer is a bare list, not the usual envelope). */
  allNames(): Observable<string[]> {
    return this.api.getRaw<string[]>('api/UserRolePermission/all-permissions');
  }

  /** The permissions of one role, all pages. */
  forRole(roleId: string): Observable<RolePermission[]> {
    const page = (index: number): Observable<Page<RolePermission>> =>
      this.api.getPage<RolePermission>('api/UserRolePermission/list', {
        pageIndex: index,
        pageSize: PAGE,
        filters: { 'userRoleId.equals': roleId },
      });
    return page(0).pipe(
      expand((current) =>
        (current.pageIndex + 1) * PAGE < current.totalCount ? page(current.pageIndex + 1) : EMPTY,
      ),
      map((current) => current.items),
      reduce((all, items) => [...all, ...items], [] as RolePermission[]),
    );
  }

  add(roleId: string, permission: string): Observable<RolePermission> {
    const form = new FormData();
    form.append('UserRoleId', roleId);
    form.append('Permission', permission);
    return this.api.postForm<RolePermission>('api/UserRolePermission', form);
  }

  remove(id: string): Observable<boolean> {
    return this.api.delete<boolean>('api/UserRolePermission', { id });
  }
}
