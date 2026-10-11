import { DOCUMENT } from '@angular/common';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  private readonly data = inject(MockDataService);
  private readonly document = inject(DOCUMENT);
  protected readonly permissions = inject(PermissionService);

  private get clipboard(): Clipboard {
    return this.document.defaultView?.navigator.clipboard as Clipboard;
  }

  protected readonly rows = signal<WorkspaceUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pendingDelete = signal<WorkspaceUser | null>(null);
  protected readonly notice = signal<string | null>(null);

  /**
   * Invite tokens per pending seat, built on load rather than in the template:
   * `ensureInvite()` writes to the data layer, and a write during change
   * detection would fight the render it is feeding.
   */
  private readonly inviteTokens = signal<ReadonlyMap<string, string>>(new Map());

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
        this.inviteTokens.set(this.tokensFor(page.items));
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

  /** The acceptance link behind a pending seat, if that seat is still pending. */
  protected inviteToken(user: WorkspaceUser): string | null {
    return this.inviteTokens().get(user.id) ?? null;
  }

  protected async copyInviteLink(event: Event, user: WorkspaceUser): Promise<void> {
    event.stopPropagation();

    const token = this.inviteToken(user);
    if (!token) {
      return;
    }

    const url = `${this.document.location.origin}/accept-invite?token=${token}`;

    try {
      await this.clipboard.writeText(url);
      this.notice.set(`Invite link for ${user.fullName} copied — it opens the accept-invite screen.`);
    } catch {
      // Clipboard blocked (insecure context, denied permission): the link is
      // still reachable from the row's Invite link action.
      this.notice.set(`Copy blocked by the browser — open the invite with the Invite link action.`);
    }
  }

  private tokensFor(users: WorkspaceUser[]): ReadonlyMap<string, string> {
    const tokens = new Map<string, string>();

    for (const user of users) {
      if (!user.invited) {
        continue;
      }
      const invite = this.data.ensureInvite(user.id);
      if (invite) {
        tokens.set(user.id, invite.token);
      }
    }

    return tokens;
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
