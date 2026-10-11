import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import {
  automationStats,
  buildReportSnapshot,
  campaignFunnel,
  FIRST_RESPONSE_TARGET_MIN,
  messageSeries,
  REPORT_RANGES,
} from './analytics';
import { MockDataService } from './mock-data.service';
import { buildDataset } from './mock-data';

/**
 * Analytics maths for `/reports` (wave 6).
 *
 * Two layers: the pure functions against hand-built rows, where the arithmetic
 * is checkable by hand, and the same functions against the seeded dataset, where
 * the invariants that matter for the page are that nothing is invented, nothing
 * is negative and the buckets line up with the window.
 */
describe('analytics — pure maths', () => {
  const now = Date.UTC(2026, 9, 8, 12, 0);
  /** Hour of the UTC day, counting back from 8 October — never past `now`. */
  const iso = (daysAgo: number, hour = 6): string =>
    new Date(Date.UTC(2026, 9, 8, hour) - daysAgo * 86_400_000).toISOString();

  const message = (
    id: string,
    conversationId: string,
    direction: 'inbound' | 'outbound',
    sentAt: string,
    isInternalWhisper = false,
  ) => ({
    id,
    conversationId,
    direction,
    type: 'text' as const,
    payload: { text: id },
    content: id,
    mediaUrl: null,
    deliveryStatus: 'read' as const,
    isInternalWhisper,
    createdByUserId: null,
    sentAt,
  });

  const conversation = (id: string, lastMessageAt: string, status = 'resolved') =>
    ({
      id,
      tenantId: 'tenant-1',
      contactId: `${id}-contact`,
      channel: 'whatsapp',
      status,
      currentActiveFlowId: null,
      currentActiveNodeId: null,
      assignedUserId: 'user-agent-1',
      lastMessageAt,
      unreadCount: 0,
      subject: id,
      priority: 'normal',
      tags: [],
    }) as never;

  it('buckets a day of traffic into the right UTC day, oldest first', () => {
    const series = messageSeries(
      [
        message('m1', 'c1', 'inbound', iso(0, 9)),
        message('m2', 'c1', 'outbound', iso(0, 10)),
        message('m3', 'c2', 'inbound', iso(6, 8)),
        message('m4', 'c2', 'outbound', iso(6, 8)),
        // A whisper is not a reply to the customer.
        message('m5', 'c2', 'outbound', iso(6, 8), true),
        // Outside the window.
        message('m6', 'c3', 'inbound', iso(20, 8)),
      ],
      7,
      now,
    );

    expect(series).toHaveLength(7);
    expect(series[0]!.inbound).toBe(1);
    expect(series[0]!.outbound).toBe(1);
    expect(series[6]!.inbound).toBe(1);
    expect(series[6]!.outbound).toBe(1);
    expect(series[6]!.total).toBe(2);
    expect(series.every((point) => point.total === point.inbound + point.outbound)).toBe(true);
    // Oldest first, and the labels read as days.
    expect(Date.parse(series[0]!.date)).toBeLessThan(Date.parse(series[6]!.date));
    expect(series[6]!.label).toMatch(/8 Oct/);
    // The 20-day-old message stayed out of a 7-day window.
    expect(series.reduce((total, point) => total + point.total, 0)).toBe(4);
  });

  it('measures first response from the contact, and resolution to the last reply', () => {
    const threads = new Map<string, typeof message[]>();
    const rows = [
      message('m1', 'c1', 'inbound', iso(1, 10)),
      message('m2', 'c1', 'outbound', iso(1, 10)), // +5 min
      message('m3', 'c1', 'outbound', iso(1, 11)), // resolved here: +65 min
      message('m4', 'c2', 'inbound', iso(2, 10)),
      message('m5', 'c2', 'outbound', iso(2, 10)), // +35 min, still open
    ].map((row) => ({ ...row, sentAt: row.sentAt }));

    // Five minutes and thirty-five minutes after the contact opened the thread.
    rows[1]!.sentAt = new Date(Date.parse(rows[0]!.sentAt) + 5 * 60_000).toISOString();
    rows[2]!.sentAt = new Date(Date.parse(rows[0]!.sentAt) + 65 * 60_000).toISOString();
    rows[4]!.sentAt = new Date(Date.parse(rows[3]!.sentAt) + 35 * 60_000).toISOString();

    for (const row of rows) {
      threads.set(row.conversationId, [...(threads.get(row.conversationId) ?? []), row as never]);
    }

    const snapshot = buildReportSnapshot(
      {
        conversations: [conversation('c1', iso(1, 11), 'resolved'), conversation('c2', iso(2, 10), 'open')],
        messages: rows as never,
        users: [
          {
            id: 'user-agent-1',
            fullName: 'Asha Menon',
            role: 'Agent',
            isOnline: true,
          } as never,
        ],
        flows: [],
        forms: [],
        campaigns: [],
      },
      7,
      now,
    );

    // Median of 5 and 35 minutes is 20; the mean is 20 too.
    expect(snapshot.response.medianFirstResponseMin).toBe(20);
    expect(snapshot.response.avgFirstResponseMin).toBe(20);
    expect(snapshot.response.avgFirstResponseMin).toBeGreaterThan(FIRST_RESPONSE_TARGET_MIN);
    expect(snapshot.response.withinTargetPct).toBe(50);
    // Only the resolved thread contributes a resolution time.
    expect(snapshot.response.avgResolutionMin).toBe(65);
    expect(snapshot.response.resolvedCount).toBe(1);
    expect(snapshot.response.counted).toBe(2);
    expect(snapshot.response.resolvedPct).toBe(50);
    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.agents[0]!.avgFirstResponseMin).toBe(20);
    expect(snapshot.agents[0]!.sharePct).toBe(100);
  });

  it('weights automation by volume rather than averaging the rates', () => {
    const stats = automationStats(
      [
        { id: 'f1', name: 'Big', sessions30d: 900, handoffRate: 10 } as never,
        { id: 'f2', name: 'Small', sessions30d: 100, handoffRate: 90 } as never,
      ],
      [
        { id: 'w1', name: 'Form', submissions30d: 200, completionRate: 80, status: 'published' } as never,
        { id: 'w2', name: 'Quiet', submissions30d: 0, completionRate: 0, status: 'draft' } as never,
      ],
    );

    // 900×10 + 100×90 over 1000 sessions is 18%, not the flat 50% average.
    expect(stats.handoffPct).toBe(18);
    expect(stats.containedPct).toBe(82);
    expect(stats.containedSessions).toBe(820);
    expect(stats.sessions30d).toBe(1000);
    expect(stats.activeFlows).toBe(0);
    expect(stats.completionPct).toBe(80);
    expect(stats.publishedForms).toBe(1);
    // Drafts with no traffic stay off the completion list.
    expect(stats.forms.map((form) => form.id)).toEqual(['w1']);
    expect(stats.flows.map((flow) => flow.id)).toEqual(['f1', 'f2']);
  });

  it('builds the funnel from summed campaign counters', () => {
    const funnel = campaignFunnel([
      {
        id: 'c1',
        status: 'sending',
        audienceSize: 1000,
        sent: 800,
        delivered: 760,
        read: 500,
        replied: 100,
        failed: 40,
        optOuts: 10,
      } as never,
      {
        id: 'c2',
        status: 'draft',
        audienceSize: 200,
        sent: 0,
        delivered: 0,
        read: 0,
        replied: 0,
        failed: 0,
        optOuts: 0,
      } as never,
    ]);

    expect(funnel.audience).toBe(1200);
    expect(funnel.sent).toBe(800);
    expect(funnel.deliveryPct).toBe(95);
    expect(funnel.readPct).toBe(66);
    expect(funnel.replyPct).toBe(20);
    expect(funnel.broadcasts).toBe(2);
    expect(funnel.live).toBe(1);
    expect(funnel.stages.map((stage) => stage.key)).toEqual([
      'audience',
      'sent',
      'delivered',
      'read',
      'replied',
    ]);
    // Every stage is a share of the matched audience, so the bars nest.
    expect(funnel.stages.map((stage) => stage.pctOfAudience)).toEqual([100, 67, 63, 42, 8]);
  });

  it('returns nulls instead of zeroes when there is nothing to measure', () => {
    const snapshot = buildReportSnapshot(
      { conversations: [], messages: [], users: [], flows: [], forms: [], campaigns: [] },
      7,
      now,
    );

    expect(snapshot.volume).toHaveLength(7);
    expect(snapshot.peak).toBeNull();
    expect(snapshot.peakLabel).toBe('No traffic yet');
    expect(snapshot.response.medianFirstResponseMin).toBeNull();
    expect(snapshot.response.avgResolutionMin).toBeNull();
    expect(snapshot.response.withinTargetPct).toBeNull();
    expect(snapshot.agents).toEqual([]);
    expect(snapshot.automation.handoffPct).toBe(0);
    expect(snapshot.funnel.deliveryPct).toBe(0);
    expect(snapshot.replyRatioPct).toBe(0);
  });
});

