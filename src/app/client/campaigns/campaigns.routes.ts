import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';

/**
 * Wave 6 — Campaign Manager (`/campaigns`).
 *
 * Three screens over one broadcast: the list with its delivery bars, the wizard
 * that creates one, and the monitor that polls delivery while it runs. Watching
 * a broadcast is a view action; creating, starting and pausing need
 * `campaigns.manage` at edit level.
 */
export const CAMPAIGN_ROUTES: Routes = [
  {
    path: '',
    title: 'Campaign Manager',
    loadComponent: () =>
      import('./campaigns-page/campaigns-page').then((page) => page.CampaignsPage),
    canActivate: [permissionGuard('campaigns.view')],
  },
  {
    path: 'new',
    title: 'New broadcast',
    loadComponent: () =>
      import('./campaign-wizard-page/campaign-wizard-page').then(
        (page) => page.CampaignWizardPage,
      ),
    canActivate: [permissionGuard('campaigns.manage', 'edit')],
  },
  {
    path: ':id',
    title: 'Delivery monitor',
    loadComponent: () =>
      import('./campaign-monitor-page/campaign-monitor-page').then(
        (page) => page.CampaignMonitorPage,
      ),
    canActivate: [permissionGuard('campaigns.view')],
  },
];
