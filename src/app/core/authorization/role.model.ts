/** Which product module a role can reach. Drives the sidebar, nothing else. */
export type MenuKey =
  | 'dashboard'
  | 'inbox'
  | 'contacts'
  | 'flows'
  | 'templates'
  | 'campaigns'
  | 'reports'
  | 'teams'
  | 'users'
  | 'roles'
  | 'quickReplies'
  | 'settings'
  | 'billing'
  | 'audit'
  | 'developer'
  | 'profile'
  | 'clients'
  | 'plans'
  | 'subscriptions'
  | 'metaConfig'
  | 'health'
  | 'announcements'
  | 'analytics';

/** A specific action. Guarded by routes and used to enable/disable controls. */
export type Capability =
  | 'dashboard.view'
  | 'inbox.view'
  | 'inbox.reply'
  | 'inbox.assign'
  | 'contacts.view'
  | 'contacts.manage'
  | 'contacts.export'
  | 'flows.view'
  | 'flows.manage'
  | 'templates.view'
  | 'templates.manage'
  | 'campaigns.view'
  | 'campaigns.manage'
  | 'reports.view'
  | 'teams.view'
  | 'teams.manage'
  | 'users.view'
  | 'users.manage'
  | 'roles.view'
  | 'roles.manage'
  | 'settings.view'
  | 'settings.manage'
  | 'billing.view'
  | 'audit.view'
  | 'developer.manage'
  | 'profile.manage'
  | 'clients.view'
  | 'clients.manage'
  | 'plans.manage'
  | 'meta.manage'
  | 'health.view'
  | 'announcements.manage'
  | 'analytics.view';

export type AccessLevel = 'none' | 'view' | 'edit' | 'full';

export const ACCESS_LEVELS: AccessLevel[] = ['none', 'view', 'edit', 'full'];

export type RoleScope = 'client' | 'platform';

export type Role = {
  id: string;
  name: string;
  description: string;
  scope: RoleScope;
  /** Seeded from the PRD §6.3 RBAC matrix, then editable in the UI. */
  menus: MenuKey[];
  capabilities: Partial<Record<Capability, AccessLevel>>;
  system: boolean;
  memberCount: number;
};

/** The levels a menu entry requires. Used to hide nav the role cannot open. */
export const MENU_CAPABILITY: Record<MenuKey, Capability> = {
  dashboard: 'dashboard.view',
  inbox: 'inbox.view',
  contacts: 'contacts.view',
  flows: 'flows.view',
  templates: 'templates.view',
  campaigns: 'campaigns.view',
  reports: 'reports.view',
  teams: 'teams.view',
  users: 'users.view',
  roles: 'roles.view',
  quickReplies: 'settings.view',
  settings: 'settings.view',
  billing: 'billing.view',
  audit: 'audit.view',
  developer: 'developer.manage',
  profile: 'profile.manage',
  clients: 'clients.view',
  plans: 'plans.manage',
  subscriptions: 'clients.view',
  metaConfig: 'meta.manage',
  health: 'health.view',
  announcements: 'announcements.manage',
  analytics: 'analytics.view',
};

/**
 * Reverse of MENU_CAPABILITY: which sidebar entries make a capability reachable.
 * Several menus can share one capability (`settings` and `quickReplies` both use
 * `settings.view`), so the value is a list and any one of them is enough.
 */
export const CAPABILITY_MENUS: ReadonlyMap<Capability, MenuKey[]> = (() => {
  const map = new Map<Capability, MenuKey[]>();

  for (const [key, capability] of Object.entries(MENU_CAPABILITY)) {
    const list = map.get(capability) ?? [];
    list.push(key as MenuKey);
    map.set(capability, list);
  }

  return map;
})();

export function atLeast(actual: AccessLevel | undefined, required: AccessLevel): boolean {
  if (!actual || actual === 'none') {
    return required === 'none';
  }

  return ACCESS_LEVELS.indexOf(actual) >= ACCESS_LEVELS.indexOf(required);
}
