import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { MockDataService } from './mock-data.service';

/**
 * The dummy layer has to behave like a real API or every page gets written
 * against a fiction: stable counts for the same seed, tenant isolation, and
 * writes that survive a re-read.
 */
describe('MockDataService (dummy data layer)', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
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
            displayName: computed(() => resolution().slug ?? 'Platform console'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    });
  });

  const build = () => TestBed.inject(MockDataService);

  it('is deterministic — two instances describe the same world', () => {
    const left = build().listUsers();
    const right = build().listUsers();

    return Promise.all([left, right]).then(([a, b]) => {
      expect(a.items.length).toBe(b.items.length);
      expect(a.items.map((user) => user.email)).toEqual(b.items.map((user) => user.email));
    });
  });

  it('scopes every read to the resolved tenant', async () => {
    const data = build();
    const page = await data.listUsers();

    expect(page.items.length).toBeGreaterThan(0);
    expect(new Set(page.items.map((user) => user.tenantId)).size).toBe(1);
    expect(page.items[0]?.tenantId).toBe(data.tenantId());
  });

  it('keeps conversations inside their tenant', async () => {
    const data = build();
    const conversations = await data.listConversations();
    const tenantId = data.tenantId();

    expect(conversations.items.every((thread) => thread.tenantId === tenantId)).toBe(true);
  });

  it('returns a page shape a table can bind directly', async () => {
    const page = await build().listTenants();

    expect(Array.isArray(page.items)).toBe(true);
    expect(page.total).toBe(page.items.length);
  });

  it('writes through saveUser and reads the change back', async () => {
    const data = build();
    const before = await data.listUsers();
    const tenantId = data.tenantId();

    const saved = await data.saveUser({
      id: 'user-verify',
      tenantId,
      fullName: 'Verification Officer',
      email: `verify.${Date.now().toString(36)}@${tenantId}.example`,
      phone: null,
      avatarInitials: 'VO',
      roleId: 'role-agent',
      department: null,
      isActive: true,
      isOnline: false,
      activeChats: 0,
      maxActiveChatCapacity: 5,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    } as never);

    expect(saved).toBeTruthy();

    const after = await data.listUsers();

    expect(after.items.length).toBe(before.items.length + 1);
    expect(after.items.some((user) => user.fullName === 'Verification Officer')).toBe(true);
  });

  it('deletes a member and drops it from the count', async () => {
    const data = build();
    const page = await data.listUsers();
    const victim = page.items[0];

    await data.deleteUser(victim.id);

    const after = await data.listUsers();

    expect(after.items.length).toBe(page.items.length - 1);
    expect(after.items.some((user) => user.id === victim.id)).toBe(false);
  });

  it('suspends a tenant without losing its row', async () => {
    const data = build();
    const tenants = await data.listTenants();
    const target = tenants.items[0];

    await data.setTenantStatus(target.id, 'suspended');

    const after = await data.listTenants();
    const updated = after.items.find((tenant) => tenant.id === target.id);

    expect(updated?.status).toBe('suspended');
    expect(after.items.length).toBe(tenants.items.length);
  });

  it('serves the admin console a different user list than a tenant', async () => {
    const data = build();
    const staff = await data.listPlatformStaff();

    const tenant = await build().listUsers();

    expect(staff.items.length).toBeGreaterThan(0);
    // Platform staff are not tenant members: no overlap, by id or by email.
    expect(staff.items.some((member) => tenant.items.some((user) => user.id === member.id))).toBe(
      false,
    );
    expect(
      staff.items.some((member) => tenant.items.some((user) => user.email === member.email)),
    ).toBe(false);
  });
});
