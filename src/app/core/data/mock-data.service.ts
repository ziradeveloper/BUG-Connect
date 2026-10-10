import { computed, inject, Injectable, signal } from '@angular/core';

import { WorkspaceContext } from '../workspace/workspace-context';
import { buildDataset, type Dataset } from './mock-data';
import type {
  BusinessProfile,
  Campaign,
  ChatFlow,
  Contact,
  ContactSegment,
  Conversation,
  Invoice,
  Message,
  MessageTemplate,
  MetaAppConfig,
  Plan,
  PlanLimits,
  PlatformStaffUser,
  QuickReply,
  SegmentRule,
  SubscriptionEvent,
  Team,
  Tenant,
  WebhookEvent,
  WorkspaceUser,
} from './entities';
import { SEED_META_CONFIG, SEED_PLANS } from './plan.seed';
import {
  payloadPreview,
  type MessagePayload,
  type MessageReaction,
  type WhatsAppMessageType,
} from './whatsapp';

export type Page<T> = { items: T[]; total: number };

/**
 * Everything the composer can stage. Mirrors one Cloud API request body: a
 * message object type plus that object's payload, so sending a sticker and
 * sending a template take the same code path.
 */
export interface OutboundDraft {
  type: WhatsAppMessageType;
  payload: MessagePayload;
  /** Internal notes are ours, never delivered to the contact. */
  whisper?: boolean;
  /** Id of the message being quoted, for contextual replies. */
  replyToMessageId?: string | null;
}

/**
 * In-memory stand-in for the .NET API. Everything goes through this service so
 * the real transport replaces one provider — pages never import the data source.
 *
 * Every method is async and artificially slow (120–260 ms) so loading and error
 * states are exercised instead of being added later.
 */
@Injectable({ providedIn: 'root' })
export class MockDataService {
  private readonly context = inject(WorkspaceContext);
  private readonly dataset = signal<Dataset>(buildDataset());

  /**
   * Platform commercial state, kept beside the dataset rather than inside it:
   * plans and the Meta app reference are edited rarely, read on every guard
   * check, and never belong to one tenant.
   */
  readonly plans = signal<Plan[]>(structuredClone(SEED_PLANS));
  readonly metaConfig = signal<MetaAppConfig>({ ...SEED_META_CONFIG });

  /** 120–260 ms, deterministic per call index so tests can fake timers. */
  private tick = 0;

  readonly tenants = computed(() => this.dataset().tenants);
  readonly allUsers = computed(() => this.dataset().workspaceUsers);

  /** The tenant matching the resolved subdomain, or null for platform/marketing. */
  readonly currentTenant = computed(() => {
    const slug = this.context.slug();
    if (!slug) {
      return null;
    }
    return this.dataset().tenants.find((tenant) => tenant.subdomain === slug) ?? null;
  });

  readonly tenantId = computed(() => this.currentTenant()?.id ?? this.dataset().tenants[0]!.id);

  readonly contacts = computed(() =>
    this.dataset().contacts.filter((contact) => contact.tenantId === this.tenantId()),
  );

  readonly conversations = computed(() =>
    this.dataset().conversations.filter((item) => item.tenantId === this.tenantId()),
  );

  readonly flows = computed(() =>
    this.dataset().flows.filter((flow) => flow.tenantId === this.tenantId()),
  );

  readonly templates = computed(() =>
    this.dataset().templates.filter((tpl) => tpl.tenantId === this.tenantId()),
  );

  readonly campaigns = computed(() =>
    this.dataset().campaigns.filter((campaign) => campaign.tenantId === this.tenantId()),
  );

  readonly users = computed(() =>
    this.dataset().workspaceUsers.filter((user) => user.tenantId === this.tenantId()),
  );

  readonly teams = computed(() =>
    this.dataset().teams.filter((team) => team.tenantId === this.tenantId()),
  );

  readonly quickReplies = computed(() =>
    this.dataset().quickReplies.filter((reply) => reply.tenantId === this.tenantId()),
  );

  readonly segments = computed(() =>
    this.dataset().segments.filter((segment) => segment.tenantId === this.tenantId()),
  );

  readonly businessProfile = computed(
    () => this.dataset().businessProfiles.find((profile) => profile.tenantId === this.tenantId()) ?? null,
  );

  readonly webhookEvents = computed(() => this.dataset().webhookEvents);

  /** Synchronous read used by the session service during login. */
  platformStaff(): PlatformStaffUser[] {
    return this.dataset().platformStaff;
  }

