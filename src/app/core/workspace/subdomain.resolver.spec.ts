import { resolveWorkspace, normalizeHost, labelFromSlug } from './subdomain.resolver';

describe('subdomain resolver', () => {
  it('sends the admin subdomain to the platform console', () => {
    expect(resolveWorkspace('admin.localhost:4200')).toMatchObject({
      kind: 'platform',
      slug: null,
      source: 'subdomain',
    });
  });

  it('sends any other subdomain to a client workspace', () => {
    expect(resolveWorkspace('nazeel.localhost:4200')).toMatchObject({
      kind: 'client',
      slug: 'nazeel',
      source: 'subdomain',
    });

    expect(resolveWorkspace('nellai-sweets.platform.com')).toMatchObject({
      kind: 'client',
      slug: 'nellai-sweets',
    });
  });

  it('keeps the bare and www hosts on the marketing site', () => {
    expect(resolveWorkspace('localhost:4200').kind).toBe('marketing');
    expect(resolveWorkspace('platform.com').kind).toBe('marketing');
    expect(resolveWorkspace('www.platform.com').kind).toBe('marketing');
  });

  it('ignores the dev override on a real tenant host', () => {
    // A stray ?ws= must not let one tenant read another workspace.
    expect(resolveWorkspace('scanwell.platform.com', { queryOverride: 'nazeel' })).toMatchObject({
      kind: 'client',
      slug: 'scanwell',
      source: 'subdomain',
    });
  });

  it('applies the dev override only on dev and preview hosts', () => {
    expect(resolveWorkspace('localhost:4200', { queryOverride: 'nazeel' })).toMatchObject({
      kind: 'client',
      slug: 'nazeel',
      source: 'dev-override',
    });

    expect(resolveWorkspace('localhost:4200', { queryOverride: 'admin' })).toMatchObject({
      kind: 'platform',
      slug: null,
    });

    expect(resolveWorkspace('4200-sandbox.e2b.app', { storedOverride: 'nazeel' })).toMatchObject({
      kind: 'client',
      slug: 'nazeel',
      source: 'dev-override',
    });

    expect(
      resolveWorkspace('nazeel.localhost:4200', { queryOverride: null, storedOverride: 'admin' }),
    ).toMatchObject({
      kind: 'platform',
      source: 'dev-override',
    });
  });

  it('prefers the query override over the stored one', () => {
    expect(
      resolveWorkspace('localhost:4200', { queryOverride: 'scanwell', storedOverride: 'nazeel' })
        .slug,
    ).toBe('scanwell');
  });

  it('falls back to marketing when the host is empty', () => {
    expect(resolveWorkspace(null).kind).toBe('marketing');
    expect(resolveWorkspace(undefined).kind).toBe('marketing');
  });

  it('never reads a tenant out of a host that cannot carry one', () => {
    // Preview proxy host: its leftmost label is a port/id pair, not a workspace.
    expect(resolveWorkspace('4200-sandbox.e2b.app').kind).toBe('marketing');
    expect(resolveWorkspace('127.0.0.1:4200').kind).toBe('marketing');
    expect(resolveWorkspace('[::1]:4200').kind).toBe('marketing');
  });

  it('normalises ports, schemes and ipv6 literals', () => {
    expect(normalizeHost('HTTP://Nazeel.LocalHost:4200/path')).toBe('nazeel.localhost');
    expect(normalizeHost('[::1]:4200')).toBe('[::1]');
    expect(normalizeHost('example.com.')).toBe('example.com');
  });

  it('reads a tenant label back into a display name', () => {
    expect(labelFromSlug('nellai-sweets')).toBe('Nellai Sweets');
    expect(labelFromSlug('nazeel')).toBe('Nazeel');
  });
});
