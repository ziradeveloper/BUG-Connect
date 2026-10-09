import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../core/authorization/permission.service';
import type { Role } from '../../core/authorization/role.model';
import { DataTableComponent } from '../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../shared/data-table/data-table.model';
import type { DataColumn } from '../../shared/data-table/data-table.model';
import { ConfirmDialog, PageHeader, StatusPill } from '../../shared/ui/ui';

/**
 * Role list for whichever module is rendering it. The same component serves the
 * tenant console and the platform console because PermissionService filters by
 * the resolved workspace scope.
 */
@Component({
  selector: 'app-roles-page',
  imports: [
    RouterLink,
    DataTableComponent,
    DataTableCellDirective,
    PageHeader,
    StatusPill,
    ConfirmDialog,
  ],
  templateUrl: './roles-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  private readonly router = inject(Router);
  protected readonly permissions = inject(PermissionService);

  protected readonly loading = signal(false);
  protected readonly pendingDelete = signal<Role | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly roles = computed(() => this.permissions.rolesWithCounts());
  protected readonly canManage = computed(() => this.permissions.can('roles.manage', 'edit'));
  protected readonly catalogueSize = computed(
    () => this.permissions.visibleMenu().length + this.permissions.hiddenByRole().length,
  );

  protected readonly scopeLabel = computed(() =>
    this.permissions.scope() === 'platform' ? 'PLATFORM' : 'WORKSPACE',
  );

  protected readonly title = computed(() =>
    this.permissions.scope() === 'platform' ? 'Platform roles' : 'Roles & menus',
  );

  protected readonly description = computed(() =>
    this.permissions.scope() === 'platform'
      ? 'Which console areas platform staff can reach. Tenant roles are configured inside each workspace.'
      : 'Each role lists the menus it opens. Members inherit exactly that — nothing is hard-coded in a component.',
  );

  protected readonly columns = computed<DataColumn<Role>[]>(() => {
    const base: DataColumn<Role>[] = [
      { key: 'name', label: 'Role', sortable: true },
      { key: 'summary', label: 'Menus', sortable: false },
      {
        key: 'menus',
        label: 'Count',
        sortable: true,
        align: 'center',
        type: 'number',
        value: (role) => role.menus.length,
      },
      {
        key: 'memberCount',
        label: 'Members',
        sortable: true,
        align: 'center',
        type: 'number',
      },
    ];

    return this.canManage() ? [...base, { key: 'actions', label: '', align: 'end' }] : base;
  });

  protected menuLabels(role: Role): string {
    return role.menus.map((key) => this.permissions.menuLabel(key)).join(' · ');
  }

  protected open(role: Role): void {
    if (this.canManage()) {
      void this.router.navigate(['/roles', role.id]);
    }
  }

  protected createRole(): void {
    const role = this.permissions.newRole(this.permissions.scope());
    this.permissions.saveRole(role);
    this.notice.set(`Draft role created. Set its menus before assigning members.`);
    void this.router.navigate(['/roles', role.id]);
  }

  protected confirmDelete(): void {
    const role = this.pendingDelete();
    if (!role) {
      return;
    }

    const result = this.permissions.deleteRole(role.id);
    this.pendingDelete.set(null);
    this.notice.set(
      result.ok ? `${role.name} was deleted.` : (result.message ?? 'Role could not be deleted.'),
    );
  }
}
