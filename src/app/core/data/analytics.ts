import { DATA_NOW } from '../../shared/format';

import type {
  Campaign,
  ChatFlow,
  Conversation,
  Message,
  WhatsAppFlowForm,
  WorkspaceUser,
} from './entities';

/**
 * The reporting maths behind Analytics & Insights (`/reports`, wave 6).
 *
 * Every number here is derived from the seeded collections — conversations and
 * their messages, chat flows, WhatsApp forms, campaigns — so the page has no
 * invented figures and no charting dependency. The charts are drawn from these
 * arrays with plain SVG and CSS.
 *
 * The whole module is pure: no service, no signals, no clock of its own. `now`
 * defaults to the dataset's fixed instant so a report renders identically in
 * SSR, in a browser and in a test.
 */

export const REPORT_RANGES = [7, 30, 90] as const;

export type ReportRange = (typeof REPORT_RANGES)[number];

const DAY = 86_400_000;

/** The first-response promise the team is measured against, in minutes. */
export const FIRST_RESPONSE_TARGET_MIN = 15;

/** One UTC day of traffic, oldest first in a series. */
export interface VolumePoint {
  /** ISO string of the day's UTC midnight — a stable `trackBy` key. */
  date: string;
  label: string;
  inbound: number;
  outbound: number;
  total: number;
}

/** How quickly the team picks up, measured from real message timestamps. */
export interface ResponseStats {
  /** Conversations counted in the window. */
  counted: number;
  resolvedCount: number;
  resolvedPct: number;
  /** Conversations no agent has claimed yet. */
  unassigned: number;
  unassignedPct: number;
  /** Minutes from the contact's first message to the first agent reply. */
  medianFirstResponseMin: number | null;
  avgFirstResponseMin: number | null;
  /** First replies that landed inside the target. */
  withinTargetPct: number | null;
  /** Minutes from the contact's first message to the last agent reply on a resolved thread. */
  avgResolutionMin: number | null;
  /** Threads that needed a human at all. */
  humanHandledPct: number;
}

/** One row of the agent leaderboard. */
export interface AgentScore {
  userId: string;
  name: string;
  role: string;
  online: boolean;
  assigned: number;
  resolved: number;
  resolvedPct: number;
  avgFirstResponseMin: number | null;
  /** Share of the window's conversations, 0–100, for the bar behind the row. */
  sharePct: number;
}

/** Automation performance: chat flows plus the native WhatsApp forms. */
export interface AutomationStats {
  activeFlows: number;
  sessions30d: number;
  /** Session-weighted handoff rate, 0–100. */
  handoffPct: number;
  containedPct: number;
  /** Sessions the bots resolved without a human. */
  containedSessions: number;
  publishedForms: number;
  submissions30d: number;
  /** Submission-weighted completion rate, 0–100. */
  completionPct: number;
  flows: { id: string; name: string; sessions30d: number; handoffPct: number }[];
  forms: { id: string; name: string; submissions30d: number; completionPct: number }[];
}

/** Broadcast delivery, summed across the workspace's campaigns. */
export interface CampaignFunnel {
  stages: { key: string; label: string; value: number; pctOfAudience: number }[];
  audience: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  optOuts: number;
  deliveryPct: number;
  readPct: number;
  replyPct: number;
  broadcasts: number;
  live: number;
}

/** Everything the reports page draws, for one window. */
export interface ReportSnapshot {
  range: ReportRange;
  /** UTC midnight of the first day in the window. */
  from: string;
  to: string;
  volume: VolumePoint[];
  peak: VolumePoint | null;
  peakLabel: string;
  messagesTotal: number;
  inboundTotal: number;
  outboundTotal: number;
  /** Outbound replies for every inbound message, as a percentage. */
  replyRatioPct: number;
  response: ResponseStats;
  agents: AgentScore[];
  automation: AutomationStats;
  funnel: CampaignFunnel;
}

