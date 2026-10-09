/**
 * Meta WhatsApp Cloud API message contract.
 *
 * The Cloud API sends (and the webhook delivers) a small set of message
 * objects. Everything the Team Inbox can send or render is described here so
 * the UI, the mock transport and the future .NET API all speak the same
 * vocabulary: a message is *one* `WhatsAppMessageType` plus a typed payload.
 *
 * Reference: WhatsApp Cloud API → Messages → "Send messages".
 *   text · template · interactive (button/list/cta/flow/catalog/product)
 *   image · video · audio · voice (ptt) · document · sticker (static +
 *   animated WebP) · location · contacts · reaction
 *
 * Limits below are Meta's published ones; the composer enforces them so an
 * agent cannot stage a payload the API would reject with a 131xxx error.
 */

/** Every message object the Cloud API accepts, plus notes rendered inline. */
export type WhatsAppMessageType =
  | 'text'
  | 'template'
  | 'interactive'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'reaction'
  | 'flow';

/** Media sub-kinds, used to pick an icon and to drive the file picker. */
export type MediaKind = 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker';

export interface MediaMeta {
  /** e.g. `image/jpeg`, `application/pdf`, `image/webp`. */
  mimeType: string;
  /** Original file name, when the agent picked a file from disk. */
  fileName?: string;
  /** Bytes. */
  fileSize?: number;
  width?: number;
  height?: number;
  /** Seconds, for audio/video/voice. */
  durationSeconds?: number;
  /**
   * Blob URL for a locally staged attachment. In the mock build this never
   * leaves the browser; against the real API it is the uploaded asset URL.
   */
  url?: string | null;
  /** Poster/thumbnail for video, or a small preview for documents. */
  thumbnailUrl?: string | null;
  /** Animated WebP sticker — Meta accepts these up to 500 KB. */
  animated?: boolean;
  /**
   * Demo-only glyph for stickers seeded without a file. Real packs ship WebP
   * assets through `url`; this keeps the send and render paths identical.
   */
  glyph?: string;
  /** Loop used to render an animated sticker: pulse, bounce, wiggle, spin… */
  animation?: string;
}

