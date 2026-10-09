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

export type Page<T> = { items: T[]; total: number };

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
