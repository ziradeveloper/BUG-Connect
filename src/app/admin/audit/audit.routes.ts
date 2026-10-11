import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 5 — the platform-wide audit log. Unlike the workspace view, rows here
 * include platform-level actions (plan edits, Meta config, domain settings) and
 * carry the tenant they targeted, so support can trace one workspace's history
 * from either console.
 */
export const PLATFORM_AUDIT_ROUTES: Routes = [
  {
    path: '',
    title: 'Platform audit',
    loadComponent: () => import('./audit-page/audit-page').then((page) => page.AuditPage),
    canActivate: [permissionGuard('audit.view')],
  },
];
