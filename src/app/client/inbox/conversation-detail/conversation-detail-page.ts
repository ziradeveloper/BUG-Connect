import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';
import type { Conversation, Message, WorkspaceUser } from '../../../core/data/entities';
import { MockDataService } from '../../../core/data/mock-data.service';
import { formatDateTime, formatRelative, initials } from '../../../shared/format';

export interface MessageViewModel {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  isWhisper: boolean;
  deliveryStatus: Message['deliveryStatus'];
  sentAt: string;
  createdByUserId: string | null;
}

@Component({
  selector: 'app-conversation-detail-page',
  standalone: true,
  templateUrl: './conversation-detail-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationDetailPageComponent implements OnDestroy {
  private readonly threadEl = viewChild<ElementRef<HTMLElement>>('threadEl');

  private readonly data = inject(MockDataService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly sub: Subscription;

  readonly convId = signal<string | null>(null);
  readonly composerText = signal('');
  readonly isWhisper = signal(false);
  readonly saving = signal(false);

  constructor() {
    this.sub = this.route.paramMap.subscribe((params) => {
      this.convId.set(params.get('conversationId'));
      this.composerText.set('');
      this.isWhisper.set(false);
      afterNextRender(() => this.scrollToBottom());
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Computed state ─────────────────────────────────────────────

  readonly conv = computed<Conversation | null>(() => {
    const id = this.convId();
    return this.data.conversations().find((c) => c.id === id) ?? null;
  });

  readonly messages = computed<MessageViewModel[]>(() => {
    const id = this.convId();
    if (!id) return [];
    return this.data.messagesFor(id).map((m) => ({
      id: m.id,
      direction: m.direction,
      content: m.content,
      isWhisper: m.isInternalWhisper,
      deliveryStatus: m.deliveryStatus,
      sentAt: m.sentAt,
      createdByUserId: m.createdByUserId,
    }));
  });

  readonly contactName = computed(() => {
    const conv = this.conv();
    if (!conv) return '';
    const c = this.data.contacts().find((ct) => ct.id === conv.contactId);
    return c?.displayName ?? 'Unknown Contact';
  });

  readonly contactInitials = computed(() => initials(this.contactName()));
  readonly lastAt = computed(() => formatRelative(this.conv()?.lastMessageAt));
  readonly agentList = computed<WorkspaceUser[]>(() => this.data.users());
  readonly myInitials = computed(() => initials(this.session.user()?.fullName ?? 'Me'));
  readonly charCount = computed(() => this.composerText().length);

  // ── Template helpers ───────────────────────────────────────────

  formatTime(iso: string): string {
    return formatDateTime(iso);
  }

  deliveryIcon(status: Message['deliveryStatus']): string {
    const icons: Record<typeof status, string> = {
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      failed: '✗',
    };
    return icons[status];
  }

  agentFirstName(userId: string): string {
    const u = this.data.allUsers().find((u) => u.id === userId);
    return u ? (u.fullName.split(' ')[0] ?? u.fullName) : 'Agent';
  }

  // ── Actions ────────────────────────────────────────────────────

  async send(): Promise<void> {
    const text = this.composerText().trim();
    const id = this.convId();
    if (!text || !id || this.saving()) return;

    this.saving.set(true);
    try {
      await this.data.sendMessage(id, text, this.isWhisper(), this.session.user()?.id);
      this.composerText.set('');
      afterNextRender(() => this.scrollToBottom());
    } finally {
      this.saving.set(false);
    }
  }

  async resolve(): Promise<void> {
    const id = this.convId();
    if (!id || this.saving()) return;
    this.saving.set(true);
    try {
      await this.data.updateConversationStatus(id, 'resolved');
    } finally {
      this.saving.set(false);
    }
  }

  async reopen(): Promise<void> {
    const id = this.convId();
    if (!id || this.saving()) return;
    this.saving.set(true);
    try {
      await this.data.updateConversationStatus(id, 'open');
    } finally {
      this.saving.set(false);
    }
  }

  async reassign(userId: string): Promise<void> {
    const id = this.convId();
    if (!id) return;
    await this.data.reassignConversation(id, userId || null);
  }

  async changePriority(priority: Conversation['priority']): Promise<void> {
    const id = this.convId();
    if (!id) return;
    await this.data.updateConversationPriority(id, priority);
  }

  private scrollToBottom(): void {
    const el = this.threadEl()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
