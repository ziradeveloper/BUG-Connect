import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MockDataService } from '../../../core/data/mock-data.service';
import type { AuditArea, AuditEvent, AuditLevel } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { formatDateTime, formatRelative } from '../../../shared/format';
import { PageHeader, StatusPill } from '../../../shared/ui/ui';

type AuditRow = AuditEvent & { tenantName: string };

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
 * Platform audit log (`/audit`, wave 5).
 *
 * The whole trail, not just one workspace: plan and Meta changes carry no
 * tenant, everything else names the workspace it touched so a row links
 * straight into `/clients/:id`. Impersonation rows get an eye marker because
 * "who looked at this workspace" is the question support asks most.
 */
@Component({
  selector: 'app-platform-audit-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './audit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage {
  private readonly data = inject(MockDataService);

  protected readonly areas: AuditArea[] = [
    'auth',
    'clients',
    'platform',
    'plans',
    'meta',
    'connections',
    'roles',
    'billing',
  ];
  protected readonly levels: AuditLevel[] = ['info', 'warning', 'critical'];

  protected readonly activeArea = signal<AuditArea | null>(null);
  protected readonly activeLevel = signal<AuditLevel | null>(null);
  protected readonly impersonationOnly = signal(false);

  private readonly allRows = computed<AuditRow[]>(() =>
    this.data.auditLog().map((event) => ({
      ...event,
      tenantName: event.tenantId
        ? (this.data.tenantById(event.tenantId)?.businessName ?? 'Unknown workspace')
        : 'Platform',
    })),
  );

  protected readonly rows = computed(() => {
    const area = this.activeArea();
    const level = this.activeLevel();
    const impersonation = this.impersonationOnly();

    return this.allRows().filter(
      (row) =>
        (!area || row.area === area) &&
        (!level || row.level === level) &&
        (!impersonation || this.isImpersonation(row)),
    );
  });

  protected readonly summary = computed(() => {
    const rows = this.allRows();
    return {
      total: rows.length,
      critical: rows.filter((row) => row.level === 'critical').length,
      actors: new Set(rows.map((row) => row.actor)).size,
      tenants: new Set(rows.filter((row) => row.tenantId).map((row) => row.tenantId)).size,
    };
  });

  protected readonly columns: DataColumn<AuditRow>[] = [
    { key: 'createdAt', label: 'When', sortable: true, value: (row) => row.createdAt },
    { key: 'actor', label: 'Actor', sortable: true },
    { key: 'tenantName', label: 'Workspace', sortable: true },
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

  protected toggleImpersonation(): void {
    this.impersonationOnly.update((value) => !value);
  }

  protected isImpersonation(row: AuditEvent): boolean {
    return /view-as|impersonat/i.test(`${row.action} ${row.target}`);
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
