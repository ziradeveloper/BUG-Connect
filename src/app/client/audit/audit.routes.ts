import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 5 — the workspace's own audit log. Every row here names this tenant;
 * platform-level actions live on the admin console's `/audit`.
 */
export const AUDIT_ROUTES: Routes = [
  {
    path: '',
    title: 'Audit log',
    loadComponent: () => import('./audit-page/audit-page').then((page) => page.AuditPage),
    canActivate: [permissionGuard('audit.view')],
  },
];