export interface TemplateButtonPayload {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface TemplateHeaderPayload {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  mediaUrl?: string | null;
  fileName?: string;
}

export interface TemplatePayload {
  /** Meta template name, e.g. `order_confirmation`. */
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  header?: TemplateHeaderPayload | null;
  body: string;
  footer?: string | null;
  buttons?: TemplateButtonPayload[];
  /** `{{1}}` … `{{n}}` resolved in order — the Cloud API `components` array. */
  variables: string[];
}

export interface InteractiveButton {
  id: string;
  title: string;
}

export interface InteractiveRow {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveSection {
  title?: string;
  rows: InteractiveRow[];
}

export interface InteractiveHeader {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  mediaUrl?: string | null;
}

/** Interactive object subtypes the Cloud API supports. */
export type InteractiveSubtype =
  | 'button'
  | 'list'
  | 'cta_url'
  | 'catalog'
  | 'product'
  | 'flow';

export interface InteractivePayload {
  subtype: InteractiveSubtype;
  header?: InteractiveHeader | null;
  body: string;
  footer?: string | null;
  /** Quick replies and CTA buttons. Max 3 quick replies, or 2 CTAs. */
  buttons: InteractiveButton[];
  /** List rows grouped in sections — max 10 rows in total. */
  sections?: InteractiveSection[];
  /** List-footer label ("View products"), or the CTA / Flow button label. */
  actionLabel?: string;
  /** Flow id + screen for `subtype: 'flow'`. */
  flowId?: string;
  flowCta?: string;
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactCard {
  name: string;
  phone: string;
  email?: string;
  organization?: string;
}

export interface ReactionPayload {
  emoji: string;
  /** `wa_id` of the message being reacted to. */
  targetMessageId: string;
}

/** A reaction a contact or agent left on a message. */
export interface MessageReaction {
  emoji: string;
  userId: string | null;
  /** Display name so the tooltip reads "Anitha reacted with ❤️". */
  displayName: string;
}

/**
 * The discriminated payload carried by a message. Only the key matching
 * `Message.type` is populated, mirroring the Cloud API request body.
 */
export interface MessagePayload {
  text?: string | null;
  /** Caption on image / video / document messages. */
  caption?: string | null;
  media?: MediaMeta | null;
  template?: TemplatePayload | null;
  interactive?: InteractivePayload | null;
  location?: LocationPayload | null;
  contacts?: ContactCard[] | null;
  reaction?: ReactionPayload | null;
  /** Rendered WhatsApp Flow response (native forms). */
  flow?: { name: string; screen: string; response: Record<string, string> } | null;
}

/** Meta's per-object payload limits, enforced by the composer before sending. */
export const META_LIMITS = {
  /** Text body characters. */
  textChars: 4096,
  /** Media caption characters. */
  captionChars: 1024,
  /** Internal notes are ours, not Meta's — keep them deliberately short. */
  whisperChars: 1000,
  fileBytes: {
    image: 5 * 1024 * 1024,
    video: 16 * 1024 * 1024,
    audio: 16 * 1024 * 1024,
    voice: 16 * 1024 * 1024,
    document: 100 * 1024 * 1024,
    sticker: 100 * 1024,
  } as Record<MediaKind, number>,
  /** An animated WebP sticker may be 500 KB instead of 100 KB. */
  animatedStickerBytes: 500 * 1024,
  quickReplyButtons: 3,
  listRows: 10,
  listSections: 10,
  buttonTitleChars: 20,
  rowTitleChars: 24,
  rowDescriptionChars: 72,
  bodyChars: 1024,
  footerChars: 60,
  headerChars: 60,
} as const;

/** Accepted MIME types per media object, used to build `accept` attributes. */
export const META_MIME_ACCEPT: Record<MediaKind, string> = {
  image: 'image/jpeg,image/png,image/webp',
  video: 'video/mp4,video/3gpp',
  audio: 'audio/aac,audio/amr,audio/mpeg,audio/mp4,audio/ogg,audio/opus',
  voice: 'audio/aac,audio/amr,audio/mpeg,audio/mp4,audio/ogg,audio/opus',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip',
  sticker: 'image/webp',
};

/** Human label for each message object, shown in menus and queue previews. */
export const MESSAGE_TYPE_LABEL: Record<WhatsAppMessageType, string> = {
  text: 'Text',
  template: 'Template',
  interactive: 'Interactive',
  image: 'Photo',
  video: 'Video',
  audio: 'Audio',
  voice: 'Voice note',
  document: 'Document',
  sticker: 'Sticker',
  location: 'Location',
  contacts: 'Contact',
  reaction: 'Reaction',
  flow: 'WhatsApp Flow',
};

/** Single glyph used in the queue preview and on attachment chips. */
export const MESSAGE_TYPE_ICON: Record<WhatsAppMessageType, string> = {
  text: '',
  template: '📋',
  interactive: '🔘',
  image: '🖼',
  video: '🎬',
  audio: '🎵',
  voice: '🎤',
  document: '📄',
  sticker: '😀',
  location: '📍',
  contacts: '👤',
  reaction: '👍',
  flow: '🧾',
};

/**
 * Substitutes `{{1}}`…`{{n}}` placeholders with the agent-supplied values,
 * exactly like Meta does before delivery. Unfilled placeholders are left
 * visible so a missing value is obvious at a glance.
 */
export function renderTemplateBody(body: string, variables: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (match, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    const value = variables[index];
    return value && value.trim() ? value : match;
  });
}

export const MEDIA_TYPES: WhatsAppMessageType[] = [
  'image',
  'video',
  'audio',
  'voice',
  'document',
  'sticker',
];

export function isMediaType(type: WhatsAppMessageType): type is MediaKind {
  return (MEDIA_TYPES as string[]).includes(type);
}

/** Size limit for a media object, honouring the animated-sticker allowance. */
export function mediaByteLimit(kind: MediaKind, animated = false): number {
  if (kind === 'sticker' && animated) {
    return META_LIMITS.animatedStickerBytes;
  }
  return META_LIMITS.fileBytes[kind];
}

/**
 * The one-line preview a queue row shows under the contact name.
 * Falls back to the stored `content` for legacy rows.
 */
export function payloadPreview(
  type: WhatsAppMessageType,
  payload: MessagePayload | null | undefined,
  fallback = '',
): string {
  if (!payload) {
    return fallback;
  }

  const icon = MESSAGE_TYPE_ICON[type];

  switch (type) {
    case 'image':
      return `${icon} Photo${payload.caption ? ` · ${payload.caption}` : ''}`;
    case 'video':
      return `${icon} Video${payload.caption ? ` · ${payload.caption}` : ''}`;
    case 'audio':
      return `${icon} Audio`;
    case 'voice':
      return `${icon} Voice note`;
    case 'document':
      return `${icon} ${payload.media?.fileName ?? 'Document'}`;
    case 'sticker':
      return `${payload.media?.glyph ?? icon} Sticker`;
    case 'location':
      return `${icon} ${payload.location?.name ?? 'Location'}`;
    case 'contacts':
      return `${icon} ${payload.contacts?.[0]?.name ?? 'Contact card'}`;
    case 'reaction':
      return `${payload.reaction?.emoji ?? '👍'} Reaction`;
    case 'template':
      return `${icon} ${payload.template?.name ?? 'Template'}`;
    case 'interactive':
      return `${icon} ${payload.interactive?.body ?? 'Interactive message'}`;
    case 'flow':
      return `${icon} ${payload.flow?.name ?? 'WhatsApp Flow'}`;
    default:
      return payload.text || payload.caption || fallback;
  }
}
