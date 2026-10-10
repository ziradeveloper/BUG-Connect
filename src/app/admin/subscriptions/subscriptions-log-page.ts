import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import type { SubscriptionEvent } from '../../core/data/entities';
import { DataTableComponent } from '../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../shared/data-table/data-table.model';
import type { DataColumn } from '../../shared/data-table/data-table.model';
import { formatDateTime, formatRelative } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

type LogRow = SubscriptionEvent & { tenantName: string };

/**
 * The full subscription transition trail (`/subscriptions/log`), newest first.
 * Suspension from the Clients list lands here as history, not as billing.
 */
@Component({
  selector: 'app-subscriptions-log-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './subscriptions-log-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionsLogPage {
  protected readonly data = inject(MockDataService);

  protected readonly rows = signal<LogRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly columns: DataColumn<LogRow>[] = [
    { key: 'tenantName', label: 'Client', sortable: true, cellClass: 'data-table__primary' },
    { key: 'transition', label: 'Transition', sortable: false, align: 'center' },
    { key: 'reason', label: 'Reason', sortable: false },
    { key: 'actor', label: 'Actor', sortable: true, align: 'center' },
    {
      key: 'createdAt',
      label: 'When',
      sortable: true,
      value: (row) => row.createdAt,
      format: (row) => formatRelative(row.createdAt),
    },
  ];

  constructor() {
    this.load();
  }

  protected transition(row: LogRow): string {
    return row.from ? `${label(row.from)} → ${label(row.to)}` : `Entered ${label(row.to)}`;
  }

  protected exact(iso: string): string {
    return formatDateTime(iso);
  }

  protected ago(iso: string): string {
    return formatRelative(iso);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.data.listSubscriptionEvents().then(
      (page) => {
        const rows = page.items
          .map((event) => ({
            ...event,
            tenantName: this.data.tenantById(event.tenantId)?.businessName ?? 'Unknown workspace',
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        this.rows.set(rows);
        this.loading.set(false);
      },
      () => {
        this.error.set('The subscription log could not be loaded.');
        this.loading.set(false);
      },
    );
  }
}

function label(state: SubscriptionEvent['to']): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}
