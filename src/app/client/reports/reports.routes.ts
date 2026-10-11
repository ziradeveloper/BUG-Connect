import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 6 — Analytics & Insights (`/reports`).
 *
 * A single read-only screen: every figure is derived from this workspace's own
 * rows, so the only capability it needs is `reports.view`. The range switcher
 * changes the window, not the data.
 */
export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Analytics & Insights',
    loadComponent: () => import('./reports-page/reports-page').then((page) => page.ReportsPage),
    canActivate: [permissionGuard('reports.view')],
  },
];
