/**
 * Static content the composer offers: sticker packs, the emoji palette and the
 * canned replies an agent can insert with a `/shortcut`.
 *
 * Real sticker packs are WebP assets fetched from Meta's sticker endpoint;
 * these stand in for them so the send-path and the renderer are exercised the
 * same way. Swapping in real packs means replacing this catalogue only.
 */

export type StickerAnimation = 'pulse' | 'bounce' | 'wiggle' | 'spin' | 'heartbeat' | 'shake';

export interface Sticker {
  id: string;
  /** Glyph drawn inside the sticker tile. */
  glyph: string;
  label: string;
  animation?: StickerAnimation;
}

export interface StickerPack {
  id: string;
  name: string;
  /** Animated WebP packs are rendered with a CSS loop in the demo. */
  animated: boolean;
  stickers: Sticker[];
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'pack-thanks',
    name: 'Thanks & greetings',
    animated: false,
    stickers: [
      { id: 'thanks-1', glyph: '🙏', label: 'Thank you' },
      { id: 'thanks-2', glyph: '😊', label: 'Smile' },
      { id: 'thanks-3', glyph: '👍', label: 'Thumbs up' },
      { id: 'thanks-4', glyph: '❤️', label: 'Love' },
      { id: 'thanks-5', glyph: '🙌', label: 'Celebrate' },
      { id: 'thanks-6', glyph: '😍', label: 'Wow' },
      { id: 'thanks-7', glyph: '🥳', label: 'Party' },
      { id: 'thanks-8', glyph: '✨', label: 'Sparkle' },
    ],
  },
  {
    id: 'pack-orders',
    name: 'Order desk',
    animated: false,
    stickers: [
      { id: 'order-1', glyph: '📦', label: 'Packed' },
      { id: 'order-2', glyph: '🚚', label: 'Dispatched' },
      { id: 'order-3', glyph: '🧾', label: 'Invoice' },
      { id: 'order-4', glyph: '💳', label: 'Payment' },
      { id: 'order-5', glyph: '🎁', label: 'Gift wrap' },
      { id: 'order-6', glyph: '⏰', label: 'Almost ready' },
      { id: 'order-7', glyph: '✅', label: 'Confirmed' },
      { id: 'order-8', glyph: '📍', label: 'Store location' },
    ],
  },
  {
    id: 'pack-animated',
    name: 'Animated',
    animated: true,
    stickers: [
      { id: 'anim-1', glyph: '🎉', label: 'Confetti', animation: 'bounce' },
      { id: 'anim-2', glyph: '❤️', label: 'Heartbeat', animation: 'heartbeat' },
      { id: 'anim-3', glyph: '🙏', label: 'Namaste', animation: 'pulse' },
      { id: 'anim-4', glyph: '🔥', label: 'Hot deal', animation: 'wiggle' },
      { id: 'anim-5', glyph: '⭐', label: 'Star', animation: 'spin' },
      { id: 'anim-6', glyph: '🎊', label: 'Celebrate', animation: 'shake' },
      { id: 'anim-7', glyph: '💫', label: 'Dizzy', animation: 'spin' },
      { id: 'anim-8', glyph: '👏', label: 'Clap', animation: 'wiggle' },
    ],
  },
];

export const EMOJI_GROUPS: { id: string; label: string; emoji: string[] }[] = [
  {
    id: 'smileys',
    label: 'Smileys',
    emoji: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊',
      '😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜',
    ],
  },
  {
    id: 'gestures',
    label: 'Gestures',
    emoji: ['👍','👎','👌','✌️','🤞','🤟','🤘','👏','🙌','🤝','🙏','💪'],
  },
  {
    id: 'hearts',
    label: 'Hearts',
    emoji: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💖','💝','💯','✨'],
  },
  {
    id: 'shop',
    label: 'Shopping',
    emoji: ['🛍','🛒','🎁','📦','🚚','💳','🧾','🏷','💰','📍','📞','✅'],
  },
  {
    id: 'time',
    label: 'Time',
    emoji: ['⏰','⏳','📅','🗓','🌅','🌙','☀️','⚡','🔥','🎉','🎊','🥳'],
  },
];

/** The six reactions offered on hover, matching WhatsApp's quick set. */
export const QUICK_REACTIONS = ['❤️', '👍', '👎', '😂', '🙏', '😮'];

/** Canned replies. Typing `/hi` in the composer expands the body. */
export const QUICK_REPLIES: { shortcut: string; label: string; body: string }[] = [
  {
    shortcut: '/hi',
    label: 'Greeting',
    body: 'Hello! Thank you for messaging us. How can we help you today?',
  },
  {
    shortcut: '/hours',
    label: 'Store hours',
    body: 'We are open 10:00 am to 8:30 pm, Monday to Saturday. WhatsApp replies continue after hours.',
  },
  {
    shortcut: '/track',
    label: 'Order tracking',
    body: 'Share your order number and we will send the live delivery status right away.',
  },
  {
    shortcut: '/payment',
    label: 'Payment options',
    body: 'You can pay by UPI, card or net banking. I can share the payment link here.',
  },
  {
    shortcut: '/thanks',
    label: 'Closing',
    body: 'Thanks for choosing us! Reply any time if you need more help. 🙏',
  },
];

/** Extension → glyph for document bubbles and attachment chips. */
const FILE_ICONS: Record<string, string> = {
  pdf: '📕',
  doc: '📘',
  docx: '📘',
  xls: '📗',
  xlsx: '📗',
  csv: '📗',
  ppt: '📙',
  pptx: '📙',
  zip: '🗜',
  rar: '🗜',
  txt: '📄',
};

export function fileIcon(fileName: string | undefined, mimeType?: string): string {
  const extension = fileName?.split('.').pop()?.toLowerCase() ?? '';

  if (FILE_ICONS[extension]) {
    return FILE_ICONS[extension] as string;
  }

  if (mimeType?.startsWith('image/')) return '🖼';
  if (mimeType?.startsWith('video/')) return '🎬';
  if (mimeType?.startsWith('audio/')) return '🎵';

  return '📄';
}

/** Uppercase extension label shown in the corner of a document tile. */
export function fileExtension(fileName: string | undefined): string {
  const extension = fileName?.split('.').pop() ?? '';
  return extension ? extension.toUpperCase().slice(0, 4) : 'FILE';
}
