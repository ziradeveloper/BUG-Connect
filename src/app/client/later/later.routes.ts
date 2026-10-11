import type { Routes } from '@angular/router';

import { permissionGuard } from '../../core/auth/guards';
import type { Capability } from '../../core/authorization/role.model';
import type { PlannedConfig } from './planned-module-page';

/**
 * Placeholder trees for modules that arrive in a later wave. Each one proves the
 * sidebar link, the route and the capability guard; the screen says which phase
 * the PRD places the module in. Replace a whole file when its wave lands.
 */
function stub(capability: Capability | null, config: PlannedConfig): Routes {
  return [
    {
      path: '',
      title: config.title,
      data: { planned: config },
      loadComponent: () => import('./planned-module-page').then((page) => page.PlannedModulePage),
      ...(capability ? { canActivate: [permissionGuard(capability)] } : {}),
    },
  ];
}

const PLANNED = {
  campaigns: {
    eyebrow: 'GROWTH',
    title: 'Campaign Manager',
    phase: 'Built in a later wave',
    icon: '▷',
    description: 'Segmented audiences, approved templates, paced sending and delivery monitoring.',
    includes: [
      'Audience from tags, attributes and business rules',
      'Pacing against the number tier and account health',
      'Quality sentinel pauses a broadcast on negative feedback',
      'Sent, delivered, read, failed and replied outcomes',
    ],
  },
  reports: {
    eyebrow: 'INSIGHTS',
    title: 'Analytics & Insights',
    phase: 'Built in a later wave',
    icon: '◮',
    description:
      'The six dashboards the PRD names, readable by a business owner without technical context.',
    includes: [
      'Executive overview',
      'Team performance',
      'Automation',
      'Campaigns',
      'Customer',
      'Integration',
    ],
  },
  developer: {
    eyebrow: 'INTEGRATIONS',
    title: 'Developer Hub',
    phase: 'Built in a later wave',
    icon: '⌘',
    description:
      'Scoped API keys, webhook endpoints and a Postman collection generated for this workspace.',
    includes: [
      'Key lifecycle with scopes and rate limits',
      'Outbound endpoints for transactional sends',
      'Inbound status webhooks',
      'Workspace-specific Postman export',
    ],
  },
} satisfies Record<string, PlannedConfig>;

export const CAMPAIGN_ROUTES = stub('campaigns.view', PLANNED.campaigns);
export const REPORTS_ROUTES = stub('reports.view', PLANNED.reports);
export const DEVELOPER_ROUTES = stub('developer.manage', PLANNED.developer);
