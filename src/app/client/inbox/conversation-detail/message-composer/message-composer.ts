import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import {
  AttachmentService,
  type StagedAttachment,
} from '../../../../core/data/attachment.service';
import { EMOJI_GROUPS, QUICK_REPLIES, STICKER_PACKS } from '../../../../core/data/composer-catalog';
import type { Message } from '../../../../core/data/entities';
import {
  META_LIMITS,
  META_MIME_ACCEPT,
  type ContactCard,
  type InteractivePayload,
  type LocationPayload,
  type MediaKind,
  type MessagePayload,
  type TemplatePayload,
  type WhatsAppMessageType,
} from '../../../../core/data/whatsapp';
import { formatBytes } from '../../../../shared/format';
import { ContactPickerDialog } from '../dialogs/contact-picker-dialog';
import { InteractiveBuilderDialog } from '../dialogs/interactive-builder-dialog';
import { LocationPickerDialog } from '../dialogs/location-picker-dialog';
import { TemplatePickerDialog } from '../dialogs/template-picker-dialog';

/** A staged draft, ready for `MockDataService.sendOutbound`. */
export type ComposerDraft = {
  type: WhatsAppMessageType;
  payload: MessagePayload;
  whisper: boolean;
};

export type ComposerSend = ComposerDraft & {
  /** Set when the agent is replying in context. */
  replyToMessageId?: string | null;
};

type Panel = 'none' | 'attach' | 'emoji' | 'sticker';

/**
 * The agent composer — WhatsApp-shaped on purpose.
 *
 * One bar covers every Cloud API message object: free text and internal notes,
 * the media family (photo, video, document, audio, voice), static and animated
 * stickers, location, contact cards, approved templates and interactive
 * messages (quick replies, list, CTA, flow). Attachments stage locally with
 * live previews and Meta limit validation before anything is sent.
 */
