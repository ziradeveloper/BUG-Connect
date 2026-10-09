import type { Routes } from '@angular/router';

import { permissionGuard } from '../core/auth/guards';
import type { Capability } from '../core/authorization/role.model';
import type { PlannedConfig } from '../client/later/planned-module-page';

/**
 * Platform stubs, kept out of admin.routes.ts so a wave can replace one module
 * without touching the route table.
 */
const ADMIN_PLANNED: Record<string, { capability: Capability | null; config: PlannedConfig }> = {
  plans: {
    capability: 'plans.manage',
    config: {
      eyebrow: 'COMMERCIAL',
      title: 'Plans & features',
      phase: 'Built in wave 4',
      icon: '◔',
      description:
        'What each plan gates. The nine dimensions the PRD lists are the controls; module access is the feature matrix.',
      includes: [
        'Users, WhatsApp numbers, flows, campaigns, contacts',
        'Automation depth, developer APIs, analytics retention, support',
        'Module → plan matrix that unlocks the client sidebar',
      ],
      note: 'Client workspaces already read this matrix — a tenant on Pilot cannot see a Growth module even if its role allows it.',
    },
  },
  subscriptions: {
    capability: 'clients.view',
    config: {
      eyebrow: 'COMMERCIAL',
      title: 'Subscriptions',
      phase: 'Built in wave 4',
      icon: '▤',
      description:
        'Trial, active, grace and expired state per tenant, with what triggered the change.',
      includes: ['Lifecycle transitions', 'Renewal and grace handling', 'Suspension reasons'],
      note: 'Suspension already works from the Clients list; this screen is its history.',
    },
  },
  metaConfig: {
    capability: 'meta.manage',
    config: {
      eyebrow: 'PLATFORM',
      title: 'Meta app & webhook',
      phase: 'Built in wave 4',
      icon: '◍',
      description:
        'The single Meta Business app the platform embeds signup through, plus the callback the webhooks hit.',
      includes: [
        'App id, app secret reference and API version',
        'Callback URL and verify token',
        'Test numbers per tenant',
      ],
      note: 'Credentials are referenced here, never stored in the browser. With dummy data there is nothing to read yet.',
    },
  },
  health: {
    capability: 'health.view',
    config: {
      eyebrow: 'PLATFORM',
      title: 'Webhook health',
      phase: 'Built in wave 4',
      icon: '❤',
      description:
        'Meta needs a 200 inside three seconds. This is acknowledgement latency, queue depth and failures by tenant.',
      includes: [
        'Ack time per event against the 150 ms target',
        'Queue depth and retry backlog',
        'Failed and duplicate events',
      ],
    },
  },
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

export const PLANS_ROUTES = adminStub('plans');
export const SUBSCRIPTIONS_ROUTES = adminStub('subscriptions');
export const META_CONFIG_ROUTES = adminStub('metaConfig');
export const HEALTH_ROUTES = adminStub('health');
export const ANALYTICS_ROUTES = adminStub('analytics');
export const ANNOUNCEMENTS_ROUTES = adminStub('announcements');
export const PLATFORM_AUDIT_ROUTES = adminStub('audit');
