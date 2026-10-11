import {
  API_KEY_SCOPES,
  REQUESTS_PER_MINUTE,
  WEBHOOK_EVENT_OPTIONS,
  apiBaseFor,
  buildCurlExample,
  buildDeliverySample,
  buildPostmanCollection,
  buildSignatureExample,
  describeScopes,
  keyState,
  type HubContext,
} from './developer-hub';

/**
 * Developer Hub generators (wave 6).
 *
 * The hub's promise is that the snippet a developer copies would actually work
 * against this workspace, so the tests pin the shape of the collection (Postman
 * v2.1, variables, one request per allowed scope) and the key lifecycle maths.
 */
describe('developer hub generators', () => {
  const now = Date.UTC(2026, 9, 8, 12, 0);
  const context: HubContext = {
    base: apiBaseFor({ subdomain: 'nazeel' }),
    workspace: 'Nazeel Silks & Bridal',
    subdomain: 'nazeel',
    keyPrefix: 'bc_live_9f3a2c1b',
    scopes: ['messages.send', 'templates.read'],
    templateName: 'diwali_offer',
    sampleRecipient: '+919840012345',
    webhook: {
      url: 'https://crm.nazeel.example.com/bugconnect',
      secret: 'whsec_test',
      events: ['message.received', 'message.status'],
    },
  };

  it('derives the base URL from the workspace subdomain', () => {
    expect(apiBaseFor({ subdomain: 'nazeel' })).toBe('https://nazeel.api.bugconnect.dev/v1');
    expect(apiBaseFor({ subdomain: 'acme' })).toBe('https://acme.api.bugconnect.dev/v1');
    expect(REQUESTS_PER_MINUTE).toBeGreaterThan(0);
  });

  it('names the scopes it offers', () => {
    expect(describeScopes(['messages.send', 'templates.read'])).toBe(
      'Send messages, Read templates',
    );
    expect(describeScopes([])).toBe('No scopes');
    // A scope the catalogue does not know still reads out rather than vanishing.
    expect(describeScopes(['some.unknown' as never])).toBe('some.unknown');
    expect(API_KEY_SCOPES.every((option) => option.label && option.hint)).toBe(true);
    expect(WEBHOOK_EVENT_OPTIONS.length).toBe(5);
  });

  it('reads a key’s life from its expiry and revocation', () => {
    expect(keyState({ expiresAt: null, revokedAt: null }, now)).toBe('live');
    expect(
      keyState({ expiresAt: new Date(now + 200 * 86_400_000).toISOString(), revokedAt: null }, now),
    ).toBe('live');
    expect(
      keyState({ expiresAt: new Date(now + 9 * 86_400_000).toISOString(), revokedAt: null }, now),
    ).toBe('expiring');
    expect(
      keyState({ expiresAt: new Date(now - 86_400_000).toISOString(), revokedAt: null }, now),
    ).toBe('expired');
    // Revocation wins over an expiry that has not arrived yet.
    expect(
      keyState(
        {
          expiresAt: new Date(now + 86_400_000).toISOString(),
          revokedAt: new Date(now - 86_400_000).toISOString(),
        },
        now,
      ),
    ).toBe('revoked');
    // A malformed stamp never bricks a live key.
    expect(keyState({ expiresAt: 'not-a-date', revokedAt: null }, now)).toBe('live');
  });

  it('builds an importable Postman collection', () => {
    const parsed = JSON.parse(buildPostmanCollection(context)) as {
      info: { name: string; schema: string; description: string };
      variable: { key: string; value: string }[];
      item: { name: string; request: { method: string; url: { raw: string } } }[];
    };

    expect(parsed.info.name).toBe('BUGConnect — Nazeel Silks & Bridal');
    expect(parsed.info.schema).toBe(
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    );
    expect(parsed.info.description).toContain('Send messages');
    expect(parsed.info.description).toContain(`${REQUESTS_PER_MINUTE} requests per minute`);
    expect(parsed.variable).toEqual([
      { key: 'base', value: 'https://nazeel.api.bugconnect.dev/v1' },
      { key: 'apiKey', value: 'bc_live_9f3a2c1b' },
    ]);

    // Two sends, one template list — and nothing this key cannot do.
    expect(parsed.item.map((item) => item.name)).toEqual([
      'Send a template message',
      'Send a session message',
      'List approved templates',
    ]);
    const send = parsed.item[0]!;

    expect(send.request.method).toBe('POST');
    expect(send.request.url.raw).toBe('{{base}}/messages');
    expect(JSON.parse((send as unknown as { request: { body: { raw: string } } }).request.body.raw))
      .toEqual({
        to: '+919840012345',
        type: 'template',
        template: {
          name: 'diwali_offer',
          language: 'en',
          components: [{ type: 'body', parameters: [{ type: 'text', text: 'Aarav' }] }],
        },
      });
  });

  it('only documents what the key’s scopes allow', () => {
    const readOnly = JSON.parse(
      buildPostmanCollection({ ...context, scopes: ['conversations.read', 'reports.read'] }),
    ) as { item: { name: string }[] };

    expect(readOnly.item.map((item) => item.name)).toEqual([
      'List open conversations',
      'Pull the analytics snapshot',
    ]);

    const everything = JSON.parse(
      buildPostmanCollection({
        ...context,
        scopes: API_KEY_SCOPES.map((option) => option.value),
      }),
    ) as { item: { name: string }[] };

    // 2 sends + conversations + contacts + templates + 2 flow reads + webhook + reports.
    expect(everything.item.length).toBe(9);
    expect(everything.item.map((item) => item.name)).toContain(
      'Update the webhook endpoint',
    );

    // Without an endpoint the same request registers one instead.
    const fresh = JSON.parse(
      buildPostmanCollection({ ...context, scopes: ['webhooks.manage'], webhook: null }),
    ) as { item: { name: string; request: { method: string } }[] };

    expect(fresh.item[0]!.name).toBe('Register a webhook endpoint');
    expect(fresh.item[0]!.request.method).toBe('POST');
  });

  it('writes a curl line and a signature check a receiver can paste', () => {
    const curl = buildCurlExample(context);

    expect(curl).toContain("curl -X POST 'https://nazeel.api.bugconnect.dev/v1/messages'");
    expect(curl).toContain('-H \'Authorization: Bearer bc_live_9f3a2c1b\'');
    expect(curl).toContain('"name": "diwali_offer"');
    expect(curl).toContain('"to": "+919840012345"');

    const verify = buildSignatureExample('whsec_test');

    expect(verify).toContain('createHmac("sha256", secret)');
    expect(verify).toContain('x-bugconnect-signature');
    expect(verify).toContain('timingSafeEqual');
    expect(verify).toContain("const secret = 'whsec_test';");
  });

  it('shows the delivery a receiver should expect', () => {
    const parsed = JSON.parse(buildDeliverySample(context)) as {
      type: string;
      workspace: string;
      data: { conversationId: string };
    };

    expect(parsed.type).toBe('message.received');
    expect(parsed.workspace).toBe('nazeel');
    expect(parsed.data.conversationId).toBe('tenant-1-conv-1');
  });
});
