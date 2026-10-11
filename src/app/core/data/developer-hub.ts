import type { ApiKeyScope, WebhookEndpoint, WebhookEventName } from './entities';

/**
 * Developer Hub (`/developer`, wave 6).
 *
 * The hub documents this workspace's own integration surface: a scoped API key,
 * one signed webhook endpoint, and a ready-to-import Postman collection. All of
 * it is generated from the workspace's real rows — its subdomain, its approved
 * templates, its endpoint and the scopes on the key it is looking at — so the
 * snippet a developer copies is the one that would work, not a generic sample.
 *
 * Pure functions only: no clock, no service, no DOM.
 */

export interface ScopeOption {
  value: ApiKeyScope;
  label: string;
  hint: string;
}

export const API_KEY_SCOPES: ScopeOption[] = [
  {
    value: 'messages.send',
    label: 'Send messages',
    hint: 'Template and session messages on the connected WhatsApp number',
  },
  {
    value: 'conversations.read',
    label: 'Read conversations',
    hint: 'Threads, their status and the message history in them',
  },
  {
    value: 'contacts.write',
    label: 'Write contacts',
    hint: 'Create and update contacts, including custom attributes',
  },
  {
    value: 'templates.read',
    label: 'Read templates',
    hint: 'List approved templates and their variables',
  },
  {
    value: 'flows.read',
    label: 'Read flows and forms',
    hint: 'Chat flow definitions and published WhatsApp forms',
  },
  {
    value: 'webhooks.manage',
    label: 'Manage webhooks',
    hint: 'Register and update the delivery endpoint',
  },
  {
    value: 'reports.read',
    label: 'Read reports',
    hint: 'Pull the same analytics the console shows',
  },
];

export interface EventOption {
  value: WebhookEventName;
  label: string;
  hint: string;
}

export const WEBHOOK_EVENT_OPTIONS: EventOption[] = [
  { value: 'message.received', label: 'message.received', hint: 'A contact sent a message' },
  { value: 'message.status', label: 'message.status', hint: 'Sent, delivered, read or failed' },
  { value: 'conversation.assigned', label: 'conversation.assigned', hint: 'A thread was routed to an agent' },
  { value: 'flow.completed', label: 'flow.completed', hint: 'A flow or form submission completed' },
  { value: 'contact.opt_out', label: 'contact.opt_out', hint: 'A contact opted out of broadcasts' },
];

/** Documented rate limit per key; the monthly allowance comes from the plan tier. */
export const REQUESTS_PER_MINUTE = 60;

export interface HubContext {
  /** The workspace's own API base, derived from its subdomain. */
  base: string;
  workspace: string;
  subdomain: string;
  /** The public part of the key being documented, e.g. `bc_live_9f3a2c`. */
  keyPrefix: string;
  scopes: ApiKeyScope[];
  /** An approved template to use in the sample payload. */
  templateName: string;
  /** The number a developer would send to, in the workspace's own format. */
  sampleRecipient: string;
  webhook: Pick<WebhookEndpoint, 'url' | 'secret' | 'events'> | null;
}

export function apiBaseFor(tenant: { subdomain: string }): string {
  return `https://${tenant.subdomain}.api.bugconnect.dev/v1`;
}

/** Human-readable scope list for a table row or a snippet header. */
export function describeScopes(scopes: ApiKeyScope[]): string {
  if (!scopes.length) return 'No scopes';

  const labels = API_KEY_SCOPES.filter((option) => scopes.includes(option.value)).map(
    (option) => option.label,
  );

  return labels.length ? labels.join(', ') : scopes.join(', ');
}

/** What the key is allowed to do right now. */
export function keyState(
  key: { expiresAt: string | null; revokedAt: string | null },
  now: number,
): 'live' | 'expiring' | 'expired' | 'revoked' {
  if (key.revokedAt) return 'revoked';

  if (key.expiresAt) {
    const expiry = Date.parse(key.expiresAt);

    if (!Number.isNaN(expiry)) {
      if (expiry <= now) return 'expired';
      if (expiry - now < 14 * 86_400_000) return 'expiring';
    }
  }

  return 'live';
}

interface PostmanRequest {
  name: string;
  method: string;
  path: string[];
  query?: { key: string; value: string }[];
  body?: unknown;
}

function postmanRequest(request: PostmanRequest): unknown {
  const raw = request.path.join('/');
  const query = request.query?.length
    ? `?${request.query.map((entry) => `${entry.key}=${entry.value}`).join('&')}`
    : '';

  return {
    name: request.name,
    request: {
      method: request.method,
      header: [
        { key: 'Authorization', value: 'Bearer {{apiKey}}' },
        { key: 'Content-Type', value: 'application/json' },
      ],
      ...(request.body
        ? { body: { mode: 'raw', raw: JSON.stringify(request.body, null, 2) } }
        : {}),
      url: {
        raw: `{{base}}/${raw}${query}`,
        host: ['{{base}}'],
        path: request.path,
        ...(request.query?.length ? { query: request.query } : {}),
      },
    },
  };
}

/**
 * A Postman v2.1 collection for this workspace. Requests follow the scopes on
 * the key: a read-only key does not get a send request it could not run.
 */
