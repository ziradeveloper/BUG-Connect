import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { PermissionService } from '../../../core/authorization/permission.service';
import { MockDataService } from '../../../core/data/mock-data.service';
import type { Contact } from '../../../core/data/entities';
import { PageHeader, StatusPill } from '../../../shared/ui/ui';
import { formatDateTime, formatRelative } from '../../../shared/format';

/**
 * Contact detail (`/contacts/:contactId`). Left pane: identity, opt-in state,
 * tags and the custom-attribute editor. Right pane: the conversation timeline,
 * newest first, each thread linking into the inbox.
 *
 * The draft is template-driven (plain signals), so derived values stay methods:
 * computeds would cache the first keystroke exactly like the wizard did.
 */
@Component({
  selector: 'app-contact-detail-page',
  imports: [FormsModule, RouterLink, PageHeader, StatusPill],
  templateUrl: './contact-detail-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactDetailPage {
  private readonly data = inject(MockDataService);
  private readonly permissions = inject(PermissionService);

  readonly contactId = input<string | null>(null);

  protected readonly contact = computed(() => this.data.contactById(this.contactId()));

  protected readonly threads = computed(() => {
    const id = this.contactId();
    return id ? this.data.conversationsForContact(id) : [];
  });

  protected readonly canManage = computed(() => this.permissions.can('contacts.manage', 'edit'));

  protected readonly assignedTo = computed(() => {
    const contact = this.contact();
    if (!contact?.assignedUserId) {
      return null;
    }
    return this.data.users().find((user) => user.id === contact.assignedUserId) ?? null;
  });

  protected readonly displayName = signal('');
  protected readonly tags = signal<string[]>([]);
  protected readonly tagInput = signal('');
  protected readonly attributes = signal<{ key: string; value: string }[]>([]);
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly formatRelative = formatRelative;
  protected readonly formatDateTime = formatDateTime;

  constructor() {
    effect(() => {
      const contact = this.contact();
      if (contact) {
        this.displayName.set(contact.displayName);
        this.tags.set([...contact.tags]);
        this.attributes.set(
          Object.entries(contact.customAttributes).map(([key, value]) => ({ key, value })),
        );
      }
    });
  }

  protected threadMessages(conversationId: string): number {
    return this.data.messagesFor(conversationId).length;
  }

  protected threadStatusTone(status: string): 'success' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'resolved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'flow':
        return 'info';
      default:
        return 'neutral';
    }
  }

  protected addTag(): void {
    const value = this.tagInput().trim();
    if (!value || this.tags().some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      this.tagInput.set('');
      return;
    }
    this.tags.set([...this.tags(), value]);
    this.tagInput.set('');
  }

  protected removeTag(tag: string): void {
    this.tags.set(this.tags().filter((candidate) => candidate !== tag));
  }

  protected addAttribute(): void {
    this.attributes.set([...this.attributes(), { key: '', value: '' }]);
  }

  protected removeAttribute(index: number): void {
    this.attributes.set(this.attributes().filter((_, i) => i !== index));
  }

  protected updateAttributeKey(index: number, key: string): void {
    this.attributes.set(this.attributes().map((attr, i) => (i === index ? { ...attr, key } : attr)));
  }

  protected updateAttributeValue(index: number, value: string): void {
    this.attributes.set(
      this.attributes().map((attr, i) => (i === index ? { ...attr, value } : attr)),
    );
  }

  protected async toggleOptIn(contact: Contact): Promise<void> {
    if (!this.canManage() || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.data.updateContact(contact.id, { optInStatus: !contact.optInStatus });
      this.notice.set(
        contact.optInStatus
          ? `${contact.displayName} opted out — excluded from marketing sends.`
          : `${contact.displayName} opted back in.`,
      );
    } catch {
      this.error.set('The opt-in status could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async save(contact: Contact): Promise<void> {
    if (!this.canManage() || this.saving()) {
      return;
    }
    const displayName = this.displayName().trim();
    if (!displayName) {
      this.error.set('The contact needs a display name.');
      return;
    }

    const customAttributes: Record<string, string> = {};
    for (const attr of this.attributes()) {
      const key = attr.key.trim();
      if (key) {
        customAttributes[key] = attr.value.trim();
      }
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.data.updateContact(contact.id, {
        displayName,
        tags: this.tags(),
        customAttributes,
      });
      this.notice.set('Contact saved.');
    } catch {
      this.error.set('The contact could not be saved.');
    } finally {
      this.saving.set(false);
    }
  }
}
