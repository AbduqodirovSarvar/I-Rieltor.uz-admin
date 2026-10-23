import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/auth/auth.guards';
import { unsavedChangesGuard } from './core/forms/unsaved-changes.guard';

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
        path: 'slides',
        canActivate: [permissionGuard],
        data: { permission: 'READ_SLIDE', title: 'slides.title' },
        loadComponent: () => import('./features/slides/slide-list').then((m) => m.SlideList),
      },
      {
        path: 'company',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permission: 'READ_COMPANY', title: 'company.title' },
        loadComponent: () => import('./features/company/company-page').then((m) => m.CompanyPage),
      },
      {
        path: 'categories',
        canActivate: [permissionGuard],
        data: { permission: 'READ_PROPERTYCATEGORY', title: 'categories.title' },
        loadComponent: () =>
          import('./features/categories/category-list').then((m) => m.CategoryList),
      },
      {
        path: 'properties',
        canActivate: [permissionGuard],
        data: { permission: 'READ_PROPERTY', title: 'properties.title' },
        loadChildren: () =>
          import('./features/properties/properties.routes').then((m) => m.PROPERTY_ROUTES),
      },
      {
        path: 'auctions',
        canActivate: [permissionGuard],
        data: { permission: 'READ_AUCTION', title: 'auctions.title' },
        loadChildren: () =>
          import('./features/auctions/auctions.routes').then((m) => m.AUCTION_ROUTES),
      },
      {
        path: 'participants',
        canActivate: [permissionGuard],
        data: { permission: 'READ_AUCTIONPARTICIPANT', title: 'participants.title' },
        loadComponent: () =>
          import('./features/participants/participant-list').then((m) => m.ParticipantList),
      },
      {
        path: 'documents',
        canActivate: [permissionGuard],
        data: { permission: 'READ_PRIVATEDOCUMENT', title: 'documents.title' },
        loadComponent: () =>
          import('./features/documents/document-list').then((m) => m.DocumentList),
      },
      {
        path: 'payments',
        canActivate: [permissionGuard],
        data: { permission: 'READ_PAYMENT', title: 'payments.title' },
        loadComponent: () => import('./features/payments/payment-list').then((m) => m.PaymentList),
      },
      {
        path: 'audit',
        canActivate: [permissionGuard],
        data: { permission: 'READ_AUDITLOG', title: 'audit.title' },
        loadComponent: () => import('./features/audit/audit-list').then((m) => m.AuditList),
      },
      {
        path: 'notifications',
        canActivate: [permissionGuard],
        data: { permission: 'READ_NOTIFICATION', title: 'notifications.title' },
        loadComponent: () =>
          import('./features/notifications/notification-list').then((m) => m.NotificationList),
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
