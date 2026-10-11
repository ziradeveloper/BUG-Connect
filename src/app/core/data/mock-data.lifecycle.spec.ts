import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { MockDataService } from './mock-data.service';

/**
 * Wave 5 behaviours of the dummy layer: the audit trail, invitations, password
 * recovery, plan usage, suspension and platform-wide settings.
 */
describe('MockDataService (lifecycle / wave 5)', () => {
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
            displayName: computed(() => 'Nazeel Silks & Bridal'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    });
  });

  const build = () => TestBed.inject(MockDataService);

  it('seeds a tenant audit trail plus platform-only rows', () => {
    const data = build();
    const tenantId = data.currentTenant()?.id;

    const tenantRows = data.auditForTenant(tenantId);
    expect(tenantRows.length).toBeGreaterThanOrEqual(8);
    expect(tenantRows.every((row) => row.tenantId === tenantId)).toBe(true);

    const platformRows = data.platformAudit();
    expect(platformRows.length).toBeGreaterThanOrEqual(4);
    expect(platformRows.every((row) => row.tenantId === null)).toBe(true);

    const log = data.auditLog();
    expect(log.length).toBeGreaterThan(tenantRows.length);
    expect(Date.parse(log[0]!.createdAt)).toBeGreaterThanOrEqual(Date.parse(log[1]!.createdAt));
  });

  it('attributes a mutation to the acting user and the right area', async () => {
    const data = build();
    data.actor.set({ name: 'Tester', role: 'Workspace Administrator', scope: 'client' });

    const before = data.auditEvents().length;
    await data.saveQuickReply({ trigger: '/wave5', body: 'A wave 5 snippet.' });

    const rows = data.auditEvents();
    expect(rows.length).toBe(before + 1);

    const last = rows[rows.length - 1]!;
    expect(last.actor).toBe('Tester');
    expect(last.area).toBe('settings');
    expect(last.action).toContain('/wave5');
    expect(last.tenantId).toBe(data.currentTenant()?.id);
  });

  it('issues a reset token for a seeded address and spends it once', async () => {
    const data = build();
    const admin = data.users().find((user) => user.role === 'admin');
    expect(admin).toBeTruthy();

    const outcome = await data.requestPasswordReset(admin!.email);
    expect(outcome.found).toBe(true);
    expect(outcome.token).toBeTruthy();
    expect(data.resetRequestFor(outcome.token)).not.toBeNull();

    const done = await data.completePasswordReset(outcome.token!);
    expect(done.ok).toBe(true);
    expect(data.resetRequestFor(outcome.token)).toBeNull();

    const replay = await data.completePasswordReset(outcome.token!);
    expect(replay.ok).toBe(false);
  });

  it('answers an unknown address without minting a token', async () => {
    const data = build();
    const outcome = await data.requestPasswordReset('nobody@example.com');

    expect(outcome.found).toBe(false);
    expect(outcome.token).toBeNull();
    expect(data.resetRequests().length).toBe(0);
  });

  it('accepts an invitation once and clears the pending seat', async () => {
    const data = build();
    const invited = data.users().find((user) => user.invited);
    expect(invited).toBeTruthy();

    const invite = data.ensureInvite(invited!.id);
    expect(invite).not.toBeNull();
    expect(data.inviteFor(invited!.id)?.token).toBe(invite!.token);

    const outcome = await data.acceptInvite(invite!.token);
    expect(outcome.ok).toBe(true);
    expect(data.users().find((user) => user.id === invited!.id)?.invited).toBe(false);
    expect(data.inviteDetails(invite!.token)?.accepted).toBe(true);

    const replay = await data.acceptInvite(invite!.token);
    expect(replay.ok).toBe(false);
  });

  it('refuses unknown and expired invitation links', async () => {
    const data = build();
    const unknown = await data.acceptInvite('invite-not-a-real-token');
    expect(unknown.ok).toBe(false);

    const invited = data.users().find((user) => user.invited)!;
    const invite = data.ensureInvite(invited.id)!;
    data.invites.update((list) =>
      list.map((candidate) =>
        candidate.token === invite.token
          ? { ...candidate, expiresAt: new Date(Date.now() - 60_000).toISOString() }
          : candidate,
      ),
    );

    expect(data.inviteDetails(invite.token)?.expired).toBe(true);
    const expired = await data.acceptInvite(invite.token);
    expect(expired.ok).toBe(false);
  });

  it('counts usage against the plan the workspace is on', () => {
    const data = build();
    const usage = data.planUsage();

    expect(usage.seats).toBe(data.users().length);
    expect(usage.contacts).toBe(data.contacts().length);
    expect(usage.whatsappNumbers).toBe(data.currentTenant()?.metaPhoneNumberId ? 1 : 0);
    expect(usage.messagesPerMonth).toBe(data.currentTenant()?.monthlyMessages ?? 0);
  });

  it('locks a suspended workspace with a reason, an event and an audit row', async () => {
    const data = build();
    const tenant = data.currentTenant()!;

    expect(data.subscriptionState()?.state).not.toBe('suspended');

    await data.setTenantStatus(tenant.id, 'suspended');

    expect(data.subscriptionState()?.state).toBe('suspended');
    expect(data.suspensionReason()).toContain('Suspended by the platform team');

    const trail = data.subscriptionEventsForTenant(tenant.id);
    expect(trail[trail.length - 1]!.to).toBe('suspended');

    const latest = data.auditForTenant(tenant.id)[0]!;
    expect(latest.area).toBe('clients');
    expect(latest.level).toBe('critical');

    await data.setTenantStatus(tenant.id, 'active');
    expect(data.subscriptionState()?.state).toBe('active');
  });

  it('records a tier move in both the lifecycle trail and the audit log', async () => {
    const data = build();
    const tenant = data.currentTenant()!;
    const target = tenant.subscriptionTier === 'Scale' ? 'Growth' : 'Scale';
    const events = data.subscriptionEventsForTenant(tenant.id).length;

    await data.changeTenantTier(tenant.id, target);

    expect(data.tenantById(tenant.id)?.subscriptionTier).toBe(target);
    expect(data.subscriptionEventsForTenant(tenant.id).length).toBe(events + 1);
    expect(data.subscriptionEventsForTenant(tenant.id).at(-1)?.reason).toContain(
      `Plan changed from ${tenant.subscriptionTier} to ${target}`,
    );
    expect(data.auditForTenant(tenant.id)[0]!.area).toBe('billing');
  });

  it('stamps platform settings with the operator and an audit row', async () => {
    const data = build();
    data.actor.set({ name: 'Zira Developer', role: 'Platform Owner', scope: 'platform' });

    const saved = await data.savePlatformSettings({ trialDays: 21, maintenanceMode: true });

    expect(saved.trialDays).toBe(21);
    expect(saved.maintenanceMode).toBe(true);
    expect(saved.updatedBy).toBe('Zira Developer');
    expect(saved.updatedAt).toBeTruthy();
    expect(
      data
        .platformAudit()
        .some((row) => row.action.startsWith('Updated platform settings') && row.actor === 'Zira Developer'),
    ).toBe(true);
  });
});
