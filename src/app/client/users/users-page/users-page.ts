import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { WorkspaceUser } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';
import { formatRelative } from '../../../shared/format';

@Component({
  selector: 'app-users-page',
  imports: [
    RouterLink,
    DataTableComponent,
    DataTableCellDirective,
    PageHeader,
    StatusPill,
    ConfirmDialog,
  ],
  templateUrl: './users-page.html',
  styleUrl: './users-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  private readonly data = inject(MockDataService);
  protected readonly permissions = inject(PermissionService);

  protected readonly rows = signal<WorkspaceUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingDelete = signal<WorkspaceUser | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly canManage = computed(() => this.permissions.can('users.manage', 'edit'));

  protected readonly columns = computed<DataColumn<WorkspaceUser>[]>(() => {
    const base: DataColumn<WorkspaceUser>[] = [
      {
        key: 'fullName',
        label: 'Member',
        sortable: true,
        cellClass: 'data-table__primary',
      },
      { key: 'email', label: 'Email', sortable: true },
      { key: 'roleId', label: 'Role', sortable: true },
      { key: 'department', label: 'Team', sortable: true },
      {
        key: 'load',
        label: 'Chat load',
        sortable: true,
        align: 'center',
        type: 'number',
        value: (user: WorkspaceUser) => user.activeChats / Math.max(1, user.maxActiveChatCapacity),
        format: (user: WorkspaceUser) => `${user.activeChats} / ${user.maxActiveChatCapacity}`,
      },
      { key: 'status', label: 'Presence', sortable: true, align: 'center' },
      {
        key: 'lastLoginAt',
        label: 'Last login',
        sortable: true,
        value: (user: WorkspaceUser) => user.lastLoginAt,
        format: (user: WorkspaceUser) => formatRelative(user.lastLoginAt),
      },
    ];

    return this.canManage()
      ? [...base, { key: 'actions', label: '', align: 'end', sortable: false }]
      : base;
  });

  protected readonly summary = computed(() => {
    const users = this.rows();
    return {
      total: users.length,
      online: users.filter((user) => user.isOnline).length,
      atCapacity: users.filter((user) => user.activeChats >= user.maxActiveChatCapacity).length,
      invited: users.filter((user) => user.invited).length,
    };
  });

  constructor() {
    const data = this.data;
    effect(() => {
      void data.tenantId();
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.data.listUsers().then(
      (page) => {
        this.rows.set(page.items);
        this.loading.set(false);
      },
      () => {
        this.error.set('Workspace users could not be loaded.');
        this.loading.set(false);
      },
    );
  }

  protected confirmDelete(): void {
    const user = this.pendingDelete();
    if (!user) {
      return;
    }

    this.data.deleteUser(user.id).then(() => {
      this.pendingDelete.set(null);
      this.notice.set(`${user.fullName} was removed from this workspace.`);
      this.load();
    });
  }

  protected roleLabel(roleId: string): string {
    return this.permissions.labelFor(roleId);
  }

  protected toneFor(user: WorkspaceUser): 'success' | 'warning' | 'info' | 'neutral' {
    if (user.invited) {
      return 'info';
    }
    if (user.status === 'online') {
      return 'success';
    }
    return user.status === 'away' ? 'warning' : 'neutral';
  }

  protected presenceLabel(user: WorkspaceUser): string {
    return user.invited
      ? 'Invite pending'
      : user.status.charAt(0).toUpperCase() + user.status.slice(1);
  }

  protected dismissNotice(): void {
    this.notice.set(null);
  }
}
