import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import {
  FIRST_RESPONSE_TARGET_MIN,
  REPORT_RANGES,
  type ReportRange,
} from '../../../core/data/analytics';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { AgentScore } from '../../../core/data/analytics';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { buildLineChart, type ChartGeometry } from '../../../shared/chart-geometry';
import { formatNumber } from '../../../shared/format';
import { PageHeader } from '../../../shared/ui/ui';

/**
 * Analytics & Insights (`/reports`, wave 6).
 *
 * Every figure is derived from this workspace's own conversations, messages,
 * flows, forms and campaigns by `core/data/analytics.ts` — there is no charting
 * dependency here. The volume chart is one inline SVG (a path, two polylines and
 * a circle per day, each with a native `<title>` tooltip), the containment ring
 * is a conic gradient, and the funnel and leaderboard bars are plain CSS widths.
 *
 * Readable by a business owner: the KPI row answers "how fast do we answer, how
 * much does automation save us, and did the broadcast land", and the panels
 * below it show the evidence.
 */
@Component({
  selector: 'app-reports-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader],
  templateUrl: './reports-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  protected readonly ranges = REPORT_RANGES;
  protected readonly target = FIRST_RESPONSE_TARGET_MIN;
  protected readonly range = signal<ReportRange>(7);

  /** The snapshot for the selected window; recomputed on the range change alone. */
  protected readonly report = computed(() => this.data.reportSnapshot(this.range()));

  /** The daily series, mapped into SVG coordinates by the shared geometry. */
  protected readonly chart = computed<ChartGeometry>(() =>
    buildLineChart(this.report().volume),
  );

  protected readonly columns: DataColumn<AgentScore>[] = [
    { key: 'name', label: 'Agent', sortable: true, value: (agent) => agent.name },
    {
      key: 'assigned',
      label: 'Conversations',
      align: 'end',
      sortable: true,
      format: (agent) => formatNumber(agent.assigned),
    },
    {
      key: 'resolved',
      label: 'Resolved',
      align: 'end',
      sortable: true,
      format: (agent) => `${agent.resolved} · ${agent.resolvedPct}%`,
    },
    {
      key: 'response',
      label: 'Avg first reply',
      align: 'end',
      sortable: true,
      value: (agent) => agent.avgFirstResponseMin ?? Number.POSITIVE_INFINITY,
      format: (agent) => ReportsPage.minutes(agent.avgFirstResponseMin),
    },
  ];

  /** A one-line reading of the window, for the header and screen readers. */
  protected readonly summary = computed(() => {
    const snapshot = this.report();

    return [
      `${formatNumber(snapshot.messagesTotal)} messages in the last ${snapshot.range} days`,
      snapshot.response.medianFirstResponseMin === null
        ? 'no threads answered yet'
        : `median first reply ${ReportsPage.minutes(snapshot.response.medianFirstResponseMin)}`,
      `${snapshot.automation.containedPct}% of bot sessions never reached an agent`,
    ].join(' · ');
  });

  /** Agents are keyed by user id, not `id`. */
  protected readonly agentKey = (agent: AgentScore): string => agent.userId;

  protected readonly formatNumber = formatNumber;

  protected readonly canManageFlows = computed(() => this.permissions.can('flows.view'));

  /** The containment ring: brand sweep for contained sessions, border for handoffs. */
  protected readonly ring = computed(() => {
    const contained = this.report().automation.containedPct;

    return `conic-gradient(var(--theme-brand) 0% ${contained}%, var(--theme-border) ${contained}% 100%)`;
  });

  /** Funnel stage colours, keyed by the analytics module's own stage names. */
  protected funnelTone(key: string): string {
    return (
      {
        audience: 'neutral',
        sent: 'info',
        delivered: 'brand',
        read: 'success',
        replied: 'warning',
      } as Record<string, string>
    )[key] ?? 'neutral';
  }

  protected setRange(range: ReportRange): void {
    this.range.set(range);
  }

  /** `12m`, `1h 05m`, or an em dash when nothing was measurable. */
  protected static minutes(minutes: number | null): string {
    if (minutes === null) return '—';
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);

    return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
  }

  protected minutes = ReportsPage.minutes;
}
