import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auctions' },
  {
    path: 'auctions',
    loadComponent: () => import('./features/auctions/auction-list').then((m) => m.AuctionList),
  },
  {
    path: 'auctions/new',
    canActivate: [authGuard],
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
    canActivate: [authGuard],
    loadComponent: () => import('./features/inventory/inventory').then((m) => m.Inventory),
  },
  {
    path: 'wallet',
    canActivate: [authGuard],
    loadComponent: () => import('./features/wallet/wallet').then((m) => m.Wallet),
  },
  {
    path: 'transfers',
    canActivate: [authGuard],
    loadComponent: () => import('./features/transfers/transfers').then((m) => m.Transfers),
  },
  {
    path: 'bank',
    canActivate: [authGuard],
    loadComponent: () => import('./features/bank/bank').then((m) => m.Bank),
  },
  {
    path: 'casino',
    canActivate: [authGuard],
    loadComponent: () => import('./features/casino/casino').then((m) => m.Casino),
  },
  {
    path: 'casino/roulette',
    canActivate: [authGuard],
    loadComponent: () => import('./features/casino/roulette').then((m) => m.Roulette),
  },
  {
    path: 'casino/blackjack',
    canActivate: [authGuard],
    loadComponent: () => import('./features/casino/blackjack').then((m) => m.Blackjack),
  },
  {
    path: 'pawnshop',
    canActivate: [authGuard],
    loadComponent: () => import('./features/pawnshop/pawnshop').then((m) => m.Pawnshop),
  },
  {
    path: 'warehouses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/warehouses/warehouse-list').then((m) => m.WarehouseList),
  },
  {
    path: 'warehouses/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/warehouses/warehouse-detail').then((m) => m.WarehouseDetail),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profiles/own-profile').then((m) => m.OwnProfile),
  },
  {
    path: 'profiles/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profiles/player-profile').then((m) => m.PlayerProfile),
  },
  { path: '**', redirectTo: 'auctions' },
];
