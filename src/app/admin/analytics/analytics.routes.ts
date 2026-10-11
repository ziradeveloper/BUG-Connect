import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Cross-tenant analytics (`/analytics`).
 *
 * One read-only screen. It needs `analytics.view` and nothing else: the page
 * never writes, and the figures are derived rather than stored, so there is no
 * edit level to guard.
 */
export const PLATFORM_ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    title: 'Cross-tenant analytics',
    loadComponent: () =>
      import('./analytics-page/analytics-page').then((page) => page.PlatformAnalyticsPage),
    canActivate: [permissionGuard('analytics.view')],
  },
];
