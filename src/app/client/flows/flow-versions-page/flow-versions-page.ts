import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { FlowVersion } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { formatDateTime, formatRelative } from '../../../shared/format';
import { ConfirmDialog, PageHeader } from '../../../shared/ui/ui';

/**
 * Flow version history (`/flows/:id/versions`, wave 6).
 *
 * Every publish appends a snapshot, so this table is the flow's changelog.
 * Restoring an older version does not rewrite history: it publishes the old
 * nodes as a new version, which is what makes the trail trustworthy.
 */
@Component({
  selector: 'app-flow-versions-page',
  imports: [
    RouterLink,
    DataTableComponent,
    DataTableCellDirective,
    PageHeader,
    ConfirmDialog,
  ],
  templateUrl: './flow-versions-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowVersionsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  /** Route parameter (`/flows/:id/versions`) fed in by component input binding. */
  readonly id = input('');

  protected readonly loading = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly pendingRestore = signal<FlowVersion | null>(null);

  protected readonly flow = computed(() => this.data.flowById(this.id()));
  protected readonly canManage = computed(() => this.permissions.can('flows.manage', 'edit'));

  protected readonly rows = computed(() => this.data.versionsFor(this.id()));

  protected readonly columns: DataColumn<FlowVersion>[] = [
    {
      key: 'version',
      label: 'Version',
      sortable: true,
      align: 'center',
      format: (version) => `v${version.version}`,
    },
    { key: 'note', label: 'Note', sortable: true, cellClass: 'data-table__primary' },
    { key: 'author', label: 'Published by', sortable: true },
    {
      key: 'nodeCount',
      label: 'Nodes',
      sortable: true,
      align: 'center',
      type: 'number',
    },
    {
      key: 'publishedAt',
      label: 'Published',
      sortable: true,
      value: (version) => version.publishedAt,
      format: (version) => formatDateTime(version.publishedAt),
    },
    { key: 'actions', label: '', align: 'end', sortable: false },
  ];

  protected readonly summary = computed(() => {
    const versions = this.rows();
    const newest = versions[0] ?? null;

    return {
      total: versions.length,
      current: newest?.version ?? 0,
      authors: new Set(versions.map((version) => version.author)).size,
      oldest: versions.length ? versions[versions.length - 1]?.version ?? 0 : 0,
    };
  });

  protected isCurrent(version: FlowVersion): boolean {
    return version.version === this.flow()?.version;
  }

  protected publishedLabel(version: FlowVersion): string {
    return formatRelative(version.publishedAt);
  }

  protected askRestore(version: FlowVersion, event: Event): void {
    event.stopPropagation();
    this.pendingRestore.set(version);
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }

  protected async confirmRestore(): Promise<void> {
    const version = this.pendingRestore();
    const flow = this.flow();
    if (!version || !flow) {
      return;
    }

    const outcome = await this.data.restoreFlowVersion(flow.id, version.id);
    this.pendingRestore.set(null);

    this.notice.set(
      outcome
        ? `Restored v${version.version} as v${outcome.version} — the canvas now shows the rolled-back graph.`
        : 'That version could not be restored.',
    );
  }
}