export interface ReportSource {
  conversations: Conversation[];
  messages: Message[];
  users: WorkspaceUser[];
  flows: ChatFlow[];
  forms: WhatsAppFlowForm[];
  campaigns: Campaign[];
}

function dayStart(stamp: number): number {
  const date = new Date(stamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayLabelFor(stamp: number): string {
  return new Date(stamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

function average(values: number[]): number | null {
  if (!values.length) return null;

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Per-thread timings. A thread only contributes a first-response figure when the
 * contact spoke first and an agent answered; a resolution figure when the thread
 * is resolved as well. Whispers never count as a reply.
 */
function timingsFor(
  thread: Message[],
  status: Conversation['status'],
): { firstResponseMin: number | null; resolutionMin: number | null } {
  const ordered = [...thread].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const firstInbound = ordered.find((message) => message.direction === 'inbound');

  if (!firstInbound) return { firstResponseMin: null, resolutionMin: null };

  const openedAt = Date.parse(firstInbound.sentAt);
  const replies = ordered.filter(
    (message) =>
      message.direction === 'outbound' &&
      !message.isInternalWhisper &&
      Date.parse(message.sentAt) >= openedAt,
  );
  const firstReply = replies[0];

  if (!firstReply) return { firstResponseMin: null, resolutionMin: null };

  const firstResponseMin = Math.max(
    0,
    Math.round((Date.parse(firstReply.sentAt) - openedAt) / 60_000),
  );

  if (status !== 'resolved') return { firstResponseMin, resolutionMin: null };

  const lastReply = replies[replies.length - 1]!;

  return {
    firstResponseMin,
    resolutionMin: Math.max(
      firstResponseMin,
      Math.round((Date.parse(lastReply.sentAt) - openedAt) / 60_000),
    ),
  };
}

/** Daily inbound/outbound counts for the window, oldest day first. */
export function messageSeries(
  messages: Message[],
  range: ReportRange,
  now: number = DATA_NOW,
): VolumePoint[] {
  const last = dayStart(now);
  const first = last - (range - 1) * DAY;
  const points: VolumePoint[] = Array.from({ length: range }, (_, index) => {
    const stamp = first + index * DAY;

    return {
      date: new Date(stamp).toISOString(),
      label: dayLabelFor(stamp),
      inbound: 0,
      outbound: 0,
      total: 0,
    };
  });

  for (const message of messages) {
    const stamp = Date.parse(message.sentAt);

    if (Number.isNaN(stamp) || stamp < first || stamp > now) continue;

    const bucket = points[Math.floor((dayStart(stamp) - first) / DAY)];

    if (!bucket) continue;

    if (message.direction === 'inbound') bucket.inbound += 1;
    else if (!message.isInternalWhisper) bucket.outbound += 1;

    bucket.total = bucket.inbound + bucket.outbound;
  }

  return points;
}

/** Pick-up and resolution figures for the window. */
export function responseStats(
  conversations: Conversation[],
  messagesByConversation: Map<string, Message[]>,
  range: ReportRange,
  now: number = DATA_NOW,
): ResponseStats {
  const from = dayStart(now) - (range - 1) * DAY;
  const inWindow = conversations.filter((conversation) => {
    const stamp = Date.parse(conversation.lastMessageAt);

    return !Number.isNaN(stamp) && stamp >= from && stamp <= now;
  });
  const firstResponses: number[] = [];
  const resolutions: number[] = [];
  let humanHandled = 0;

  for (const conversation of inWindow) {
    const timings = timingsFor(messagesByConversation.get(conversation.id) ?? [], conversation.status);

    if (timings.firstResponseMin !== null) {
      firstResponses.push(timings.firstResponseMin);
      humanHandled += 1;
    }

    if (timings.resolutionMin !== null) resolutions.push(timings.resolutionMin);
  }

  const counted = inWindow.length;
  const resolvedCount = inWindow.filter(
    (conversation) => conversation.status === 'resolved',
  ).length;
  const unassigned = inWindow.filter((conversation) => !conversation.assignedUserId).length;
  const withinTarget = firstResponses.filter((value) => value <= FIRST_RESPONSE_TARGET_MIN).length;

  return {
    counted,
    resolvedCount,
    resolvedPct: percent(resolvedCount, counted),
    unassigned,
    unassignedPct: percent(unassigned, counted),
    medianFirstResponseMin: median(firstResponses),
    avgFirstResponseMin: average(firstResponses),
    withinTargetPct: firstResponses.length ? percent(withinTarget, firstResponses.length) : null,
    avgResolutionMin: average(resolutions),
    humanHandledPct: percent(humanHandled, counted),
  };
}

/** Per-agent workload and responsiveness for the window. */
export function agentScores(
  conversations: Conversation[],
  messagesByConversation: Map<string, Message[]>,
  users: WorkspaceUser[],
  range: ReportRange,
  now: number = DATA_NOW,
): AgentScore[] {
  const from = dayStart(now) - (range - 1) * DAY;
  const inWindow = conversations.filter((conversation) => {
    const stamp = Date.parse(conversation.lastMessageAt);

    return !Number.isNaN(stamp) && stamp >= from && stamp <= now;
  });
  const busiest = inWindow.length;
  const byAgent = new Map<
    string,
    { assigned: number; resolved: number; responses: number[] }
  >();

  for (const conversation of inWindow) {
    if (!conversation.assignedUserId) continue;

    const entry =
      byAgent.get(conversation.assignedUserId) ?? { assigned: 0, resolved: 0, responses: [] };

    entry.assigned += 1;

    if (conversation.status === 'resolved') entry.resolved += 1;

    const timings = timingsFor(
      messagesByConversation.get(conversation.id) ?? [],
      conversation.status,
    );

    if (timings.firstResponseMin !== null) entry.responses.push(timings.firstResponseMin);
    byAgent.set(conversation.assignedUserId, entry);
  }

  const scores: AgentScore[] = [];

  for (const user of users) {
    const entry = byAgent.get(user.id);

    if (!entry || entry.assigned === 0) continue;

    scores.push({
      userId: user.id,
      name: user.fullName,
      role: user.role,
      online: user.isOnline,
      assigned: entry.assigned,
      resolved: entry.resolved,
      resolvedPct: percent(entry.resolved, entry.assigned),
      avgFirstResponseMin: average(entry.responses),
      sharePct: percent(entry.assigned, busiest),
    });
  }

  return scores.sort(
    (a, b) =>
      b.assigned - a.assigned ||
      b.resolved - a.resolved ||
      (a.avgFirstResponseMin ?? Infinity) - (b.avgFirstResponseMin ?? Infinity),
  );
}

/** Flow containment and WhatsApp form completion, weighted by real volume. */
export function automationStats(flows: ChatFlow[], forms: WhatsAppFlowForm[]): AutomationStats {
  const sessions30d = flows.reduce((total, flow) => total + flow.sessions30d, 0);
  const weightedHandoff = flows.reduce(
    (total, flow) => total + flow.handoffRate * flow.sessions30d,
    0,
  );
  const submissions30d = forms.reduce((total, form) => total + form.submissions30d, 0);
  const weightedCompletion = forms.reduce(
    (total, form) => total + form.completionRate * form.submissions30d,
    0,
  );
  const handoffPct = sessions30d > 0 ? Math.round(weightedHandoff / sessions30d) : 0;

  return {
    activeFlows: flows.filter((flow) => flow.isActive).length,
    sessions30d,
    handoffPct,
    containedPct: 100 - handoffPct,
    containedSessions: Math.round((sessions30d * (100 - handoffPct)) / 100),
    publishedForms: forms.filter((form) => form.status === 'published').length,
    submissions30d,
    completionPct: submissions30d > 0 ? Math.round(weightedCompletion / submissions30d) : 0,
    flows: [...flows]
      .sort((a, b) => b.sessions30d - a.sessions30d)
      .map((flow) => ({
        id: flow.id,
        name: flow.name,
        sessions30d: flow.sessions30d,
        handoffPct: flow.handoffRate,
      })),
    forms: [...forms]
      .filter((form) => form.submissions30d > 0)
      .sort((a, b) => b.submissions30d - a.submissions30d)
      .map((form) => ({
        id: form.id,
        name: form.name,
        submissions30d: form.submissions30d,
        completionPct: form.completionRate,
      })),
  };
}

/** Broadcast delivery funnel, summed over the workspace's campaigns. */
export function campaignFunnel(campaigns: Campaign[]): CampaignFunnel {
  const sum = (pick: (campaign: Campaign) => number) =>
    campaigns.reduce((total, campaign) => total + pick(campaign), 0);
  const audience = sum((campaign) => campaign.audienceSize);
  const sent = sum((campaign) => campaign.sent);
  const delivered = sum((campaign) => campaign.delivered);
  const read = sum((campaign) => campaign.read);
  const replied = sum((campaign) => campaign.replied);
  const failed = sum((campaign) => campaign.failed);
  const optOuts = sum((campaign) => campaign.optOuts);

  return {
    stages: [
      { key: 'audience', label: 'Matched contacts', value: audience, pctOfAudience: 100 },
      { key: 'sent', label: 'Sent to Meta', value: sent, pctOfAudience: percent(sent, audience) },
      {
        key: 'delivered',
        label: 'Delivered',
        value: delivered,
        pctOfAudience: percent(delivered, audience),
      },
      { key: 'read', label: 'Read', value: read, pctOfAudience: percent(read, audience) },
      { key: 'replied', label: 'Replied', value: replied, pctOfAudience: percent(replied, audience) },
    ],
    audience,
    sent,
    delivered,
    read,
    replied,
    failed,
    optOuts,
    deliveryPct: percent(delivered, sent),
    readPct: percent(read, delivered),
    replyPct: percent(replied, read),
    broadcasts: campaigns.length,
    live: campaigns.filter(
      (campaign) => campaign.status === 'sending' || campaign.status === 'scheduled',
    ).length,
  };
}

/**
 * The whole report for one window. Grouping messages by conversation once keeps
 * the per-thread timings a single pass rather than a nested search.
 */
export function buildReportSnapshot(
  source: ReportSource,
  range: ReportRange,
  now: number = DATA_NOW,
): ReportSnapshot {
  const messagesByConversation = new Map<string, Message[]>();

  for (const message of source.messages) {
    const thread = messagesByConversation.get(message.conversationId) ?? [];

    thread.push(message);
    messagesByConversation.set(message.conversationId, thread);
  }

  const volume = messageSeries(source.messages, range, now);
  const busiest = volume.reduce<VolumePoint | null>(
    (best, point) => (!best || point.total > best.total ? point : best),
    null,
  );
  // An empty window has no peak day at all, rather than a zero-valued one.
  const peak = busiest && busiest.total > 0 ? busiest : null;
  const inboundTotal = volume.reduce((total, point) => total + point.inbound, 0);
  const outboundTotal = volume.reduce((total, point) => total + point.outbound, 0);

  return {
    range,
    from: volume[0]?.date ?? new Date(now).toISOString(),
    to: volume[volume.length - 1]?.date ?? new Date(now).toISOString(),
    volume,
    peak,
    peakLabel: peak && peak.total > 0 ? `${peak.label} · ${peak.total} messages` : 'No traffic yet',
    messagesTotal: inboundTotal + outboundTotal,
    inboundTotal,
    outboundTotal,
    replyRatioPct: percent(outboundTotal, inboundTotal),
    response: responseStats(source.conversations, messagesByConversation, range, now),
    agents: agentScores(source.conversations, messagesByConversation, source.users, range, now),
    automation: automationStats(source.flows, source.forms),
    funnel: campaignFunnel(source.campaigns),
  };
}
