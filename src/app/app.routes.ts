import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  { path: 'dev/ui', loadComponent: () => import('./features/dev-ui/dev-ui').then((m) => m.DevUi) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { title: 'nav.dashboard' },
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'forbidden',
        data: { title: 'errors.forbidden' },
        loadComponent: () => import('./features/errors/error-pages').then((m) => m.Forbidden),
      },
      {
        path: '**',
        data: { title: 'errors.notFound' },
        loadComponent: () => import('./features/errors/error-pages').then((m) => m.NotFound),
      },
    ],
  },
];
