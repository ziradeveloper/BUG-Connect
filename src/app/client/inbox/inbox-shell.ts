import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SessionService } from '../../core/auth/session.service';
import { MockDataService } from '../../core/data/mock-data.service';
import { formatRelative, initials } from '../../shared/format';

export type InboxTab = 'unassigned' | 'mine' | 'open' | 'resolved';

export interface ConvListItem {
  convId: string;
  contactName: string;
  avatarText: string;
  lastAt: string;
  subject: string;
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

  private readonly enriched = computed<ConvListItem[]>(() => {
    const convs = this.data.conversations();
    const contacts = this.data.contacts();
    const users = this.data.allUsers();
    return convs.map((conv) => {
      const contact = contacts.find((c) => c.id === conv.contactId);
      const agent = users.find((u) => u.id === conv.assignedUserId);
      return {
        convId: conv.id,
        contactName: contact?.displayName ?? 'Unknown Contact',
        avatarText: contact ? initials(contact.displayName) : '?',
        lastAt: formatRelative(conv.lastMessageAt),
        subject: conv.subject,
        status: conv.status,
        priority: conv.priority,
        unreadCount: conv.unreadCount,
        assignedUserId: conv.assignedUserId,
        assignedAgentFirstName: agent ? agent.fullName.split(' ')[0]! : null,
      };
    });
  });

  readonly filteredList = computed<ConvListItem[]>(() => {
    const tab = this.activeTab();
    const q = this.search().toLowerCase().trim();
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
          !q ||
          item.contactName.toLowerCase().includes(q) ||
          item.subject.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
        return 0;
      });
  });

  tabCount(tab: InboxTab): number {
    const myId = this.session.user()?.id;
    const convs = this.data.conversations();
    if (tab === 'unassigned') return convs.filter((c) => !c.assignedUserId && c.status !== 'resolved').length;
    if (tab === 'mine') return convs.filter((c) => c.assignedUserId === myId && c.status !== 'resolved').length;
    if (tab === 'open') return convs.filter((c) => c.status === 'open' || c.status === 'flow' || c.status === 'pending').length;
    if (tab === 'resolved') return convs.filter((c) => c.status === 'resolved').length;
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
