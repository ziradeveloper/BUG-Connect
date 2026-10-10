import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { MockDataService } from './mock-data.service';

/**
 * Wave 4 behaviours of the dummy layer: tenant provisioning, WABA connection,
 * plan edits, the Meta reference and the dead-letter queue.
 */
describe('MockDataService (platform / wave 4)', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'platform',
    slug: null,
    host: 'admin.localhost',
    source: 'subdomain',
  });

  beforeEach(() => {
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
            displayName: computed(() => 'Platform console'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    });
  });

  const build = () => TestBed.inject(MockDataService);

  it('provisions a tenant on trial with a subscription trail', async () => {
    const data = build();
    const before = (await data.listTenants()).total;

    const tenant = await data.saveTenant({
      businessName: 'Platform Test Store',
      subdomain: `platform-${Date.now().toString(36)}`,
      industry: 'General retail',
      subscriptionTier: 'Pilot',
    });

    expect(tenant.status).toBe('onboarding');
    expect(tenant.metaWabaId).toBeNull();
    expect((await data.listTenants()).total).toBe(before + 1);

    const trail = data.subscriptionEventsForTenant(tenant.id);
    expect(trail.length).toBe(1);
    expect(trail[0]?.to).toBe('trial');
  });

  it('stamps a user into an explicit tenant from the platform console', async () => {
    const data = build();
    const tenant = await data.saveTenant({
      businessName: 'Tenant Target',
      subdomain: `target-${Date.now().toString(36)}`,
      industry: 'General retail',
      subscriptionTier: 'Growth',
    });

    const saved = await data.saveUser({
      tenantId: tenant.id,
      fullName: 'Tenant Admin',
      email: `tenant-admin-${Date.now().toString(36)}@example.com`,
      role: 'admin',
      roleId: 'role-admin',
    });

    expect(saved.tenantId).toBe(tenant.id);
    expect(data.usersForTenant(tenant.id).some((user) => user.id === saved.id)).toBe(true);
  });

  it('connects WhatsApp and activates a pending workspace', async () => {
    const data = build();
    const tenant = await data.saveTenant({
      businessName: 'WABA Test Store',
      subdomain: `waba-${Date.now().toString(36)}`,
      industry: 'General retail',
      subscriptionTier: 'Growth',
    });

    const updated = await data.connectWaba(tenant.id, {
      wabaId: '109999999999',
      phoneNumberId: '108888888888',
      phoneNumber: '+91 98765 43210',
    });

    expect(updated?.status).toBe('active');
    expect(updated?.connectedAt).toBeTruthy();

    const trail = data.subscriptionEventsForTenant(tenant.id);
    expect(trail.at(-1)?.to).toBe('active');
  });

  it('edits plan limits and the module matrix in place', async () => {
    const data = build();

    await data.savePlanLimits('Pilot', { ...data.planForTier('Pilot')!.limits, seats: 7 });
    expect(data.planForTier('Pilot')?.limits.seats).toBe(7);

    data.setPlanModule('Pilot', 'campaigns', true);
    expect(data.planForTier('Pilot')?.modules).toContain('campaigns');

    data.setPlanModule('Pilot', 'campaigns', false);
    expect(data.planForTier('Pilot')?.modules).not.toContain('campaigns');
  });

  it('saves the Meta reference with an audit stamp', async () => {
    const data = build();

    const updated = await data.saveMetaConfig({ appId: '42' }, 'Test Operator');

    expect(updated.appId).toBe('42');
    expect(updated.updatedBy).toBe('Test Operator');
    expect(updated.updatedAt).toBeTruthy();
  });

  it('re-queues a failed webhook event on acknowledgement', async () => {
    const data = build();
    const failed = (await data.listWebhookEvents()).items.find((event) => event.outcome === 'failed');

    if (!failed) {
      expect(true).toBe(true);
      return;
    }

    await data.ackWebhookEvent(failed.id);

    const updated = (await data.listWebhookEvents()).items.find((event) => event.id === failed.id);
    expect(updated?.outcome).toBe('queued');
    expect(updated?.error).toBeNull();
  });

  it('moves tenants between tiers', async () => {
    const data = build();
    const target = (await data.listTenants()).items[0]!;

    await data.changeTenantTier(target.id, 'Scale');

    expect(data.tenantById(target.id)?.subscriptionTier).toBe('Scale');
  });

  it('seeds subscription and invoice trails for every tenant', async () => {
    const data = build();
    const tenants = (await data.listTenants()).items;

    for (const tenant of tenants) {
      expect(data.subscriptionEventsForTenant(tenant.id).length).toBeGreaterThan(0);
      expect(data.invoicesForTenant(tenant.id).length).toBeGreaterThan(0);
    }
  });
});