  readonly messagesFor = (conversationId: string): Message[] =>
    this.dataset().messages.filter((message) => message.conversationId === conversationId);

  async listTenants(): Promise<Page<Tenant>> {
    const items = await this.latency(this.dataset().tenants);
    return { items, total: items.length };
  }

  async listUsers(): Promise<Page<WorkspaceUser>> {
    const items = await this.latency(this.users());
    return { items, total: items.length };
  }

  async listPlatformStaff(): Promise<Page<PlatformStaffUser>> {
    const items = await this.latency(this.dataset().platformStaff);
    return { items, total: items.length };
  }

  async listContacts(): Promise<Page<Contact>> {
    const items = await this.latency(this.contacts());
    return { items, total: items.length };
  }

  async listConversations(): Promise<Page<Conversation>> {
    const items = await this.latency(this.conversations());
    return { items, total: items.length };
  }

  async listTemplates(): Promise<Page<MessageTemplate>> {
    const items = await this.latency(this.templates());
    return { items, total: items.length };
  }

  async listFlows(): Promise<Page<ChatFlow>> {
    const items = await this.latency(this.flows());
    return { items, total: items.length };
  }

  async listCampaigns(): Promise<Page<Campaign>> {
    const items = await this.latency(this.campaigns());
    return { items, total: items.length };
  }

  async listWebhookEvents(): Promise<Page<WebhookEvent>> {
    const items = await this.latency(this.dataset().webhookEvents);
    return { items, total: items.length };
  }

  async listSubscriptionEvents(): Promise<Page<SubscriptionEvent>> {
    const items = await this.latency(this.dataset().subscriptionEvents);
    return { items, total: items.length };
  }

  async listInvoices(): Promise<Page<Invoice>> {
    const items = await this.latency(this.dataset().invoices);
    return { items, total: items.length };
  }

  async listTeams(): Promise<Page<Team>> {
    const items = await this.latency(this.teams());
    return { items, total: items.length };
  }

  async listQuickReplies(): Promise<Page<QuickReply>> {
    const items = await this.latency(this.quickReplies());
    return { items, total: items.length };
  }

  async listSegments(): Promise<Page<ContactSegment>> {
    const items = await this.latency(this.segments());
    return { items, total: items.length };
  }

  async getBusinessProfile(): Promise<BusinessProfile | null> {
    await this.sleep(140);
    const profile = this.businessProfile();
    return profile ? structuredClone(profile) : null;
  }

  /** The contact detail page and the inbox customer panel share this lookup. */
  contactById(id: string | null | undefined): Contact | null {
    if (!id) {
      return null;
    }
    return this.contacts().find((contact) => contact.id === id) ?? null;
  }

  conversationsForContact(contactId: string): Conversation[] {
    return this.conversations()
      .filter((conversation) => conversation.contactId === contactId)
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }

  /** Platform reads across tenants, so these helpers skip the tenant scope. */
  tenantById(id: string | null | undefined): Tenant | null {
    if (!id) {
      return null;
    }
    return this.dataset().tenants.find((tenant) => tenant.id === id) ?? null;
  }

  usersForTenant(tenantId: string): WorkspaceUser[] {
    return this.dataset().workspaceUsers.filter((user) => user.tenantId === tenantId);
  }

  contactsForTenant(tenantId: string): Contact[] {
    return this.dataset().contacts.filter((contact) => contact.tenantId === tenantId);
  }

  webhookEventsForTenant(tenantId: string): WebhookEvent[] {
    return this.dataset().webhookEvents.filter((event) => event.tenantId === tenantId);
  }

  subscriptionEventsForTenant(tenantId: string): SubscriptionEvent[] {
    return this.dataset().subscriptionEvents.filter((event) => event.tenantId === tenantId);
  }

  invoicesForTenant(tenantId: string): Invoice[] {
    return this.dataset().invoices.filter((invoice) => invoice.tenantId === tenantId);
  }

  planForTier(tier: string): Plan | null {
    return this.plans().find((plan) => plan.tier === tier) ?? null;
  }

