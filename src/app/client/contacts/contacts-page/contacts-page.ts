import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { Router } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { Contact } from '../../../core/data/entities';
import { DataTableComponent } from '../../../shared/data-table/data-table';
import { DataTableCellDirective } from '../../../shared/data-table/data-table.model';
import type { DataColumn } from '../../../shared/data-table/data-table.model';
import { PageHeader, StatusPill } from '../../../shared/ui/ui';
import { formatRelative } from '../../../shared/format';

/** The tag filter's "no tag selected" value. */
const ALL_TAGS = null;

/**
 * Contact Hub directory (`/contacts`). Reads the tenant's contacts, filters by
 * tag, and shows opt-in status so a marketing send can be checked against it.
 * Opt-out is the inverse of `optInStatus` on the entity.
 */
@Component({
  selector: 'app-contacts-page',
  imports: [DataTableComponent, DataTableCellDirective, PageHeader, StatusPill],
  templateUrl: './contacts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsPage {
  private readonly data = inject(MockDataService);
  private readonly router = inject(Router);
  protected readonly permissions = inject(PermissionService);

  protected readonly allRows = signal<Contact[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly activeTag = signal<string | null>(ALL_TAGS);

  /** Every tag used by this workspace's contacts, alphabetical, for the chip row. */
  protected readonly tags = computed(() =>
    [...new Set(this.allRows().flatMap((contact) => contact.tags))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );

  protected readonly rows = computed(() => {
    const tag = this.activeTag();
    return tag === ALL_TAGS
      ? this.allRows()
      : this.allRows().filter((contact) => contact.tags.includes(tag));
  });

  protected readonly summary = computed(() => {
    const contacts = this.allRows();
    const optedOut = contacts.filter((contact) => !contact.optInStatus).length;
    return {
      total: contacts.length,
      optedIn: contacts.length - optedOut,
      optedOut,
      withConversations: contacts.filter((contact) => contact.conversationCount > 0).length,
    };
  });

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
      key: 'optInStatus',
      label: 'Opt-in',
      sortable: true,
      align: 'center',
      value: (contact: Contact) => (contact.optInStatus ? 1 : 0),
    },
    {
      key: 'conversationCount',
      label: 'Conversations',
      sortable: true,
      align: 'center',
      type: 'number',
    },
    {
      key: 'lastSeenAt',
      label: 'Last seen',
      sortable: true,
      value: (contact: Contact) => contact.lastSeenAt,
      format: (contact: Contact) => formatRelative(contact.lastSeenAt),
    },
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
    this.activeTag.set(ALL_TAGS);

    this.data.listContacts().then(
      (page) => {
        this.allRows.set(page.items);
        this.loading.set(false);
      },
      () => {
        this.error.set('Contacts could not be loaded.');
        this.loading.set(false);
      },
    );
  }

  protected selectTag(tag: string | null): void {
    this.activeTag.set(tag);
  }

  protected isActive(tag: string | null): boolean {
    return this.activeTag() === tag;
  }

  protected optInLabel(contact: Contact): string {
    return contact.optInStatus ? 'Opted in' : 'Opted out';
  }

  protected openContact(contact: Contact): void {
    void this.router.navigate(['/contacts', contact.id]);
  }
}
