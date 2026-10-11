import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 6 — Developer Hub (`/developer`).
 *
 * Reading the hub is `developer.manage` at view level, which is what the
 * Integration User role holds; issuing, rotating and revoking keys needs the
 * same capability at edit level.
 */
export const DEVELOPER_ROUTES: Routes = [
  {
    path: '',
    title: 'Developer Hub',
    loadComponent: () =>
      import('./developer-page/developer-page').then((page) => page.DeveloperPage),
    canActivate: [permissionGuard('developer.manage')],
  },
];
