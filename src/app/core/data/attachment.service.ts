import { Injectable } from '@angular/core';

import { formatBytes } from '../../shared/format';
import {
  META_LIMITS,
  META_MIME_ACCEPT,
  mediaByteLimit,
  type MediaKind,
  type MediaMeta,
  type WhatsAppMessageType,
} from './whatsapp';

/** A file the agent has staged but not yet sent. */
export interface StagedAttachment {
  id: string;
  /** Which Cloud API object this file will be sent as. */
  messageType: WhatsAppMessageType;
  kind: MediaKind;
  fileName: string;
  meta: MediaMeta;
  /** Object URL for local preview; revoked when the attachment is dropped. */
  previewUrl: string | null;
  /** Set when the file breaks a Meta limit — the composer blocks the send. */
  error: string | null;
}

/**
 * Stages files for sending: validates them against Meta's published limits,
 * reads intrinsic metadata (dimensions, duration) and creates the object URLs
 * the composer previews. Stands in for the upload endpoint the .NET API will
 * expose — swapping it out must not touch the composer.
 */
@Injectable({ providedIn: 'root' })
export class AttachmentService {
  private staged = new Map<string, string>();

  async stage(file: File, kind: MediaKind): Promise<StagedAttachment> {
    const id = `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const animated = kind === 'sticker' && file.type === 'image/webp' && file.size > 32 * 1024;

    const error = this.validate(file, kind, animated);
    const previewUrl = this.previewable(kind, file) ? URL.createObjectURL(file) : null;

    if (previewUrl) {
      this.staged.set(id, previewUrl);
    }

    const meta: MediaMeta = {
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name,
      fileSize: file.size,
      url: previewUrl,
      animated,
    };

    await this.probe(file, kind, meta, previewUrl);

    return {
      id,
      kind,
      messageType: kind,
      fileName: file.name,
      meta,
      previewUrl,
      error,
    };
  }

  /** Frees the object URL when an attachment is discarded or sent. */
  release(attachment: StagedAttachment | null | undefined): void {
    if (!attachment?.previewUrl) {
      return;
    }

    URL.revokeObjectURL(attachment.previewUrl);
    this.staged.delete(attachment.id);
  }

  releaseAll(attachments: StagedAttachment[]): void {
    for (const attachment of attachments) {
      this.release(attachment);
    }
  }

  private validate(file: File, kind: MediaKind, animated: boolean): string | null {
    const limit = mediaByteLimit(kind, animated);

    if (file.size > limit) {
      return `${file.name} is ${formatBytes(file.size)}. ${kindLabel(kind)} must be under ${formatBytes(limit)}.`;
    }

    if (kind === 'document') {
      // Meta accepts most document types; only the size limit is enforced.
      return null;
    }

    const accepted = META_MIME_ACCEPT[kind]
      .split(',')
      .map((entry) => entry.trim().toLowerCase());

    const matches =
      accepted.includes(file.type.toLowerCase()) ||
      accepted.some((entry) => entry.startsWith('.') && file.name.toLowerCase().endsWith(entry));

    if (!file.type && !matches) {
      return `Could not read the file type of ${file.name}.`;
    }

    if (!matches) {
      return `${file.type || file.name} is not a ${kindLabel(kind).toLowerCase()} type WhatsApp accepts (${accepted.join(', ')}).`;
    }

    if (kind === 'sticker' && file.size > META_LIMITS.fileBytes.sticker && !animated) {
      return `Static stickers must be under ${formatBytes(META_LIMITS.fileBytes.sticker)}.`;
    }

    return null;
  }

  private previewable(kind: MediaKind, file: File): boolean {
    if (kind === 'document') {
      return false;
    }

    return file.type.startsWith('image/') || file.type.startsWith('video/');
  }

  /** Reads intrinsic dimensions / duration so bubbles can size themselves. */
  private async probe(
    file: File,
    kind: MediaKind,
    meta: MediaMeta,
    previewUrl: string | null,
  ): Promise<void> {
    if (kind === 'image' || kind === 'sticker') {
      if (!previewUrl) return;

      try {
        const size = await imageSize(previewUrl);
        meta.width = size.width;
        meta.height = size.height;
      } catch {
        // Dimensions are cosmetic — the bubble falls back to a fixed ratio.
      }
      return;
    }

    if (kind === 'video' || kind === 'audio' || kind === 'voice') {
      const isVideo = file.type.startsWith('video/');
      // Audio and voice notes are not previewable, so probe a throwaway URL
      // and release it immediately — object URLs are never garbage collected.
      const source = previewUrl ?? URL.createObjectURL(file);
      const borrowed = source !== previewUrl;

      try {
        meta.durationSeconds = await mediaDuration(source, isVideo);
      } catch {
        // Leave duration unset; the bubble then hides its duration badge.
      } finally {
        if (borrowed) {
          URL.revokeObjectURL(source);
        }
      }
    }
  }
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('decode failed'));
    image.src = src;
  });
}

function mediaDuration(src: string, isVideo: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    const element = document.createElement(isVideo ? 'video' : 'audio');
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const seconds = Math.round(element.duration);
      resolve(Number.isFinite(seconds) ? seconds : 0);
    };
    element.onerror = () => reject(new Error('metadata failed'));
    element.src = src;
  });
}

function kindLabel(kind: MediaKind): string {
  switch (kind) {
    case 'image':
      return 'Photos';
    case 'video':
      return 'Videos';
    case 'audio':
      return 'Audio';
    case 'voice':
      return 'Voice notes';
    case 'sticker':
      return 'Stickers';
    default:
      return 'Documents';
  }
}
