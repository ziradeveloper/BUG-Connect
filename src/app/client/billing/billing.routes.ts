import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 5 — the workspace's own commercial view. The platform console owns
 * billing *for* tenants (`/subscriptions`, `/invoices`); this tree is what a
 * workspace administrator sees about their own plan.
 */
export const BILLING_ROUTES: Routes = [
  {
    path: '',
    title: 'Subscription',
    loadComponent: () => import('./billing-page/billing-page').then((page) => page.BillingPage),
    canActivate: [permissionGuard('billing.view')],
  },
];
