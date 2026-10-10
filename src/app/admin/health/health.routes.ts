import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 4 — Webhook health. `/health` lands on the monitor; the path stays so
 * the dashboard link and the sidebar entry resolve to the same screen.
 */
export const HEALTH_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'monitor',
  },
  {
    path: 'monitor',
    title: 'Queue health monitor',
    loadComponent: () => import('./health-monitor-page').then((page) => page.HealthMonitorPage),
    canActivate: [permissionGuard('health.view')],
  },
];
