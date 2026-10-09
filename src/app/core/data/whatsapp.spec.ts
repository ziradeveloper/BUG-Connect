import { describe, expect, it } from 'vitest';

import {
  MESSAGE_TYPE_LABEL,
  mediaByteLimit,
  payloadPreview,
  renderTemplateBody,
  type MessagePayload,
} from './whatsapp';

describe('WhatsApp Cloud API contract', () => {
  describe('renderTemplateBody', () => {
    it('substitutes numbered placeholders in order', () => {
      expect(renderTemplateBody('Hi {{1}}, order {{2}} is ready.', ['Anitha', 'ORD-1'])).toBe(
        'Hi Anitha, order ORD-1 is ready.',
      );
    });

    it('leaves unfilled placeholders visible so gaps are obvious', () => {
      expect(renderTemplateBody('Hi {{1}}, order {{2}}.', ['Anitha'])).toBe(
        'Hi Anitha, order {{2}}.',
      );
    });

    it('ignores blank values', () => {
      expect(renderTemplateBody('Hi {{1}}!', ['   '])).toBe('Hi {{1}}!');
    });
  });

  describe('mediaByteLimit', () => {
    it('returns Meta’s caps per object', () => {
      expect(mediaByteLimit('image')).toBe(5 * 1024 * 1024);
      expect(mediaByteLimit('video')).toBe(16 * 1024 * 1024);
      expect(mediaByteLimit('document')).toBe(100 * 1024 * 1024);
    });

    it('gives animated stickers the larger allowance', () => {
      expect(mediaByteLimit('sticker')).toBe(100 * 1024);
      expect(mediaByteLimit('sticker', true)).toBe(500 * 1024);
    });
  });

  describe('payloadPreview', () => {
    it('prefixes media with its icon', () => {
      const payload: MessagePayload = { media: { mimeType: 'image/jpeg' }, caption: 'Silk' };
      expect(payloadPreview('image', payload)).toContain('Photo');
      expect(payloadPreview('image', payload)).toContain('Silk');
    });

    it('names documents and locations', () => {
      expect(
        payloadPreview('document', { media: { mimeType: 'application/pdf', fileName: 'a.pdf' } }),
      ).toContain('a.pdf');

      expect(
        payloadPreview('location', { location: { latitude: 1, longitude: 2, name: 'Store' } }),
      ).toContain('Store');
    });

    it('titles templates and interactive bodies', () => {
      expect(
        payloadPreview('template', { template: { name: 'order_confirmation' } as never }),
      ).toContain('order_confirmation');

      expect(
        payloadPreview('interactive', { interactive: { body: 'Pick a slot' } as never }),
      ).toContain('Pick a slot');
    });

    it('falls back to text and then to the supplied default', () => {
      expect(payloadPreview('text', { text: 'Hello' })).toBe('Hello');
      expect(payloadPreview('text', {}, 'legacy content')).toBe('legacy content');
    });
  });

  it('labels every message object the UI exposes', () => {
    const types = Object.keys(MESSAGE_TYPE_LABEL);
    expect(types).toContain('sticker');
    expect(types).toContain('template');
    expect(types).toContain('interactive');
    expect(types).toContain('reaction');
    expect(types).toContain('flow');
  });
});
