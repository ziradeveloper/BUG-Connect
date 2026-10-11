import {
  activationFunnel,
  billingSummary,
  buildPlatformSnapshot,
  daysBetween,
  firstConversationAt,
  industrySlices,
  tierSlices,
  workspaceUsage,
  type PlatformSource,
} from './platform-analytics';
import type { Campaign, Conversation, Invoice, Message, Tenant, WhatsAppFlowForm, WorkspaceUser } from './entities';

/**
 * Cross-tenant analytics maths (platform `/analytics`).
 *
 * Checked against a hand-built estate of three workspaces, where every total can
 * be added up by hand: the point of the module is that the platform owner sees
 * the same numbers the workspaces' own rows imply.
 */
describe('platform analytics — pure maths', () => {
  const now = Date.UTC(2026, 9, 8, 12, 0);
  const iso = (daysAgo: number, hour = 9): string =>
    new Date(Date.UTC(2026, 9, 8, hour) - daysAgo * 86_400_000).toISOString();

  const tenant = (overrides: Partial<Tenant>): Tenant =>
    ({
      id: 'tenant-1',
      businessName: 'Nazeel Silks',
      subdomain: 'nazeel',
      subscriptionTier: 'Growth',
      status: 'active',
      industry: 'Textile, silk and bridal retail',
      seatsUsed: 4,
      contactCount: 120,
      monthlyMessages: 900,
      createdAt: iso(40, 6),
      connectedAt: iso(38, 6),
      ...overrides,
    }) as Tenant;

  const conversation = (id: string, tenantId: string, status = 'open'): Conversation =>
    ({
      id,
      tenantId,
      contactId: `${id}-c`,
      channel: 'whatsapp',
      status,
      currentActiveFlowId: null,
      currentActiveNodeId: null,
      assignedUserId: null,
      lastMessageAt: iso(1),
      unreadCount: 0,
      subject: id,
      priority: 'normal',
      tags: [],
    }) as Conversation;

  const message = (id: string, conversationId: string, sentAt: string, direction = 'inbound'): Message =>
    ({
      id,
      conversationId,
      direction,
      type: 'text',
      payload: { text: id },
      content: id,
      mediaUrl: null,
      deliveryStatus: 'read',
      isInternalWhisper: false,
      createdByUserId: null,
      sentAt,
    }) as Message;

  const tenants = [
    tenant({}),
    tenant({
      id: 'tenant-2',
      businessName: 'Iyer Sweets',
      subdomain: 'iyer',
      subscriptionTier: 'Pilot',
      status: 'whatsapp_pending',
      industry: 'Sweets, bakeries and packaged foods',
      seatsUsed: 2,
      contactCount: 40,
      createdAt: iso(20, 6),
      connectedAt: null,
    }),
    tenant({
      id: 'tenant-3',
      businessName: 'Apex Diagnostics',
      subdomain: 'apex',
      subscriptionTier: 'Scale',
      status: 'suspended',
      industry: 'Diagnostic centres and clinics',
      seatsUsed: 7,
      contactCount: 300,
      createdAt: iso(60, 6),
      connectedAt: iso(55, 6),
    }),
  ];

  const conversations = [
    conversation('c1', 'tenant-1', 'open'),
    conversation('c2', 'tenant-1', 'flow'),
    conversation('c3', 'tenant-1', 'resolved'),
    conversation('c4', 'tenant-2', 'open'),
    conversation('c5', 'tenant-3', 'flow'),
  ];

  const messages = [
    message('m1', 'c1', iso(2, 9)),
    message('m2', 'c1', iso(2, 10), 'outbound'),
    message('m3', 'c2', iso(1, 9)),
    message('m4', 'c4', iso(5, 9)),
    message('m5', 'c5', iso(1, 11)),
    // A message whose conversation is not in the list is ignored, not guessed at.
    message('m6', 'ghost', iso(1, 12)),
  ];

  const users = [
    { id: 'u1', tenantId: 'tenant-1', isOnline: true } as WorkspaceUser,
    { id: 'u2', tenantId: 'tenant-1', isOnline: false } as WorkspaceUser,
    { id: 'u3', tenantId: 'tenant-3', isOnline: true } as WorkspaceUser,
  ];

  const campaigns = [
    { id: 'camp-1', tenantId: 'tenant-1' } as Campaign,
    { id: 'camp-2', tenantId: 'tenant-1' } as Campaign,
    { id: 'camp-3', tenantId: 'tenant-3' } as Campaign,
  ];

  const forms = [
    { id: 'f1', tenantId: 'tenant-1', status: 'published' } as WhatsAppFlowForm,
    { id: 'f2', tenantId: 'tenant-1', status: 'draft' } as WhatsAppFlowForm,
    { id: 'f3', tenantId: 'tenant-3', status: 'published' } as WhatsAppFlowForm,
  ];

  const invoices = [
    { id: 'i1', tenantId: 'tenant-1', amountInr: 14900, status: 'paid' } as Invoice,
    { id: 'i2', tenantId: 'tenant-1', amountInr: 14900, status: 'due' } as Invoice,
    { id: 'i3', tenantId: 'tenant-3', amountInr: 49900, status: 'overdue' } as Invoice,
    { id: 'i4', tenantId: 'tenant-3', amountInr: 49900, status: 'paid' } as Invoice,
  ];

  const source: PlatformSource = {
    tenants,
    users,
    conversations,
    messages,
    campaigns,
    forms,
    invoices,
  };

  it('finds each workspace’s first live conversation', () => {
    const first = firstConversationAt(conversations, messages);

    expect(first.get('tenant-1')).toBe(iso(2, 9));
    expect(first.get('tenant-2')).toBe(iso(5, 9));
    expect(first.get('tenant-3')).toBe(iso(1, 11));
    // The orphan message invented no tenant.
    expect(first.size).toBe(3);
  });

  it('counts whole days between two stamps', () => {
    expect(daysBetween(iso(40, 6), iso(2, 9))).toBe(38);
    expect(daysBetween(iso(2, 9), iso(2, 9))).toBe(0);
    // Never negative, even when the order is wrong.
    expect(daysBetween(iso(2, 9), iso(9, 9))).toBe(0);
    expect(daysBetween(null, iso(1))).toBeNull();
    expect(daysBetween(iso(1), null)).toBeNull();
    expect(daysBetween('nonsense', iso(1))).toBeNull();
  });

  it('aggregates adoption and usage per plan tier', () => {
    const perTenant = new Map([
      ['tenant-1', 3],
      ['tenant-2', 1],
      ['tenant-3', 1],
    ]);
    const slices = tierSlices(tenants, perTenant);

    expect(slices).toHaveLength(3);

    const growth = slices.find((slice) => slice.tier === 'Growth')!;

    expect(growth.workspaces).toBe(1);
    expect(growth.active).toBe(1);
    expect(growth.suspended).toBe(0);
    expect(growth.seats).toBe(4);
    expect(growth.contacts).toBe(120);
    expect(growth.messages30d).toBe(3);
    expect(growth.sharePct).toBe(33);
    expect(growth.messageSharePct).toBe(60);

    const scale = slices.find((slice) => slice.tier === 'Scale')!;

    expect(scale.suspended).toBe(1);
    expect(scale.messageSharePct).toBe(20);
  });

  it('measures each onboarding step against the one before it', () => {
    const stages = activationFunnel(
      tenants,
      firstConversationAt(conversations, messages),
      campaigns,
      forms,
    );

    expect(stages.map((stage) => stage.key)).toEqual([
      'signup',
      'connected',
      'firstConversation',
      'firstBroadcast',
      'publishedForm',
    ]);
    // tenant-2 never connected WhatsApp, so it drops out of every later step
    // even though it does have a conversation.
    expect(stages.map((stage) => stage.count)).toEqual([3, 2, 2, 2, 2]);
    expect(stages[0]!.pctOfPrevious).toBe(100);
    expect(stages[1]!.pctOfPrevious).toBe(67);
    expect(stages[2]!.pctOfPrevious).toBe(100);
    expect(stages[3]!.pctOfPrevious).toBe(100);
    // Nothing ever widens going down the funnel.
    for (let index = 1; index < stages.length; index += 1) {
      expect(stages[index]!.count).toBeLessThanOrEqual(stages[index - 1]!.count);
      expect(stages[index]!.pctOfPrevious).toBeLessThanOrEqual(100);
    }
  });

  it('reports invoices as issued, not projected revenue', () => {
    const billing = billingSummary(invoices);

    expect(billing.collectedInr).toBe(64800);
    expect(billing.outstandingInr).toBe(64800);
    expect(billing.overdueInr).toBe(49900);
    expect(billing.paid).toBe(2);
    expect(billing.open).toBe(2);
    expect(billingSummary([])).toEqual({
      collectedInr: 0,
      outstandingInr: 0,
      overdueInr: 0,
      paid: 0,
      open: 0,
    });
  });

  it('ranks workspaces by traffic and scales the bar to the busiest', () => {
    const rows = workspaceUsage(tenants, {
      messages30d: new Map([
        ['tenant-1', 30],
        ['tenant-2', 10],
        ['tenant-3', 0],
      ]),
      conversations: new Map([
        ['tenant-1', 3],
        ['tenant-2', 1],
        ['tenant-3', 1],
      ]),
      agentsOnline: new Map([['tenant-1', 1]]),
    });

    expect(rows.map((row) => row.tenantId)).toEqual(['tenant-1', 'tenant-2', 'tenant-3']);
    expect(rows[0]!.sharePct).toBe(100);
    expect(rows[1]!.sharePct).toBe(33);
    expect(rows[2]!.sharePct).toBe(0);
    expect(rows[0]!.agentsOnline).toBe(1);
    // Only tenant-1 had an online agent in the fixture.
    expect(rows[2]!.agentsOnline).toBe(0);
  });

  it('groups workspaces by industry', () => {
    const slices = industrySlices([
      ...tenants,
      tenant({ id: 'tenant-4', industry: 'Sweets, bakeries and packaged foods' }),
    ]);

    expect(slices[0]!.industry).toBe('Sweets, bakeries and packaged foods');
    expect(slices[0]!.workspaces).toBe(2);
    expect(slices[0]!.sharePct).toBe(50);
    expect(slices).toHaveLength(3);
  });

  it('builds one snapshot covering the whole estate', () => {
    const snapshot = buildPlatformSnapshot(source, 7, now);

    expect(snapshot.range).toBe(7);
    expect(snapshot.volume).toHaveLength(7);
    expect(snapshot.tenants.total).toBe(3);
    expect(snapshot.tenants.active).toBe(1);
    expect(snapshot.tenants.suspended).toBe(1);
    expect(snapshot.tenants.other).toBe(1);
    expect(snapshot.seats).toBe(13);
    expect(snapshot.contacts).toBe(460);
    expect(snapshot.agents).toBe(3);
    expect(snapshot.agentsOnline).toBe(2);
    // Four conversations are unresolved; two of those are inside a flow.
    expect(snapshot.openConversations).toBe(4);
    expect(snapshot.inFlow).toBe(2);
    expect(snapshot.automationPct).toBe(50);
    // The ghost conversation's message never counted.
    expect(snapshot.messagesTotal).toBe(snapshot.inboundTotal + snapshot.outboundTotal);
    expect(snapshot.messagesTotal).toBeGreaterThan(0);
    expect(snapshot.peakLabel).toContain('messages');
    // Median of 38, 5 and 49 days is 38.
    expect(snapshot.medianActivationDays).toBe(38);
    expect(snapshot.fastest[0]!.tenantId).toBe('tenant-2');
    expect(snapshot.slowest[0]!.tenantId).toBe('tenant-3');
    expect(snapshot.tiers).toHaveLength(3);
    expect(snapshot.industries).toHaveLength(3);
  });

  it('says so plainly when the estate is empty', () => {
    const snapshot = buildPlatformSnapshot(
      { tenants: [], users: [], conversations: [], messages: [], campaigns: [], forms: [], invoices: [] },
      30,
      now,
    );

    expect(snapshot.volume).toHaveLength(30);
    expect(snapshot.messagesTotal).toBe(0);
    expect(snapshot.peakLabel).toBe('No traffic in this window');
    expect(snapshot.medianActivationDays).toBeNull();
    expect(snapshot.automationPct).toBe(0);
    expect(snapshot.activation.map((stage) => stage.count)).toEqual([0, 0, 0, 0, 0]);
    expect(snapshot.tiers).toEqual([]);
    expect(snapshot.industries).toEqual([]);
  });
});
