import {
  ADMIN_SUBDOMAIN,
  DEV_HOSTS,
  type ResolvedWorkspace,
  type WorkspaceKind,
} from './workspace.model';

/** Host without a port, lower-cased, no trailing dot. */
export function normalizeHost(rawHost: string | null | undefined): string {
  if (!rawHost) {
    return '';
  }

  let host = rawHost.trim().toLowerCase();

  if (host.startsWith('http://') || host.startsWith('https://')) {
    host = host.slice(host.indexOf('//') + 2);
  }

  host = host.split('/')[0];

  // IPv6 literals keep their brackets, e.g. [::1]:4200.
  if (host.startsWith('[')) {
    const close = host.indexOf(']');
    return close === -1 ? host : host.slice(0, close + 1);
  }

  const portStart = host.lastIndexOf(':');
  if (portStart > -1 && /^\d+$/.test(host.slice(portStart + 1))) {
    host = host.slice(0, portStart);
  }

  return host.replace(/\.+$/, '');
}

function isPreviewHost(host: string): boolean {
  // The Arena preview proxy is {port}-{id}.e2b.app, which cannot carry tenant
  // subdomains. Treated like localhost so the dev override stays available.
  return host === 'e2b.app' || host.endsWith('.e2b.app');
}

function isDevHost(host: string): boolean {
  return DEV_HOSTS.has(host) || host.endsWith('.localhost') || isPreviewHost(host);
}

/** A host whose leftmost label can never be a tenant: raw IPs and the preview proxy. */
function isLabellessHost(host: string): boolean {
  return isPreviewHost(host) || host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host);
}

/**
 * Turns a hostname into the workspace the app should render.
 *
 * `admin.localhost:4200`  -> platform console
 * `nazeel.localhost:4200` -> client workspace `nazeel`
 * `localhost:4200`        -> marketing site (or whatever the dev override selects)
 * `nellai.platform.com`   -> client workspace `nellai`
 * `platform.com`          -> marketing site
 *
 * The dev override only applies on dev hosts (`localhost`, `*.localhost`,
 * `*.e2b.app`) so a stray `?ws=` can never switch tenants in production.
 */
export function resolveWorkspace(
  rawHost: string | null | undefined,
  overrides: { queryOverride?: string | null; storedOverride?: string | null } = {},
): ResolvedWorkspace {
  const host = normalizeHost(rawHost);
  const devHost = isDevHost(host);
  const override = sanitiseOverride(overrides.queryOverride ?? overrides.storedOverride);

  if (devHost && override) {
    return override === 'marketing'
      ? { kind: 'marketing', slug: null, source: 'dev-override', host }
      : {
          kind: override === ADMIN_SUBDOMAIN ? 'platform' : 'client',
          slug: override === ADMIN_SUBDOMAIN ? null : override,
          source: 'dev-override',
          host,
        };
  }

  const labels = host ? host.split('.') : [];

  if (!host) {
    return { kind: 'marketing', slug: null, source: 'default', host };
  }

  // The preview proxy is `{port}-{id}.e2b.app` and raw IPs have no subdomain to
  // read, so their leftmost label must not be mistaken for a tenant slug. These
  // hosts select a workspace through the dev override above, never the name.
  if (isLabellessHost(host)) {
    return { kind: 'marketing', slug: null, source: 'default', host };
  }

  // `nazeel.localhost` is two labels but still a subdomain — dev hosts are
  // exempt from the "need a real apex" rule that production domains follow.
  const hasSubdomain = isDevHost(host) ? labels.length > 1 : labels.length > 2;

  if (!hasSubdomain) {
    return { kind: 'marketing', slug: null, source: 'default', host };
  }

  const [first] = labels;

  if (first === 'www' || first === 'app') {
    return { kind: 'marketing', slug: null, source: 'default', host };
  }

  if (first === ADMIN_SUBDOMAIN) {
    return { kind: 'platform', slug: null, source: 'subdomain', host };
  }

  return { kind: 'client', slug: first, source: 'subdomain', host };
}

function sanitiseOverride(value: string | null | undefined): WorkspaceKind | string | null {
  if (!value) {
    return null;
  }

  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

  if (!cleaned || cleaned === 'platform') {
    return cleaned ? ADMIN_SUBDOMAIN : null;
  }

  return cleaned === 'client' ? null : cleaned;
}

/** Display name for a resolved client workspace, before tenant lookup confirms it. */
export function workspaceDisplayName(resolved: ResolvedWorkspace): string {
  if (resolved.kind === 'platform') {
    return 'Platform Console';
  }

  if (resolved.kind === 'client') {
    return resolved.slug ? labelFromSlug(resolved.slug) : 'Workspace';
  }

  return 'BUGConnect';
}

export function labelFromSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
