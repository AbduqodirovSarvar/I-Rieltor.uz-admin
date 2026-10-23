import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';
import { unsavedChangesGuard } from '../../core/forms/unsaved-changes.guard';

export const AUCTION_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./auction-list').then((m) => m.AuctionList) },
  {
    path: 'new',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: 'CREATE_AUCTION', title: 'auctions.new' },
    loadComponent: () => import('./auction-form').then((m) => m.AuctionForm),
  },
  {
    path: ':id/edit',
    canActivate: [permissionGuard],
    canDeactivate: [unsavedChangesGuard],
    data: { permission: 'UPDATE_AUCTION', title: 'auctions.edit' },
    loadComponent: () => import('./auction-form').then((m) => m.AuctionForm),
  },
  {
    path: ':id',
    data: { title: 'auctions.details' },
    loadComponent: () => import('./auction-detail').then((m) => m.AuctionDetail),
  },
];
