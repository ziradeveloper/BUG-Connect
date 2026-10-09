import { computed, inject, Injectable, signal } from '@angular/core';

import { WorkspaceContext } from '../workspace/workspace-context';
import { buildDataset, type Dataset } from './mock-data';
import type {
  Campaign,
  ChatFlow,
  Contact,
  Conversation,
  Message,
  MessageTemplate,
  PlatformStaffUser,
  Tenant,
  WebhookEvent,
  WorkspaceUser,
} from './entities';
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
            tenantId: this.tenantId(),
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
