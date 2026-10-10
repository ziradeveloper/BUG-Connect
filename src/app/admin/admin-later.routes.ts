import type { Routes } from '@angular/router';

import { permissionGuard } from '../core/auth/guards';
import type { Capability } from '../core/authorization/role.model';
import type { PlannedConfig } from '../client/later/planned-module-page';

/**
 * Platform stubs, kept out of admin.routes.ts so a wave can replace one module
 * without touching the route table.
 *
 * Wave 4 landed plans, subscriptions, meta-config and health as real modules;
 * what remains here is genuinely later-wave work.
 */
const ADMIN_PLANNED: Record<string, { capability: Capability | null; config: PlannedConfig }> = {
  analytics: {
    capability: 'analytics.view',
    config: {
      eyebrow: 'PLATFORM',
      title: 'Cross-tenant analytics',
      phase: 'Built in wave 6',
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
  announcements: {
    capability: 'announcements.manage',
    config: {
      eyebrow: 'PLATFORM',
      title: 'Announcements',
      phase: 'Built in wave 6',
      icon: '▷',
      description: 'In-console notices for onboarding steps, maintenance and plan changes.',
      includes: ['Target by plan, industry or single tenant', 'Expiry and read receipts'],
    },
  },
  audit: {
    capability: 'audit.view',
    config: {
      eyebrow: 'PLATFORM',
      title: 'Platform audit',
      phase: 'Built in wave 5',
      icon: '☰',
      description: 'Every administrative action across tenants, including support impersonation.',
      includes: [
        'Actor, target workspace, action, timestamp',
        'Impersonation events',
        'Exportable history',
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
export const ANNOUNCEMENTS_ROUTES = adminStub('announcements');
export const PLATFORM_AUDIT_ROUTES = adminStub('audit');
