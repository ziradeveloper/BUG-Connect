import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';
import type { PlannedConfig } from '../later/planned-module-page';

/**
 * Workspace settings tree. `/settings` itself stays a stub until wave 3 adds
 * the business profile; wave 4 owns the WhatsApp connection screens beneath.
 */
const SETTINGS_HOME: PlannedConfig = {
  eyebrow: 'WORKSPACE',
  title: 'Workspace settings',
  phase: 'Built in wave 3 and 4',
  icon: '⚙',
  description:
    'Business profile, operating hours, the WhatsApp connection and everything else configured once by an administrator.',
  includes: [
    'Business profile and greeting',
    'Working hours and holiday fallback (flow conditions read these)',
    'WhatsApp connection and sync health',
    'Meta Embedded Signup for self-service connection',
  ],
};

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Workspace settings',
    data: { planned: SETTINGS_HOME },
    loadComponent: () =>
      import('../later/planned-module-page').then((page) => page.PlannedModulePage),
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
];
