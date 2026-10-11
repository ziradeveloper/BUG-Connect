import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { ChatFlow } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { formatNumber, formatRelative } from '../../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

/**
 * Flow Builder list (`/flows`, wave 6).
 *
 * The index into the automation module: one row per saved flow with its trigger,
 * live/draft state, graph size and the last 30 days of traffic. Rows open the
 * canvas; the row actions reach the simulator, the history and the live toggle.
 */
@Component({
  selector: 'app-flows-page',
  imports: [
    RouterLink,
    DataTableComponent,
    DataTableCellDirective,
    PageHeader,
    StatusPill,
    ConfirmDialog,
  ],
  templateUrl: './flows-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly pendingToggle = signal<ChatFlow | null>(null);

  protected readonly canManage = computed(() => this.permissions.can('flows.manage', 'edit'));

  protected readonly rows = computed(() =>
    [...this.data.flows()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );

  protected readonly summary = computed(() => {
    const flows = this.data.flows();
    const sessions = flows.reduce((total, flow) => total + flow.sessions30d, 0);
    const handoff = flows.length
      ? Math.round(flows.reduce((total, flow) => total + flow.handoffRate, 0) / flows.length)
      : 0;

    return {
      total: flows.length,
      live: flows.filter((flow) => flow.isActive).length,
      sessions,
      handoff,
      versions: this.data.flowVersions().length,
    };
  });

  protected readonly columns: DataColumn<ChatFlow>[] = [
    { key: 'name', label: 'Flow', sortable: true, cellClass: 'data-table__primary' },
    {
      key: 'triggerKeyword',
      label: 'Trigger',
      sortable: true,
      value: (flow) => flow.triggerKeyword ?? '',
      format: (flow) => (flow.triggerKeyword ? `/${flow.triggerKeyword}` : 'No keyword'),
    },
    {
      key: 'isActive',
      label: 'Status',
      sortable: true,
      align: 'center',
      value: (flow) => (flow.isActive ? 1 : 0),
    },
    {
      key: 'version',
      label: 'Version',
      sortable: true,
      align: 'center',
      format: (flow) => `v${flow.version}`,
    },
    {
      key: 'sessions30d',
      label: 'Sessions (30d)',
      sortable: true,
      align: 'center',
      type: 'number',
      format: (flow) => formatNumber(flow.sessions30d),
    },
    {
      key: 'handoffRate',
      label: 'Handoff',
      sortable: true,
      align: 'center',
      type: 'number',
      format: (flow) => `${flow.handoffRate}%`,
    },
    {
      key: 'updatedAt',
      label: 'Last edited',
      sortable: true,
      value: (flow) => flow.updatedAt,
      format: (flow) => formatRelative(flow.updatedAt),
    },
    { key: 'actions', label: '', align: 'end', sortable: false },
  ];

  protected nodeCount(flow: ChatFlow): number {
    return this.data.graphFor(flow.id)?.nodes.length ?? 0;
  }

  protected statusLabel(flow: ChatFlow): string {
    return flow.isActive ? 'Live' : 'Draft';
  }

  protected triggerLabel(flow: ChatFlow): string {
    return flow.triggerKeyword ? `/${flow.triggerKeyword}` : 'No keyword';
  }

  protected toggleLabel(flow: ChatFlow): string {
    return flow.isActive ? 'Move to draft' : 'Take live';
  }

  protected conditionLabel(flow: ChatFlow): string {
    return (
      this.data
        .graphFor(flow.id)
        ?.nodes.filter((node) => node.condition)
        .map((node) => node.condition as string)[0] ?? 'No conditions'
    );
  }

  protected async openCanvas(flow: ChatFlow): Promise<void> {
    await this.router.navigate(['/flows', flow.id, 'edit']);
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  protected async confirmToggle(): Promise<void> {
    const flow = this.pendingToggle();
    if (!flow) {
      return;
    }

    const wasActive = flow.isActive;
    await this.data.setFlowActive(flow.id, !wasActive);
    this.notice.set(`${flow.name} is now ${wasActive ? 'a draft' : 'live'}.`);
    this.pendingToggle.set(null);
  }
}
