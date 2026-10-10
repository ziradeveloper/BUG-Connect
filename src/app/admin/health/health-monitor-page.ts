import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import type { WebhookEvent } from '../../core/data/entities';
import { DataTableComponent } from '../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../shared/data-table/data-table.model';
import type { DataColumn } from '../../shared/data-table/data-table.model';
import { formatRelative } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

type EventRow = WebhookEvent & { tenantName: string };

const ACK_TARGET_MS = 150;
const META_BUDGET_MS = 3000;

const OUTCOMES: WebhookEvent['outcome'][] = ['failed', 'queued', 'processed', 'duplicate'];

/**
 * Queue health (`/health/monitor`): acknowledgement latency against Meta's
 * three-second budget, the outcome mix, and the dead-letter queue — failed
 * events the operator acknowledges back into the retry queue.
 */
@Component({
  selector: 'app-health-monitor-page',
  imports: [DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './health-monitor-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthMonitorPage {
  protected readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  protected readonly rows = signal<EventRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly activeOutcome = signal<WebhookEvent['outcome'] | null>(null);
  protected readonly acking = signal<string | null>(null);

  protected readonly outcomes = OUTCOMES;
  protected readonly ackTarget = ACK_TARGET_MS;

  protected readonly canAck = computed(() => this.permissions.can('health.view', 'edit'));

  protected readonly filtered = computed(() => {
    const wanted = this.activeOutcome();
    const rows = this.rows();
    return wanted ? rows.filter((row) => row.outcome === wanted) : rows;
  });

  protected readonly stats = computed(() => {
    const rows = this.rows();
    const acks = rows.map((row) => row.ackMs).sort((a, b) => a - b);

    return {
      total: rows.length,
      failed: rows.filter((row) => row.outcome === 'failed').length,
      queued: rows.filter((row) => row.outcome === 'queued').length,
      duplicate: rows.filter((row) => row.outcome === 'duplicate').length,
      p50: percentile(acks, 50),
      p95: percentile(acks, 95),
      max: acks.length ? acks[acks.length - 1]! : 0,
      overTarget: rows.filter((row) => row.ackMs > ACK_TARGET_MS).length,
    };
  });

  protected readonly buckets = computed(() => {
    const rows = this.rows();
    const groups = [
      { label: '≤ 50 ms', test: (ms: number) => ms <= 50 },
      { label: '51–100 ms', test: (ms: number) => ms > 50 && ms <= 100 },
      { label: '101–150 ms', test: (ms: number) => ms > 100 && ms <= ACK_TARGET_MS },
      { label: '> 150 ms', test: (ms: number) => ms > ACK_TARGET_MS },
    ].map((group) => ({ label: group.label, count: rows.filter((row) => group.test(row.ackMs)).length }));

    const peak = Math.max(1, ...groups.map((group) => group.count));
    return groups.map((group) => ({ ...group, width: Math.round((group.count / peak) * 100) }));
  });

  protected readonly columns = computed<DataColumn<EventRow>[]>(() => {
    const base: DataColumn<EventRow>[] = [
      { key: 'tenantName', label: 'Workspace', sortable: true },
      { key: 'type', label: 'Event', sortable: true, align: 'center' },
      {
        key: 'ackMs',
        label: 'Ack',
        sortable: true,
        align: 'end',
        type: 'number',
        format: (row) => `${row.ackMs} ms`,
      },
      { key: 'outcome', label: 'Outcome', sortable: true, align: 'center' },
      { key: 'error', label: 'Error', sortable: false },
      {
        key: 'receivedAt',
        label: 'Received',
        sortable: true,
        value: (row) => row.receivedAt,
        format: (row) => formatRelative(row.receivedAt),
      },
    ];

    return this.canAck() ? [...base, { key: 'actions', label: '', align: 'end', sortable: false }] : base;
  });

  constructor() {
    this.load();
  }

  protected selectOutcome(outcome: WebhookEvent['outcome'] | null): void {
    this.activeOutcome.set(outcome);
  }

  protected isActive(outcome: WebhookEvent['outcome'] | null): boolean {
    return this.activeOutcome() === outcome;
  }

  protected outcomeTone(outcome: WebhookEvent['outcome']): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (outcome) {
      case 'processed':
        return 'success';
      case 'queued':
        return 'warning';
      case 'failed':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  protected async acknowledge(row: EventRow): Promise<void> {
    if (!this.canAck() || this.acking()) {
      return;
    }

    this.acking.set(row.id);
    try {
      await this.data.ackWebhookEvent(row.id);
      this.rows.update((rows) =>
        rows.map((candidate) =>
          candidate.id === row.id ? { ...candidate, outcome: 'queued' as const, error: null } : candidate,
        ),
      );
      this.notice.set(`Event for ${row.tenantName} acknowledged back into the retry queue.`);
    } finally {
      this.acking.set(null);
    }
  }

  protected budgetNote(): string {
    return `Meta allows ${META_BUDGET_MS / 1000} seconds for the 200; this platform targets ${ACK_TARGET_MS} ms.`;
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.data.listWebhookEvents().then(
      (page) => {
        const rows = page.items
          .map((event) => ({
            ...event,
            tenantName: this.data.tenantById(event.tenantId)?.businessName ?? 'Unknown workspace',
          }))
          .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
        this.rows.set(rows);
        this.loading.set(false);
      },
      () => {
        this.error.set('Webhook events could not be loaded.');
        this.loading.set(false);
      },
    );
  }
}

function percentile(sorted: number[], pct: number): number {
  if (!sorted.length) {
    return 0;
  }
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * pct) / 100))]!;
}
