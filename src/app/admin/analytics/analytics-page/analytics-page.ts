import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { REPORT_RANGES, type ReportRange } from '../../../core/data/analytics';
import type { Tenant, TenantStatus } from '../../../core/data/entities';
import { MockDataService } from '../../../core/data/mock-data.service';
import type {
  ActivationStage,
  TierSlice,
  WorkspaceUsage,
} from '../../../core/data/platform-analytics';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { buildLineChart, type ChartGeometry } from '../../../shared/chart-geometry';
import { formatNumber } from '../../../shared/format';
import { PageHeader, StatusPill } from '../../../shared/ui/ui';

/**
 * Cross-tenant analytics (`/analytics`).
 *
 * The platform owner's view of the estate, deliberately kept apart from any
 * single tenant's reporting: adoption by plan, usage by workspace, and how long
 * a new workspace takes to reach its first live conversation. Every figure comes
 * from `core/data/platform-analytics.ts` over the seeded tenants, so there is
 * nothing here to reconcile and no charting dependency — the volume chart is one
 * inline SVG and the rest are bars sized in percent.
 *
 * There is no revenue projection on this page. The plan prices in the seed are
 * null because the PRD publishes no price list, so the billing card reports the
 * invoices that were actually issued instead of a price multiplied by seats.
 */
@Component({
  selector: 'app-platform-analytics-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './analytics-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformAnalyticsPage {
  private readonly data = inject(MockDataService);

  protected readonly ranges = REPORT_RANGES;
  protected readonly range = signal<ReportRange>(30);
  protected readonly formatNumber = formatNumber;

  protected readonly snapshot = computed(() => this.data.platformSnapshot(this.range()));

  protected readonly chart = computed<ChartGeometry>(() => buildLineChart(this.snapshot().volume));

  /** Rupee figures with the grouping the rest of the console uses. */
  protected inr(value: number): string {
    return `₹${formatNumber(value)}`;
  }

  protected readonly columns: DataColumn<WorkspaceUsage>[] = [
    { key: 'name', label: 'Workspace', sortable: true, value: (row) => row.name },
    { key: 'tier', label: 'Plan', sortable: true, width: '7rem' },
    {
      key: 'status',
      label: 'State',
      sortable: true,
      value: (row) => row.status,
    },
    {
      key: 'messages30d',
      label: 'Messages, 30d',
      align: 'end',
      sortable: true,
      format: (row) => formatNumber(row.messages30d),
    },
    {
      key: 'conversations',
      label: 'Conversations',
      align: 'end',
      sortable: true,
      format: (row) => formatNumber(row.conversations),
    },
    {
      key: 'seats',
      label: 'Seats',
      align: 'end',
      sortable: true,
      format: (row) => `${row.seats} · ${row.agentsOnline} online`,
    },
  ];

  protected readonly rowKey = (row: WorkspaceUsage): string => row.tenantId;

  protected setRange(range: ReportRange): void {
    this.range.set(range);
  }

  protected statusLabel(status: TenantStatus): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'onboarding':
        return 'Onboarding';
      case 'whatsapp_pending':
        return 'WhatsApp pending';
      case 'suspended':
        return 'Suspended';
      case 'archived':
        return 'Archived';
      default:
        return 'Trial lead';
    }
  }

  protected statusTone(status: TenantStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'active':
        return 'success';
      case 'onboarding':
      case 'whatsapp_pending':
      case 'lead_trial':
        return 'warning';
      case 'suspended':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  /** The funnel's drop-off line, in plain words. */
  protected readonly funnelNote = computed(() => {
    const stages = this.snapshot().activation;
    const weakest = [...stages].slice(1).sort((a, b) => a.pctOfPrevious - b.pctOfPrevious)[0];

    if (!weakest || weakest.pctOfPrevious >= 100) {
      return 'Every workspace has taken every step.';
    }

    return `Biggest drop-off: ${weakest.label.toLowerCase()} — ${weakest.pctOfPrevious}% of the step before it.`;
  });

  /** Days, with a readable plural. */
  protected days(value: number | null): string {
    if (value === null) return '—';
    if (value === 0) return 'Same day';

    return `${value} ${value === 1 ? 'day' : 'days'}`;
  }

  /** Which tier a bar belongs to, for its colour. */
  protected tierClass(tier: TierSlice): string {
    return `ana-tier__fill ana-tier__fill--${tier.tier.toLowerCase()}`;
  }

  protected stageClass(stage: ActivationStage): string {
    return `ana-funnel__fill ana-funnel__fill--${stage.key}`;
  }
}
