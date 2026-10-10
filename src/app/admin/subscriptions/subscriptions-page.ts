import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import type { SubscriptionEvent, SubscriptionState, Tenant } from '../../core/data/entities';
import { DataTableComponent } from '../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../shared/data-table/data-table.model';
import type { DataColumn } from '../../shared/data-table/data-table.model';
import { formatRelative } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

type SubscriptionRow = Tenant & { state: SubscriptionState; stateAt: string; stateReason: string };

/**
 * One row per tenant with its current subscription state (`/subscriptions`).
 * The state is derived, not stored: the newest subscription event wins, and a
 * suspended workspace reads as suspended whatever its billing says.
 */
@Component({
  selector: 'app-subscriptions-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './subscriptions-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionsPage {
  protected readonly data = inject(MockDataService);

  protected readonly rows = computed<SubscriptionRow[]>(() =>
    this.data
      .tenants()
      .map((tenant) => {
        const trail = this.data
          .subscriptionEventsForTenant(tenant.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        const latest = trail[trail.length - 1];

        return {
          ...tenant,
          state: tenant.status === 'suspended' ? 'suspended' : (latest?.to ?? 'trial'),
          stateAt: latest?.createdAt ?? tenant.createdAt,
          stateReason: latest?.reason ?? 'Workspace provisioned with a 14-day trial.',
        };
      })
      .sort((a, b) => b.stateAt.localeCompare(a.stateAt)),
  );

  protected readonly summary = computed(() => {
    const rows = this.rows();
    return {
      total: rows.length,
      active: rows.filter((row) => row.state === 'active').length,
      trial: rows.filter((row) => row.state === 'trial').length,
      attention: rows.filter((row) => row.state === 'grace' || row.state === 'expired' || row.state === 'suspended').length,
    };
  });

  protected readonly columns: DataColumn<SubscriptionRow>[] = [
    { key: 'businessName', label: 'Client', sortable: true },
    { key: 'subscriptionTier', label: 'Plan', sortable: true, align: 'center' },
    { key: 'state', label: 'State', sortable: true, align: 'center' },
    {
      key: 'stateAt',
      label: 'Since',
      sortable: true,
      value: (row) => row.stateAt,
      format: (row) => formatRelative(row.stateAt),
    },
    { key: 'stateReason', label: 'What triggered it', sortable: false },
    { key: 'actions', label: '', align: 'end', sortable: false },
  ];

  protected stateTone(state: SubscriptionState): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (state) {
      case 'active':
        return 'success';
      case 'trial':
        return 'info';
      case 'grace':
        return 'warning';
      case 'suspended':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  protected stateLabel(state: SubscriptionState): string {
    return state.charAt(0).toUpperCase() + state.slice(1);
  }
}

export type { SubscriptionEvent };
