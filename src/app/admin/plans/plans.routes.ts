import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 4 — Plans & features. The overview reads the live plan records, the
 * editor rewrites their metered limits, and the matrix rewrites which modules
 * each tier unlocks. All three feed `PermissionService.planModules` directly.
 */
export const PLANS_ROUTES: Routes = [
  {
    path: '',
    title: 'Plans & features',
    loadComponent: () => import('./plans-page').then((page) => page.PlansPage),
    canActivate: [permissionGuard('plans.manage')],
  },
  {
    path: 'edit',
    title: 'Edit plan limits',
    loadComponent: () => import('./plans-edit-page').then((page) => page.PlansEditPage),
    canActivate: [permissionGuard('plans.manage', 'edit')],
  },
  {
    path: 'matrix',
    title: 'Feature matrix',
    loadComponent: () => import('./feature-matrix-page').then((page) => page.FeatureMatrixPage),
    canActivate: [permissionGuard('plans.manage')],
  },
];
