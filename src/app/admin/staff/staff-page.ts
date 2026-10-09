import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import { MockDataService } from '../../core/data/mock-data.service';
import type { PlatformStaffUser } from '../../core/data/entities';
import { DataTableComponent } from '../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../shared/data-table/data-table.model';
import type { DataColumn } from '../../shared/data-table/data-table.model';
import { formatRelative } from '../../shared/format';
import { PageHeader, StatusPill } from '../../shared/ui/ui';

/** Platform staff — the people who run the SaaS, separate from tenant members. */
@Component({
  selector: 'app-staff-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  template: `
    <div class="workspace-page">
      <app-page-header
        eyebrow="PLATFORM"
        title="Platform staff"
        description="Owner and operations accounts. These sign in on the admin subdomain only and never appear in a client’s user list."
      >
        <a class="button button-secondary" pageActions routerLink="/roles">Roles & menus</a>
      </app-page-header>

      <app-data-table
        [columns]="columns"
        [rows]="rows()"
        caption="Platform staff accounts"
        searchPlaceholder="Search staff"
        emptyTitle="No staff match this filter"
        emptyDescription="Owner and operations accounts are listed here."
      >
        <ng-template appCell="fullName" let-member>
          <span class="shell__avatar" aria-hidden="true">{{ member.fullName.slice(0, 1) }}</span>
          <strong class="data-table__primary">{{ member.fullName }}</strong>
        </ng-template>

        <ng-template appCell="roleId" let-member>
          {{ permissions.labelFor(member.roleId) }}
        </ng-template>

        <ng-template appCell="isActive" let-member>
          <app-status-pill
            [label]="member.isActive ? 'Active' : 'Deactivated'"
            [tone]="member.isActive ? 'success' : 'neutral'"
          />
        </ng-template>

        <ng-template appCell="lastLoginAt" let-member>
          {{ ago(member.lastLoginAt) }}
        </ng-template>
      </app-data-table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffPage {
  private readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  protected readonly rows = signal<PlatformStaffUser[]>([]);

  constructor() {
    this.data.listPlatformStaff().then((page) => this.rows.set(page.items));
  }

  protected readonly columns: DataColumn<PlatformStaffUser>[] = [
    { key: 'fullName', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'roleId', label: 'Role', sortable: true },
    { key: 'isActive', label: 'Status', sortable: true, align: 'center' },
    {
      key: 'lastLoginAt',
      label: 'Last login',
      sortable: true,
      value: (member) => member.lastLoginAt,
    },
    { key: 'createdAt', label: 'Added', sortable: true, value: (member) => member.createdAt },
  ];

  protected ago(iso: string): string {
    return formatRelative(iso);
  }
}