  /** Upsert by id; a new row is stamped into the current tenant. */
  async saveUser(
    user: Partial<WorkspaceUser> & { fullName: string; email: string },
  ): Promise<WorkspaceUser> {
    const dataset = this.dataset();
    const existingIndex = user.id
      ? dataset.workspaceUsers.findIndex((candidate) => candidate.id === user.id)
      : -1;

    const saved: WorkspaceUser =
      existingIndex >= 0
        ? { ...(dataset.workspaceUsers[existingIndex] as WorkspaceUser), ...user }
        : {
            id: `tenant-user-${Date.now().toString(36)}`,
            // An explicit tenant wins: the platform console provisions users
            // into workspaces it is not signed into (client onboarding).
            tenantId: user.tenantId ?? this.tenantId(),
            fullName: user.fullName,
            email: user.email,
            role: user.role ?? 'agent',
            roleId: user.roleId ?? 'role-agent',
            maxActiveChatCapacity: user.maxActiveChatCapacity ?? 5,
            activeChats: 0,
            isOnline: false,
            status: 'offline',
            department: user.department ?? 'Support desk',
            phone: user.phone ?? '',
            lastLoginAt: 'never',
            createdAt: new Date().toISOString(),
            invited: true,
          };

    const workspaceUsers = [...dataset.workspaceUsers];
    if (existingIndex >= 0) {
      workspaceUsers[existingIndex] = saved;
    } else {
      workspaceUsers.push(saved);
    }

    this.dataset.set({ ...dataset, workspaceUsers });
    await this.sleep(200);
    return saved;
  }

  async deleteUser(id: string): Promise<void> {
    const dataset = this.dataset();
    this.dataset.set({
      ...dataset,
      workspaceUsers: dataset.workspaceUsers.filter((user) => user.id !== id),
    });
    await this.sleep(160);
  }

  async setTenantStatus(tenantId: string, status: Tenant['status']): Promise<void> {
    const dataset = this.dataset();
    this.dataset.set({
      ...dataset,
      tenants: dataset.tenants.map((tenant) =>
        tenant.id === tenantId
          ? {
              ...tenant,
              status,
              isActive: status !== 'suspended' && status !== 'archived',
            }
          : tenant,
      ),
    });
    await this.sleep(180);
  }

  /** Provisions a tenant from the onboard wizard. Starts on trial, unconnected. */
  async saveTenant(input: {
    businessName: string;
    subdomain: string;
    industry: string;
    subscriptionTier: string;
    city?: string;
  }): Promise<Tenant> {
    const dataset = this.dataset();
    const now = new Date().toISOString();
    const tenant: Tenant = {
      id: `tenant-${Date.now().toString(36)}`,
      businessName: input.businessName.trim(),
      subdomain: input.subdomain.trim().toLowerCase(),
      metaWabaId: null,
      metaPhoneNumberId: null,
      phoneNumber: null,
      subscriptionTier: input.subscriptionTier,
      isActive: true,
      status: 'onboarding',
      industry: input.industry,
      city: input.city?.trim() || 'Tirunelveli',
      seatsUsed: 0,
      contactCount: 0,
      monthlyMessages: 0,
      createdAt: now,
      connectedAt: null,
    };

    const subscriptionEvents: SubscriptionEvent[] = [
      ...dataset.subscriptionEvents,
      {
        id: `${tenant.id}-sub-1`,
        tenantId: tenant.id,
        from: null,
        to: 'trial',
        reason: 'Workspace provisioned with a 14-day trial.',
        actor: 'platform',
        createdAt: now,
      },
    ];

    this.dataset.set({
      ...dataset,
      tenants: [...dataset.tenants, tenant],
      subscriptionEvents,
    });
    await this.sleep(220);
    return tenant;
  }

  /** Moves a tenant between tiers; the client sidebar re-gates immediately. */
  async changeTenantTier(tenantId: string, tier: string): Promise<void> {
    const dataset = this.dataset();
    this.dataset.set({
      ...dataset,
      tenants: dataset.tenants.map((tenant) =>
        tenant.id === tenantId ? { ...tenant, subscriptionTier: tier } : tenant,
      ),
    });
    await this.sleep(160);
  }

