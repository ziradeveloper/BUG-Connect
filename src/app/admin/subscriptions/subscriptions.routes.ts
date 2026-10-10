import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 4 — Subscriptions. The overview is one row per tenant with its current
 * lifecycle state; `/log` is the full transition trail behind those states.
 */
export const SUBSCRIPTIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Subscriptions',
    loadComponent: () => import('./subscriptions-page').then((page) => page.SubscriptionsPage),
    canActivate: [permissionGuard('clients.view')],
  },
  {
    path: 'log',
    title: 'Subscription lifecycle log',
    loadComponent: () => import('./subscriptions-log-page').then((page) => page.SubscriptionsLogPage),
    canActivate: [permissionGuard('clients.view')],
  },
];
