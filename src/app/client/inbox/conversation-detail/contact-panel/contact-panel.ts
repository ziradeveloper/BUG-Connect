import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { Contact, Conversation } from '../../../../core/data/entities';
import { formatDateTime, formatRelative, initials } from '../../../../shared/format';

/**
 * The right-hand context pane. Agents need the customer record — opt-in state,
 * tags and custom attributes — without leaving the thread, so it lives beside
 * the conversation instead of on another route.
 */
@Component({
  selector: 'app-contact-panel',
  standalone: true,
  templateUrl: './contact-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPanel {
  readonly contact = input<Contact | null>(null);
  readonly conversation = input<Conversation | null>(null);
  readonly agentName = input<string | null>(null);

  readonly close = output<void>();

  readonly initials = computed(() => initials(this.contact()?.displayName ?? '?'));
  readonly optedIn = computed(() => this.contact()?.optInStatus ?? false);

  readonly attributes = computed(() => {
    const attributes = this.contact()?.customAttributes ?? {};
    return Object.entries(attributes).map(([key, value]) => ({
      key: titleCase(key),
      value,
    }));
  });

  readonly lastSeen = computed(() => formatRelative(this.contact()?.lastSeenAt));
  readonly memberSince = computed(() => formatDateTime(this.contact()?.createdAt));
  readonly lastActivity = computed(() => formatRelative(this.conversation()?.lastMessageAt));
}

function titleCase(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