  /**
   * Completes the simulated Meta Embedded Signup: stamps the WABA ids the
   * callback carried and flips a pending workspace to active.
   */
  async connectWaba(
    tenantId: string,
    connection: { wabaId: string; phoneNumberId: string; phoneNumber: string },
  ): Promise<Tenant | null> {
    const dataset = this.dataset();
    const target = dataset.tenants.find((tenant) => tenant.id === tenantId);
    if (!target) {
      return null;
    }

    const now = new Date().toISOString();
    const activates = target.status === 'lead_trial' || target.status === 'onboarding' || target.status === 'whatsapp_pending';
    const updated: Tenant = {
      ...target,
      metaWabaId: connection.wabaId,
      metaPhoneNumberId: connection.phoneNumberId,
      phoneNumber: connection.phoneNumber,
      connectedAt: target.connectedAt ?? now,
      status: activates ? 'active' : target.status,
      isActive: true,
    };

    const subscriptionEvents = activates
      ? [
          ...dataset.subscriptionEvents,
          {
            id: `${tenantId}-sub-${dataset.subscriptionEvents.filter((event) => event.tenantId === tenantId).length + 1}`,
            tenantId,
            from: 'trial' as const,
            to: 'active' as const,
            reason: `Trial converted to the ${target.subscriptionTier} plan after WhatsApp connection.`,
            actor: 'workspace-admin',
            createdAt: now,
          },
        ]
      : dataset.subscriptionEvents;

    this.dataset.set({
      ...dataset,
      tenants: dataset.tenants.map((tenant) => (tenant.id === tenantId ? updated : tenant)),
      subscriptionEvents,
    });
    await this.sleep(200);
    return updated;
  }

  /** Replaces one tier's metered limits; modules are edited on the matrix. */
  async savePlanLimits(tier: string, limits: PlanLimits): Promise<void> {
    this.plans.update((plans) =>
      plans.map((plan) => (plan.tier === tier ? { ...plan, limits: { ...limits } } : plan)),
    );
    await this.sleep(160);
  }

  /** One checkbox of the feature matrix. Takes effect on the next read. */
  setPlanModule(tier: string, module: string, enabled: boolean): void {
    this.plans.update((plans) =>
      plans.map((plan) => {
        if (plan.tier !== tier) {
          return plan;
        }
        const modules = enabled
          ? [...new Set([...plan.modules, module])]
          : plan.modules.filter((entry) => entry !== module);
        return { ...plan, modules };
      }),
    );
  }

  async saveMetaConfig(patch: Partial<MetaAppConfig>, updatedBy: string): Promise<MetaAppConfig> {
    const updated: MetaAppConfig = {
      ...this.metaConfig(),
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    this.metaConfig.set(updated);
    await this.sleep(180);
    return updated;
  }

  /** Re-queues a failed webhook event after the operator acknowledges it. */
  async ackWebhookEvent(id: string): Promise<void> {
    const dataset = this.dataset();
    this.dataset.set({
      ...dataset,
      webhookEvents: dataset.webhookEvents.map((event) =>
        event.id === id ? { ...event, outcome: 'queued' as const, error: null } : event,
      ),
    });
    await this.sleep(120);
  }

  /** Aggregate numbers the client dashboard shows without a reports module. */
  readonly inboxStats = computed(() => {
    const conversations = this.conversations();
    const users = this.users();
    return {
      total: conversations.length,
      unassigned: conversations.filter((conversation) => !conversation.assignedUserId).length,
      open: conversations.filter((conversation) => conversation.status === 'open').length,
      inFlow: conversations.filter((conversation) => conversation.status === 'flow').length,
      pending: conversations.filter((conversation) => conversation.status === 'pending').length,
      resolved: conversations.filter((conversation) => conversation.status === 'resolved').length,
      onlineAgents: users.filter((user) => user.isOnline).length,
      spareCapacity: users.reduce(
        (total, user) => total + Math.max(0, user.maxActiveChatCapacity - user.activeChats),
        0,
      ),
    };
  });

  /** Convenience wrapper for plain text and internal notes. */
  async sendMessage(
    conversationId: string,
    content: string,
    isInternalWhisper = false,
    createdByUserId?: string,
  ): Promise<Message> {
    return this.sendOutbound(
      conversationId,
      { type: 'text', payload: { text: content }, whisper: isInternalWhisper },
      createdByUserId,
    );
  }

  /**
   * Sends any Cloud API message object. This is the only write path the
   * composer uses, so every type inherits the same optimistic delivery
   * lifecycle (sent → delivered → read) and conversation bump.
   */
  async sendOutbound(
    conversationId: string,
    draft: OutboundDraft,
    createdByUserId?: string,
  ): Promise<Message> {
    const dataset = this.dataset();
    const now = new Date().toISOString();
    const whisper = draft.whisper ?? false;

    const newMessage: Message = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      direction: 'outbound',
      type: whisper ? 'text' : draft.type,
      payload: draft.payload,
      content: whisper
        ? (draft.payload.text ?? '')
        : payloadPreview(draft.type, draft.payload, draft.payload.text ?? ''),
      mediaUrl: draft.payload.media?.url ?? draft.payload.media?.thumbnailUrl ?? null,
      deliveryStatus: whisper ? 'read' : 'sent',
      isInternalWhisper: whisper,
      createdByUserId: createdByUserId ?? null,
      sentAt: now,
      replyToMessageId: draft.replyToMessageId ?? null,
      reactions: [],
      waMessageId: whisper ? null : `wamid.outbound-${Date.now().toString(36)}`,
    };

    const messages = [...dataset.messages, newMessage];
    const conversations = dataset.conversations.map((conv) =>
      conv.id === conversationId
        ? {
            ...conv,
            lastMessageAt: now,
            // Replying to a customer clears the unread badge, like WhatsApp.
            unreadCount: 0,
            status: conv.status === 'resolved' ? ('resolved' as const) : ('open' as const),
          }
        : conv,
    );

    this.dataset.set({ ...dataset, messages, conversations });
    await this.sleep(120);

    if (!whisper) {
      this.advanceDelivery(newMessage.id);
    }

    return newMessage;
  }

