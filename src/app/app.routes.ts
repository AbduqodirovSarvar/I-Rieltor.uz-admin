import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/auth/auth.guards';

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
        path: 'users',
        canActivate: [permissionGuard],
        data: { permission: 'READ_USER', title: 'users.title' },
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USER_ROUTES),
      },
      {
        path: 'roles',
        canActivate: [permissionGuard],
        data: { permission: 'READ_USERROLE', title: 'roles.title' },
        loadChildren: () => import('./features/roles/roles.routes').then((m) => m.ROLE_ROUTES),
      },
      {
        path: 'profile',
        data: { title: 'profile.title' },
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
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
