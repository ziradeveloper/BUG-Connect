import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { MockDataService } from '../../../core/data/mock-data.service';
import type { AuditArea, AuditEvent, AuditLevel } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { formatDateTime, formatRelative } from '../../../shared/format';
import { PageHeader, StatusPill } from '../../../shared/ui/ui';

const AREA_LABELS: Record<AuditArea, string> = {
  auth: 'Auth',
  users: 'Users',
  roles: 'Roles',
  settings: 'Settings',
  billing: 'Billing',
  platform: 'Platform',
  clients: 'Clients',
  plans: 'Plans',
  meta: 'Meta',
  templates: 'Templates',
  inbox: 'Inbox',
  connections: 'Connections',
  flows: 'Flows',
  campaigns: 'Campaigns',
  developer: 'Developer',
};

/**
 * Workspace audit log (`/audit`, wave 5).
 *
 * One table over `MockDataService.auditForTenant()`: rows are written by the
 * mutations that change state, so the log answers "who changed what" from the
 * same records the rest of the console reads.
 */
@Component({
  selector: 'app-audit-page',
  imports: [DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './audit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage {
  private readonly data = inject(MockDataService);

  protected readonly areas: AuditArea[] = [
    'auth',
    'users',
    'roles',
    'settings',
    'templates',
    'inbox',
    'connections',
    'billing',
    'flows',
    'campaigns',
  ];
  protected readonly levels: AuditLevel[] = ['info', 'warning', 'critical'];

  protected readonly activeArea = signal<AuditArea | null>(null);
  protected readonly activeLevel = signal<AuditLevel | null>(null);

  private readonly allRows = computed(() => this.data.auditForTenant(this.data.currentTenant()?.id));

  protected readonly rows = computed(() => {
    const area = this.activeArea();
    const level = this.activeLevel();

    return this.allRows().filter(
      (event) => (!area || event.area === area) && (!level || event.level === level),
    );
  });

  protected readonly summary = computed(() => {
    const rows = this.allRows();
    return {
      total: rows.length,
      critical: rows.filter((row) => row.level === 'critical').length,
      actors: new Set(rows.map((row) => row.actor)).size,
      areas: new Set(rows.map((row) => row.area)).size,
    };
  });

  protected readonly columns: DataColumn<AuditEvent>[] = [
    { key: 'createdAt', label: 'When', sortable: true, value: (row) => row.createdAt },
    { key: 'actor', label: 'Actor', sortable: true },
    { key: 'area', label: 'Area', sortable: true, align: 'center' },
    { key: 'action', label: 'Action', sortable: true },
    { key: 'level', label: 'Severity', sortable: true, align: 'center' },
  ];

  protected selectArea(area: AuditArea | null): void {
    this.activeArea.set(area);
  }

  protected selectLevel(level: AuditLevel | null): void {
    this.activeLevel.set(this.activeLevel() === level ? null : level);
  }

  protected areaLabel(area: AuditArea): string {
    return AREA_LABELS[area] ?? area;
  }

  protected levelLabel(level: AuditLevel): string {
    return level.charAt(0).toUpperCase() + level.slice(1);
  }

  protected levelTone(level: AuditLevel): 'info' | 'warning' | 'danger' {
    switch (level) {
      case 'critical':
        return 'danger';
      case 'warning':
        return 'warning';
      default:
        return 'info';
    }
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected ago(iso: string): string {
    return formatRelative(iso);
  }
}