export function buildPostmanCollection(context: HubContext): string {
  const can = (scope: ApiKeyScope): boolean => context.scopes.includes(scope);
  const items: unknown[] = [];

  if (can('messages.send')) {
    items.push(
      postmanRequest({
        name: 'Send a template message',
        method: 'POST',
        path: ['messages'],
        body: {
          to: context.sampleRecipient,
          type: 'template',
          template: {
            name: context.templateName,
            language: 'en',
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: 'Aarav' }],
              },
            ],
          },
        },
      }),
      postmanRequest({
        name: 'Send a session message',
        method: 'POST',
        path: ['messages'],
        body: { to: context.sampleRecipient, type: 'text', text: 'How can we help?' },
      }),
    );
  }

  if (can('conversations.read')) {
    items.push(
      postmanRequest({
        name: 'List open conversations',
        method: 'GET',
        path: ['conversations'],
        query: [
          { key: 'status', value: 'open' },
          { key: 'limit', value: '25' },
        ],
      }),
    );
  }

  if (can('contacts.write')) {
    items.push(
      postmanRequest({
        name: 'Create or update a contact',
        method: 'POST',
        path: ['contacts'],
        body: {
          phone: context.sampleRecipient,
          fullName: 'Aarav Sharma',
          attributes: { city: 'Chennai', source: 'api' },
        },
      }),
    );
  }

  if (can('templates.read')) {
    items.push(
      postmanRequest({
        name: 'List approved templates',
        method: 'GET',
        path: ['templates'],
        query: [{ key: 'status', value: 'approved' }],
      }),
    );
  }

  if (can('flows.read')) {
    items.push(
      postmanRequest({ name: 'List chat flows', method: 'GET', path: ['flows'] }),
      postmanRequest({
        name: 'List published WhatsApp forms',
        method: 'GET',
        path: ['whatsapp-flows'],
        query: [{ key: 'status', value: 'published' }],
      }),
    );
  }

  if (can('webhooks.manage')) {
    items.push(
      postmanRequest({
        name: context.webhook ? 'Update the webhook endpoint' : 'Register a webhook endpoint',
        method: context.webhook ? 'PATCH' : 'POST',
        path: ['webhooks'],
        body: {
          url: context.webhook?.url ?? 'https://example.com/bugconnect',
          events: context.webhook?.events ?? ['message.received', 'message.status'],
        },
      }),
    );
  }

  if (can('reports.read')) {
    items.push(
      postmanRequest({
        name: 'Pull the analytics snapshot',
        method: 'GET',
        path: ['reports', 'summary'],
        query: [{ key: 'range', value: '30' }],
      }),
    );
  }

  const collection = {
    info: {
      name: `BUGConnect — ${context.workspace}`,
      description: [
        `Requests for the ${context.workspace} workspace (${context.subdomain}.api.bugconnect.dev).`,
        `Scopes on this key: ${describeScopes(context.scopes)}.`,
        `Rate limit: ${REQUESTS_PER_MINUTE} requests per minute per key.`,
      ].join('\n'),
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'base', value: context.base },
      { key: 'apiKey', value: context.keyPrefix },
    ],
    item: items,
  };

  return JSON.stringify(collection, null, 2);
}

/** The one request most integrators start with, as a copy-pasteable curl. */
export function buildCurlExample(context: HubContext): string {
  return [
    `curl -X POST '${context.base}/messages' \\`,
    `  -H 'Authorization: Bearer ${context.keyPrefix}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{`,
    `    "to": "${context.sampleRecipient}",`,
    `    "type": "template",`,
    `    "template": { "name": "${context.templateName}", "language": "en" }`,
    `  }'`,
  ].join('\n');
}

/**
 * How a receiver checks a delivery. The hub shows this next to the signing
 * secret, because an unsigned webhook endpoint is the usual first incident.
 */
export function buildSignatureExample(secret: string): string {
  return [
    "import { createHmac, timingSafeEqual } from 'node:crypto';",
    '',
    `const secret = '${secret}';`,
    '',
    'app.post("/bugconnect", (req, res) => {',
    '  const signature = req.header("x-bugconnect-signature") ?? "";',
    '  const expected = createHmac("sha256", secret)',
    '    .update(req.rawBody)',
    '    .digest("hex");',
    '',
    '  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {',
    '    return res.status(401).send("bad signature");',
    '  }',
    '',
    '  // Acknowledge fast; queue anything slow.',
    '  res.status(200).send("ok");',
    '});',
  ].join('\n');
}

/** The delivery a receiver should expect, for the sample payload panel. */
export function buildDeliverySample(context: HubContext): string {
  return JSON.stringify(
    {
      id: 'evt_01J8ZQ4M2T7B',
      type: context.webhook?.events[0] ?? 'message.received',
      workspace: context.subdomain,
      receivedAt: '2026-10-08T09:14:22.000Z',
      data: {
        conversationId: 'tenant-1-conv-1',
        direction: 'inbound',
        type: 'text',
        content: 'Do you have the banarasi in maroon?',
      },
    },
    null,
    2,
  );
}
