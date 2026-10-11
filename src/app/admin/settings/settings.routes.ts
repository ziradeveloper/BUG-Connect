import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 5 — platform-wide configuration (`/settings` on the admin host).
 * Deliberately separate from the workspace settings tree on tenant hosts.
 */
export const PLATFORM_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Platform settings',
    loadComponent: () =>
      import('./platform-settings-page/platform-settings-page').then(
        (page) => page.PlatformSettingsPage,
      ),
    canActivate: [permissionGuard('platform.configure', 'edit')],
  },
];
