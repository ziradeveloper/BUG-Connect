import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { Campaign } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { formatDateTime, formatNumber, formatRelative } from '../../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

/**
 * Campaign Manager (`/campaigns`, wave 6).
 *
 * The index into broadcast delivery: one row per campaign with the audience it
 * targets, the template it sends, and a live progress bar built from the same
 * counters the delivery monitor polls. Starting and pausing are gated behind
 * `campaigns.manage`; watching a broadcast is not.
 */
@Component({
  selector: 'app-campaigns-page',
  imports: [
    RouterLink,
    DataTableComponent,
    DataTableCellDirective,
    PageHeader,
    StatusPill,
    ConfirmDialog,
  ],
  templateUrl: './campaigns-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal<{ campaign: Campaign; action: 'start' | 'pause' } | null>(
    null,
  );

  protected readonly canManage = computed(() => this.permissions.can('campaigns.manage', 'edit'));

  /** Exposed for the template's row copy. */
  protected readonly formatNumber = formatNumber;

  protected readonly rows = computed(() =>
    [...this.data.campaigns()].sort((a, b) => {
      const left = a.scheduledAt ?? a.createdAt;
      const right = b.scheduledAt ?? b.createdAt;
      return right.localeCompare(left);
    }),
  );

  protected readonly summary = computed(() => {
    const campaigns = this.data.campaigns();
    const audience = campaigns.reduce((total, row) => total + row.audienceSize, 0);
    const sent = campaigns.reduce((total, row) => total + row.sent, 0);
    const delivered = campaigns.reduce((total, row) => total + row.delivered, 0);
    const read = campaigns.reduce((total, row) => total + row.read, 0);

    return {
      total: campaigns.length,
      sending: campaigns.filter((row) => row.status === 'sending').length,
      scheduled: campaigns.filter((row) => row.status === 'scheduled').length,
      audience,
      sent,
      deliveryRate: sent ? Math.round((delivered / sent) * 100) : 0,
      readRate: delivered ? Math.round((read / delivered) * 100) : 0,
    };
  });

  /** The tier's monthly broadcast allowance, for the header's pacing note. */
  protected readonly allowance = computed(() => {
    const tier = this.data.currentTenant()?.subscriptionTier ?? 'Pilot';
    const limit = this.data.planForTier(tier)?.limits.campaignsPerMonth ?? null;
    const used = this.data.planUsage().campaignsPerMonth;
    return { tier, limit, used };
  });

  protected readonly columns: DataColumn<Campaign>[] = [
    { key: 'name', label: 'Campaign', sortable: true, cellClass: 'data-table__primary' },
    { key: 'status', label: 'Status', sortable: true, align: 'center' },
    { key: 'progress', label: 'Delivery', sortable: false },
    {
      key: 'sent',
      label: 'Sent',
      sortable: true,
      align: 'center',
      type: 'number',
      format: (campaign) => formatNumber(campaign.sent),
    },
    {
      key: 'delivered',
      label: 'Delivered',
      sortable: true,
      align: 'center',
      type: 'number',
      format: (campaign) => `${this.rate(campaign.delivered, campaign.sent)}%`,
    },
    {
      key: 'read',
      label: 'Read',
      sortable: true,
      align: 'center',
      type: 'number',
      format: (campaign) => `${this.rate(campaign.read, campaign.delivered)}%`,
    },
    {
      key: 'pacePerHour',
      label: 'Pace',
      sortable: true,
      align: 'center',
      type: 'number',
      format: (campaign) => `${formatNumber(campaign.pacePerHour)}/h`,
    },
    {
      key: 'scheduledAt',
      label: 'When',
      sortable: true,
      value: (campaign) => campaign.scheduledAt ?? campaign.createdAt,
      format: (campaign) =>
        campaign.scheduledAt ? formatDateTime(campaign.scheduledAt) : formatRelative(campaign.createdAt),
    },
    { key: 'actions', label: '', align: 'end', sortable: false },
  ];

  protected statusTone(
    campaign: Campaign,
  ): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (campaign.status) {
      case 'sending':
        return 'success';
      case 'scheduled':
        return 'info';
      case 'paused':
        return 'warning';
      case 'completed':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  protected statusLabel(campaign: Campaign): string {
    switch (campaign.status) {
      case 'sending':
        return 'Sending';
      case 'scheduled':
        return 'Scheduled';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      default:
        return 'Draft';
    }
  }

  protected rate(value: number, base: number): number {
    return base > 0 ? Math.round((value / base) * 100) : 0;
  }

  protected progress(campaign: Campaign): number {
    return this.data.campaignMetrics(campaign.id)?.progress ?? 0;
  }

  protected audienceLabel(campaign: Campaign): string {
    const segment = this.data.segmentFor(campaign.id);
    return segment ? segment.name : 'Ad-hoc audience';
  }

  protected templateLabel(campaign: Campaign): string {
    const template = this.data.templateFor(campaign.id);
    return template ? template.name : 'No template chosen';
  }

  protected canStart(campaign: Campaign): boolean {
    return (
      this.canManage() &&
      campaign.status !== 'sending' &&
      campaign.status !== 'completed' &&
      Boolean(campaign.templateId) &&
      campaign.audienceSize > 0
    );
  }

  protected startBlocker(campaign: Campaign): string | null {
    if (!campaign.templateId) {
      return 'Pick an approved template before sending.';
    }
    if (campaign.audienceSize === 0) {
      return 'The audience is empty — the segment matched nobody.';
    }
    return null;
  }

  protected ask(campaign: Campaign, action: 'start' | 'pause'): void {
    this.pending.set({ campaign, action });
  }

  protected dialogTitle(): string {
    const state = this.pending();
    if (!state) {
      return '';
    }
    return state.action === 'start'
      ? `Start sending ${state.campaign.name}?`
      : `Pause ${state.campaign.name}?`;
  }

  protected dialogBody(): string {
    const state = this.pending();
    if (!state) {
      return '';
    }
    return state.action === 'start'
      ? `${formatNumber(state.campaign.audienceSize)} recipients get the ${this.templateLabel(state.campaign)} template at ${formatNumber(state.campaign.pacePerHour)} per hour. Started sends cannot be recalled.`
      : `Sending stops after the current batch. Everything already delivered stays delivered.`;
  }

  protected async confirm(): Promise<void> {
    const state = this.pending();
    this.pending.set(null);
    if (!state) {
      return;
    }

    this.error.set(null);
    const saved =
      state.action === 'start'
        ? await this.data.startCampaign(state.campaign.id)
        : await this.data.pauseCampaign(state.campaign.id);

    if (!saved) {
      this.error.set(
        state.action === 'start'
          ? 'That campaign cannot start — check its template and audience.'
          : 'That campaign is not sending.',
      );
      return;
    }

    this.notice.set(
      state.action === 'start'
        ? `${saved.name} is sending. Open the monitor to watch delivery.`
        : `${saved.name} is paused after ${formatNumber(saved.sent)} sends.`,
    );
  }

  protected dismiss(): void {
    this.notice.set(null);
    this.error.set(null);
  }

  protected async openMonitor(campaign: Campaign): Promise<void> {
    await this.router.navigate(['/campaigns', campaign.id]);
  }
}
