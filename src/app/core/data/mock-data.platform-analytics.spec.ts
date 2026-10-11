import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { buildDataset } from './mock-data';
import { MockDataService } from './mock-data.service';

/**
 * The platform analytics snapshot over the real seeded estate.
 *
 * The checks that matter: the snapshot covers every workspace rather than the
 * one the console is pointed at, its totals agree with the collections it is
 * built from, and it is stable between calls.
 */
describe('MockDataService (cross-tenant analytics)', () => {
  let data: MockDataService;

  const resolution = signal<ResolvedWorkspace>({
    kind: 'platform',
    slug: null,
    host: 'admin.localhost',
    source: 'subdomain',
  });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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
    data = TestBed.inject(MockDataService);
  });

  it('covers every workspace, not just the current one', () => {
    const snapshot = data.platformSnapshot();

    expect(snapshot.tenants.total).toBe(data.tenants().length);
    expect(snapshot.tenants.total).toBeGreaterThan(1);
    expect(snapshot.tenants.active + snapshot.tenants.suspended + snapshot.tenants.other).toBe(
      snapshot.tenants.total,
    );
    expect(snapshot.seats).toBe(data.tenants().reduce((total, tenant) => total + tenant.seatsUsed, 0));
    expect(snapshot.contacts).toBe(
      data.tenants().reduce((total, tenant) => total + tenant.contactCount, 0),
    );
    expect(snapshot.agents).toBe(data.allUsers().length);
    expect(snapshot.agentsOnline).toBe(data.allUsers().filter((user) => user.isOnline).length);
    // One leaderboard row per workspace.
    expect(snapshot.topWorkspaces).toHaveLength(data.tenants().length);
    expect(snapshot.topWorkspaces.map((row) => row.tenantId).sort()).toEqual(
      data.tenants().map((tenant) => tenant.id).sort(),
    );
  });

  it('counts only messages that belong to a real conversation', () => {
    const snapshot = data.platformSnapshot(90);
    const dataset = buildDataset();
    const conversationIds = new Set(dataset.conversations.map((conversation) => conversation.id));
    const own = dataset.messages.filter((message) => conversationIds.has(message.conversationId));

    expect(own.length).toBe(dataset.messages.length);
    expect(snapshot.messagesTotal).toBeGreaterThan(0);
    expect(snapshot.messagesTotal).toBeLessThanOrEqual(own.length);
    expect(snapshot.messagesTotal).toBe(snapshot.inboundTotal + snapshot.outboundTotal);
    // The window's buckets add up to the headline number.
    expect(snapshot.volume).toHaveLength(90);
    expect(snapshot.volume.reduce((total, point) => total + point.total, 0)).toBe(
      snapshot.messagesTotal,
    );
    expect(snapshot.openConversations).toBeLessThanOrEqual(dataset.conversations.length);
    expect(snapshot.inFlow).toBeLessThanOrEqual(snapshot.openConversations);
  });

  it('reports the invoices that were actually issued', () => {
    const snapshot = data.platformSnapshot();
    const dataset = buildDataset();
    const paid = dataset.invoices.filter((invoice) => invoice.status === 'paid');

    expect(snapshot.billing.collectedInr).toBe(
      paid.reduce((total, invoice) => total + invoice.amountInr, 0),
    );
    expect(snapshot.billing.paid).toBe(paid.length);
    expect(snapshot.billing.open).toBe(dataset.invoices.length - paid.length);
    expect(snapshot.billing.outstandingInr).toBeGreaterThanOrEqual(snapshot.billing.overdueInr);
  });

  it('measures the onboarding funnel against the real estate', () => {
    const snapshot = data.platformSnapshot();

    expect(snapshot.activation).toHaveLength(5);
    expect(snapshot.activation[0]!.count).toBe(data.tenants().length);
    expect(snapshot.activation[1]!.count).toBe(
      data.tenants().filter((tenant) => tenant.connectedAt !== null).length,
    );
    // Every step is at most as wide as the one before it.
    for (let index = 1; index < snapshot.activation.length; index += 1) {
      expect(snapshot.activation[index]!.count).toBeLessThanOrEqual(
        snapshot.activation[index - 1]!.count,
      );
      expect(snapshot.activation[index]!.pctOfPrevious).toBeLessThanOrEqual(100);
    }

    const measured = snapshot.fastest.filter((entry) => entry.days !== null);

    expect(measured.length).toBeGreaterThan(0);
    expect(snapshot.medianActivationDays).not.toBeNull();
    expect(snapshot.medianActivationDays!).toBeGreaterThanOrEqual(0);
  });

  it('switches window without changing the estate', () => {
    const week = data.platformSnapshot(7);
    const quarter = data.platformSnapshot(90);

    expect(week.volume).toHaveLength(7);
    expect(quarter.volume).toHaveLength(90);
    expect(quarter.messagesTotal).toBeGreaterThanOrEqual(week.messagesTotal);
    // Everything that is not time-windowed stays put.
    expect(quarter.tenants).toEqual(week.tenants);
    expect(quarter.seats).toBe(week.seats);
    expect(quarter.billing).toEqual(week.billing);
    expect(quarter.topWorkspaces.map((row) => row.tenantId)).toEqual(
      week.topWorkspaces.map((row) => row.tenantId),
    );
  });

  it('returns the same numbers for the same window', () => {
    const first = data.platformSnapshot(30);
    const second = data.platformSnapshot(30);

    expect(second.messagesTotal).toBe(first.messagesTotal);
    expect(second.medianActivationDays).toBe(first.medianActivationDays);
    expect(second.tiers).toEqual(first.tiers);
    expect(second.industries).toEqual(first.industries);
  });
});
