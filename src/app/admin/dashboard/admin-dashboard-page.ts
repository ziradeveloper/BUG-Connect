import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MockDataService } from '../../core/data/mock-data.service';
import { DataTableComponent } from '../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../shared/data-table/data-table.model';
import type { DataColumn } from '../../shared/data-table/data-table.model';
import type { Tenant, WebhookEvent } from '../../core/data/entities';
import { formatNumber, formatRelative } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

type TenantRollup = Tenant & { failedEvents: number; latencyP95: number };

/** Platform-level numbers. Nothing here reaches into a tenant's business data. */
@Component({
  selector: 'app-admin-dashboard-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  template: `
    <div class="workspace-page">
      <app-page-header
        eyebrow="PLATFORM"
        title="Platform dashboard"
        description="Provisioning, connection state and delivery health across every workspace."
      />

      <div class="metric-grid">
        @for (metric of metrics(); track metric.label) {
          <div class="metric" [class.metric--brand]="metric.brand">
            <span class="metric__label">{{ metric.label }}</span>
            <span class="metric__value">{{ metric.value }}</span>
            <span class="metric__hint">{{ metric.hint }}</span>
          </div>
        }
      </div>

      <section class="surface admin-panel" aria-labelledby="rollup">
        <header class="admin-panel__head">
          <div>
            <p class="eyebrow">BY WORKSPACE</p>
            <h2 id="rollup">Tenants, traffic and webhook failures</h2>
          </div>
          <a class="button button-secondary" routerLink="/clients">Manage clients</a>
        </header>

        <app-data-table
          [columns]="columns"
          [rows]="rollup()"
          caption="Per-tenant traffic and webhook outcome"
          searchPlaceholder="Search workspaces"
          emptyTitle="No workspaces match this filter"
          emptyDescription="Onboarded clients appear here as soon as they are provisioned."
        >
          <ng-template appCell="businessName" let-row>
            <strong class="data-table__primary">{{ row.businessName }}</strong>
            <code class="data-table__mono">{{ row.subdomain }}</code>
          </ng-template>

          <ng-template appCell="status" let-row>
            <app-status-pill
              [label]="row.status"
              [tone]="row.failedEvents > 0 ? 'warning' : 'success'"
            />
          </ng-template>

          <ng-template appCell="latencyP95" let-row>
            <span [class.data-table__danger]="row.latencyP95 > 150">{{ row.latencyP95 }} ms</span>
          </ng-template>

          <ng-template appCell="failedEvents" let-row>
            @if (row.failedEvents) {
              <app-status-pill [label]="row.failedEvents + ' failed'" tone="danger" />
            } @else {
              <span class="data-table__subdued">none</span>
            }
          </ng-template>
        </app-data-table>
      </section>

      <section class="surface admin-panel" aria-labelledby="events">
        <header class="admin-panel__head">
          <div>
            <p class="eyebrow">INGESTION</p>
            <h2 id="events">Recent webhook events</h2>
          </div>
          <a class="button button-secondary" routerLink="/health">Queue monitor</a>
        </header>

        <ul class="event-list">
          @for (event of events(); track event.id) {
            <li class="event-list__item">
              <span
                class="event-list__dot"
                [attr.data-outcome]="event.outcome"
                aria-hidden="true"
              ></span>
              <span class="event-list__main">
                <strong>{{ event.type }}</strong>
                <small class="text-muted"
                  >{{ tenantName(event.tenantId) }} · {{ ago(event.receivedAt) }}</small
                >
              </span>
              <span class="event-list__ack">{{ event.ackMs }} ms</span>
            </li>
          }
        </ul>

        <p class="admin-panel__note text-muted">
          Acknowledgement stays well inside the three seconds Meta allows. Failures here are
          processing problems after the 200, which is the point of the decoupled queue.
        </p>
      </section>
    </div>
  `,
  styles: `
    .admin-panel {
      padding: clamp(1.1rem, 2.2vw, 1.6rem);
    }

    .admin-panel__head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-block-end: 1rem;
    }

    .admin-panel__head h2 {
      margin: 0.4rem 0 0;
      color: var(--theme-text-primary);
      font-size: 1.1rem;
      font-weight: 720;
      letter-spacing: -0.04em;
    }

    .admin-panel__head .button {
      min-height: 2.25rem;
      font-size: 0.78rem;
    }

    .admin-panel__note {
      margin: 1rem 0 0;
      font-size: 0.75rem;
      line-height: 1.6;
    }

    .event-list {
      display: grid;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .event-list__item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-block-end: 1px solid var(--theme-border);
      padding: 0.6rem 0;
    }

    .event-list__item:last-child {
      border-block-end: 0;
    }

    .event-list__dot {
      inline-size: 0.5rem;
      block-size: 0.5rem;
      flex: 0 0 auto;
      border-radius: 50%;
      background-color: var(--theme-success);
    }

    .event-list__dot[data-outcome='queued'] {
      background-color: var(--theme-info);
    }

    .event-list__dot[data-outcome='duplicate'] {
      background-color: var(--theme-warning);
    }

    .event-list__dot[data-outcome='failed'] {
      background-color: var(--theme-danger);
    }

    .event-list__main {
      display: grid;
      min-width: 0;
      flex: 1;
      gap: 0.1rem;
    }

    .event-list__main strong {
      color: var(--theme-text-primary);
      font-size: 0.8rem;
      font-weight: 650;
    }

    .event-list__main small {
      font-size: 0.7rem;
    }

    .event-list__ack {
      color: var(--theme-text-secondary);
      font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
      font-size: 0.7rem;
    }

    .data-table__danger {
      color: var(--theme-danger);
      font-weight: 700;
    }

    code.data-table__mono {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage {
  private readonly data = inject(MockDataService);

  protected readonly events = signal<WebhookEvent[]>([]);

  constructor() {
    this.data.listWebhookEvents().then((page) => this.events.set(page.items));
  }

  protected readonly rollup = computed<TenantRollup[]>(() => {
    const events = this.data.webhookEvents();
    return this.data.tenants().map((tenant) => {
      const scoped = events.filter((event) => event.tenantId === tenant.id);
      const acks = scoped.map((event) => event.ackMs).sort((left, right) => left - right);

      return {
        ...tenant,
        failedEvents: scoped.filter((event) => event.outcome === 'failed').length,
        latencyP95: acks.length ? (acks[Math.floor(acks.length * 0.95) - 1] ?? 0) : 0,
      };
    });
  });

  protected readonly metrics = computed(() => {
    const tenants = this.data.tenants();
    const users = this.data.allUsers();
    const failed = this.events().filter((event) => event.outcome === 'failed').length;

    return [
      {
        label: 'Workspaces',
        value: formatNumber(tenants.length),
        hint: 'Provisioned tenants',
        brand: true,
      },
      {
        label: 'Active',
        value: formatNumber(tenants.filter((tenant) => tenant.status === 'active').length),
        hint: 'Connected and taking chats',
        brand: false,
      },
      {
        label: 'Awaiting connection',
        value: formatNumber(tenants.filter((tenant) => tenant.status !== 'active').length),
        hint: 'Onboarding or pending WhatsApp',
        brand: false,
      },
      {
        label: 'Seats in use',
        value: formatNumber(users.length),
        hint: 'Unlimited per plan, priced on usage',
        brand: false,
      },
      {
        label: 'Contacts',
        value: formatNumber(tenants.reduce((total, tenant) => total + tenant.contactCount, 0)),
        hint: 'Across every workspace',
        brand: false,
      },
      {
        label: 'Failed events',
        value: formatNumber(failed),
        hint: 'After acknowledgement, in the queue',
        brand: failed > 0,
      },
    ];
  });

  protected readonly columns: DataColumn<TenantRollup>[] = [
    { key: 'businessName', label: 'Workspace', sortable: true },
    { key: 'subscriptionTier', label: 'Plan', sortable: true, align: 'center' },
    { key: 'status', label: 'State', sortable: true, align: 'center' },
    { key: 'seatsUsed', label: 'Seats', sortable: true, align: 'center', type: 'number' },
    {
      key: 'monthlyMessages',
      label: 'Messages / 30d',
      sortable: true,
      align: 'end',
      type: 'number',
    },
    { key: 'latencyP95', label: 'Ack p95', sortable: true, align: 'end', type: 'number' },
    { key: 'failedEvents', label: 'Failures', sortable: true, align: 'end', type: 'number' },
  ];

  protected tenantName(id: string): string {
    return (
      this.data.tenants().find((tenant) => tenant.id === id)?.businessName ?? 'Unknown workspace'
    );
  }

  protected ago(iso: string): string {
    return formatRelative(iso);
  }
}
