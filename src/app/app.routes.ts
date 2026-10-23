import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'dev/ui', loadComponent: () => import('./features/dev-ui/dev-ui').then((m) => m.DevUi) },
  {
    path: 'forbidden',
    loadComponent: () => import('./features/errors/error-pages').then((m) => m.Forbidden),
  },
  {
    path: '**',
    loadComponent: () => import('./features/errors/error-pages').then((m) => m.NotFound),
  },
];
