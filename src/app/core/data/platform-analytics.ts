import type {
  Campaign,
  Conversation,
  Invoice,
  Message,
  Tenant,
  WhatsAppFlowForm,
  WorkspaceUser,
} from './entities';
import { DATA_NOW } from '../../shared/format';
import { messageSeries, type ReportRange, type VolumePoint } from './analytics';

/**
 * Cross-tenant analytics for the platform console (`/analytics`).
 *
 * This is the platform owner's view: adoption and usage across every workspace,
 * kept separate from any single tenant's reporting. Like the client reports, it
 * invents nothing — every figure is derived from the seeded tenants, their
 * users, conversations, messages, campaigns, forms and invoices.
 *
 * There is deliberately no revenue projection here. `Plan.monthlyPriceInr` is
 * null because the PRD publishes no price list, so the billing figures are the
 * invoices that were actually issued, not a price multiplied by a seat count.
 */

const DAY = 86_400_000;

/** One plan tier's share of the estate. */
export interface TierSlice {
  tier: string;
  workspaces: number;
  active: number;
  suspended: number;
  seats: number;
  contacts: number;
  messages30d: number;
  /** Share of all workspaces, 0–100. */
  sharePct: number;
  /** Share of the window's messages, 0–100. */
  messageSharePct: number;
}

/** One step of the onboarding funnel. */
export interface ActivationStage {
  key: string;
  label: string;
  count: number;
  /** Share of the step before it, so the bars show drop-off. */
  pctOfPrevious: number;
}

/** How long one workspace took from signup to its first live conversation. */
export interface ActivationTime {
  tenantId: string;
  name: string;
  tier: string;
  industry: string;
  days: number | null;
}

/** One row of the leaderboard. */
export interface WorkspaceUsage {
  tenantId: string;
  name: string;
  subdomain: string;
  tier: string;
  status: Tenant['status'];
  seats: number;
  agentsOnline: number;
  contacts: number;
  messages30d: number;
  conversations: number;
  /** Percentage of the busiest workspace's traffic, for the bar behind the row. */
  sharePct: number;
}

export interface PlatformSnapshot {
  range: ReportRange;
  from: string;
  to: string;
  tenants: {
    total: number;
    active: number;
    suspended: number;
    /** Onboarding, awaiting WhatsApp, trial leads and archived. */
    other: number;
  };
  seats: number;
  agents: number;
  agentsOnline: number;
  contacts: number;
  messagesTotal: number;
  inboundTotal: number;
  outboundTotal: number;
  /** Conversations a human still has to answer. */
  openConversations: number;
  /** Conversations currently inside a flow. */
  inFlow: number;
  automationPct: number;
  billing: {
    collectedInr: number;
    outstandingInr: number;
    overdueInr: number;
    paid: number;
    open: number;
  };
  tiers: TierSlice[];
  activation: ActivationStage[];
  medianActivationDays: number | null;
  fastest: ActivationTime[];
  slowest: ActivationTime[];
  topWorkspaces: WorkspaceUsage[];
  industries: { industry: string; workspaces: number; sharePct: number }[];
  volume: VolumePoint[];
  peakLabel: string;
}

export interface PlatformSource {
  tenants: Tenant[];
  users: WorkspaceUser[];
  conversations: Conversation[];
  messages: Message[];
  campaigns: Campaign[];
  forms: WhatsAppFlowForm[];
  invoices: Invoice[];
}

