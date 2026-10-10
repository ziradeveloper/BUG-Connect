import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import type { Tenant } from '../../core/data/entities';
import { PLAN_TIERS } from '../../core/data/plan.seed';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import { DataTableComponent } from '../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../shared/data-table/data-table.model';
import type { DataColumn } from '../../shared/data-table/data-table.model';
import type { Invoice, SubscriptionEvent, WorkspaceUser } from '../../core/data/entities';
import { formatDateTime, formatNumber, formatRelative } from '../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../shared/ui/ui';

export type ClientTab = 'overview' | 'seats' | 'whatsapp' | 'subscription' | 'history';

const TABS: { id: ClientTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'seats', label: 'Seats' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'history', label: 'History' },
];

type UsageRow = { label: string; used: number; limit: number | null };

/**
 * One workspace, five tabs (`/clients/:clientId`): profile facts, seat usage,
 * the WABA connection, the subscription with tier control, and the lifecycle
 * timeline stitched from subscription events plus provisioning milestones.
 */
@Component({
  selector: 'app-client-detail-page',
  imports: [FormsModule, RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill, ConfirmDialog],
  templateUrl: './client-detail-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetailPage {
  readonly clientId = input<string | null>(null);
  /** Bound from `?tab=` — unknown values fall back to the overview. */
  readonly tab = input<string>('overview');

  private readonly router = inject(Router);
  private readonly workspace = inject(WorkspaceContext);
  protected readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  protected readonly notice = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly pendingTier = signal<string | null>(null);
  protected readonly pendingSuspend = signal(false);

  protected readonly tabs = TABS;
  protected readonly tiers = PLAN_TIERS;

  protected readonly tenant = computed(() => this.data.tenantById(this.clientId()));

  protected readonly activeTab = computed<ClientTab>(() => {
    const wanted = this.tab();
    return TABS.some((entry) => entry.id === wanted) ? (wanted as ClientTab) : 'overview';
  });

  protected readonly canManage = computed(() => this.permissions.can('clients.manage', 'edit'));

  protected readonly plan = computed(() => {
    const tenant = this.tenant();
    return tenant ? this.data.planForTier(tenant.subscriptionTier) : null;
  });

  protected readonly members = computed<WorkspaceUser[]>(() => {
    const tenant = this.tenant();
    return tenant ? this.data.usersForTenant(tenant.id) : [];
  });

  protected readonly onlineMembers = computed(() => this.members().filter((member) => member.isOnline).length);

  protected readonly invoices = computed<Invoice[]>(() => {
    const tenant = this.tenant();
    return tenant ? this.data.invoicesForTenant(tenant.id) : [];
  });

  protected readonly subscriptionEvents = computed<SubscriptionEvent[]>(() => {
    const tenant = this.tenant();
    if (!tenant) {
      return [];
    }
    return [...this.data.subscriptionEventsForTenant(tenant.id)].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  });

  protected readonly recentWebhookEvents = computed(() => {
    const tenant = this.tenant();
    if (!tenant) {
      return [];
    }
    return [...this.data.webhookEventsForTenant(tenant.id)]
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, 8);
  });

  protected readonly failedWebhooks = computed(
    () => this.recentWebhookEvents().filter((event) => event.outcome === 'failed').length,
  );

  protected readonly usage = computed<UsageRow[]>(() => {
    const tenant = this.tenant();
    const plan = this.plan();
    if (!tenant || !plan) {
      return [];
    }

    return [
      { label: 'Seats', used: this.members().length, limit: plan.limits.seats },
      { label: 'Contacts', used: tenant.contactCount, limit: plan.limits.contacts },
      { label: 'Messages / 30d', used: tenant.monthlyMessages, limit: plan.limits.messagesPerMonth },
      {
        label: 'WhatsApp numbers',
        used: tenant.metaPhoneNumberId ? 1 : 0,
        limit: plan.limits.whatsappNumbers,
      },
    ];
  });

  /** Subscription events plus the created/connected milestones, newest first. */
  protected readonly timeline = computed(() => {
    const tenant = this.tenant();
    if (!tenant) {
      return [];
    }

    const items: { at: string; title: string; detail: string }[] = this.subscriptionEvents().map(
      (event) => ({
        at: event.createdAt,
        title: event.from ? `${labelState(event.from)} → ${labelState(event.to)}` : `Entered ${labelState(event.to)}`,
        detail: `${event.reason} — ${event.actor}`,
      }),
    );

    items.push({
      at: tenant.createdAt,
      title: 'Workspace provisioned',
      detail: `${tenant.businessName} created on the ${tenant.subscriptionTier} plan.`,
    });

    if (tenant.connectedAt) {
      items.push({
        at: tenant.connectedAt,
        title: 'WhatsApp connected',
        detail: `WABA ${tenant.metaWabaId} · ${tenant.phoneNumber ?? 'number pending'}.`,
      });
    }

    return items.sort((a, b) => b.at.localeCompare(a.at));
  });

  protected readonly memberColumns: DataColumn<WorkspaceUser>[] = [
    { key: 'fullName', label: 'Member', sortable: true, cellClass: 'data-table__primary' },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'roleId', label: 'Role', sortable: true },
    { key: 'department', label: 'Team', sortable: true },
    {
      key: 'load',
      label: 'Chat load',
      sortable: true,
      align: 'center',
      type: 'number',
      value: (user) => user.activeChats / Math.max(1, user.maxActiveChatCapacity),
      format: (user) => `${user.activeChats} / ${user.maxActiveChatCapacity}`,
    },
    { key: 'status', label: 'Presence', sortable: true, align: 'center' },
  ];

  protected readonly invoiceColumns: DataColumn<Invoice>[] = [
    { key: 'number', label: 'Invoice', sortable: true, cellClass: 'data-table__mono' },
    { key: 'period', label: 'Period', sortable: true, align: 'center' },
    {
      key: 'amountInr',
      label: 'Amount',
      sortable: true,
      align: 'end',
      type: 'number',
      format: (invoice) => this.inr(invoice.amountInr),
    },
    { key: 'status', label: 'Status', sortable: true, align: 'center' },
    {
      key: 'dueAt',
      label: 'Due',
      sortable: true,
      value: (invoice) => invoice.dueAt,
      format: (invoice) => formatRelative(invoice.dueAt),
    },
  ];

  protected statusLabel(tenant: Tenant): string {
    switch (tenant.status) {
      case 'lead_trial':
        return 'Lead / trial';
      case 'onboarding':
        return 'Onboarding';
      case 'whatsapp_pending':
        return 'Connection pending';
      case 'active':
        return 'Active';
      case 'suspended':
        return 'Suspended';
      default:
        return 'Archived';
    }
  }

  protected statusTone(tenant: Tenant): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (tenant.status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'danger';
      case 'whatsapp_pending':
        return 'warning';
      case 'archived':
        return 'neutral';
      default:
        return 'info';
    }
  }

  protected invoiceTone(status: Invoice['status']): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'paid':
        return 'success';
      case 'due':
        return 'warning';
      case 'overdue':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  protected inr(amount: number): string {
    return amount === 0 ? 'Free' : `₹${amount.toLocaleString('en-IN')}`;
  }

  protected count(value: number): string {
    return formatNumber(value);
  }

  protected ago(iso: string): string {
    return formatRelative(iso);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected roleName(roleId: string): string {
    return this.permissions.labelFor(roleId);
  }

  protected limitLabel(limit: number | null): string {
    return limit === null ? 'Unlimited' : formatNumber(limit);
  }

  protected usagePercent(row: UsageRow): number {
    if (row.limit === null || row.limit === 0) {
      return row.limit === null ? 0 : 100;
    }
    return Math.min(100, Math.round((row.used / row.limit) * 100));
  }

  protected usageTone(row: UsageRow): 'ok' | 'warn' | 'over' {
    if (row.limit === null) {
      return 'ok';
    }
    if (row.used > row.limit) {
      return 'over';
    }
    return row.used / Math.max(1, row.limit) >= 0.85 ? 'warn' : 'ok';
  }

  /** Dev-only convenience: hop into the workspace without changing hosts. */
  protected openWorkspace(tenant: Tenant): void {
    if (!this.workspace.canOverride()) {
      this.notice.set(
        `Subdomain switching needs a dev host. Point your browser at ${tenant.subdomain}.localhost:4200 to open this workspace.`,
      );
      return;
    }

    this.workspace.setDevWorkspace(tenant.subdomain);
    void this.router.navigate(['/']);
  }

  protected askSuspend(): void {
    this.pendingSuspend.set(true);
  }

  protected toggleSuspension(): void {
    const tenant = this.tenant();
    this.pendingSuspend.set(false);
    if (!tenant) {
      return;
    }

    const next = tenant.status === 'suspended' ? 'active' : 'suspended';
    this.loading.set(true);
    this.data.setTenantStatus(tenant.id, next).then(() => {
      this.loading.set(false);
      this.notice.set(
        `${tenant.businessName} is now ${this.statusLabel({ ...tenant, status: next }).toLowerCase()}.`,
      );
    });
  }

  protected askTierChange(tier: string): void {
    const tenant = this.tenant();
    if (!tenant || tier === tenant.subscriptionTier) {
      return;
    }
    this.pendingTier.set(tier);
  }

  protected confirmTierChange(): void {
    const tenant = this.tenant();
    const tier = this.pendingTier();
    this.pendingTier.set(null);
    if (!tenant || !tier) {
      return;
    }

    this.loading.set(true);
    this.data.changeTenantTier(tenant.id, tier).then(() => {
      this.loading.set(false);
      this.notice.set(`${tenant.businessName} moved to the ${tier} plan. Its sidebar re-gated immediately.`);
    });
  }
}

function labelState(state: SubscriptionEvent['from'] | SubscriptionEvent['to']): string {
  switch (state) {
    case 'trial':
      return 'Trial';
    case 'active':
      return 'Active';
    case 'grace':
      return 'Grace';
    case 'expired':
      return 'Expired';
    case 'suspended':
      return 'Suspended';
    default:
      return '—';
  }
}
