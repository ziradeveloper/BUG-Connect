import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import {
  ANNOUNCEMENT_KINDS,
  announcementState,
  audienceLabel,
  type AnnouncementState,
} from '../../../core/data/announcements';
import type { Announcement } from '../../../core/data/entities';
import { MockDataService } from '../../../core/data/mock-data.service';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { DATA_NOW, formatDateTime, formatNumber, formatRelative } from '../../../shared/format';
import { ConfirmDialog, PageHeader, StatusPill } from '../../../shared/ui/ui';

const STATE_LABEL: Record<AnnouncementState, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

/**
 * Platform announcements (`/announcements`, wave 6).
 *
 * The notices the platform owner sends to workspaces, with their state derived
 * from the clock rather than a flag: a published notice whose publish time has
 * not arrived reads as scheduled, and one past its expiry reads as expired
 * without anyone editing a row.
 */
@Component({
  selector: 'app-announcements-page',
  imports: [
    RouterLink,
    DataTableComponent,
    DataTableCellDirective,
    PageHeader,
    StatusPill,
    ConfirmDialog,
  ],
  templateUrl: './announcements-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly pendingWithdraw = signal<Announcement | null>(null);
  protected readonly pendingDelete = signal<Announcement | null>(null);

  protected readonly canManage = computed(() =>
    this.permissions.can('announcements.manage', 'edit'),
  );

  protected readonly rows = computed(() =>
    this.data.announcements().map((announcement) => ({
      ...announcement,
      reach: this.data.announcementReach(announcement),
    })),
  );

  protected readonly summary = computed(() => {
    const rows = this.rows();
    const state = (announcement: Announcement): AnnouncementState =>
      announcementState(announcement, DATA_NOW);

    return {
      total: rows.length,
      live: rows.filter((row) => state(row) === 'live').length,
      scheduled: rows.filter((row) => state(row) === 'scheduled').length,
      drafts: rows.filter((row) => state(row) === 'draft').length,
      reached: rows
        .filter((row) => state(row) === 'live')
        .reduce((total, row) => total + row.reach.workspaces, 0),
    };
  });

  protected readonly columns: DataColumn<Announcement & { reach: { workspaces: number } }>[] = [
    { key: 'title', label: 'Notice', sortable: true, value: (row) => row.title },
    {
      key: 'state',
      label: 'State',
      sortable: true,
      value: (row) => announcementState(row, DATA_NOW),
    },
    {
      key: 'audience',
      label: 'Audience',
      sortable: true,
      format: (row) => `${row.reach.workspaces} workspaces · ${audienceLabel(row)}`,
    },
    {
      key: 'publishAt',
      label: 'Goes out',
      align: 'end',
      sortable: true,
      format: (row) => formatDateTime(row.publishAt),
    },
    {
      key: 'views',
      label: 'Opened',
      align: 'end',
      sortable: true,
      format: (row) => formatNumber(row.views),
    },
    { key: 'actions', label: '', sortable: false, align: 'end' },
  ];

  protected readonly rowKey = (row: Announcement): string => row.id;

  protected readonly formatDateTime = formatDateTime;
  protected readonly formatRelative = formatRelative;

  protected stateOf(announcement: Announcement): AnnouncementState {
    return announcementState(announcement, DATA_NOW);
  }

  protected stateLabel(announcement: Announcement): string {
    return STATE_LABEL[announcementState(announcement, DATA_NOW)];
  }

  protected stateTone(announcement: Announcement): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
    switch (announcementState(announcement, DATA_NOW)) {
      case 'live':
        return 'success';
      case 'scheduled':
        return 'info';
      case 'draft':
        return 'neutral';
      case 'expired':
        return 'warning';
      default:
        return 'danger';
    }
  }

  protected kindLabel(kind: Announcement['kind']): string {
    return ANNOUNCEMENT_KINDS.find((option) => option.value === kind)?.label ?? kind;
  }

  protected open(announcement: Announcement): void {
    void this.router.navigate(['/announcements', announcement.id]);
  }

  protected async togglePin(announcement: Announcement): Promise<void> {
    this.loading.set(true);

    try {
      const changed = await this.data.setAnnouncementPinned(
        announcement.id,
        !announcement.pinned,
      );

      this.notice.set(
        changed
          ? announcement.pinned
            ? 'Unpinned — it will sit with the other notices.'
            : 'Pinned — it will show above the others in every console it reaches.'
          : 'That notice is gone.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected askWithdraw(announcement: Announcement): void {
    this.pendingWithdraw.set(announcement);
  }

  protected async confirmWithdraw(): Promise<void> {
    const announcement = this.pendingWithdraw();

    this.pendingWithdraw.set(null);

    if (!announcement) return;

    this.loading.set(true);
    const withdrawn = await this.data.withdrawAnnouncement(announcement.id);

    this.loading.set(false);
    this.notice.set(
      withdrawn
        ? `“${announcement.title}” withdrawn. Workspaces stop seeing it immediately.`
        : 'That notice was already withdrawn.',
    );
  }

  protected askDelete(announcement: Announcement): void {
    this.pendingDelete.set(announcement);
  }

  protected async confirmDelete(): Promise<void> {
    const announcement = this.pendingDelete();

    this.pendingDelete.set(null);

    if (!announcement) return;

    this.loading.set(true);
    const deleted = await this.data.deleteAnnouncement(announcement.id);

    this.loading.set(false);
    this.notice.set(
      deleted
        ? 'Draft deleted.'
        : 'Only a draft can be deleted — a notice that went out stays in the record.',
    );
  }

  protected dismiss(): void {
    this.notice.set(null);
  }
}
