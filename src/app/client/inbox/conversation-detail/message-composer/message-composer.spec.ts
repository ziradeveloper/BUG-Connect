import { ComponentFixture, TestBed } from '@angular/core/testing';

import { META_LIMITS } from '../../../../core/data/whatsapp';
import { MessageComposer, type ComposerSend } from './message-composer';

describe('MessageComposer', () => {
  let fixture: ComponentFixture<MessageComposer>;
  let component: MessageComposer;
  let sent: ComposerSend[][];

  /** The drafts of the most recent send. */
  const drafted = () => sent.at(-1) ?? [];

  function type(value: string): void {
    const textarea = (fixture.nativeElement as HTMLElement).querySelector<HTMLTextAreaElement>(
      '.composer__textarea',
    )!;
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MessageComposer] }).compileComponents();
    fixture = TestBed.createComponent(MessageComposer);
    component = fixture.componentInstance;
    sent = [];
    component.send.subscribe((drafts) => sent.push(drafts));
    fixture.detectChanges();
  });

  it('starts disabled and enables once there is text', () => {
    expect(component.canSend()).toBe(false);
    type('Hello');
    expect(component.canSend()).toBe(true);
  });

  it('emits a text draft and clears the field', () => {
    type('Hello');
    component.sendText();

    expect(drafted()).toHaveLength(1);
    expect(drafted()[0]?.type).toBe('text');
    expect(drafted()[0]?.payload.text).toBe('Hello');
    expect(component.text()).toBe('');
  });

  it('emits an internal note that is flagged as a whisper', () => {
    component.setWhisper(true);
    type('Offer 5%');
    component.sendText();

    expect(drafted()[0]?.whisper).toBe(true);
    expect(drafted()[0]?.type).toBe('text');
  });

  it('caps internal notes below the customer text limit', () => {
    component.setWhisper(true);
    expect(component.charLimit()).toBe(META_LIMITS.whisperChars);

    component.setWhisper(false);
    expect(component.charLimit()).toBe(META_LIMITS.textChars);
  });

  it('blocks sending once the text passes the limit', () => {
    type('x'.repeat(META_LIMITS.textChars + 1));
    expect(component.overLimit()).toBe(true);
    expect(component.canSend()).toBe(false);
  });

  it('sends a sticker immediately from the picker', () => {
    component.sendSticker({ glyph: '🎉', label: 'Party', animated: true });

    expect(drafted()[0]?.type).toBe('sticker');
    expect(drafted()[0]?.payload.media?.animated).toBe(true);
    expect(drafted()[0]?.payload.media?.glyph).toBe('🎉');
  });

  it('sends location and contact payloads unchanged', () => {
    component.sendLocation({ latitude: 1, longitude: 2, name: 'Store' });
    component.sendContacts([{ name: 'Bala', phone: '+91 98765 43210' }]);

    expect(sent[0]?.[0]?.type).toBe('location');
    expect(sent[0]?.[0]?.payload.location?.name).toBe('Store');
    expect(sent[1]?.[0]?.type).toBe('contacts');
    expect(sent[1]?.[0]?.payload.contacts?.[0]?.name).toBe('Bala');
  });

  it('forwards template and interactive payloads from their builders', () => {
    component.sendTemplate({
      name: 'order_confirmation',
      language: 'en',
      category: 'UTILITY',
      body: 'Hi {{1}}',
      variables: ['Anitha'],
    });

    component.sendInteractive({
      subtype: 'button',
      body: 'Continue?',
      buttons: [{ id: 'a', title: 'Yes' }],
    });

    expect(sent[0]?.[0]?.type).toBe('template');
    expect(sent[1]?.[0]?.type).toBe('interactive');
    expect(sent[1]?.[0]?.payload.interactive?.buttons?.[0]?.title).toBe('Yes');
  });

  it('offers quick replies when the text starts with a slash', () => {
    type('/');
    expect(component.slashMatches().length).toBeGreaterThan(0);

    type('/hours');
    expect(component.slashMatches()[0]?.label).toBe('Store hours');

    component.applyQuickReply(component.slashMatches()[0]!.body);
    expect(component.text()).toContain('10:00 am');
  });

  it('opens and closes one popover at a time', () => {
    component.togglePanel('attach');
    expect(component.panel()).toBe('attach');

    component.togglePanel('emoji');
    expect(component.panel()).toBe('emoji');

    component.togglePanel('emoji');
    expect(component.panel()).toBe('none');
  });

  it('inserts an emoji at the end of the text', () => {
    type('Great ');
    component.insertEmoji('🙏');
    expect(component.text()).toBe('Great 🙏');
  });
});