  /** Adds or removes the agent's reaction on a message. */
  async toggleReaction(
    messageId: string,
    emoji: string,
    actor: { userId: string | null; displayName: string },
  ): Promise<void> {
    const dataset = this.dataset();
    const messages = dataset.messages.map((message) => {
      if (message.id !== messageId) {
        return message;
      }

      const reactions: MessageReaction[] = [...(message.reactions ?? [])];
      const existing = reactions.findIndex(
        (reaction) => reaction.emoji === emoji && reaction.userId === actor.userId,
      );

      if (existing >= 0) {
        reactions.splice(existing, 1);
      } else {
        reactions.push({ emoji, userId: actor.userId, displayName: actor.displayName });
      }

      return { ...message, reactions };
    });

    this.dataset.set({ ...dataset, messages });
  }

  /** Templates Meta has approved — the only ones the composer may send. */
  readonly sendableTemplates = computed(() =>
    this.templates().filter((template) => template.status === 'approved'),
  );

  /**
   * Simulates the Cloud API status webhook: `sent` → `delivered` → `read`.
   * Fire-and-forget so the send itself resolves immediately.
   */
  private advanceDelivery(messageId: string): void {
    const steps: { after: number; status: Message['deliveryStatus'] }[] = [
      { after: 900, status: 'delivered' },
      { after: 2400, status: 'read' },
    ];

    for (const step of steps) {
      setTimeout(() => {
        const dataset = this.dataset();
        const target = dataset.messages.find((message) => message.id === messageId);
        if (!target || target.deliveryStatus === 'failed') {
          return;
        }

        this.dataset.set({
          ...dataset,
          messages: dataset.messages.map((message) =>
            message.id === messageId ? { ...message, deliveryStatus: step.status } : message,
          ),
        });
      }, step.after);
    }
  }

  async updateConversationStatus(
    conversationId: string,
    status: Conversation['status'],
  ): Promise<void> {
    const dataset = this.dataset();
    const target = dataset.conversations.find((c) => c.id === conversationId);
    if (!target) return;

    const oldStatus = target.status;
    const conversations = dataset.conversations.map((conv) =>
      conv.id === conversationId ? { ...conv, status } : conv,
    );

    let workspaceUsers = dataset.workspaceUsers;
    if (target.assignedUserId && oldStatus !== 'resolved' && status === 'resolved') {
      workspaceUsers = workspaceUsers.map((user) =>
        user.id === target.assignedUserId
          ? { ...user, activeChats: Math.max(0, user.activeChats - 1) }
          : user,
      );
    } else if (target.assignedUserId && oldStatus === 'resolved' && status !== 'resolved') {
      workspaceUsers = workspaceUsers.map((user) =>
        user.id === target.assignedUserId ? { ...user, activeChats: user.activeChats + 1 } : user,
      );
    }

    this.dataset.set({ ...dataset, conversations, workspaceUsers });
    await this.sleep(140);
  }

