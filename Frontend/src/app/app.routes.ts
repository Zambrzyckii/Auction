import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auctions' },
  {
    path: 'auctions',
    loadComponent: () => import('./features/auctions/auction-list').then((m) => m.AuctionList),
  },
  {
    path: 'auctions/new',
    loadComponent: () => import('./features/auctions/create-auction').then((m) => m.CreateAuction),
  },
  {
    path: 'auctions/:id',
    loadComponent: () => import('./features/auctions/auction-detail').then((m) => m.AuctionDetail),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: 'inventory',
    loadComponent: () => import('./features/inventory/inventory').then((m) => m.Inventory),
  },
  {
    path: 'wallet',
    loadComponent: () => import('./features/wallet/wallet').then((m) => m.Wallet),
  },
  { path: '**', redirectTo: 'auctions' },
];
