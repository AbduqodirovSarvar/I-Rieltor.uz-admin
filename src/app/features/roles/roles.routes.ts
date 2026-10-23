import { Routes } from '@angular/router';

export const ROLE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./role-list').then((m) => m.RoleList) },
];
