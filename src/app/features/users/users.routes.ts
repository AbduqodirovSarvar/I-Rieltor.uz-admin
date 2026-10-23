import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';
import { unsavedChangesGuard } from '../../core/forms/unsaved-changes.guard';

export const USER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissionGuard],
    data: { permission: 'READ_USER' },
    loadComponent: () => import('./user-list').then((m) => m.UserList),
  },
  {
    path: 'new',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: 'CREATE_USER', title: 'users.new' },
    loadComponent: () => import('./user-form').then((m) => m.UserForm),
  },
  {
    path: ':id/edit',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: 'UPDATE_USER', title: 'users.edit' },
    loadComponent: () => import('./user-form').then((m) => m.UserForm),
  },
  {
    path: ':id',
    canActivate: [permissionGuard],
    data: { permission: 'READ_USER', title: 'users.details' },
    loadComponent: () => import('./user-detail').then((m) => m.UserDetail),
  },
];
