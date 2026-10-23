import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';
import { unsavedChangesGuard } from '../../core/forms/unsaved-changes.guard';

export const ROLE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./role-list').then((m) => m.RoleList) },
  {
    path: ':id/permissions',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: 'READ_USERROLEPERMISSION', title: 'permissions.title' },
    loadComponent: () => import('./role-permissions-page').then((m) => m.RolePermissionsPage),
  },
];