function dayStart(stamp: number): number {
  const date = new Date(stamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

/** The earliest message timestamp per tenant — its first live conversation. */
export function firstConversationAt(
  conversations: Conversation[],
  messages: Message[],
): Map<string, string> {
  const tenantOf = new Map(conversations.map((conversation) => [conversation.id, conversation.tenantId]));
  const first = new Map<string, string>();

  for (const message of messages) {
    const tenantId = tenantOf.get(message.conversationId);

    if (!tenantId) continue;

    const current = first.get(tenantId);

    if (!current || message.sentAt < current) first.set(tenantId, message.sentAt);
  }

  return first;
}

/** Whole days between two ISO stamps, or null when either is missing. */
export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;

  const start = Date.parse(from);
  const end = Date.parse(to);

  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  return Math.max(0, Math.round((end - start) / DAY));
}

/** Adoption and usage per plan tier. */
export function tierSlices(
  tenants: Tenant[],
  messages30dByTenant: Map<string, number>,
): TierSlice[] {
  const totalMessages = [...messages30dByTenant.values()].reduce(
    (sum, count) => sum + count,
    0,
  );
  const tiers = new Map<string, TierSlice>();

  for (const tenant of tenants) {
    const slice =
      tiers.get(tenant.subscriptionTier) ??
      ({
        tier: tenant.subscriptionTier,
        workspaces: 0,
        active: 0,
        suspended: 0,
        seats: 0,
        contacts: 0,
        messages30d: 0,
        sharePct: 0,
        messageSharePct: 0,
      } as TierSlice);

    slice.workspaces += 1;
    slice.active += tenant.status === 'active' ? 1 : 0;
    slice.suspended += tenant.status === 'suspended' ? 1 : 0;
    slice.seats += tenant.seatsUsed;
    slice.contacts += tenant.contactCount;
    slice.messages30d += messages30dByTenant.get(tenant.id) ?? 0;
    tiers.set(tenant.subscriptionTier, slice);
  }

  return [...tiers.values()]
    .map((slice) => ({
      ...slice,
      sharePct: percent(slice.workspaces, tenants.length),
      messageSharePct: percent(slice.messages30d, totalMessages),
    }))
    .sort((a, b) => b.workspaces - a.workspaces || a.tier.localeCompare(b.tier));
}

/**
 * Signup → connected → first conversation → first broadcast → published form.
 *
 * A workspace counts at a step only if it took every step before it. Measuring
 * each step independently would let a later bar be wider than the one above it —
 * a workspace can hold a campaign without ever having connected WhatsApp — and a
 * "conversion rate" over 100% is not a funnel, it is a mistake. Cumulative
 * counting makes the bars nest, so every percentage is a real drop-off.
 */
export function activationFunnel(
  tenants: Tenant[],
  firstAt: Map<string, string>,
  campaigns: Campaign[],
  forms: WhatsAppFlowForm[],
): ActivationStage[] {
  const broadcastTenants = new Set(campaigns.map((campaign) => campaign.tenantId));
  const formTenants = new Set(
    forms.filter((form) => form.status === 'published').map((form) => form.tenantId),
  );
  const reached = tenants.map((tenant) => [
    true,
    tenant.connectedAt !== null,
    firstAt.has(tenant.id),
    broadcastTenants.has(tenant.id),
    formTenants.has(tenant.id),
  ]);
  const counts = reached[0]?.map((_, step) =>
    reached.filter((steps) => steps.slice(0, step + 1).every(Boolean)).length,
  ) ?? [0, 0, 0, 0, 0];
  const labels = [
    'Workspaces signed up',
    'WhatsApp connected',
    'First live conversation',
    'First broadcast sent',
    'Published a WhatsApp form',
  ];
  const keys = ['signup', 'connected', 'firstConversation', 'firstBroadcast', 'publishedForm'];

  return counts.map((count, index) => ({
    key: keys[index]!,
    label: labels[index]!,
    count,
    pctOfPrevious: index === 0 ? 100 : percent(count, counts[index - 1]!),
  }));
}

/** Invoices as issued: collected, outstanding and overdue. */
export function billingSummary(invoices: Invoice[]): PlatformSnapshot['billing'] {
  let collectedInr = 0;
  let outstandingInr = 0;
  let overdueInr = 0;
  let paid = 0;
  let open = 0;

  for (const invoice of invoices) {
    if (invoice.status === 'paid') {
      collectedInr += invoice.amountInr;
      paid += 1;
      continue;
    }

    outstandingInr += invoice.amountInr;
    open += 1;

    if (invoice.status === 'overdue') overdueInr += invoice.amountInr;
  }

  return { collectedInr, outstandingInr, overdueInr, paid, open };
}

/** Per-workspace usage, busiest first. */
export function workspaceUsage(
  tenants: Tenant[],
  counts: {
    messages30d: Map<string, number>;
    conversations: Map<string, number>;
    agentsOnline: Map<string, number>;
  },
): WorkspaceUsage[] {
  const rows = tenants.map((tenant) => ({
    tenantId: tenant.id,
    name: tenant.businessName,
    subdomain: tenant.subdomain,
    tier: tenant.subscriptionTier,
    status: tenant.status,
    seats: tenant.seatsUsed,
    agentsOnline: counts.agentsOnline.get(tenant.id) ?? 0,
    contacts: tenant.contactCount,
    messages30d: counts.messages30d.get(tenant.id) ?? 0,
    conversations: counts.conversations.get(tenant.id) ?? 0,
    sharePct: 0,
  }));
  const busiest = rows.reduce((max, row) => Math.max(max, row.messages30d), 0);

  return rows
    .map((row) => ({ ...row, sharePct: percent(row.messages30d, busiest) }))
    .sort(
      (a, b) =>
        b.messages30d - a.messages30d || b.conversations - a.conversations || a.name.localeCompare(b.name),
    );
}

/** Industries by workspace count. */
export function industrySlices(
  tenants: Tenant[],
): { industry: string; workspaces: number; sharePct: number }[] {
  const counts = new Map<string, number>();

  for (const tenant of tenants) {
    counts.set(tenant.industry, (counts.get(tenant.industry) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([industry, workspaces]) => ({
      industry,
      workspaces,
      sharePct: percent(workspaces, tenants.length),
    }))
    .sort((a, b) => b.workspaces - a.workspaces || a.industry.localeCompare(b.industry));
}

/**
 * The whole platform snapshot for one window. Message counts are bucketed twice:
 * once for the window the chart draws, once for the 30-day figures the tables
 * quote, because those are the numbers a workspace's own billing page shows.
 */
export function buildPlatformSnapshot(
  source: PlatformSource,
  range: ReportRange,
  now: number = DATA_NOW,
): PlatformSnapshot {
  const from = dayStart(now) - (range - 1) * DAY;
  const monthStart = dayStart(now) - 29 * DAY;
  const tenantOf = new Map(
    source.conversations.map((conversation) => [conversation.id, conversation.tenantId]),
  );
  const messages30d = new Map<string, number>();
  const windowMessages: Message[] = [];

  for (const message of source.messages) {
    const stamp = Date.parse(message.sentAt);

    if (Number.isNaN(stamp)) continue;

    const tenantId = tenantOf.get(message.conversationId);

    if (!tenantId) continue;

    if (stamp >= monthStart && stamp <= now) {
      messages30d.set(tenantId, (messages30d.get(tenantId) ?? 0) + 1);
    }

    if (stamp >= from && stamp <= now) windowMessages.push(message);
  }

  const conversationsByTenant = new Map<string, number>();
  const agentsOnline = new Map<string, number>();
  let openConversations = 0;
  let inFlow = 0;

  for (const conversation of source.conversations) {
    conversationsByTenant.set(
      conversation.tenantId,
      (conversationsByTenant.get(conversation.tenantId) ?? 0) + 1,
    );

    if (conversation.status === 'resolved') continue;

    openConversations += 1;

    if (conversation.status === 'flow') inFlow += 1;
  }

  for (const user of source.users) {
    if (!user.isOnline) continue;

    agentsOnline.set(user.tenantId, (agentsOnline.get(user.tenantId) ?? 0) + 1);
  }

  const firstAt = firstConversationAt(source.conversations, source.messages);
  const volume = messageSeries(windowMessages, range, now);
  const busiest = volume.reduce<VolumePoint | null>(
    (best, point) => (!best || point.total > best.total ? point : best),
    null,
  );
  const peak = busiest && busiest.total > 0 ? busiest : null;
  const activation: ActivationTime[] = source.tenants
    .map((tenant) => ({
      tenantId: tenant.id,
      name: tenant.businessName,
      tier: tenant.subscriptionTier,
      industry: tenant.industry,
      days: daysBetween(tenant.createdAt, firstAt.get(tenant.id) ?? null),
    }))
    .sort((a, b) => (a.days ?? Number.POSITIVE_INFINITY) - (b.days ?? Number.POSITIVE_INFINITY));
  const measured = activation.filter((entry) => entry.days !== null);
  const tiers = tierSlices(source.tenants, messages30d);

  return {
    range,
    from: volume[0]?.date ?? new Date(now).toISOString(),
    to: volume[volume.length - 1]?.date ?? new Date(now).toISOString(),
    tenants: {
      total: source.tenants.length,
      active: source.tenants.filter((tenant) => tenant.status === 'active').length,
      suspended: source.tenants.filter((tenant) => tenant.status === 'suspended').length,
      other: source.tenants.filter(
        (tenant) => tenant.status !== 'active' && tenant.status !== 'suspended',
      ).length,
    },
    seats: source.tenants.reduce((total, tenant) => total + tenant.seatsUsed, 0),
    agents: source.users.length,
    agentsOnline: source.users.filter((user) => user.isOnline).length,
    contacts: source.tenants.reduce((total, tenant) => total + tenant.contactCount, 0),
    messagesTotal: volume.reduce((total, point) => total + point.total, 0),
    inboundTotal: volume.reduce((total, point) => total + point.inbound, 0),
    outboundTotal: volume.reduce((total, point) => total + point.outbound, 0),
    openConversations,
    inFlow,
    automationPct: percent(inFlow, openConversations),
    billing: billingSummary(source.invoices),
    tiers,
    activation: activationFunnel(source.tenants, firstAt, source.campaigns, source.forms),
    medianActivationDays: median(measured.map((entry) => entry.days as number)),
    fastest: activation.slice(0, 3),
    slowest: [...activation].reverse().slice(0, 3),
    topWorkspaces: workspaceUsage(source.tenants, {
      messages30d,
      conversations: conversationsByTenant,
      agentsOnline,
    }),
    industries: industrySlices(source.tenants),
    volume,
    peakLabel: peak ? `${peak.label} · ${peak.total} messages` : 'No traffic in this window',
  };
}
