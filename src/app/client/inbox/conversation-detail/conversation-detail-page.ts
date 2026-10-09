import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  OnDestroy,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { afterNextRender } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { SessionService } from '../../../core/auth/session.service';
import type { Contact, Conversation, Message } from '../../../core/data/entities';
import { MockDataService } from '../../../core/data/mock-data.service';
import { dayLabel, formatRelative, initials } from '../../../shared/format';
import { ContactPanel } from './contact-panel/contact-panel';
import { MessageBubble } from './message-bubble/message-bubble';
import { MessageComposer, type ComposerSend } from './message-composer/message-composer';

type TimelineItem =
  | { kind: 'day'; id: string; label: string }
  | { kind: 'start'; id: string; label: string }
  | {
      kind: 'message';
      id: string;
      message: Message;
      showAvatar: boolean;
      quoted: Message | null;
    };

/**
 * The conversation thread pane.
 *
 * Layout contract: header and composer are fixed, only the thread scrolls, and
 * the pane never contributes to the page scroll — see `.conv-detail` in
 * `styles/pages/inbox.css`. Everything the agent can send routes through
 * `MockDataService.sendOutbound`, so text, media, templates and interactive
 * objects all share one write path.
 */
@Component({
  selector: 'app-conversation-detail-page',
  standalone: true,
  imports: [RouterLink, MessageBubble, MessageComposer, ContactPanel],
  templateUrl: './conversation-detail-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationDetailPageComponent implements OnDestroy {
  private readonly threadEl = viewChild<ElementRef<HTMLElement>>('threadEl');

  private readonly data = inject(MockDataService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  private readonly sub: Subscription;

  readonly convId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly replyTo = signal<Message | null>(null);
  readonly panelOpen = signal(false);
  readonly lightbox = signal<Message | null>(null);

  /** True while the thread is pinned to the newest message. */
  readonly stick = signal(true);
  readonly pending = signal(0);

  constructor() {
    this.sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('conversationId');
      this.convId.set(id);
      this.replyTo.set(null);
      this.lightbox.set(null);
      this.pending.set(0);
      this.stick.set(true);

      if (id) {
        void this.data.markRead(id);
      }

      afterNextRender(() => this.scrollToBottom('auto'), { injector: this.injector });
    });

    // Keep the newest message in view while the agent is already at the bottom.
    effect(() => {
      const messages = this.messages();

      untracked(() => {
        const last = messages[messages.length - 1];

        if (last && last.direction === 'inbound' && !this.stick()) {
          this.pending.update((count) => count + 1);
        }

        afterNextRender(() => {
          if (this.stick()) {
            this.scrollToBottom('smooth');
          }
        }, { injector: this.injector });
      });
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── State ─────────────────────────────────────────────────────

  readonly conv = computed<Conversation | null>(() => {
    const id = this.convId();
    return this.data.conversations().find((conversation) => conversation.id === id) ?? null;
  });

  readonly contact = computed<Contact | null>(() => {
    const conv = this.conv();
    if (!conv) return null;
    return this.data.contacts().find((person) => person.id === conv.contactId) ?? null;
  });

  readonly messages = computed<Message[]>(() => {
    const id = this.convId();
    if (!id) return [];
    return [...this.data.messagesFor(id)].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  });

  readonly timeline = computed<TimelineItem[]>(() => {
    const messages = this.messages();
    const items: TimelineItem[] = [];
    let currentDay = '';
    let lastDirection = '';

    if (messages.length) {
      const first = messages[0]!;
      items.push({
        kind: 'start',
        id: `start-${first.id}`,
        label: `Conversation started ${dayLabel(first.sentAt)} · ${this.conv()?.channel ?? 'WhatsApp'}`,
      });
    }

    for (const message of messages) {
      const label = dayLabel(message.sentAt);

      if (label !== currentDay) {
        items.push({ kind: 'day', id: `day-${label}-${message.id}`, label });
        currentDay = label;
        lastDirection = '';
      }

      const showAvatar = message.direction !== lastDirection;
      lastDirection = message.direction;

      items.push({
        kind: 'message',
        id: message.id,
        message,
        showAvatar,
        quoted: message.replyToMessageId ? this.findMessage(message.replyToMessageId) : null,
      });
    }

    return items;
  });

  readonly contactName = computed(() => this.contact()?.displayName ?? 'Unknown contact');
  readonly contactInitials = computed(() => initials(this.contactName()));
  readonly contactPhone = computed(() => this.contact()?.waId ?? '');
  readonly lastAt = computed(() => formatRelative(this.conv()?.lastMessageAt));
  readonly agentList = computed(() => this.data.users());
  readonly myInitials = computed(() => initials(this.session.user()?.fullName ?? 'Me'));
  readonly myName = computed(() => this.session.user()?.fullName ?? 'Me');

  readonly assignedName = computed(() => {
    const userId = this.conv()?.assignedUserId;
    if (!userId) return null;
    return this.data.allUsers().find((user) => user.id === userId)?.fullName ?? null;
  });

  /** Summary of what the last message contained, for the queue-style subtitle. */
  readonly lastMessagePreview = computed(() => {
    const messages = this.messages();
    return messages[messages.length - 1]?.content ?? '';
  });

  readonly unreadCount = computed(() => this.conv()?.unreadCount ?? 0);

  // ── Actions ───────────────────────────────────────────────────

  /** Applies a composer batch — one attachment per send, in order. */
  async send(drafts: ComposerSend[]): Promise<void> {
    const id = this.convId();
    if (!id || this.saving() || drafts.length === 0) return;

    this.saving.set(true);
    try {
      for (const draft of drafts) {
        await this.data.sendOutbound(
          id,
          {
            type: draft.type,
            payload: draft.payload,
            whisper: draft.whisper,
            replyToMessageId: draft.replyToMessageId ?? null,
          },
          this.session.user()?.id,
        );
      }

      this.replyTo.set(null);
      this.stick.set(true);
      this.pending.set(0);
    } finally {
      this.saving.set(false);
    }
  }

  async react(event: { messageId: string; emoji: string }): Promise<void> {
    await this.data.toggleReaction(event.messageId, event.emoji, {
      userId: this.session.user()?.id ?? null,
      displayName: this.myName(),
    });
  }

  setReplyTarget(message: Message): void {
    this.replyTo.set(message);
  }

  clearReply(): void {
    this.replyTo.set(null);
  }

  async resolve(): Promise<void> {
    await this.withSaving(() => this.data.updateConversationStatus(this.convId()!, 'resolved'));
  }

  async reopen(): Promise<void> {
    await this.withSaving(() => this.data.updateConversationStatus(this.convId()!, 'open'));
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

  back(): void {
    void this.router.navigate(['/inbox']);
  }

  openLightbox(message: Message): void {
    this.lightbox.set(message);
  }

  closeLightbox(): void {
    this.lightbox.set(null);
  }

  // ── Scrolling ─────────────────────────────────────────────────

  onThreadScroll(): void {
    const element = this.threadEl()?.nativeElement;
    if (!element) return;

    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    const atBottom = distance < 120;

    this.stick.set(atBottom);

    if (atBottom && this.pending() > 0) {
      this.pending.set(0);
    }
  }

  jumpToLatest(): void {
    this.stick.set(true);
    this.pending.set(0);
    this.scrollToBottom('smooth');
  }

  private scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    const element = this.threadEl()?.nativeElement;
    if (!element) return;

    // `scrollTo` is missing in jsdom and in some embedded webviews.
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: element.scrollHeight, behavior });
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }

  private findMessage(messageId: string): Message | null {
    const id = this.convId();
    if (!id) return null;
    return this.data.messagesFor(id).find((message) => message.id === messageId) ?? null;
  }

  private async withSaving(action: () => Promise<void>): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await action();
    } finally {
      this.saving.set(false);
    }
  }
}
