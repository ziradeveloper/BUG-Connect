import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { Invoice, Plan, PlanTier } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { formatRelative } from '../../../shared/format';
import { PageHeader, StatusPill } from '../../../shared/ui/ui';

type UsageRow = {
  key: string;
  label: string;
  used: number;
  limitLabel: string;
  percent: number;
  tone: 'ok' | 'warn' | 'over';
};

/**
 * Workspace subscription (`/billing`, wave 5).
 *
 * Reads the plan records the platform console edits, so a limit change on
 * `/plans/edit` shows up here as soon as the workspace next renders. Moving a
 * plan goes through a simulated Stripe sheet and then `changeTenantTier`, which
 * writes both the lifecycle trail and the audit log.
 */
@Component({
  selector: 'app-billing-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './billing-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly checkoutTier = signal<PlanTier | null>(null);

  protected readonly tenant = computed(() => this.data.currentTenant());
  protected readonly plan = computed(() => this.data.currentPlan());
  protected readonly usage = computed(() => this.data.planUsage());
  protected readonly tiers = computed(() => this.data.plans());
  protected readonly invoices = computed(() => this.data.tenantInvoices());

  protected readonly canManage = computed(() => this.permissions.can('billing.view', 'edit'));

  protected readonly seatLimit = computed(() => this.plan()?.limits.seats ?? null);

  protected readonly usageRows = computed<UsageRow[]>(() => {
    const plan = this.plan();
    const usage = this.usage();
    if (!plan) {
      return [];
    }

    const definition: { key: keyof typeof usage; label: string; limit: number | null }[] = [
      { key: 'seats', label: 'Seats', limit: plan.limits.seats },
      { key: 'contacts', label: 'Contacts', limit: plan.limits.contacts },
      { key: 'messagesPerMonth', label: 'Messages / 30d', limit: plan.limits.messagesPerMonth },
      { key: 'campaignsPerMonth', label: 'Campaigns this month', limit: plan.limits.campaignsPerMonth },
      { key: 'flows', label: 'Flows', limit: plan.limits.flows },
      { key: 'whatsappNumbers', label: 'WhatsApp numbers', limit: plan.limits.whatsappNumbers },
    ];

    return definition.map((entry) => {
      const used = usage[entry.key];
      const limitLabel = this.limitLabel(entry.limit);
      const percent = entry.limit ? Math.min(100, Math.round((used / entry.limit) * 100)) : 0;

      return {
        key: entry.key,
        label: entry.label,
        used,
        limitLabel,
        percent,
        tone: entry.limit && used > entry.limit ? 'over' : percent >= 80 ? 'warn' : 'ok',
      };
    });
  });

  protected readonly overLimit = computed(
    () => this.usageRows().filter((row) => row.tone === 'over').length,
  );

  protected readonly invoiceColumns: DataColumn<Invoice>[] = [
    { key: 'number', label: 'Invoice', sortable: true, cellClass: 'data-table__mono' },
    { key: 'period', label: 'Period', sortable: true, align: 'center' },
    { key: 'amountInr', label: 'Amount', sortable: true, align: 'end', type: 'number' },
    { key: 'status', label: 'Status', sortable: true, align: 'center' },
    {
      key: 'issuedAt',
      label: 'Issued',
      sortable: true,
      value: (row) => row.issuedAt,
      format: (row) => formatRelative(row.issuedAt),
    },
    { key: 'dueAt', label: 'Due', sortable: true, value: (row) => row.dueAt },
    { key: 'actions', label: '', align: 'end', sortable: false },
  ];

  protected stateLabel(): string {
    const state = this.data.subscriptionState()?.state ?? 'trial';
    return state.charAt(0).toUpperCase() + state.slice(1);
  }

  protected stateSince(): string {
    const state = this.data.subscriptionState();
    return state ? formatRelative(state.since) : '—';
  }

  protected nextInvoiceLabel(): string {
    const due = this.invoices().find((invoice) => !invoice.paidAt);
    if (due) {
      return this.inr(due.amountInr);
    }
    return this.plan()?.monthlyPriceInr === null ? 'Custom' : this.inr(0);
  }

  protected limitLabel(limit: number | null | undefined): string {
    return limit === null || limit === undefined ? 'Unlimited' : String(limit);
  }

  protected priceLabel(plan: Plan | null): string {
    if (!plan) {
      return '—';
    }
    return plan.monthlyPriceInr === null
      ? 'Custom pricing'
      : `₹${plan.monthlyPriceInr.toLocaleString('en-IN')} / month`;
  }

  protected inr(amount: number): string {
    return amount === 0 ? 'Free' : `₹${amount.toLocaleString('en-IN')}`;
  }

  protected statusTone(status: Invoice['status']): 'success' | 'warning' | 'danger' | 'neutral' {
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

  protected tierFor(tier: PlanTier | null): Plan | null {
    return tier ? (this.data.planForTier(tier) ?? null) : null;
  }

  protected openCheckout(tier: PlanTier): void {
    if (!this.canManage()) {
      return;
    }
    this.error.set(null);
    this.checkoutTier.set(tier);
  }

  protected closeCheckout(): void {
    this.checkoutTier.set(null);
  }

  protected async confirmCheckout(): Promise<void> {
    const target = this.checkoutTier();
    const tenant = this.tenant();

    if (!target || !tenant || this.saving()) {
      return;
    }

    this.saving.set(true);
    await this.data.changeTenantTier(tenant.id, target);
    this.saving.set(false);
    this.checkoutTier.set(null);
    this.notice.set(
      `${tenant.businessName} is now on the ${target} plan — limits and modules are already in effect.`,
    );
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  /** Client-side download: there is no document store behind the dummy layer. */
  protected downloadInvoice(invoice: Invoice): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (typeof URL.createObjectURL !== 'function') {
      this.error.set('This browser cannot download files.');
      return;
    }

    const tenant = this.tenant();
    const lines = [
      'BUGConnect — workspace invoice',
      '==========================================',
      `Invoice      ${invoice.number}`,
      `Workspace    ${tenant?.businessName ?? '—'} (${tenant?.subdomain ?? '—'})`,
      `Plan         ${tenant?.subscriptionTier ?? '—'}`,
      `Period       ${invoice.period}`,
      `Amount       ${this.inr(invoice.amountInr)}`,
      `Status       ${invoice.status}`,
      `Issued       ${invoice.issuedAt.slice(0, 10)}`,
      `Due          ${invoice.dueAt.slice(0, 10)}`,
      `Paid         ${invoice.paidAt ? invoice.paidAt.slice(0, 10) : '—'}`,
      '',
      'Test-mode document. No payment was processed.',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `${invoice.number}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
