import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Quick replies tree (wave 3). Guarded by `settings.view` like the sidebar
 * entry — snippets are workspace configuration, edited under `settings.manage`.
 */
export const QUICK_REPLIES_ROUTES: Routes = [
  {
    path: '',
    title: 'Quick replies',
    loadComponent: () =>
      import('./quick-replies-page/quick-replies-page').then((page) => page.QuickRepliesPage),
    canActivate: [permissionGuard('settings.view')],
  },
];
