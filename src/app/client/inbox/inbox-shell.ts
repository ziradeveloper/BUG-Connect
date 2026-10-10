import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { MESSAGE_TYPE_ICON, payloadPreview } from '../../core/data/whatsapp';
import { formatRelative, initials } from '../../shared/format';

export type InboxTab = 'unassigned' | 'mine' | 'open' | 'resolved';

export interface ConvListItem {
  convId: string;
  contactName: string;
  avatarText: string;
  lastAt: string;
  /** Raw ISO timestamp behind `lastAt` — the queue's recency sort key. */
  lastAtIso: string;
  subject: string;
  /** One-line preview of the newest message, with its type icon. */
  preview: string;
  previewIcon: string;
  status: string;
  priority: string;
  unreadCount: number;
  assignedUserId: string | null;
  assignedAgentFirstName: string | null;
}

@Component({
  selector: 'app-inbox-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './inbox-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxShellComponent {
  private readonly data = inject(MockDataService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly search = signal('');
  readonly activeTab = signal<InboxTab>('unassigned');
  readonly simulating = signal(false);

  readonly tabs: { id: InboxTab; label: string }[] = [
    { id: 'unassigned', label: 'Unassigned' },
    { id: 'mine', label: 'Mine' },
    { id: 'open', label: 'Open' },
    { id: 'resolved', label: 'Resolved' },
  ];

  /**
   * Mobile switches between the queue and the thread instead of stacking them
   * (the WhatsApp pattern). Driven from the URL so a deep link opens the
   * thread directly.
   */
  readonly threadOpen = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.hasConversation()),
      startWith(this.hasConversation()),
    ),
    { initialValue: this.hasConversation() },
  );

  private hasConversation(): boolean {
    return /\/inbox\/[^/?#]+/.test(this.router.url);
  }

  private readonly enriched = computed<ConvListItem[]>(() => {
    const convs = this.data.conversations();
    const contacts = this.data.contacts();
    const users = this.data.allUsers();

    return convs.map((conv) => {
      const contact = contacts.find((candidate) => candidate.id === conv.contactId);
      const agent = users.find((user) => user.id === conv.assignedUserId);
      const thread = this.data.messagesFor(conv.id);
      const last = thread[thread.length - 1];

      return {
        convId: conv.id,
        contactName: contact?.displayName ?? 'Unknown Contact',
        avatarText: contact ? initials(contact.displayName) : '?',
        lastAt: formatRelative(conv.lastMessageAt),
        lastAtIso: conv.lastMessageAt,
        subject: conv.subject,
        preview: last ? payloadPreview(last.type, last.payload, last.content) : 'No messages yet',
        previewIcon: last ? MESSAGE_TYPE_ICON[last.type] : '',
        status: conv.status,
        priority: conv.priority,
        unreadCount: conv.unreadCount,
        assignedUserId: conv.assignedUserId,
        assignedAgentFirstName: agent ? (agent.fullName.split(' ')[0] ?? null) : null,
      };
    });
  });

  readonly filteredList = computed<ConvListItem[]>(() => {
    const tab = this.activeTab();
    const query = this.search().toLowerCase().trim();
    const myId = this.session.user()?.id;

    return this.enriched()
      .filter((item) => {
        if (tab === 'unassigned') return !item.assignedUserId && item.status !== 'resolved';
        if (tab === 'mine') return item.assignedUserId === myId && item.status !== 'resolved';
        if (tab === 'open')
          return item.status === 'open' || item.status === 'flow' || item.status === 'pending';
        if (tab === 'resolved') return item.status === 'resolved';
        return true;
      })
      .filter(
        (item) =>
          !query ||
          item.contactName.toLowerCase().includes(query) ||
          item.subject.toLowerCase().includes(query) ||
          item.preview.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
        // Unread first, then newest activity first — the queue's stable order.
        return b.lastAtIso.localeCompare(a.lastAtIso);
      });
  });

  tabCount(tab: InboxTab): number {
    const myId = this.session.user()?.id;
    const convs = this.data.conversations();

    if (tab === 'unassigned') {
      return convs.filter((conv) => !conv.assignedUserId && conv.status !== 'resolved').length;
    }

    if (tab === 'mine') {
      return convs.filter(
        (conv) => conv.assignedUserId === myId && conv.status !== 'resolved',
      ).length;
    }

    if (tab === 'open') {
      return convs.filter(
        (conv) => conv.status === 'open' || conv.status === 'flow' || conv.status === 'pending',
      ).length;
    }

    if (tab === 'resolved') {
      return convs.filter((conv) => conv.status === 'resolved').length;
    }

    return 0;
  }

  async simulateInbound(): Promise<void> {
    if (this.simulating()) return;
    this.simulating.set(true);

    try {
      const { conversation } = await this.data.simulateInboundMessage();
      this.activeTab.set('unassigned');
      void this.router.navigate(['/inbox', conversation.id]);
    } finally {
      this.simulating.set(false);
    }
  }
}
