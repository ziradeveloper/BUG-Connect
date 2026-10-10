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
import type { Contact } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { PageHeader, StatusPill } from '../../../shared/ui/ui';
import { formatDateTime, formatRelative } from '../../../shared/format';

/**
 * Opt-out list (`/contacts/opt-outs`). Everyone marketing must never message,
 * with a one-click path back in and a manual Meta sync for the compliance log.
 */
@Component({
  selector: 'app-opt-outs-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './opt-outs-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptOutsPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  protected readonly loading = signal(true);
  protected readonly syncing = signal(false);
  protected readonly actingId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly lastSyncAt = signal<string | null>(null);

  protected readonly canManage = computed(() => this.permissions.can('contacts.manage', 'edit'));

  protected readonly rows = computed(() =>
    this.data.contacts().filter((contact) => !contact.optInStatus),
  );

  protected readonly formatRelative = formatRelative;
  protected readonly formatDateTime = formatDateTime;

  protected readonly columns: DataColumn<Contact>[] = [
    {
      key: 'displayName',
      label: 'Contact',
      sortable: true,
      cellClass: 'data-table__primary',
    },
    { key: 'waId', label: 'WhatsApp ID', sortable: true, cellClass: 'data-table__mono' },
    { key: 'tags', label: 'Tags', sortable: false },
    {
      key: 'lastSeenAt',
      label: 'Last seen',
      sortable: true,
      value: (contact: Contact) => contact.lastSeenAt,
      format: (contact: Contact) => formatRelative(contact.lastSeenAt),
    },
    { key: 'actions', label: '', sortable: false, align: 'end' },
  ];

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
    this.data.listContacts().then(
      () => this.loading.set(false),
      () => {
        this.error.set('The opt-out list could not be loaded.');
        this.loading.set(false);
      },
    );
  }

  protected async resubscribe(contact: Contact): Promise<void> {
    if (!this.canManage() || this.actingId()) {
      return;
    }
    this.actingId.set(contact.id);
    try {
      await this.data.updateContact(contact.id, { optInStatus: true });
      this.notice.set(`${contact.displayName} opted back in and left this list.`);
    } catch {
      this.error.set('The contact could not be resubscribed.');
    } finally {
      this.actingId.set(null);
    }
  }

  /** Simulated Meta blocklist pull — stamps the sync, changes nothing else. */
  protected async syncNow(): Promise<void> {
    if (!this.canManage() || this.syncing()) {
      return;
    }
    this.syncing.set(true);
    try {
      await this.data.listContacts();
      const at = new Date().toISOString();
      this.lastSyncAt.set(at);
      this.notice.set(`Blocklist synced at ${formatDateTime(at)} — no new opt-outs.`);
    } catch {
      this.error.set('The sync could not be completed.');
    } finally {
      this.syncing.set(false);
    }
  }
}
