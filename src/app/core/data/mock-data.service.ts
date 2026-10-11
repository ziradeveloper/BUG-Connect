import { computed, inject, Injectable, signal } from '@angular/core';

import { WorkspaceContext } from '../workspace/workspace-context';
import { buildDataset, type Dataset } from './mock-data';
import type {
  AuditArea,
  AuditEvent,
  AuditLevel,
  BusinessProfile,
  Campaign,
  ChatFlow,
  Contact,
  ContactSegment,
  Conversation,
  FlowGraph,
  FlowNode,
  FlowVersion,
  InviteToken,
  Invoice,
  Message,
  MessageTemplate,
  MetaAppConfig,
  PasswordResetToken,
  Plan,
  PlanLimits,
  PlatformSettings,
  PlatformStaffUser,
  QuickReply,
  SegmentRule,
  SubscriptionEvent,
  SubscriptionState,
  Team,
  Tenant,
  WebhookEvent,
  WorkspaceUser,
} from './entities';
import { SEED_META_CONFIG, SEED_PLANS, SEED_PLATFORM_SETTINGS } from './plan.seed';
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

  /** Platform-wide configuration, edited at `/settings` on the admin console. */
  readonly platformSettings = signal<PlatformSettings>({ ...SEED_PLATFORM_SETTINGS });

  /**
   * Who is acting, stamped onto every audit row. SessionService keeps it in
   * step with the session; `System` covers seeding and background work.
   */
  readonly actor = signal<{ name: string; role: string; scope: 'client' | 'platform' | null }>({
    name: 'System',
    role: 'Automation',
    scope: null,
  });

  /**
   * Pending invitations, seeded from the users flagged `invited` and kept in
   * step when a seat is added or accepted.
   */
  readonly invites = signal<InviteToken[]>(this.buildInvites());

  /** Self-service reset requests — dummy email, real expiry and single use. */
  readonly resetRequests = signal<PasswordResetToken[]>([]);

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

  /** Wave 6: graph + published snapshots for this workspace's flows. */
  readonly flowGraphs = computed(() =>
    this.dataset().flowGraphs.filter((graph) => graph.tenantId === this.tenantId()),
  );

  readonly flowVersions = computed(() =>
    this.dataset().flowVersions.filter((version) => version.tenantId === this.tenantId()),
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

  async listFlowVersions(flowId: string): Promise<Page<FlowVersion>> {
    const items = await this.latency(this.versionsFor(flowId));
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
    this.recordAudit({
      area: 'users',
      action:
        existingIndex >= 0
          ? `Updated the staff profile for ${saved.fullName}`
          : `Added ${saved.fullName} (${saved.email}) to the workspace`,
      target: saved.email,
      level: 'info',
      tenantId: saved.tenantId,
    });
    await this.sleep(200);
    return saved;
  }

  async deleteUser(id: string): Promise<void> {
    const dataset = this.dataset();
    const removed = dataset.workspaceUsers.find((user) => user.id === id);
    this.dataset.set({
      ...dataset,
      workspaceUsers: dataset.workspaceUsers.filter((user) => user.id !== id),
    });
    this.invites.update((list) => list.filter((invite) => invite.userId !== id));

    if (removed) {
      this.recordAudit({
        area: 'users',
        action: `Removed ${removed.fullName} from the workspace`,
        target: removed.email,
        level: 'warning',
        tenantId: removed.tenantId,
      });
    }

    await this.sleep(160);
  }

  /**
   * Suspending or reactivating a workspace. The lifecycle trail gets the
   * transition (subscription state is derived from it) and the audit log gets
   * the row — that pair is what `/suspended` and the platform log read.
   */
  async setTenantStatus(tenantId: string, status: Tenant['status']): Promise<void> {
    const dataset = this.dataset();
    const target = dataset.tenants.find((tenant) => tenant.id === tenantId) ?? null;
    const now = new Date().toISOString();

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

    if (target) {
      const state = status === 'suspended' ? 'suspended' : 'active';
      const events = this.subscriptionEventsForTenant(tenantId);
      const from =
        target.status === 'suspended'
          ? ('suspended' as SubscriptionState)
          : ((events[events.length - 1]?.to ?? 'trial') as SubscriptionState);

      this.dataset.update((current) => ({
        ...current,
        subscriptionEvents: [
          ...current.subscriptionEvents,
          {
            id: `${tenantId}-sub-${events.length + 1}`,
            tenantId,
            from,
            to: state,
            reason:
              status === 'suspended'
                ? 'Suspended by the platform team pending account review.'
                : 'Reactivated after the account review cleared.',
            actor: this.actor().name,
            createdAt: now,
          },
        ],
      }));

      this.recordAudit({
        area: 'clients',
        action:
          status === 'suspended'
            ? `Suspended ${target.businessName}`
            : `Set ${target.businessName} to ${status}`,
        target: `${target.businessName} · ${target.subdomain}`,
        level: status === 'suspended' ? 'critical' : 'warning',
        tenantId,
      });
    }

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
    this.recordAudit({
      area: 'clients',
      action: `Provisioned ${tenant.businessName} on the ${tenant.subscriptionTier} trial`,
      target: `${tenant.businessName} · ${tenant.subdomain}`,
      level: 'critical',
      tenantId: tenant.id,
    });
    await this.sleep(220);
    return tenant;
  }

  /**
   * Moves a tenant between tiers. Two records come out of it: a lifecycle event
   * (the History tab and the subscription log read that trail) and an audit row.
   */
  async changeTenantTier(tenantId: string, tier: string): Promise<void> {
    const dataset = this.dataset();
    const target = dataset.tenants.find((tenant) => tenant.id === tenantId) ?? null;
    if (!target || target.subscriptionTier === tier) {
      await this.sleep(120);
      return;
    }

    const now = new Date().toISOString();
    const events = this.subscriptionEventsForTenant(tenantId);
    const currentState = (events[events.length - 1]?.to ?? 'trial') as SubscriptionState;

    this.dataset.update((current) => ({
      ...current,
      tenants: current.tenants.map((tenant) =>
        tenant.id === tenantId ? { ...tenant, subscriptionTier: tier } : tenant,
      ),
      subscriptionEvents: [
        ...current.subscriptionEvents,
        {
          id: `${tenantId}-sub-${events.length + 1}`,
          tenantId,
          from: currentState,
          to: currentState,
          reason: `Plan changed from ${target.subscriptionTier} to ${tier} — limits and modules update immediately.`,
          actor: this.actor().name,
          createdAt: now,
        },
      ],
    }));

    this.recordAudit({
      area: 'billing',
      action: `Moved ${target.businessName} from the ${target.subscriptionTier} plan to ${tier}`,
      target: `${target.businessName} · ${tier}`,
      level: 'warning',
      tenantId,
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
    this.recordAudit({
      area: 'connections',
      action: `Connected WhatsApp Business Account ${connection.wabaId} to ${target.businessName}`,
      target: connection.phoneNumber,
      level: 'critical',
      tenantId,
    });
    await this.sleep(200);
    return updated;
  }

  /** Replaces one tier's metered limits; modules are edited on the matrix. */
  async savePlanLimits(tier: string, limits: PlanLimits): Promise<void> {
    this.plans.update((plans) =>
      plans.map((plan) => (plan.tier === tier ? { ...plan, limits: { ...limits } } : plan)),
    );
    this.recordAudit({
      area: 'plans',
      action: `Saved the ${tier} plan limits`,
      target: `${tier} plan`,
      level: 'warning',
      tenantId: null,
    });
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
    this.recordAudit({
      area: 'plans',
      action: `${enabled ? 'Enabled' : 'Disabled'} the ${module} module on the ${tier} plan`,
      target: `${tier} plan · ${module}`,
      level: 'warning',
      tenantId: null,
    });
  }

  async saveMetaConfig(patch: Partial<MetaAppConfig>, updatedBy: string): Promise<MetaAppConfig> {
    const updated: MetaAppConfig = {
      ...this.metaConfig(),
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    this.metaConfig.set(updated);
    this.recordAudit({
      area: 'meta',
      action: `Updated the Meta app reference (${Object.keys(patch).join(', ')})`,
      target: 'Meta app · webhook',
      level: 'warning',
      tenantId: null,
    });
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
    this.recordAudit({
      area: 'platform',
      action: `Re-queued the failed webhook event ${id}`,
      target: `Webhook event · ${id}`,
      level: 'warning',
      tenantId: null,
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
    this.recordAudit({
      area: 'settings',
      action: existing ? `Updated the ${saved.name} team` : `Created the ${saved.name} team`,
      target: `${saved.name} · weight ${saved.weight}`,
      level: 'info',
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
    if (target) {
      this.recordAudit({
        area: 'settings',
        action: `Deleted the ${target.name} team`,
        target: target.name,
        level: 'warning',
      });
    }
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
    this.recordAudit({
      area: 'settings',
      action: existing
        ? `Updated the quick reply ${saved.trigger}`
        : `Created the quick reply ${saved.trigger}`,
      target: saved.trigger,
      level: 'info',
    });
    await this.sleep(160);
    return saved;
  }

  async deleteQuickReply(id: string): Promise<void> {
    const dataset = this.dataset();
    const removed = dataset.quickReplies.find((reply) => reply.id === id);
    this.dataset.set({
      ...dataset,
      quickReplies: dataset.quickReplies.filter((reply) => reply.id !== id),
    });
    if (removed) {
      this.recordAudit({
        area: 'settings',
        action: `Deleted the quick reply ${removed.trigger}`,
        target: removed.trigger,
        level: 'warning',
      });
    }
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
    this.recordAudit({
      area: 'settings',
      action: existing
        ? `Updated the ${saved.name} segment`
        : `Created the ${saved.name} segment`,
      target: `${saved.name} · ${saved.rules.length} rule(s)`,
      level: 'info',
    });
    await this.sleep(180);
    return saved;
  }

  async deleteSegment(id: string): Promise<void> {
    const dataset = this.dataset();
    const removed = dataset.segments.find((segment) => segment.id === id);
    this.dataset.set({
      ...dataset,
      segments: dataset.segments.filter((segment) => segment.id !== id),
    });
    if (removed) {
      this.recordAudit({
        area: 'settings',
        action: `Deleted the ${removed.name} segment`,
        target: removed.name,
        level: 'warning',
      });
    }
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
    this.recordAudit({
      area: 'settings',
      action: `Updated the business profile for ${saved.displayName}`,
      target: `${saved.displayName} · ${saved.timezone}`,
      level: 'info',
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
    this.recordAudit({
      area: 'templates',
      action: existing
        ? `Updated the ${saved.name} template draft`
        : `Created the ${saved.name} template draft`,
      target: `${saved.name} · ${saved.language}`,
      level: 'info',
    });
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
    this.recordAudit({
      area: 'templates',
      action: `Submitted the ${saved.name} template to Meta for approval`,
      target: `${saved.name} · ${saved.category}`,
      level: 'info',
    });
    await this.sleep(200);
    return saved;
  }

  // ── Wave 5: lifecycle, audit and self-service ────────────────────

  /** Every audit row, oldest first — the order the dataset stores them in. */
  readonly auditEvents = computed(() => this.dataset().auditEvents);

  /** Newest first; every audit surface reads this order. */
  readonly auditLog = computed(() =>
    [...this.dataset().auditEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  auditForTenant(tenantId: string | null | undefined): AuditEvent[] {
    if (!tenantId) {
      return [];
    }
    return this.auditLog().filter((event) => event.tenantId === tenantId);
  }

  /** Actions that belong to no single workspace — plan edits, Meta app, domains. */
  platformAudit(): AuditEvent[] {
    return this.auditLog().filter((event) => event.tenantId === null);
  }

  /**
   * The single write path for the log. Called by the mutations themselves, so
   * anything that changes state leaves a row without a page remembering to ask.
   */
  recordAudit(entry: {
    area: AuditArea;
    action: string;
    target: string;
    level?: AuditLevel;
    tenantId?: string | null;
    actorName?: string;
    actorRole?: string;
  }): AuditEvent {
    const actor = this.actor();
    const dataset = this.dataset();
    const event: AuditEvent = {
      id: `audit-${Date.now().toString(36)}-${this.auditSeq}`,
      tenantId:
        entry.tenantId === undefined ? (this.currentTenant()?.id ?? null) : entry.tenantId,
      actor: entry.actorName ?? actor.name,
      actorRole: entry.actorRole ?? actor.role,
      area: entry.area,
      action: entry.action,
      target: entry.target,
      level: entry.level ?? 'info',
      createdAt: new Date().toISOString(),
    };

    this.auditSeq += 1;
    this.dataset.set({ ...dataset, auditEvents: [...dataset.auditEvents, event] });
    return event;
  }

  // ── Flow builder (wave 6) ────────────────────────────────────────

  flowById(flowId: string | null | undefined): ChatFlow | null {
    if (!flowId) {
      return null;
    }
    return this.flows().find((flow) => flow.id === flowId) ?? null;
  }

  graphFor(flowId: string | null | undefined): FlowGraph | null {
    if (!flowId) {
      return null;
    }
    return this.flowGraphs().find((graph) => graph.flowId === flowId) ?? null;
  }

  /** Newest-first published snapshots for one flow. */
  versionsFor(flowId: string | null | undefined): FlowVersion[] {
    if (!flowId) {
      return [];
    }
    return this.flowVersions()
      .filter((version) => version.flowId === flowId)
      .sort((a, b) => b.version - a.version);
  }

  /**
   * Commit a canvas edit: persists the graph, bumps the flow's version, appends
   * a published snapshot and records what changed. One write path so the list,
   * the canvas and the history can never disagree.
   */
  async saveFlowGraph(
    flowId: string,
    nodes: FlowNode[],
    note: string,
  ): Promise<{ flow: ChatFlow; version: FlowVersion } | null> {
    const flow = this.flowById(flowId);
    const graph = this.graphFor(flowId);
    if (!flow || !graph) {
      return null;
    }

    await this.latency([]);

    const actor = this.actor();
    const now = new Date().toISOString();
    const nextVersion = flow.version + 1;
    const copy = nodes.map((node) => ({
      ...node,
      options: node.options.map((option) => ({ ...option })),
    }));

    const version: FlowVersion = {
      id: `${flow.id}-v${nextVersion}`,
      tenantId: flow.tenantId,
      flowId: flow.id,
      version: nextVersion,
      note: note.trim() || 'Published from the canvas',
      author: actor.name,
      nodeCount: copy.length,
      publishedAt: now,
      nodes: copy,
    };

    const dataset = this.dataset();
    this.dataset.set({
      ...dataset,
      flows: dataset.flows.map((row) =>
        row.id === flow.id ? { ...row, version: nextVersion, updatedAt: now } : row,
      ),
      flowGraphs: dataset.flowGraphs.map((row) =>
        row.id === graph.id ? { ...row, nodes: copy, updatedAt: now } : row,
      ),
      flowVersions: [...dataset.flowVersions, version],
    });

    this.recordAudit({
      area: 'flows',
      action: `Published ${flow.name} v${nextVersion}: ${version.note}`,
      target: `${flow.name} · ${copy.length} nodes`,
      level: 'info',
    });

    return { flow: this.flowById(flowId) as ChatFlow, version };
  }

  /** Take a flow live, or pull it back to draft. Audited either way. */
  async setFlowActive(flowId: string, isActive: boolean): Promise<void> {
    const flow = this.flowById(flowId);
    if (!flow) {
      return;
    }

    await this.latency([]);

    const dataset = this.dataset();
    this.dataset.set({
      ...dataset,
      flows: dataset.flows.map((row) => (row.id === flow.id ? { ...row, isActive } : row)),
    });

    this.recordAudit({
      area: 'flows',
      action: isActive ? `Took ${flow.name} live` : `Moved ${flow.name} back to draft`,
      target: `${flow.name} · ${flow.triggerKeyword ? `/${flow.triggerKeyword}` : 'no keyword'}`,
      level: isActive ? 'info' : 'warning',
    });
  }

  /**
   * Roll a flow back to an earlier published snapshot. The restore publishes a
   * new version rather than rewriting history, so the trail stays append-only.
   */
  async restoreFlowVersion(flowId: string, versionId: string): Promise<FlowVersion | null> {
    const version = this.versionsFor(flowId).find((row) => row.id === versionId);
    if (!version) {
      return null;
    }

    const outcome = await this.saveFlowGraph(
      flowId,
      version.nodes,
      `Restored v${version.version} (${version.note})`,
    );

    return outcome?.version ?? null;
  }

  // ── Invitations ──────────────────────────────────────────────────

  private buildInvites(): InviteToken[] {
    // Seeded invites are dated a few days back so every demo link still opens.
    return this.dataset()
      .workspaceUsers.filter((user) => user.invited)
      .map((user, index) => makeInvite(user, Date.now() - (index + 1) * 36 * 3_600_000));
  }

  /** The open invitation for a seat, if one exists. */
  inviteFor(userId: string): InviteToken | null {
    return (
      this.invites().find((invite) => invite.userId === userId && !invite.acceptedAt) ?? null
    );
  }

  /** Reuses the open invite or issues a new one for a seat that is still pending. */
  ensureInvite(userId: string): InviteToken | null {
    const existing = this.inviteFor(userId);
    if (existing) {
      return existing;
    }

    const user = this.dataset().workspaceUsers.find((candidate) => candidate.id === userId);
    if (!user || !user.invited) {
      return null;
    }

    const invite = makeInvite(user, Date.now());
    this.invites.update((list) => [...list, invite]);
    return invite;
  }

  inviteByToken(token: string | null | undefined): InviteToken | null {
    if (!token) {
      return null;
    }
    return this.invites().find((invite) => invite.token === token) ?? null;
  }

  /** The seat an invitation points at, whatever state the invite is in. */
  inviteDetails(token: string | null | undefined): {
    invite: InviteToken;
    user: WorkspaceUser | null;
    tenant: Tenant | null;
    expired: boolean;
    accepted: boolean;
  } | null {
    const invite = this.inviteByToken(token);
    if (!invite) {
      return null;
    }

    return {
      invite,
      user: this.dataset().workspaceUsers.find((user) => user.id === invite.userId) ?? null,
      tenant: this.tenantById(invite.tenantId),
      expired: Date.parse(invite.expiresAt) < Date.now(),
      accepted: invite.acceptedAt !== null,
    };
  }

  /**
   * Accepting an invitation activates the seat: the `invited` flag clears, the
   * account is stamped and the invite is spent. The password itself is held by
   * SessionService, which is the only thing that checks credentials.
   */
  async acceptInvite(token: string): Promise<{ ok: boolean; message?: string; user?: WorkspaceUser }> {
    const details = this.inviteDetails(token);

    if (!details) {
      return { ok: false, message: 'That invitation link is not valid. Ask your admin to resend it.' };
    }
    if (details.accepted) {
      return { ok: false, message: 'That invitation has already been accepted. Sign in instead.' };
    }
    if (details.expired) {
      return { ok: false, message: 'That invitation has expired. Ask your admin to send a new one.' };
    }
    if (!details.user) {
      return { ok: false, message: 'The seat behind this invitation no longer exists.' };
    }

    const now = new Date().toISOString();
    const dataset = this.dataset();
    const user: WorkspaceUser = {
      ...details.user,
      invited: false,
      lastLoginAt: now,
    };

    this.dataset.set({
      ...dataset,
      workspaceUsers: dataset.workspaceUsers.map((candidate) =>
        candidate.id === user.id ? user : candidate,
      ),
    });
    this.invites.update((list) =>
      list.map((invite) => (invite.token === token ? { ...invite, acceptedAt: now } : invite)),
    );

    this.recordAudit({
      area: 'auth',
      action: 'Accepted the invitation and set a password',
      target: user.email,
      level: 'info',
      tenantId: user.tenantId,
      actorName: user.fullName,
      actorRole: this.roleLabelFor(user.role),
    });

    await this.sleep(220);
    return { ok: true, user };
  }

  // ── Password recovery ────────────────────────────────────────────

  /**
   * Looks the address up across workspaces and platform staff. Nothing is
   * emailed, so the result carries the simulated link the page shows instead —
   * the same honesty the demo login uses for its credentials.
   */
  async requestPasswordReset(email: string): Promise<{
    found: boolean;
    token: string | null;
    name: string | null;
    scope: 'client' | 'platform' | null;
  }> {
    const wanted = email.trim().toLowerCase();
    const staff = this.dataset().platformStaff.find(
      (member) => member.email.toLowerCase() === wanted,
    );
    const workspaceUser = this.dataset().workspaceUsers.find(
      (user) => user.email.toLowerCase() === wanted,
    );

    if (!staff && !workspaceUser) {
      await this.sleep(200);
      return { found: false, token: null, name: null, scope: null };
    }

    const scope: 'client' | 'platform' = staff ? 'platform' : 'client';
    const now = new Date();
    const token: PasswordResetToken = {
      token: `reset-${scope}-${now.getTime().toString(36)}`,
      email: (staff ?? workspaceUser)!.email,
      scope,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
      usedAt: null,
    };

    this.resetRequests.update((list) => [...list, token]);
    this.recordAudit({
      area: 'auth',
      action: `Requested a password reset for ${token.email}`,
      target: token.email,
      level: 'warning',
      tenantId: workspaceUser?.tenantId ?? null,
      actorName: token.email,
      actorRole: scope === 'platform' ? 'Platform staff' : 'Workspace staff',
    });

    await this.sleep(220);
    return {
      found: true,
      token: token.token,
      name: (staff ?? workspaceUser)!.fullName,
      scope,
    };
  }

  /** An unused, unexpired reset request. Anything else reads as invalid. */
  resetRequestFor(token: string | null | undefined): PasswordResetToken | null {
    if (!token) {
      return null;
    }

    const request = this.resetRequests().find((candidate) => candidate.token === token);
    if (!request || request.usedAt || Date.parse(request.expiresAt) < Date.now()) {
      return null;
    }

    return request;
  }

  async completePasswordReset(
    token: string,
  ): Promise<{ ok: boolean; message?: string; request?: PasswordResetToken }> {
    const request = this.resetRequestFor(token);
    if (!request) {
      return { ok: false, message: 'That reset link is invalid or has expired. Request a new one.' };
    }

    const usedAt = new Date().toISOString();
    this.resetRequests.update((list) =>
      list.map((candidate) => (candidate.token === token ? { ...candidate, usedAt } : candidate)),
    );

    this.recordAudit({
      area: 'auth',
      action: `Completed a password reset for ${request.email}`,
      target: request.email,
      level: 'warning',
      tenantId: this.currentTenant()?.id ?? null,
      actorName: request.email,
      actorRole: request.scope === 'platform' ? 'Platform staff' : 'Workspace staff',
    });

    await this.sleep(200);
    return { ok: true, request };
  }

  // ── Billing, platform settings, lifecycle ────────────────────────

  /** The plan behind the resolved workspace. */
  readonly currentPlan = computed<Plan | null>(() => {
    const tenant = this.currentTenant();
    return tenant ? this.planForTier(tenant.subscriptionTier) : null;
  });

  /** What the workspace consumes against each metered dimension. */
  readonly planUsage = computed(() => {
    const tenant = this.currentTenant();
    return {
      seats: this.users().length,
      whatsappNumbers: tenant?.metaPhoneNumberId ? 1 : 0,
      contacts: this.contacts().length,
      messagesPerMonth: tenant?.monthlyMessages ?? 0,
      campaignsPerMonth: this.campaigns().filter((campaign) => campaign.status !== 'draft').length,
      flows: this.flows().length,
    };
  });

  /**
   * The workspace's subscription state, derived exactly like the platform
   * console derives it: suspension wins, otherwise the newest event decides.
   */
  readonly subscriptionState = computed<{ state: SubscriptionState; since: string; reason: string } | null>(
    () => {
      const tenant = this.currentTenant();
      if (!tenant) {
        return null;
      }

      const trail = this.subscriptionEventsForTenant(tenant.id).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
      const latest = trail[trail.length - 1];

      return {
        state: tenant.status === 'suspended' ? 'suspended' : (latest?.to ?? 'trial'),
        since: latest?.createdAt ?? tenant.createdAt,
        reason: latest?.reason ?? 'Workspace provisioned with a 14-day trial.',
      };
    },
  );

  /** The workspace's invoices, newest first. */
  readonly tenantInvoices = computed<Invoice[]>(() => {
    const tenant = this.currentTenant();
    if (!tenant) {
      return [];
    }
    return [...this.invoicesForTenant(tenant.id)].sort((a, b) =>
      b.issuedAt.localeCompare(a.issuedAt),
    );
  });

  /** Why a suspended workspace is locked, straight from the lifecycle trail. */
  readonly suspensionReason = computed(() => {
    const tenant = this.currentTenant();
    if (!tenant) {
      return null;
    }

    const suspension = [...this.subscriptionEventsForTenant(tenant.id)]
      .filter((event) => event.to === 'suspended')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    return suspension?.reason ?? 'This workspace was suspended by the platform team.';
  });

  async savePlatformSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const actor = this.actor();
    const updated: PlatformSettings = {
      ...this.platformSettings(),
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name,
    };

    this.platformSettings.set(updated);
    this.recordAudit({
      area: 'platform',
      action: `Updated platform settings (${Object.keys(patch).join(', ')})`,
      target: 'Platform settings',
      level: 'warning',
      tenantId: null,
    });

    await this.sleep(180);
    return updated;
  }

  private roleLabelFor(role: WorkspaceUser['role']): string {
    switch (role) {
      case 'admin':
        return 'Workspace Administrator';
      case 'supervisor':
        return 'Supervisor';
      case 'developer':
        return 'Integration User';
      default:
        return 'Support Agent';
    }
  }

  private auditSeq = 0;

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

/** Invitation links last a fortnight; the seeded ones are dated a few days back. */
const INVITE_TTL_MS = 14 * 24 * 3_600_000;

function makeInvite(user: WorkspaceUser, issuedAtMs: number): InviteToken {
  const issuedAt = new Date(issuedAtMs).toISOString();
  return {
    token: `invite-${user.id}`,
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    roleId: user.roleId,
    issuedAt,
    expiresAt: new Date(issuedAtMs + INVITE_TTL_MS).toISOString(),
    acceptedAt: null,
  };
}
