import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/landing-page/landing-page').then((page) => page.LandingPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login-page/login-page').then((page) => page.LoginPage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
