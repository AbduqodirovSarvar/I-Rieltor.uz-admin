import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';
import { unsavedChangesGuard } from '../../core/forms/unsaved-changes.guard';

export const PROPERTY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./property-list').then((m) => m.PropertyList) },
  {
    path: 'new',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: 'CREATE_PROPERTY', title: 'properties.new' },
    loadComponent: () => import('./property-form').then((m) => m.PropertyForm),
  },
  {
    path: ':id/edit',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: 'UPDATE_PROPERTY', title: 'properties.edit' },
    loadComponent: () => import('./property-form').then((m) => m.PropertyForm),
  },
  {
    path: ':id',
    data: { title: 'properties.details' },
    loadComponent: () => import('./property-detail').then((m) => m.PropertyDetail),
  },
];
