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
  inbox: {
    eyebrow: 'OPERATIONS',
    title: 'Team Inbox',
    phase: 'Built in wave 2',
    icon: '◫',
    description:
      'The shared queue where escalated conversations land. Real-time sync, assignment, internal notes and collision indicators.',
    includes: [
      'Unassigned, Mine, Open and Resolved queues',
      'Agent whisper notes shown in the thread',
      'Typing and active-view indicators to prevent double replies',
      'Composer with / quick-reply snippets and media attach',
      'Mark resolved frees chat capacity back to the router',
    ],
    note: 'The dashboard already reads these same conversations, so the queue is the next layer on data that exists.',
  },
  flows: {
    eyebrow: 'AUTOMATION',
    title: 'Flow Builder',
    phase: 'Built after the engine',
    icon: '⇄',
    description:
      'The visual designer for customer journeys. The Flow Engine behaviour and its five nodes come first; this is the canvas on top of the same schema.',
    includes: [
      'Inbound hook, interactive menu, selection, weighted router, close',
      'Up to three buttons or a ten-option list per menu node',
      'Conditions on hours, tags and lead status',
      'In-browser simulator on a virtual phone before publishing',
    ],
    note: 'Business §11 puts the Builder in Phase 2 while Master §8 puts it in Phase 1 — the engine first, canvas after, is how this build resolves that.',
  },
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
  billing: {
    eyebrow: 'WORKSPACE',
    title: 'Subscription',
    phase: 'Pricing is an open decision',
    icon: '▤',
    description: 'The plan this workspace is on, what it consumes, and the invoices behind it.',
    includes: [
      'Current plan and the nine metered dimensions',
      'Usage against each limit',
      'Invoices and payment status',
    ],
    note: 'The PRD has no published prices, so this screen will show limits and usage until the commercial model is confirmed — not invented numbers.',
  },
  audit: {
    eyebrow: 'INSIGHTS',
    title: 'Audit log',
    phase: 'Built in a later wave',
    icon: '☰',
    description:
      'Administrative actions recorded for accountability, filterable by actor and area.',
    includes: [
      'Who changed what and when',
      'Role, plan and connection changes',
      'Exportable history',
    ],
  },
} satisfies Record<string, PlannedConfig>;

export const INBOX_ROUTES = stub('inbox.view', PLANNED.inbox);
export const FLOW_ROUTES = stub('flows.view', PLANNED.flows);
export const CAMPAIGN_ROUTES = stub('campaigns.view', PLANNED.campaigns);
export const REPORTS_ROUTES = stub('reports.view', PLANNED.reports);
export const DEVELOPER_ROUTES = stub('developer.manage', PLANNED.developer);
export const BILLING_ROUTES = stub('billing.view', PLANNED.billing);
export const AUDIT_ROUTES = stub('audit.view', PLANNED.audit);
