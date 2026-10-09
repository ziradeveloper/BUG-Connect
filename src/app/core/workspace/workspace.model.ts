/**
 * Which of the two product modules a request belongs to.
 *
 * Resolved from the incoming host (PRD §3.1 subdomain routing) so the app knows
 * before the first render whether it is showing the platform console, a tenant
 * workspace, or the public marketing site.
 */
export type WorkspaceKind = 'platform' | 'client' | 'marketing';

export type ResolvedWorkspace = {
  kind: WorkspaceKind;
  /** Tenant subdomain label, e.g. `nazeel`. Null for platform and marketing. */
  slug: string | null;
  /** How the workspace was decided — surfaced in the dev badge only. */
  source: 'subdomain' | 'dev-override' | 'default';
  /** The raw host used for resolution, kept for debugging and the topbar. */
  host: string;
};

export const ADMIN_SUBDOMAIN = 'admin';

/** Hostnames treated as "local" and therefore allowed to use the dev override. */
export const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export const DEV_WORKSPACE_PARAM = 'ws';
export const DEV_WORKSPACE_STORAGE_KEY = 'bugconnect-dev-workspace';