describe('analytics — seeded workspace', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  let data: MockDataService;

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
            displayName: computed(() => 'Nazeel Silks & Bridal'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    });
    data = TestBed.inject(MockDataService);
  });

  it('builds one bucket per day for every supported window', () => {
    for (const range of REPORT_RANGES) {
      const snapshot = data.reportSnapshot(range);

      expect(snapshot.range).toBe(range);
      expect(snapshot.volume).toHaveLength(range);
      expect(snapshot.messagesTotal).toBe(snapshot.inboundTotal + snapshot.outboundTotal);
      // Nothing negative anywhere, and the peak is a real day.
      expect(snapshot.volume.every((point) => point.inbound >= 0 && point.outbound >= 0)).toBe(
        true,
      );

      if (snapshot.peak) {
        expect(snapshot.peak.total).toBeLessThanOrEqual(snapshot.messagesTotal);
        expect(snapshot.peakLabel).toContain(`${snapshot.peak.total} messages`);
      }
    }
  });

  it('reports the tenant’s own traffic and nothing else', () => {
    const snapshot = data.reportSnapshot(90);
    const ownMessages = new Set(
      data.conversations().map((conversation) => conversation.id),
    );

    expect(snapshot.messagesTotal).toBeGreaterThan(0);
    expect(snapshot.response.counted).toBeGreaterThan(0);
    expect(snapshot.response.counted).toBeLessThanOrEqual(data.conversations().length);
    expect(ownMessages.size).toBe(data.conversations().length);
    // The workspace has real automation and broadcasts behind the KPIs.
    expect(snapshot.automation.sessions30d).toBeGreaterThan(0);
    expect(snapshot.automation.publishedForms).toBeGreaterThan(0);
    expect(snapshot.funnel.broadcasts).toBe(data.campaigns().length);
    expect(snapshot.funnel.audience).toBeGreaterThan(0);
    // Leaderboard rows are real, assigned agents only.
    expect(snapshot.agents.length).toBeGreaterThan(0);

    for (const agent of snapshot.agents) {
      expect(data.users().some((user) => user.id === agent.userId)).toBe(true);
      expect(agent.assigned).toBeGreaterThan(0);
      expect(agent.resolved).toBeLessThanOrEqual(agent.assigned);
      expect(agent.sharePct).toBeLessThanOrEqual(100);
    }
  });

  it('keeps the same numbers for the same window', () => {
    const first = data.reportSnapshot(30);
    const second = data.reportSnapshot(30);

    expect(second.messagesTotal).toBe(first.messagesTotal);
    expect(second.response.medianFirstResponseMin).toBe(first.response.medianFirstResponseMin);
    expect(second.funnel.read).toBe(first.funnel.read);
  });

  it('never reads past the seeded dataset', () => {
    const dataset = buildDataset(20261008);

    expect(dataset.messages.length).toBeGreaterThan(0);
    // Every seeded message belongs to a conversation that exists.
    const conversationIds = new Set(dataset.conversations.map((conversation) => conversation.id));

    expect(dataset.messages.every((message) => conversationIds.has(message.conversationId))).toBe(
      true,
    );
  });
});

