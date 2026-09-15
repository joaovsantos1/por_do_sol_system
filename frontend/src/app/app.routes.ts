import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },

  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'pdv', pathMatch: 'full' },
      {
        path: 'pdv',
        loadComponent: () => import('./features/pos/pos.component').then(m => m.PosComponent)
      },
      {
        path: 'comandas-abertas',
        loadComponent: () => import('./features/commands/open-commands.component').then(m => m.OpenCommandsComponent)
      },
      {
        path: 'dashboard',
        canActivate: [roleGuard(['Administrador', 'Gerente'])],
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'produtos',
        canActivate: [roleGuard(['Administrador', 'Gerente'])],
        loadComponent: () => import('./features/products/products.component').then(m => m.ProductsComponent)
      },
      {
        path: 'estoque',
        canActivate: [roleGuard(['Administrador', 'Gerente'])],
        loadComponent: () => import('./features/stock/stock.component').then(m => m.StockComponent)
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard(['Administrador'])],
        loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent)
      }
    ]
  },

  { path: '**', redirectTo: '' }
];
