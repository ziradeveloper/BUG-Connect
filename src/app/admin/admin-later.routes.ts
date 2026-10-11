import type { Routes } from '@angular/router';

import { permissionGuard } from '../core/auth/guards';
import type { Capability } from '../core/authorization/role.model';
import type { PlannedConfig } from '../client/later/planned-module-page';

/**
 * Platform stubs, kept out of admin.routes.ts so a wave can replace one module
 * without touching the route table.
 *
 * Wave 4 landed plans, subscriptions, meta-config and health as real modules,
 * wave 5 took audit and wave 6 took announcements; what remains here is
 * cross-tenant analytics, which the PRD places after wave 6.
 */
const ADMIN_PLANNED: Record<string, { capability: Capability | null; config: PlannedConfig }> = {
  analytics: {
    capability: 'analytics.view',
    config: {
      eyebrow: 'PLATFORM',
      title: 'Cross-tenant analytics',
      phase: 'Planned after wave 6',
      icon: '◮',
      description:
        'Adoption and usage across all workspaces, kept separate from any single tenant’s reporting.',
      includes: [
        'Active workspaces and agents',
        'Message volume by plan',
        'Time from signup to first live conversation',
      ],
    },
  },
};

function adminStub(key: keyof typeof ADMIN_PLANNED): Routes {
  const entry = ADMIN_PLANNED[key] as (typeof ADMIN_PLANNED)[string];

  return [
    {
      path: '',
      title: entry.config.title,
      data: { planned: entry.config },
      loadComponent: () =>
        import('../client/later/planned-module-page').then((page) => page.PlannedModulePage),
      ...(entry.capability ? { canActivate: [permissionGuard(entry.capability)] } : {}),
    },
  ];
}

export const ANALYTICS_ROUTES = adminStub('analytics');
