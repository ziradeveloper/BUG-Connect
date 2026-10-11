import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { keyState } from './developer-hub';
import { DATA_NOW } from '../../shared/format';
import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { buildDataset } from './mock-data';
import { MockDataService } from './mock-data.service';

/**
 * Wave 6 data layer: the seeded integration surface and its write path.
 *
 * Two things matter here. The keys and the endpoint are seeded on their own
 * stream, so nothing earlier in the dataset moves; and a secret is returned
 * exactly once, with only a digest left on the row — which is what makes the
 * hub's "copy it now" warning true rather than theatrical.
 */
describe('MockDataService (Developer Hub / wave 6)', () => {
  let data: MockDataService;
  let tenantId: string;

  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  function configure(): MockDataService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WorkspaceContext,
          useValue: {
            resolved: resolution.asReadonly(),
            kind: computed(() => resolution().kind),
            slug: computed(() => resolution().slug),
            isPlatform: computed(() => resolution().kind === 'platform'),
            isClient: computed(() => resolution().kind === 'client'),
            isMarketing: computed(() => resolution().kind === 'marketing'),
            isWorkspace: computed(() => resolution().kind !== 'marketing'),
            displayName: computed(() => 'Nazeel Silks & Bridal'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    });

    return TestBed.inject(MockDataService);
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    data = configure();
    tenantId = data.currentTenant()?.id as string;
  });

  it('seeds two keys and one endpoint per tenant, and nothing from its neighbours', () => {
    const dataset = buildDataset();

    expect(dataset.apiKeys.length).toBe(dataset.tenants.length * 2);
    expect(dataset.webhookEndpoints.length).toBe(dataset.tenants.length);
    expect(dataset.webhookEndpoints.every((hook) => hook.url.startsWith('https://'))).toBe(true);
    expect(dataset.webhookEndpoints.every((hook) => hook.secret.startsWith('whsec_'))).toBe(true);
    expect(dataset.apiKeys.every((key) => key.prefix.startsWith('bc_'))).toBe(true);
    // Only a digest is stored, never the secret.
    expect(dataset.apiKeys.every((key) => key.secretDigest.startsWith('sha256:'))).toBe(true);

    // The workspace only ever sees its own rows.
    expect(data.apiKeys()).toHaveLength(2);
    expect(data.apiKeys().every((key) => key.tenantId === tenantId)).toBe(true);
    expect(data.webhookEndpoint()?.tenantId).toBe(tenantId);
    expect(data.apiKeys()[0]!.scopes.length).toBeGreaterThan(0);
    // The list is newest first.
    expect(
      Date.parse(data.apiKeys()[0]!.createdAt) >= Date.parse(data.apiKeys()[1]!.createdAt),
    ).toBe(true);
  });

  it('shows the end of a key’s life somewhere in the estate', () => {
    const dataset = buildDataset();
    const states = dataset.apiKeys.map((key) => keyState(key, DATA_NOW));

    // One tenant in three has a revoked key, one in three an expiring one.
    expect(states).toContain('revoked');
    expect(states).toContain('expiring');
    expect(states).toContain('live');
    // And every workspace still has a key that works.
    expect(
      dataset.tenants.every((tenant) =>
        dataset.apiKeys.some(
          (key) => key.tenantId === tenant.id && keyState(key, DATA_NOW) === 'live',
        ),
      ),
    ).toBe(true);
  });

  it('seeds the same keys every time and never disturbs the rest of the data', () => {
    const first = buildDataset();
    const second = buildDataset();

    expect(second.apiKeys.map((key) => key.prefix)).toEqual(first.apiKeys.map((key) => key.prefix));
    expect(second.apiKeys.map((key) => key.secretDigest)).toEqual(
      first.apiKeys.map((key) => key.secretDigest),
    );
    expect(second.webhookEndpoints.map((hook) => hook.secret)).toEqual(
      first.webhookEndpoints.map((hook) => hook.secret),
    );
    // The hub block runs after every other collection, on its own stream.
    expect(second.messages.length).toBe(first.messages.length);
    expect(second.contacts.length).toBe(first.contacts.length);
    expect(second.campaignSamples.length).toBe(first.campaignSamples.length);
    expect(second.whatsappFlows.length).toBe(first.whatsappFlows.length);
  });

  it('issues a key, returns the secret once and keeps only a digest', async () => {
    const before = data.apiKeys().length;
    const contactsBefore = data.contacts().length;

    const issued = await data.createApiKey({
      name: 'Nightly contact sync',
      scopes: ['contacts.write', 'reports.read'],
      expiresAt: null,
    });

    expect(issued.secret).toMatch(/^bc_secret_[0-9a-f]{32}$/);
    expect(issued.key.prefix).toMatch(/^bc_live_[0-9a-f]{8}$/);
    expect(issued.key.scopes).toEqual(['contacts.write', 'reports.read']);
    expect(issued.key.revokedAt).toBeNull();
    expect(keyState(issued.key, DATA_NOW)).toBe('live');
    expect(data.apiKeys()).toHaveLength(before + 1);
    expect(data.apiKeyById(issued.key.id)).not.toBeNull();
    // The row never held the secret.
    expect(JSON.stringify(data.apiKeyById(issued.key.id))).not.toContain(issued.secret);
    // Minting a key touches nothing else.
    expect(data.contacts()).toHaveLength(contactsBefore);

    // The log reads newest first, so the row we just wrote is at the top.
    const audit = data.auditForTenant(tenantId)[0];

    expect(audit?.area).toBe('developer');
    expect(audit?.action).toContain('Nightly contact sync');
  });

  it('revokes a key once and leaves the row for the log', async () => {
    const issued = await data.createApiKey({ name: 'Throwaway', scopes: ['flows.read'], expiresAt: null });

    expect(await data.revokeApiKey(issued.key.id)).toBe(true);
    expect(data.apiKeyById(issued.key.id)?.revokedAt).not.toBeNull();
    expect(keyState(data.apiKeyById(issued.key.id)!, DATA_NOW)).toBe('revoked');
    // A revoked key stays in the list, and cannot be revoked twice.
    expect(data.apiKeys().some((key) => key.id === issued.key.id)).toBe(true);
    expect(await data.revokeApiKey(issued.key.id)).toBe(false);
    expect(await data.revokeApiKey('never-existed')).toBe(false);
    expect(data.auditForTenant(tenantId)[0]?.level).toBe('warning');
  });

  it('rotates a secret but not a revoked key', async () => {
    const issued = await data.createApiKey({ name: 'Rotating', scopes: ['messages.send'], expiresAt: null });
    const digestBefore = data.apiKeyById(issued.key.id)!.secretDigest;

    const rotated = await data.rotateApiKey(issued.key.id);

    expect(rotated).not.toBeNull();
    expect(rotated!.secret).toMatch(/^bc_secret_/);
    expect(rotated!.secret).not.toBe(issued.secret);
    expect(data.apiKeyById(issued.key.id)!.secretDigest).not.toBe(digestBefore);
    // Name, prefix and scopes survive the rotation.
    expect(data.apiKeyById(issued.key.id)!.name).toBe('Rotating');
    expect(data.apiKeyById(issued.key.id)!.prefix).toBe(issued.key.prefix);

    await data.revokeApiKey(issued.key.id);

    expect(await data.rotateApiKey(issued.key.id)).toBeNull();
  });

  it('saves the endpoint, pauses it and refuses a test while paused', async () => {
    const saved = await data.saveWebhook({
      url: 'https://crm.nazeel.example.com/v2/bugconnect',
      events: ['message.received', 'flow.completed'],
    });

    expect(saved?.url).toBe('https://crm.nazeel.example.com/v2/bugconnect');
    expect(saved?.events).toEqual(['message.received', 'flow.completed']);
    expect(data.webhookEndpoint()?.url).toBe(saved?.url);
    // Saving keeps the signing secret that was already issued.
    expect(saved?.secret).toMatch(/^whsec_/);

    const paused = await data.setWebhookStatus('paused');

    expect(paused?.status).toBe('paused');
    expect(await data.sendTestWebhook()).toBeNull();

    await data.setWebhookStatus('active');

    const delivered = await data.sendTestWebhook();

    expect(delivered?.ok).toBe(true);
    expect(delivered?.status).toBe(200);
    expect(data.webhookEndpoint()?.lastStatus).toBe(200);
    expect(data.webhookEndpoint()?.failureCount).toBe(0);
    expect(data.auditForTenant(tenantId)[0]?.action).toContain('test delivery');
  });

  it('keeps failing until the endpoint is fixed', async () => {
    // Force the failing state the way three bad deliveries would.
    const endpoint = data.webhookEndpoint()!;
    const dataset = buildDataset();

    expect(endpoint.id).toBe(`${tenantId}-hook-1`);
    expect(dataset.webhookEndpoints.length).toBe(dataset.tenants.length);

    await data.saveWebhook({
      url: endpoint.url,
      events: endpoint.events,
      status: 'failing',
    });
    expect(data.webhookEndpoint()?.status).toBe('failing');

    const failureCountBefore = data.webhookEndpoint()!.failureCount;
    const result = await data.sendTestWebhook();

    expect(result?.ok).toBe(false);
    expect(result?.status).toBe(500);
    expect(data.webhookEndpoint()?.failureCount).toBe(failureCountBefore + 1);
    expect(data.auditForTenant(tenantId)[0]?.level).toBe('critical');

    // Resuming clears the counter, because the operator says it is healthy again.
    await data.setWebhookStatus('active');

    expect(data.webhookEndpoint()?.failureCount).toBe(0);
  });

  it('rotates the signing secret without touching the URL', async () => {
    const before = data.webhookEndpoint()!;
    const next = await data.rotateWebhookSecret();

    expect(next?.secret).not.toBe(before.secret);
    expect(next?.secret).toMatch(/^whsec_[0-9a-f]{24}$/);
    expect(next?.url).toBe(before.url);
    expect(next?.events).toEqual(before.events);
    expect(data.auditForTenant(tenantId)[0]?.level).toBe('warning');
  });
});
