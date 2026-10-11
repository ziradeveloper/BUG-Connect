import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Workspace settings tree. The root is a directory of the areas below it
 * (`settings-home-page`), each sub-page owning one concern.
 */
export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Workspace settings',
    loadComponent: () => import('./settings-home-page').then((page) => page.SettingsHomePage),
    canActivate: [permissionGuard('settings.view')],
  },
  {
    path: 'whatsapp',
    title: 'WhatsApp connection',
    loadComponent: () =>
      import('./whatsapp-settings-page').then((page) => page.WhatsappSettingsPage),
    canActivate: [permissionGuard('settings.view')],
  },
  {
    path: 'whatsapp/callback',
    title: 'Connecting WhatsApp',
    loadComponent: () =>
      import('./whatsapp-callback-page').then((page) => page.WhatsappCallbackPage),
    canActivate: [permissionGuard('settings.view')],
  },
  {
    path: 'business',
    title: 'Business profile',
    loadComponent: () =>
      import('./business-settings-page/business-settings-page').then(
        (page) => page.BusinessSettingsPage,
      ),
    canActivate: [permissionGuard('settings.view')],
  },
];