@Component({
  selector: 'app-message-composer',
  standalone: true,
  imports: [
    NgClass,
    ContactPickerDialog,
    InteractiveBuilderDialog,
    LocationPickerDialog,
    TemplatePickerDialog,
  ],
  templateUrl: './message-composer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageComposer {
  private readonly attachments = inject(AttachmentService);
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textInput');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly replyTo = input<Message | null>(null);
  readonly disabled = input(false);
  readonly contactName = input('the customer');
  readonly sending = input(false);

  /**
   * Emits a batch: drafting a caption with three photos attached produces three
   * sends, and the page applies them in order.
   */
  readonly send = output<ComposerSend[]>();
  readonly cancelReply = output<void>();

  readonly text = signal('');
  readonly whisper = signal(false);
  readonly panel = signal<Panel>('none');
  readonly dragOver = signal(false);

  /** Files staged for sending, one bubble per file. */
  readonly staged = signal<StagedAttachment[]>([]);
  /** Caption per staged attachment id. */
  readonly captions = signal<Record<string, string>>({});

  readonly emojiGroups = EMOJI_GROUPS;
  readonly stickerPacks = STICKER_PACKS;
  readonly activePack = signal(STICKER_PACKS[0]!.id);
  readonly activeEmojiGroup = signal(EMOJI_GROUPS[0]!.id);

  readonly quickReplies = QUICK_REPLIES;
  readonly dragDepth = signal(0);

  /** Which attach action armed the file input. */
  private pendingKind = signal<MediaKind>('image');

  readonly accept = computed(() => META_MIME_ACCEPT[this.pendingKind()]);

  readonly charLimit = computed(() =>
    this.whisper()
      ? META_LIMITS.whisperChars
      : this.staged().length
        ? META_LIMITS.captionChars
        : META_LIMITS.textChars,
  );

  readonly charCount = computed(() => this.text().length);
  readonly overLimit = computed(() => this.charCount() > this.charLimit());
  readonly remaining = computed(() => this.charLimit() - this.charCount());
  readonly showCounter = computed(() => this.remaining() <= 200 || this.overLimit());

  readonly hasStaged = computed(() => this.staged().length > 0);
  readonly blocked = computed(() => this.staged().some((item) => item.error !== null));

  readonly canSend = computed(() => {
    if (this.disabled() || this.sending() || this.overLimit()) {
      return false;
    }

    if (this.hasStaged()) {
      return !this.blocked();
    }

    return this.text().trim().length > 0;
  });

  /** `/shortcut` matching, shown as a hint strip above the textarea. */
  readonly slashMatches = computed(() => {
    const value = this.text();

    if (!value.startsWith('/') || value.includes(' ')) {
      return [];
    }

    return QUICK_REPLIES.filter((reply) => reply.shortcut.startsWith(value.toLowerCase())).slice(
      0,
      4,
    );
  });

  readonly replyPreview = computed(() => {
    const target = this.replyTo();
    if (!target) {
      return null;
    }

    return {
      author: target.direction === 'outbound' ? 'You' : 'Customer',
      text: target.payload.text ?? target.content,
    };
  });

  // ── Mode ──────────────────────────────────────────────────────

  setWhisper(value: boolean): void {
    this.whisper.set(value);
    this.panel.set('none');
    this.focusText();
  }

  togglePanel(panel: Panel): void {
    this.panel.set(this.panel() === panel ? 'none' : panel);
  }

  closePanels(): void {
    if (this.panel() !== 'none') {
      this.panel.set('none');
    }
  }

  // ── Text ──────────────────────────────────────────────────────

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.text.set(target.value);
    this.autoGrow(target);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.sendText();
  }

  insertEmoji(emoji: string): void {
    const element = this.textarea()?.nativeElement;
    const value = this.text();

    if (!element) {
      this.text.set(value + emoji);
      return;
    }

    const start = element.selectionStart ?? value.length;
    const end = element.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;

    this.text.set(next);
    element.value = next;

    const caret = start + emoji.length;
    element.setSelectionRange(caret, caret);
    element.focus();
    this.autoGrow(element);
  }

  applyQuickReply(body: string): void {
    this.text.set(body);
    this.focusText();
  }

  private focusText(): void {
    const element = this.textarea()?.nativeElement;
    if (!element) return;
    element.focus();
    this.autoGrow(element);
  }

  private autoGrow(element: HTMLTextAreaElement): void {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 176)}px`;
  }

  // ── Attachments ───────────────────────────────────────────────

  pickFile(kind: MediaKind): void {
    this.pendingKind.set(kind);
    this.panel.set('none');

    // Set `accept` imperatively so the native picker filters before it opens,
    // instead of waiting for the binding to flush on the next change detection.
    const input = this.fileInput()?.nativeElement;
    if (!input) return;

    input.accept = META_MIME_ACCEPT[kind];
    input.click();
  }

  async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    for (const file of files) {
      await this.stage(file, this.pendingKind());
    }

    input.value = '';
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOver.set(false);
    this.dragDepth.set(0);

    const files = Array.from(event.dataTransfer?.files ?? []);
    for (const file of files) {
      await this.stage(file, guessKind(file));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragDepth.update((depth) => Math.max(0, depth - 1));
    if (this.dragDepth() === 0) {
      this.dragOver.set(false);
    }
  }

  onDragEnter(): void {
    this.dragDepth.update((depth) => depth + 1);
    this.dragOver.set(true);
  }

  private async stage(file: File, kind: MediaKind): Promise<void> {
    const attachment = await this.attachments.stage(file, kind);
    this.staged.update((items) => [...items, attachment]);
  }

  removeStaged(attachment: StagedAttachment): void {
    this.attachments.release(attachment);
    this.staged.update((items) => items.filter((item) => item.id !== attachment.id));
    this.captions.update((map) => {
      const next = { ...map };
      delete next[attachment.id];
      return next;
    });
  }

  setCaption(attachment: StagedAttachment, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.captions.update((map) => ({ ...map, [attachment.id]: value }));
  }

  captionFor(attachment: StagedAttachment): string {
    return this.captions()[attachment.id] ?? '';
  }

  sizeLabel(attachment: StagedAttachment): string {
    return formatBytes(attachment.meta.fileSize);
  }

  // ── Stickers ──────────────────────────────────────────────────

  sendSticker(sticker: { glyph: string; label: string; animated?: boolean; animation?: string }): void {
    this.panel.set('none');
    this.send.emit([
      {
        type: 'sticker',
        payload: {
          media: {
            mimeType: 'image/webp',
            glyph: sticker.glyph,
            animated: sticker.animated ?? false,
            animation: sticker.animation,
            fileSize: sticker.animated ? 320 * 1024 : 64 * 1024,
            fileName: sticker.label,
          },
        },
        whisper: false,
      },
    ]);
  }

  animatedPack(id: string): boolean {
    return this.stickerPacks.some((pack) => pack.id === id && pack.animated);
  }

  // ── Sending ───────────────────────────────────────────────────

  sendText(): void {
    if (!this.canSend()) {
      return;
    }

    const replyToMessageId = this.replyTo()?.id ?? null;

    if (this.hasStaged()) {
      const drafts = this.staged()
        .filter((attachment) => !attachment.error)
        .map((attachment, index) => {
          const caption = this.captionFor(attachment).trim();
          const body = caption || this.text().trim();

          return {
            type: attachment.messageType,
            payload: {
              media: { ...attachment.meta },
              caption: caption || (attachment.kind === 'document' ? null : body) || null,
            },
            whisper: false,
            // Only the first attachment of a batch carries the reply context.
            replyToMessageId: index === 0 ? replyToMessageId : null,
          } satisfies ComposerSend;
        });

      this.clearStaged();
      this.text.set('');
      this.resetHeight();
      this.send.emit(drafts);
      return;
    }

    const body = this.text().trim();
    const whisper = this.whisper();

    this.text.set('');
    this.resetHeight();
    this.send.emit([{ type: 'text', payload: { text: body }, whisper, replyToMessageId }]);
  }

  sendTemplate(payload: TemplatePayload): void {
    this.panel.set('none');
    this.send.emit([{ type: 'template', payload: { template: payload }, whisper: false }]);
  }

  sendInteractive(payload: InteractivePayload): void {
    this.panel.set('none');
    this.send.emit([{ type: 'interactive', payload: { interactive: payload }, whisper: false }]);
  }

  sendLocation(location: LocationPayload): void {
    this.panel.set('none');
    this.send.emit([{ type: 'location', payload: { location }, whisper: false }]);
  }

  sendContacts(contacts: ContactCard[]): void {
    this.panel.set('none');
    this.send.emit([{ type: 'contacts', payload: { contacts }, whisper: false }]);
  }

  private clearStaged(): void {
    this.attachments.releaseAll(this.staged());
    this.staged.set([]);
    this.captions.set({});
  }

  private resetHeight(): void {
    const element = this.textarea()?.nativeElement;
    if (element) {
      element.value = '';
      element.style.height = 'auto';
    }
  }

  placeholder(): string {
    if (this.whisper()) {
      return 'Write an internal note — only your team sees this…';
    }

    if (this.hasStaged()) {
      return 'Add a caption (optional)…';
    }

    return `Message ${this.contactName()}…`;
  }
}

/** Chooses the Cloud API object for a dropped file. */
function guessKind(file: File): MediaKind {
  if (file.type.startsWith('image/')) {
    return file.type === 'image/webp' ? 'sticker' : 'image';
  }

  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';

  return 'document';
}
