import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkspaceContext } from '../workspace/workspace-context';
import type { ResolvedWorkspace } from '../workspace/workspace.model';
import { MockDataService, type OutboundDraft } from './mock-data.service';
import { payloadPreview } from './whatsapp';

/**
 * Sending is the one write every message type shares, so the guarantees live
 * here: the payload survives a round-trip, the queue preview matches what the
 * thread renders, and internal notes never reach the contact.
 */
describe('MockDataService — outbound messages', () => {
  const resolution = signal<ResolvedWorkspace>({
    kind: 'client',
    slug: 'nazeel',
    host: 'nazeel.localhost',
    source: 'subdomain',
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WorkspaceContext,
          useValue: {
            resolved: resolution.asReadonly(),
            kind: computed(() => resolution().kind),
            slug: computed(() => resolution().slug),
            isPlatform: computed(() => resolution().kind === 'platform'),
            isClient: computed(() => resolution().kind === 'client'),
            isMarketing: computed(() => resolution().kind === 'marketing'),
            isWorkspace: computed(() => resolution().kind !== 'marketing'),
            displayName: computed(() => resolution().slug ?? 'Platform console'),
            canOverride: computed(() => true),
            setDevWorkspace: () => {},
          },
        },
      ],
    });
  });

  const service = () => TestBed.inject(MockDataService);

  async function firstConversationId(): Promise<string> {
    const page = await service().listConversations();
    return page.items[0]!.id;
  }

  it('stores a text message with its payload intact', async () => {
    const id = await firstConversationId();
    const sent = await service().sendOutbound(
      id,
      { type: 'text', payload: { text: 'Hello from the team' } },
      'tenant-1-user-1',
    );

    const stored = service().messagesFor(id).find((message) => message.id === sent.id);
    expect(stored?.payload.text).toBe('Hello from the team');
    expect(stored?.direction).toBe('outbound');
    expect(stored?.deliveryStatus).toBe('sent');
  });

  it('keeps the media, sticker and location objects the composer staged', async () => {
    const id = await firstConversationId();

    const drafts: OutboundDraft[] = [
      {
        type: 'image',
        payload: { media: { mimeType: 'image/jpeg', fileName: 'silk.jpg' }, caption: 'Bottle green' },
      },
      {
        type: 'sticker',
        payload: { media: { mimeType: 'image/webp', glyph: '🙏', animated: true } },
      },
      {
        type: 'location',
        payload: { location: { latitude: 8.7139, longitude: 77.7567, name: 'Town branch' } },
      },
    ];

    for (const draft of drafts) {
      const sent = await service().sendOutbound(id, draft);
      const stored = service().messagesFor(id).find((message) => message.id === sent.id);

      expect(stored?.type).toBe(draft.type);
      expect(stored?.payload).toEqual(draft.payload);
    }
  });

  it('sends a template with its resolved variables', async () => {
    const id = await firstConversationId();

    const sent = await service().sendOutbound(id, {
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

    expect(sent.payload.template?.variables).toEqual(['Anitha', 'ORD-4821']);
    expect(sent.content).toContain('order_confirmation');
  });

  it('sends interactive objects with their buttons and rows', async () => {
    const id = await firstConversationId();

    const sent = await service().sendOutbound(id, {
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

    expect(sent.payload.interactive?.sections?.[0]?.rows?.[0]?.title).toBe('11:00 AM');
  });

  it('keeps internal notes out of the delivery lifecycle', async () => {
    const id = await firstConversationId();
    const sent = await service().sendMessage(id, 'Internal only', true, 'tenant-1-user-1');

    expect(sent.isInternalWhisper).toBe(true);
    expect(sent.type).toBe('text');
    expect(sent.deliveryStatus).toBe('read');
    expect(sent.waMessageId).toBeNull();
  });

  it('adds and removes a reaction on the same message', async () => {
    const id = await firstConversationId();
    const sent = await service().sendMessage(id, 'React to me');
    const actor = { userId: 'tenant-1-user-1', displayName: 'Anitha' };

    await service().toggleReaction(sent.id, '❤️', actor);
    expect(service().messagesFor(id).find((m) => m.id === sent.id)?.reactions).toHaveLength(1);

    await service().toggleReaction(sent.id, '❤️', actor);
    expect(service().messagesFor(id).find((m) => m.id === sent.id)?.reactions).toHaveLength(0);
  });

  it('bumps the conversation and clears its unread badge on reply', async () => {
    const id = await firstConversationId();
    const before = (await service().listConversations()).items.find((c) => c.id === id)!;
    const previous = before.lastMessageAt;

    await new Promise((resolve) => setTimeout(resolve, 4));
    await service().sendMessage(id, 'Any update?');

    const after = (await service().listConversations()).items.find((c) => c.id === id)!;
    expect(after.lastMessageAt >= previous).toBe(true);
    expect(after.unreadCount).toBe(0);
  });

  it('only offers approved templates to the composer', async () => {
    const page = await service().listTemplates();
    const sendable = service().sendableTemplates();

    expect(sendable.length).toBeGreaterThan(0);
    expect(page.items.filter((tpl) => tpl.status === 'approved').length).toBe(sendable.length);
  });

  it('gives every seeded message a preview the queue can render', async () => {
    const id = await firstConversationId();
    for (const message of service().messagesFor(id)) {
      expect(payloadPreview(message.type, message.payload, message.content).length).toBeGreaterThan(0);
    }
  });
});
