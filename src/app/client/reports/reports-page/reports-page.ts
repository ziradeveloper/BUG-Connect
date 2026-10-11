import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import {
  FIRST_RESPONSE_TARGET_MIN,
  REPORT_RANGES,
  type ReportRange,
  type VolumePoint,
} from '../../../core/data/analytics';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { AgentScore } from '../../../core/data/analytics';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { formatNumber } from '../../../shared/format';
import { PageHeader } from '../../../shared/ui/ui';

/** Geometry of the volume chart, in the SVG's own 600×220 user space. */
interface ChartGeometry {
  inbound: string;
  outbound: string;
  area: string;
  /** Rounded-up axis maximum, so the gridlines land on whole messages. */
  max: number;
  gridlines: { y: number; label: string }[];
  points: { x: number; y: number; total: number; point: VolumePoint }[];
  /** Day labels under the chart, thinned out so a 90-day window stays legible. */
  labels: string[];
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 220;
const PADDING = { top: 14, right: 14, bottom: 26, left: 46 };

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

  protected readonly chart = computed<ChartGeometry>(() =>
    ReportsPage.buildChart(this.report().volume),
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

  /**
   * Maps the daily series into SVG coordinates. The axis maximum is rounded up
   * to the next five so the gridlines read as whole messages, and a flat window
   * still draws a baseline rather than dividing by zero.
   */
  private static buildChart(volume: VolumePoint[]): ChartGeometry {
    const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
    const rawMax = Math.max(...volume.map((point) => point.total), 1);
    const max = Math.max(5, Math.ceil((rawMax * 1.1) / 5) * 5);
    const step = volume.length > 1 ? plotWidth / (volume.length - 1) : 0;
    const xAt = (index: number): number => PADDING.left + index * step;
    const yAt = (value: number): number =>
      PADDING.top + plotHeight - (value / max) * plotHeight;

    const points = volume.map((point, index) => ({
      x: Math.round(xAt(index) * 10) / 10,
      y: Math.round(yAt(point.total) * 10) / 10,
      total: point.total,
      point,
    }));
    const baseline = PADDING.top + plotHeight;
    const line = (pick: (point: VolumePoint) => number): string =>
      points
        .map((entry, index) => `${index === 0 ? 'M' : 'L'}${entry.x},${yAt(pick(entry.point)).toFixed(1)}`)
        .join(' ');
    const area = points.length
      ? `${line((point) => point.inbound)} L${points[points.length - 1]!.x},${baseline} L${points[0]!.x},${baseline} Z`
      : '';
    const labelEvery = Math.max(1, Math.ceil(volume.length / 7));

    return {
      inbound: line((point) => point.inbound),
      outbound: line((point) => point.outbound),
      area,
      max,
      gridlines: [1, 0.75, 0.5, 0.25, 0].map((fraction) => ({
        y: Math.round(yAt(max * fraction) * 10) / 10,
        label: String(Math.round(max * fraction)),
      })),
      points,
      labels: volume
        .filter((_, index) => index % labelEvery === 0 || index === volume.length - 1)
        .map((point) => point.label),
    };
  }
}
