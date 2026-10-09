import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { WorkspaceContext } from '../../core/workspace/workspace-context';
import { formatNumber, formatRelative } from '../../shared/format';
import { PageHeader, PlannedState, StatusPill } from '../../shared/ui/ui';

/**
 * The client landing screen. Every number here is an aggregate over the mock
 * dataset the inbox will read from too, so the two never disagree.
 */
@Component({
  selector: 'app-client-dashboard-page',
  imports: [RouterLink, PageHeader, StatusPill, PlannedState],
  template: `
    <div class="workspace-page">
      <app-page-header
        [eyebrow]="contextLabel()"
        [title]="'Good to see you, ' + firstName() + '.'"
        description="Conversations are qualified by the flow first. What you see here is what the router handed to your team."
      />

      @if (!session.user()) {
        <app-planned-state
          icon="⚿"
          phase="Session required"
          title="Sign in to see your queues"
          description="This dashboard is scoped to the signed-in member and their role. The dummy session only proves menus and permissions."
          [includes]="[]"
          back="/login"
        />
      }

      <div class="metric-grid">
        @for (metric of metrics(); track metric.label) {
          <div class="metric" [class.metric--brand]="metric.brand">
            <span class="metric__label">{{ metric.label }}</span>
            <span class="metric__value">{{ metric.value }}</span>
            <span class="metric__hint">{{ metric.hint }}</span>
          </div>
        }
      </div>

      <div class="dashboard-split">
        <section class="surface dashboard-panel" aria-labelledby="needs-attention">
          <header class="dashboard-panel__head">
            <div>
              <p class="eyebrow">FROM THE FLOW ENGINE</p>
              <h2 id="needs-attention">Needs attention</h2>
            </div>
            @if (permissions.can('inbox.view')) {
              <a class="button button-secondary" routerLink="/inbox">Open Team Inbox</a>
            }
          </header>

          @if (recent().length === 0) {
            <p class="text-muted dashboard-empty">
              Nothing is waiting. Every escalated conversation is already assigned.
            </p>
          } @else {
            <ul class="dashboard-list">
              @for (row of recent(); track row.id) {
                <li>
                  <span class="dashboard-list__main">
                    <strong>{{ row.subject }}</strong>
                    <small class="text-muted">
                      {{ row.contactName }} · {{ relative(row.lastMessageAt) }}
                    </small>
                  </span>
                  <app-status-pill [label]="row.statusLabel" [tone]="row.tone" />
                </li>
              }
            </ul>
          }
        </section>

        <section class="surface dashboard-panel" aria-labelledby="plan-scope">
          <header class="dashboard-panel__head">
            <div>
              <p class="eyebrow">WORKSPACE</p>
              <h2 id="plan-scope">Modules available to you</h2>
            </div>
          </header>

          <ul class="dashboard-chips">
            @for (entry of permissions.visibleMenu(); track entry.key) {
              <li>
                <span aria-hidden="true">{{ entry.icon }}</span
                >{{ entry.label }}
                @if (entry.planned) {
                  <em>planned</em>
                }
              </li>
            }
          </ul>

          @if (permissions.hiddenByRole().length) {
            <p class="dashboard-note text-muted">
              {{ permissions.hiddenByRole().length }} module(s) are hidden by your role. A Workspace
              Administrator can enable them under Roles &amp; Menus.
            </p>
          }

          @if (permissions.deniedByPlan().length) {
            <p class="dashboard-note text-muted">
              Also gated by the {{ plan() }} plan: {{ deniedLabels() }}.
            </p>
          }
        </section>
      </div>
    </div>
  `,
  styles: `
    .dashboard-split {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
      gap: 1rem;
      align-items: start;
    }

    .dashboard-panel {
      padding: clamp(1.1rem, 2.2vw, 1.6rem);
    }

    .dashboard-panel__head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.85rem;
    }

    .dashboard-panel__head h2 {
      margin: 0.4rem 0 0;
      color: var(--theme-text-primary);
      font-size: 1.1rem;
      font-weight: 720;
      letter-spacing: -0.04em;
    }

    .dashboard-panel__head .button {
      min-height: 2.25rem;
      font-size: 0.78rem;
    }

    .dashboard-list {
      display: grid;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .dashboard-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      border-bottom: 1px solid var(--theme-border);
      padding: 0.7rem 0;
    }

    .dashboard-list li:last-child {
      border-bottom: 0;
    }

    .dashboard-list__main {
      display: grid;
      min-width: 0;
      gap: 0.15rem;
    }

    .dashboard-list__main strong {
      color: var(--theme-text-primary);
      font-size: 0.85rem;
      font-weight: 650;
    }

    .dashboard-list__main small {
      font-size: 0.72rem;
    }

    .dashboard-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .dashboard-chips li {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      border: 1px solid var(--theme-border);
      border-radius: 999px;
      padding: 0.32rem 0.6rem;
      color: var(--theme-text-primary);
      font-size: 0.72rem;
      font-weight: 600;
    }

    .dashboard-chips em {
      color: var(--theme-brand);
      font-size: 0.6rem;
      font-style: normal;
      text-transform: uppercase;
    }

    .dashboard-note,
    .dashboard-empty {
      margin: 0.9rem 0 0;
      font-size: 0.78rem;
      line-height: 1.6;
    }

    @media (max-width: 1040px) {
      .dashboard-split {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly data = inject(MockDataService);
  private readonly workspace = inject(WorkspaceContext);
  protected readonly permissions = inject(PermissionService);
  protected readonly session = inject(SessionService);

  protected readonly metrics = computed(() => {
    const stats = this.data.inboxStats();

    return [
      {
        label: 'Unassigned',
        value: formatNumber(stats.unassigned),
        hint: 'Waiting for the weighted router',
        brand: true,
      },
      {
        label: 'With an agent',
        value: formatNumber(stats.open),
        hint: 'Open conversations',
        brand: false,
      },
      {
        label: 'In automation',
        value: formatNumber(stats.inFlow),
        hint: 'Not yet escalated',
        brand: false,
      },
      {
        label: 'Pending',
        value: formatNumber(stats.pending),
        hint: 'Waiting on the customer',
        brand: false,
      },
      {
        label: 'Resolved',
        value: formatNumber(stats.resolved),
        hint: 'Capacity freed back to the team',
        brand: false,
      },
      {
        label: 'Spare capacity',
        value: formatNumber(stats.spareCapacity),
        hint: `${stats.onlineAgents} agent(s) online`,
        brand: false,
      },
    ];
  });

  protected readonly recent = computed(() => {
    const contacts = new Map(this.data.contacts().map((contact) => [contact.id, contact]));
    const users = new Map(this.data.users().map((user) => [user.id, user]));

    return [...this.data.conversations()]
      .filter((conversation) => conversation.status !== 'resolved')
      .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt))
      .slice(0, 6)
      .map((conversation) => ({
        id: conversation.id,
        subject: conversation.subject,
        lastMessageAt: conversation.lastMessageAt,
        contactName: contacts.get(conversation.contactId)?.displayName ?? 'Unknown contact',
        assignee: conversation.assignedUserId
          ? (users.get(conversation.assignedUserId)?.fullName ?? '')
          : '',
        statusLabel:
          conversation.status === 'flow'
            ? 'In flow'
            : conversation.status === 'open'
              ? (users.get(conversation.assignedUserId ?? '')?.fullName ?? 'Open')
              : 'Pending',
        tone: (conversation.status === 'pending'
          ? 'danger'
          : conversation.status === 'open'
            ? 'warning'
            : 'info') as 'danger' | 'warning' | 'info',
      }));
  });

  protected readonly plan = computed(() => this.data.currentTenant()?.subscriptionTier ?? 'Pilot');

  protected readonly deniedLabels = computed(() =>
    this.permissions
      .deniedByPlan()
      .map((entry) => entry.label)
      .join(', '),
  );

  protected readonly contextLabel = computed(() => {
    const tenant = this.data.currentTenant();
    return tenant ? `${tenant.businessName}` : this.workspace.displayName();
  });

  protected readonly firstName = computed(
    () => this.session.user()?.fullName.split(' ')[0] ?? 'there',
  );

  protected relative(iso: string): string {
    return formatRelative(iso);
  }
}
