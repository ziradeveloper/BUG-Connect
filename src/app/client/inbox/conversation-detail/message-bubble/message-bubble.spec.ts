import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { Message } from '../../../../core/data/entities';
import { MessageBubble } from './message-bubble';

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    direction: 'outbound',
    type: 'text',
    payload: { text: 'Hello there' },
    content: 'Hello there',
    mediaUrl: null,
    deliveryStatus: 'sent',
    isInternalWhisper: false,
    createdByUserId: null,
    sentAt: '2026-10-08T06:30:00.000Z',
    reactions: [],
    ...overrides,
  };
}

describe('MessageBubble', () => {
  let fixture: ComponentFixture<MessageBubble>;

  function render(overrides: Partial<Message>): HTMLElement {
    fixture.componentRef.setInput('message', message(overrides));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MessageBubble] }).compileComponents();
    fixture = TestBed.createComponent(MessageBubble);
  });

  it('renders a text message', () => {
    const host = render({});
    expect(host.querySelector('.bubble__text')?.textContent).toContain('Hello there');
  });

  it('marks inbound and outbound messages apart', () => {
    expect(render({ direction: 'inbound' }).querySelector('.bubble--inbound')).toBeTruthy();
    expect(render({ direction: 'outbound' }).querySelector('.bubble--outbound')).toBeTruthy();
  });

  it('renders an image with its caption and keeps it zoomable', () => {
    const host = render({
      type: 'image',
      payload: { media: { mimeType: 'image/jpeg', url: 'blob:photo' }, caption: 'Bottle green' },
    });

    expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:photo');
    expect(host.textContent).toContain('Bottle green');
  });

  it('renders a document tile with name and size', () => {
    const host = render({
      type: 'document',
      payload: { media: { mimeType: 'application/pdf', fileName: 'invoice.pdf', fileSize: 184320 } },
    });

    expect(host.querySelector('.bubble__doc-name')?.textContent).toContain('invoice.pdf');
    expect(host.querySelector('.bubble__doc-meta')?.textContent).toContain('PDF');
    expect(host.querySelector('.bubble__doc-meta')?.textContent).toContain('180 KB');
  });

  it('renders stickers without a bubble shell, flagging animated ones', () => {
    const host = render({
      type: 'sticker',
      payload: { media: { mimeType: 'image/webp', glyph: '🎉', animated: true } },
    });

    expect(host.querySelector('.bubble--bare')).toBeTruthy();
    expect(host.querySelector('.bubble__sticker-glyph--animated')).toBeTruthy();
    expect(host.textContent).toContain('ANIMATED');
  });

  it('renders a location with a maps link', () => {
    const host = render({
      type: 'location',
      payload: { location: { latitude: 8.7139, longitude: 77.7567, name: 'Town branch' } },
    });

    const link = host.querySelector('.bubble__location') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('8.7139,77.7567');
    expect(host.textContent).toContain('Town branch');
  });

  it('renders contact cards', () => {
    const host = render({
      type: 'contacts',
      payload: { contacts: [{ name: 'Bala', phone: '+91 98765 43210' }] },
    });

    expect(host.querySelector('.bubble__contact-copy')?.textContent).toContain('Bala');
  });

  it('resolves template variables in the body and renders its buttons', () => {
    const host = render({
      type: 'template',
      payload: {
        template: {
          name: 'order_confirmation',
          language: 'en',
          category: 'UTILITY',
          body: 'Hi {{1}}, order {{2}} is confirmed.',
          variables: ['Anitha', 'ORD-4821'],
          buttons: [{ type: 'QUICK_REPLY', text: 'Track order' }],
        },
      },
    });

    expect(host.querySelector('.bubble__template')?.textContent).toContain(
      'Hi Anitha, order ORD-4821 is confirmed.',
    );
    expect(host.querySelector('.bubble__button')?.textContent).toContain('Track order');
  });

  it('renders interactive buttons and list rows', () => {
    const buttons = render({
      type: 'interactive',
      payload: {
        interactive: {
          subtype: 'button',
          body: 'How do you want to continue?',
          buttons: [{ id: 'a', title: 'Confirm order' }],
        },
      },
    });
    expect(buttons.querySelector('.bubble__button')?.textContent).toContain('Confirm order');

    const list = render({
      type: 'interactive',
      payload: {
        interactive: {
          subtype: 'list',
          body: 'Pick a slot',
          actionLabel: 'View slots',
          buttons: [],
          sections: [{ title: 'Today', rows: [{ id: 'r1', title: '11:00 AM' }] }],
        },
      },
    });
    expect(list.querySelector('.bubble__list-row')?.textContent).toContain('11:00 AM');
  });

  it('renders a flow response as key/value rows', () => {
    const host = render({
      type: 'flow',
      payload: {
        flow: { name: 'Appointment booking', screen: 'DETAILS', response: { Slot: 'Morning' } },
      },
    });

    expect(host.querySelector('.bubble__flow-rows')?.textContent).toContain('Morning');
  });

  it('shows internal notes with their lock tag', () => {
    const host = render({ isInternalWhisper: true, payload: { text: 'Offer 5%' } });

    expect(host.querySelector('.bubble--whisper')).toBeTruthy();
    expect(host.textContent).toContain('Internal note');
  });

  it('shows delivery ticks only on outbound messages', () => {
    expect(render({ deliveryStatus: 'read' }).querySelector('.bubble__ticks')?.textContent).toContain(
      '✓✓',
    );
    expect(render({ direction: 'inbound' }).querySelector('.bubble__ticks')).toBeNull();
  });

  it('renders reactions and emits when one is toggled', () => {
    fixture.componentRef.setInput(
      'message',
      message({ reactions: [{ emoji: '❤️', userId: null, displayName: 'Anitha' }] }),
    );
    fixture.detectChanges();

    const emitted: { messageId: string; emoji: string }[] = [];
    fixture.componentInstance.react.subscribe((event) => emitted.push(event));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.msg__reaction',
    )!.click();

    expect(emitted).toEqual([{ messageId: 'msg-1', emoji: '❤️' }]);
  });

  it('renders the quoted message a reply points at', () => {
    fixture.componentRef.setInput('message', message({ replyToMessageId: 'msg-0' }));
    fixture.componentRef.setInput(
      'quoted',
      message({ id: 'msg-0', payload: { text: 'Original question' }, content: 'Original question' }),
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.bubble__quote')?.textContent).toContain(
      'Original question',
    );
  });
});
