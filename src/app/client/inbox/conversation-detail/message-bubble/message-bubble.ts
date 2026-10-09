import { KeyValuePipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { Message } from '../../../../core/data/entities';
import {
  renderTemplateBody,
  type ContactCard,
  type InteractivePayload,
  type LocationPayload,
  type MediaMeta,
  type TemplatePayload,
} from '../../../../core/data/whatsapp';
import { fileExtension, fileIcon, QUICK_REACTIONS } from '../../../../core/data/composer-catalog';
import { formatBytes, formatClock, formatTimeOfDay } from '../../../../shared/format';

/**
 * Renders one Cloud API message object.
 *
 * Every type in `WhatsAppMessageType` has a branch here — text, the media
 * family, stickers (static and animated), documents, location, contact cards,
 * templates, interactive messages, flow responses and reactions — so the
 * thread never falls back to "unsupported message".
 */
@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [KeyValuePipe, NgClass],
  templateUrl: './message-bubble.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageBubble {
  readonly message = input.required<Message>();
  /** The message being quoted, resolved by the parent thread. */
  readonly quoted = input<Message | null>(null);
  readonly contactInitials = input('?');
  readonly agentInitials = input('Me');
  /** Hide the avatar on consecutive messages from the same sender. */
  readonly showAvatar = input(true);

  readonly react = output<{ messageId: string; emoji: string }>();
  readonly reply = output<Message>();
  readonly openMedia = output<Message>();

  readonly quickReactions = QUICK_REACTIONS;

  readonly outbound = computed(() => this.message().direction === 'outbound');
  readonly whisper = computed(() => this.message().isInternalWhisper);
  readonly type = computed(() => this.message().type);
  readonly payload = computed(() => this.message().payload);
  readonly reactions = computed(() => this.message().reactions ?? []);

  readonly media = computed<MediaMeta | null>(() => this.payload().media ?? null);
  readonly template = computed<TemplatePayload | null>(() => this.payload().template ?? null);
  readonly interactive = computed<InteractivePayload | null>(
    () => this.payload().interactive ?? null,
  );
  readonly location = computed<LocationPayload | null>(() => this.payload().location ?? null);
  readonly contacts = computed<ContactCard[]>(() => this.payload().contacts ?? []);
  readonly flow = computed(() => this.payload().flow ?? null);

  readonly time = computed(() => formatTimeOfDay(this.message().sentAt));
  readonly caption = computed(() => this.payload().caption ?? '');
  readonly text = computed(() => this.payload().text ?? this.message().content);

  readonly fileIcon = computed(() => fileIcon(this.media()?.fileName, this.media()?.mimeType));
  readonly fileExtension = computed(() => fileExtension(this.media()?.fileName));
  readonly fileSize = computed(() => formatBytes(this.media()?.fileSize));

  readonly duration = computed(() => formatClock(this.media()?.durationSeconds));

  readonly templateBody = computed(() => {
    const template = this.template();
    return template ? renderTemplateBody(template.body, template.variables) : '';
  });

  readonly interactiveBody = computed(() => {
    const interactive = this.interactive();
    return interactive ? renderTemplateBody(interactive.body, []) : '';
  });

  readonly listRows = computed(() => {
    const interactive = this.interactive();
    if (!interactive?.sections?.length) {
      return [];
    }

    return interactive.sections.map((section) => ({
      title: section.title ?? '',
      rows: section.rows.slice(0, 10),
    }));
  });

  /** Deterministic waveform bars so a voice note reads as audio, not a bar. */
  readonly waveform = computed<number[]>(() => {
    const seconds = this.media()?.durationSeconds ?? 8;
    const seed = this.message().id.length + seconds;
    const bars: number[] = [];

    for (let i = 0; i < 28; i += 1) {
      const wave = Math.sin((i + seed) * 0.7) * 0.35 + Math.sin((i + seed) * 0.31) * 0.25;
      bars.push(Math.round(28 + Math.abs(wave) * 72));
    }

    return bars;
  });

  readonly deliveryIcon = computed(() => {
    switch (this.message().deliveryStatus) {
      case 'delivered':
      case 'read':
        return '✓✓';
      case 'failed':
        return '!';
      default:
        return '✓';
    }
  });

  readonly deliveryLabel = computed(() => {
    switch (this.message().deliveryStatus) {
      case 'sent':
        return 'Sent';
      case 'delivered':
        return 'Delivered';
      case 'read':
        return 'Read';
      default:
        return 'Not delivered';
    }
  });

  readonly reactionSummary = computed(() =>
    this.reactions()
      .map((reaction) => `${reaction.displayName} reacted with ${reaction.emoji}`)
      .join(' · '),
  );

  readonly mapsUrl = computed(() => {
    const place = this.location();
    if (!place) return '';
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  });

  /** Sticker glyph: packs seeded without a WebP asset carry the glyph itself. */
  readonly stickerGlyph = computed(() => this.media()?.glyph ?? '😊');
  readonly stickerAnimation = computed(() => this.media()?.animated ?? false);

  /** The CSS loop that brings an animated sticker to life. */
  readonly stickerAnimationClass = computed(
    () => `sticker-anim-${this.media()?.animation ?? 'pulse'}`,
  );

  toggleReaction(emoji: string): void {
    this.react.emit({ messageId: this.message().id, emoji });
  }

  quotedPreview(message: Message | null): string {
    if (!message) {
      return '';
    }

    if (message.type === 'text') {
      return message.payload.text ?? message.content;
    }

    return message.content || message.type;
  }
}