  /** Opening a conversation in the thread clears its unread badge. */
  async markRead(conversationId: string): Promise<void> {
    const dataset = this.dataset();
    const target = dataset.conversations.find((conv) => conv.id === conversationId);

    if (!target || target.unreadCount === 0) {
      return;
    }

    this.dataset.set({
      ...dataset,
      conversations: dataset.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv,
      ),
    });
  }

  async updateConversationPriority(
    conversationId: string,
    priority: Conversation['priority'],
  ): Promise<void> {
    const dataset = this.dataset();
    this.dataset.set({
      ...dataset,
      conversations: dataset.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, priority } : conv,
      ),
    });
    await this.sleep(80);
  }

  async reassignConversation(
    conversationId: string,
    assignedUserId: string | null,
  ): Promise<void> {
    const dataset = this.dataset();
    const target = dataset.conversations.find((c) => c.id === conversationId);
    if (!target) return;

    const prevUserId = target.assignedUserId;
    const conversations = dataset.conversations.map((conv) =>
      conv.id === conversationId
        ? {
            ...conv,
            assignedUserId,
            status: assignedUserId ? (conv.status === 'resolved' ? 'open' : conv.status) : 'open',
          }
        : conv,
    );

    let workspaceUsers = dataset.workspaceUsers;
    if (prevUserId) {
      workspaceUsers = workspaceUsers.map((user) =>
        user.id === prevUserId
          ? { ...user, activeChats: Math.max(0, user.activeChats - 1) }
          : user,
      );
    }
    if (assignedUserId) {
      workspaceUsers = workspaceUsers.map((user) =>
        user.id === assignedUserId ? { ...user, activeChats: user.activeChats + 1 } : user,
      );
    }

    this.dataset.set({ ...dataset, conversations, workspaceUsers });
    await this.sleep(150);
  }

  async simulateInboundMessage(summary?: string): Promise<{ conversation: Conversation; message: Message }> {
    const dataset = this.dataset();
    const tenantId = this.tenantId();
    const now = new Date().toISOString();

    // Weighted Agent Router: find online agents under capacity with lowest current active load
    const onlineAgents = dataset.workspaceUsers
      .filter((user) => user.tenantId === tenantId && user.isOnline && user.activeChats < user.maxActiveChatCapacity)
      .sort((a, b) => a.activeChats - b.activeChats);

    const assignedUser = onlineAgents[0] ?? null;
    const contact = dataset.contacts.find((c) => c.tenantId === tenantId) ?? dataset.contacts[0]!;

    const convId = `conv-sim-${Date.now().toString(36)}`;
    const newConv: Conversation = {
      id: convId,
      tenantId,
      contactId: contact.id,
      channel: 'whatsapp',
      status: 'open',
      currentActiveFlowId: null,
      currentActiveNodeId: null,
      assignedUserId: assignedUser?.id ?? null,
      lastMessageAt: now,
      unreadCount: 1,
      subject: summary ?? 'Inbound customer inquiry via WhatsApp',
      priority: 'normal',
      tags: ['Inbound', 'WhatsApp'],
    };

    const inboundText = summary ?? 'Hello! I need assistance with my WhatsApp order.';
    const newMsg: Message = {
      id: `msg-sim-${Date.now().toString(36)}`,
      conversationId: convId,
      direction: 'inbound',
      type: 'text',
      payload: { text: inboundText },
      content: inboundText,
      mediaUrl: null,
      deliveryStatus: 'read',
      isInternalWhisper: false,
      createdByUserId: null,
      sentAt: now,
      replyToMessageId: null,
      reactions: [],
      waMessageId: `wamid.inbound-${Date.now().toString(36)}`,
    };

    const conversations = [newConv, ...dataset.conversations];
    const messages = [...dataset.messages, newMsg];
    let workspaceUsers = dataset.workspaceUsers;

    if (assignedUser) {
      workspaceUsers = workspaceUsers.map((user) =>
        user.id === assignedUser.id ? { ...user, activeChats: user.activeChats + 1 } : user,
      );
    }

    this.dataset.set({ ...dataset, conversations, messages, workspaceUsers });
    await this.sleep(180);
    return { conversation: newConv, message: newMsg };
  }

  // ── Wave 3: workspace operations ────────────────────────────────

  /**
   * Evaluates segment rules against the tenant's contacts. Empty rules match
   * everything under `all` (every vacuous truth) and nothing under `any`.
   */
  evaluateSegment(match: ContactSegment['match'], rules: SegmentRule[]): Contact[] {
    const contacts = this.contacts();
    if (rules.length === 0) {
      return match === 'all' ? [...contacts] : [];
    }

    const test = (contact: Contact, rule: SegmentRule): boolean => {
      const value = rule.value.trim().toLowerCase();
      switch (rule.field) {
        case 'tag': {
          const has = contact.tags.some((tag) => tag.toLowerCase() === value);
          return rule.operator === 'lacks' ? !has : has;
        }
        case 'optIn':
          return rule.value === 'opted-out' ? !contact.optInStatus : contact.optInStatus;
        case 'conversations': {
          const count = Number(rule.value);
          if (Number.isNaN(count)) {
            return false;
          }
          return rule.operator === 'fewerThan'
            ? contact.conversationCount < count
            : contact.conversationCount > count;
        }
        case 'name':
          return contact.displayName.toLowerCase().includes(value);
        case 'inactiveDays': {
          const days = Number(rule.value);
          if (Number.isNaN(days)) {
            return false;
          }
          const ageDays = (Date.now() - new Date(contact.lastSeenAt).getTime()) / 86_400_000;
          return rule.operator === 'fewerThan' ? ageDays < days : ageDays > days;
        }
      }
    };

    return contacts.filter((contact) =>
      match === 'all' ? rules.every((rule) => test(contact, rule)) : rules.some((rule) => test(contact, rule)),
    );
  }

  async updateContact(
    id: string,
    patch: Partial<Pick<Contact, 'displayName' | 'tags' | 'optInStatus' | 'customAttributes'>>,
  ): Promise<Contact | null> {
    const dataset = this.dataset();
    const existing = dataset.contacts.find((contact) => contact.id === id) ?? null;
    if (!existing) {
      return null;
    }

    const saved: Contact = { ...existing, ...patch };
    this.dataset.set({
      ...dataset,
      contacts: dataset.contacts.map((contact) => (contact.id === id ? saved : contact)),
    });
    await this.sleep(160);
    return saved;
  }

  async saveTeam(team: Partial<Team> & { name: string }): Promise<Team> {
    const dataset = this.dataset();
    const now = new Date().toISOString();
    const existing = team.id ? (dataset.teams.find((candidate) => candidate.id === team.id) ?? null) : null;

    const saved: Team = existing
      ? { ...existing, ...team, updatedAt: now }
      : {
          id: `team-${Date.now().toString(36)}`,
          tenantId: this.tenantId(),
          name: team.name,
          description: team.description ?? '',
          memberUserIds: team.memberUserIds ?? [],
          weight: team.weight ?? 1,
          isDefault: team.isDefault ?? dataset.teams.every((candidate) => candidate.tenantId !== this.tenantId()),
          icon: team.icon ?? '◭',
          updatedAt: now,
        };

    // Exactly one default per tenant: promoting a team demotes the previous one.
    this.dataset.set({
      ...dataset,
      teams: dataset.teams.some((candidate) => candidate.id === saved.id)
        ? dataset.teams.map((candidate) =>
            candidate.tenantId === saved.tenantId && candidate.id !== saved.id && saved.isDefault
              ? { ...candidate, isDefault: false }
              : candidate.id === saved.id
                ? saved
                : candidate,
          )
        : [
            ...dataset.teams.map((candidate) =>
              candidate.tenantId === saved.tenantId && saved.isDefault
                ? { ...candidate, isDefault: false }
                : candidate,
            ),
            saved,
          ],
    });
    await this.sleep(180);
    return saved;
  }

  async deleteTeam(id: string): Promise<void> {
    const dataset = this.dataset();
    const target = dataset.teams.find((team) => team.id === id);
    this.dataset.set({
      ...dataset,
      teams: dataset.teams.filter((team) => team.id !== id).map((team, index, rest) =>
        // Deleting the default promotes the oldest surviving team of the tenant.
        target?.isDefault && team.tenantId === target.tenantId && index === rest.findIndex((t) => t.tenantId === target.tenantId)
          ? { ...team, isDefault: true }
          : team,
      ),
    });
    await this.sleep(160);
  }

  async saveQuickReply(reply: Partial<QuickReply> & { trigger: string; body: string }): Promise<QuickReply> {
    const dataset = this.dataset();
    const now = new Date().toISOString();
    const existing = reply.id
      ? (dataset.quickReplies.find((candidate) => candidate.id === reply.id) ?? null)
      : null;

    const saved: QuickReply = existing
      ? { ...existing, ...reply, updatedAt: now }
      : {
          id: `qr-${Date.now().toString(36)}`,
          tenantId: this.tenantId(),
          trigger: reply.trigger,
          title: reply.title ?? reply.trigger.replace(/^\//, ''),
          body: reply.body,
          usageCount: 0,
          updatedAt: now,
        };

    const quickReplies = existing
      ? dataset.quickReplies.map((candidate) => (candidate.id === saved.id ? saved : candidate))
      : [...dataset.quickReplies, saved];

    this.dataset.set({ ...dataset, quickReplies });
    await this.sleep(160);
    return saved;
  }

  async deleteQuickReply(id: string): Promise<void> {
    const dataset = this.dataset();
    this.dataset.set({
      ...dataset,
      quickReplies: dataset.quickReplies.filter((reply) => reply.id !== id),
    });
    await this.sleep(160);
  }

  async saveSegment(segment: Partial<ContactSegment> & { name: string }): Promise<ContactSegment> {
    const dataset = this.dataset();
    const now = new Date().toISOString();
    const existing = segment.id
      ? (dataset.segments.find((candidate) => candidate.id === segment.id) ?? null)
      : null;

    const saved: ContactSegment = existing
      ? { ...existing, ...segment, updatedAt: now }
      : {
          id: `seg-${Date.now().toString(36)}`,
          tenantId: this.tenantId(),
          name: segment.name,
          description: segment.description ?? '',
          match: segment.match ?? 'all',
          rules: segment.rules ?? [],
          createdAt: now,
          updatedAt: now,
        };

    const segments = existing
      ? dataset.segments.map((candidate) => (candidate.id === saved.id ? saved : candidate))
      : [...dataset.segments, saved];

    this.dataset.set({ ...dataset, segments });
    await this.sleep(180);
    return saved;
  }

  async deleteSegment(id: string): Promise<void> {
    const dataset = this.dataset();
    this.dataset.set({
      ...dataset,
      segments: dataset.segments.filter((segment) => segment.id !== id),
    });
    await this.sleep(160);
  }

  async saveBusinessProfile(patch: Partial<BusinessProfile>): Promise<BusinessProfile | null> {
    const dataset = this.dataset();
    const existing =
      dataset.businessProfiles.find((profile) => profile.tenantId === this.tenantId()) ?? null;
    if (!existing) {
      return null;
    }

    const saved: BusinessProfile = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.dataset.set({
      ...dataset,
      businessProfiles: dataset.businessProfiles.map((profile) =>
        profile.tenantId === saved.tenantId ? saved : profile,
      ),
    });
    await this.sleep(180);
    return saved;
  }

  async saveTemplate(
    template: Partial<MessageTemplate> & { name: string; body: string },
  ): Promise<MessageTemplate> {
    const dataset = this.dataset();
    const now = new Date().toISOString();
    const existing = template.id
      ? (dataset.templates.find((candidate) => candidate.id === template.id) ?? null)
      : null;

    const body = template.body ?? existing?.body ?? '';
    const variables = new Set(body.match(/\{\{\d+\}\}/g) ?? []).size;

    const saved: MessageTemplate = existing
      ? { ...existing, ...template, body, variables, updatedAt: now }
      : {
          id: `tpl-${Date.now().toString(36)}`,
          tenantId: this.tenantId(),
          name: template.name,
          category: template.category ?? 'UTILITY',
          language: template.language ?? 'en',
          status: 'draft',
          body,
          variables,
          header: template.header ?? null,
          footer: template.footer ?? null,
          buttons: template.buttons ?? [],
          variableLabels: template.variableLabels ?? [],
          updatedAt: now,
          submittedAt: null,
        };

    const templates = existing
      ? dataset.templates.map((candidate) => (candidate.id === saved.id ? saved : candidate))
      : [...dataset.templates, saved];

    this.dataset.set({ ...dataset, templates });
    await this.sleep(180);
    return saved;
  }

  /** Draft → pending, the way the Meta submission would leave it. */
  async submitTemplate(id: string): Promise<MessageTemplate | null> {
    const dataset = this.dataset();
    const existing = dataset.templates.find((template) => template.id === id) ?? null;
    if (!existing || existing.status !== 'draft') {
      return null;
    }

    const saved: MessageTemplate = {
      ...existing,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.dataset.set({
      ...dataset,
      templates: dataset.templates.map((template) => (template.id === id ? saved : template)),
    });
    await this.sleep(200);
    return saved;
  }

  private async latency<T>(items: T[]): Promise<T[]> {
    await this.sleep(140);
    return [...items];
  }

  private sleep(baseMs: number): Promise<void> {
    this.tick += 1;
    const ms = baseMs + (this.tick % 7) * 20;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
