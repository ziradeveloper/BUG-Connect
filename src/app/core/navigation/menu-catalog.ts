import type { Capability, MenuKey } from '../authorization/role.model';

export type MenuEntry = {
  key: MenuKey;
  label: string;
  /** Route under the workspace root, e.g. `inbox` -> `/inbox`. */
  path: string;
  icon: string;
  group: 'operations' | 'automation' | 'growth' | 'insights' | 'workspace' | 'platform';
  /** Route available but sidebar entry only for a specific workspace kind. */
  capability: Capability;
  /** Wave 6 modules render a labelled stub so nav and permissions stay provable. */
  planned?: boolean;

  /**
   * Grantable in the role matrix but never listed in the sidebar — for entries the
   * shell reaches another way, such as the avatar menu's link to /profile. Without
   * a catalogue row there is nothing for `roles.menu` to grant against, so the
   * route would fall outside the permission model.
   */
  hidden?: boolean;
};

export const CLIENT_MENU: MenuEntry[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '',
    icon: '◧',
    group: 'operations',
    capability: 'dashboard.view',
  },
  {
    key: 'inbox',
    label: 'Team Inbox',
    path: 'inbox',
    icon: '◫',
    group: 'operations',
    capability: 'inbox.view',
  },
  {
    key: 'contacts',
    label: 'Contact Hub',
    path: 'contacts',
    icon: '◉',
    group: 'operations',
    capability: 'contacts.view',
  },
  {
    key: 'flows',
    label: 'Flow Builder',
    path: 'flows',
    icon: '⇄',
    group: 'automation',
    capability: 'flows.view',
    planned: true,
  },
  {
    key: 'templates',
    label: 'Template Manager',
    path: 'templates',
    icon: '◨',
    group: 'automation',
    capability: 'templates.view',
  },
  {
    key: 'campaigns',
    label: 'Campaign Manager',
    path: 'campaigns',
    icon: '▷',
    group: 'growth',
    capability: 'campaigns.view',
    planned: true,
  },
  {
    key: 'reports',
    label: 'Analytics & Insights',
    path: 'reports',
    icon: '◮',
    group: 'insights',
    capability: 'reports.view',
    planned: true,
  },
  {
    key: 'teams',
    label: 'Teams & Routing',
    path: 'teams',
    icon: '◭',
    group: 'workspace',
    capability: 'teams.view',
  },
  {
    key: 'users',
    label: 'Users',
    path: 'users',
    icon: '☺',
    group: 'workspace',
    capability: 'users.view',
  },
  {
    key: 'roles',
    label: 'Roles & Menus',
    path: 'roles',
    icon: '⚿',
    group: 'workspace',
    capability: 'roles.view',
  },
  {
    key: 'quickReplies',
    label: 'Quick Replies',
    path: 'quick-replies',
    icon: '✎',
    group: 'workspace',
    capability: 'settings.view',
    planned: true,
  },
  {
    key: 'settings',
    label: 'Workspace Settings',
    path: 'settings',
    icon: '⚙',
    group: 'workspace',
    capability: 'settings.view',
  },
  {
    key: 'developer',
    label: 'Developer Hub',
    path: 'developer',
    icon: '⌘',
    group: 'insights',
    capability: 'developer.manage',
    planned: true,
  },
  {
    key: 'billing',
    label: 'Subscription',
    path: 'billing',
    icon: '▤',
    group: 'workspace',
    capability: 'billing.view',
    planned: true,
  },
  {
    key: 'audit',
    label: 'Audit Log',
    path: 'audit',
    icon: '☰',
    group: 'insights',
    capability: 'audit.view',
    planned: true,
  },
  {
    key: 'profile',
    label: 'My Account',
    path: 'profile',
    icon: '◉',
    group: 'workspace',
    capability: 'profile.manage',
    hidden: true,
  },
];

export const PLATFORM_MENU: MenuEntry[] = [
  {
    key: 'dashboard',
    label: 'Platform Dashboard',
    path: '',
    icon: '◧',
    group: 'platform',
    capability: 'dashboard.view',
  },
  {
    key: 'clients',
    label: 'Clients',
    path: 'clients',
    icon: '▣',
    group: 'platform',
    capability: 'clients.view',
  },
  {
    key: 'plans',
    label: 'Plans & Features',
    path: 'plans',
    icon: '◔',
    group: 'platform',
    capability: 'plans.manage',
  },
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    path: 'subscriptions',
    icon: '▤',
    group: 'platform',
    capability: 'clients.view',
    planned: true,
  },
  {
    key: 'users',
    label: 'Platform Staff',
    path: 'users',
    icon: '☺',
    group: 'platform',
    capability: 'users.view',
  },
  {
    key: 'roles',
    label: 'Roles & Menus',
    path: 'roles',
    icon: '⚿',
    group: 'platform',
    capability: 'roles.view',
  },
  {
    key: 'analytics',
    label: 'Cross-tenant Analytics',
    path: 'analytics',
    icon: '◮',
    group: 'platform',
    capability: 'analytics.view',
    planned: true,
  },
  {
    key: 'metaConfig',
    label: 'Meta App & Webhook',
    path: 'meta-config',
    icon: '◍',
    group: 'platform',
    capability: 'meta.manage',
  },
  {
    key: 'health',
    label: 'Webhook Health',
    path: 'health',
    icon: '❤',
    group: 'platform',
    capability: 'health.view',
  },
  {
    key: 'announcements',
    label: 'Announcements',
    path: 'announcements',
    icon: '▷',
    group: 'platform',
    capability: 'announcements.manage',
    planned: true,
  },
  {
    key: 'audit',
    label: 'Platform Audit',
    path: 'audit',
    icon: '☰',
    group: 'platform',
    capability: 'audit.view',
    planned: true,
  },
  {
    key: 'profile',
    label: 'My Account',
    path: 'profile',
    icon: '◉',
    group: 'workspace',
    capability: 'profile.manage',
    hidden: true,
  },
];

export const MENU_BY_KEY: Record<MenuKey, MenuEntry | undefined> = MENU_KEYS_TO_MAP();

function MENU_KEYS_TO_MAP(): Record<MenuKey, MenuEntry | undefined> {
  const map = {} as Record<MenuKey, MenuEntry | undefined>;

  for (const entry of [...CLIENT_MENU, ...PLATFORM_MENU]) {
    map[entry.key] ??= entry;
  }

  return map;
}

export const MENU_GROUPS: { id: MenuEntry['group']; label: string }[] = [
  { id: 'operations', label: 'Daily operations' },
  { id: 'automation', label: 'Automation' },
  { id: 'growth', label: 'Growth' },
  { id: 'insights', label: 'Insights' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'platform', label: 'Platform' },
];
