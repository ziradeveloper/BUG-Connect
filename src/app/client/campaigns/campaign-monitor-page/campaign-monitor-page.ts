import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import { renderTemplateBody } from '../../../core/data/whatsapp';
import { formatDateTime, formatNumber, formatRelative, formatTimeOfDay } from '../../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

/** How often the monitor asks for the next delivery batch. */
const POLL_MS = 2500;

/**
 * Campaign Delivery Monitor (`/campaigns/:id`, wave 6).
 *
 * The dummy layer has no websocket, so this page polls: every tick calls
 * `tickCampaign()`, which advances the counters by one paced batch and appends a
 * sample — exactly what a run of status webhooks would do. Polling is a read in
 * intent (delivery happens whether or not anyone watches) and is browser-only,
 * so SSR never starts a timer. Starting and pausing the broadcast are separate,
 * gated actions.
 */
@Component({
  selector: 'app-campaign-monitor-page',
  imports: [RouterLink, PageHeader, StatusPill, ConfirmDialog],
  templateUrl: './campaign-monitor-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignMonitorPage implements OnDestroy {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);
  private readonly platformId = inject(PLATFORM_ID);

  /** Route parameter (`/campaigns/:id`) via component input binding. */
  readonly id = input('');

  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly live = signal(true);
  protected readonly ticks = signal(0);
  protected readonly ticking = signal(false);
  protected readonly pending = signal<'start' | 'pause' | null>(null);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.timer = setInterval(() => void this.poll(), POLL_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.live() || this.ticking()) {
      return;
    }
    const campaign = this.campaign();
    if (!campaign || campaign.status !== 'sending') {
      return;
    }

    this.ticking.set(true);
    try {
      await this.data.tickCampaign(campaign.id);
      this.ticks.update((count) => count + 1);
    } finally {
      this.ticking.set(false);
    }
  }

  protected readonly campaign = computed(() => this.data.campaignById(this.id()));

  protected readonly missing = computed(() => Boolean(this.id()) && !this.campaign());

  protected readonly canManage = computed(() => this.permissions.can('campaigns.manage', 'edit'));

  protected readonly metrics = computed(() =>
    this.data.campaignMetrics(this.id()),
  );

  protected readonly samples = computed(() => this.data.samplesFor(this.id()));

  /** The newest sample is the truth when the counters have moved past it. */
  protected readonly latest = computed(() => {
    const campaign = this.campaign();
    const samples = this.samples();
    const last = samples[samples.length - 1];

    return {
      sent: campaign?.sent ?? last?.sent ?? 0,
      delivered: campaign?.delivered ?? last?.delivered ?? 0,
      read: campaign?.read ?? last?.read ?? 0,
      failed: campaign?.failed ?? last?.failed ?? 0,
      at: last?.at ?? null,
    };
  });

  /** Bars for the chart, scaled to the busiest sample. */
  protected readonly chart = computed(() => {
    const samples = this.samples();
    const peak = Math.max(1, ...samples.map((sample) => sample.sent));

    return samples.map((sample) => ({
      id: sample.id,
      at: sample.at,
      sent: Math.round((sample.sent / peak) * 100),
      delivered: Math.round((sample.delivered / peak) * 100),
      read: Math.round((sample.read / peak) * 100),
      sentTotal: sample.sent,
    }));
  });

  protected readonly template = computed(() => this.data.templateFor(this.id()));

  protected readonly segment = computed(() => this.data.segmentFor(this.id()));

  /** The message as it went out, with the template's own sample values. */
  protected readonly previewBody = computed(() => {
    const template = this.template();
    if (!template) {
      return null;
    }
    return renderTemplateBody(template.body, template.variableLabels ?? []);
  });

  /** Audit rows this broadcast produced, newest first. */
  protected readonly activity = computed(() => {
    const campaign = this.campaign();
    if (!campaign) {
      return [];
    }
    return this.data
      .auditForTenant(campaign.tenantId)
      .filter((event) => event.area === 'campaigns' && event.target.includes(campaign.name))
      .slice(0, 6);
  });

  protected readonly statusLabel = computed(() => {
    switch (this.campaign()?.status) {
      case 'sending':
        return 'Sending';
      case 'scheduled':
        return 'Scheduled';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'draft':
        return 'Draft';
      default:
        return 'Unknown';
    }
  });

  protected readonly statusTone = computed<'success' | 'warning' | 'info' | 'neutral'>(() => {
    switch (this.campaign()?.status) {
      case 'sending':
        return 'success';
      case 'scheduled':
        return 'info';
      case 'paused':
        return 'warning';
      default:
        return 'neutral';
    }
  });

  protected readonly rate = (value: number, base: number): number =>
    base > 0 ? Math.round((value / base) * 100) : 0;

  protected readonly formatNumber = formatNumber;

  protected toggleLive(): void {
    this.live.update((current) => !current);
  }

  protected ask(action: 'start' | 'pause'): void {
    this.pending.set(action);
  }

  protected async confirm(): Promise<void> {
    const action = this.pending();
    const campaign = this.campaign();
    this.pending.set(null);
    if (!action || !campaign) {
      return;
    }

    this.error.set(null);
    const saved =
      action === 'start'
        ? await this.data.startCampaign(campaign.id)
        : await this.data.pauseCampaign(campaign.id);

    if (!saved) {
      this.error.set(
        action === 'start'
          ? 'That campaign cannot start — check its template and audience.'
          : 'That campaign is not sending.',
      );
      return;
    }

    this.notice.set(
      action === 'start'
        ? `${saved.name} is sending.`
        : `${saved.name} paused after ${formatNumber(saved.sent)} sends.`,
    );
  }

  protected dismiss(): void {
    this.notice.set(null);
    this.error.set(null);
  }

  protected timeLabel(iso: string | null): string {
    return iso ? formatTimeOfDay(iso) : '—';
  }

  protected fullTimeLabel(iso: string | null): string {
    return iso ? formatDateTime(iso) : '—';
  }

  protected relativeLabel(iso: string | null | undefined): string {
    return formatRelative(iso);
  }
}
