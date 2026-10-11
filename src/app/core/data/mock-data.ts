import type {
  AuditArea,
  AuditEvent,
  AuditLevel,
  TenantStatus,
  BusinessProfile,
  Campaign,
  CampaignSample,
  ChatFlow,
  Contact,
  ContactSegment,
  Conversation,
  FlowGraph,
  FlowNode,
  FlowNodeKind,
  FlowVersion,
  Invoice,
  Message,
  MessageTemplate,
  PlatformStaffUser,
  QuickReply,
  SubscriptionEvent,
  Team,
  Tenant,
  WaFormCategory,
  WaFormComponentType,
  WaFormInputType,
  WaFormScreen,
  WaFormStatus,
  WhatsAppFlowForm,
  WebhookEvent,
  WorkspaceUser,
} from './entities';
import {
  payloadPreview,
  type MessagePayload,
  type TemplateButtonPayload,
  type WhatsAppMessageType,
} from './whatsapp';
import { QUICK_REPLIES } from './composer-catalog';

/**
 * Deterministic seeded generator (mulberry32) — never Math.random, so tests can
 * assert exact counts and the demo tells the same story on every reload.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  some<T>(items: readonly T[], min: number, max: number): T[] {
    const count = this.int(min, max);
    const pool = [...items];
    const chosen: T[] = [];

    for (let i = 0; i < count && pool.length > 0; i += 1) {
      chosen.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0] as T);
    }

    return chosen;
  }
}

export const SEED = 20261008;

const EPOCH = Date.UTC(2026, 9, 8, 6, 30);
const HOUR = 3_600_000;

export function isoAt(offsetMs: number): string {
  return new Date(EPOCH + offsetMs).toISOString();
}

/** Tenant rows carry the subdomains used by the dev URLs. */
export const TENANT_SEEDS: {
  subdomain: string;
  businessName: string;
  industry: string;
  tier: string;
  status: TenantStatus;
}[] = [
  {
    subdomain: 'nazeel',
    businessName: 'Nazeel Silks & Bridal',
    industry: 'Textile, silk and bridal retail',
    tier: 'Growth',
    status: 'active',
  },
  {
    subdomain: 'nellai-sweets',
    businessName: 'Nellai Sweets & Halwa',
    industry: 'Sweets, bakeries and packaged foods',
    tier: 'Growth',
    status: 'active',
  },
  {
    subdomain: 'scanwell',
    businessName: 'Scanwell Diagnostics',
    industry: 'Diagnostic centres and clinics',
    tier: 'Pilot',
    status: 'whatsapp_pending',
  },
  {
    subdomain: 'venkateswara',
    businessName: 'Venkateswara Coaching Labs',
    industry: 'Coaching and educational institutes',
    tier: 'Pilot',
    status: 'onboarding',
  },
];

const FIRST_NAMES = [
  'Anitha',
  'Bala',
  'Chandran',
  'Deepa',
  'Esakki',
  'Fathima',
  'Gopinath',
  'Hema',
  'Immanuel',
  'Jansi',
  'Karthik',
  'Lakshmi',
  'Manoj',
  'Nirmala',
  'Oviya',
  'Pandi',
  'Ravi',
  'Sangeetha',
  'Thamizh',
  'Usha',
  'Vijay',
  'Yazhini',
  'Meena',
  'Suresh',
];
const LAST_NAMES = ['Murugan', 'Raja', 'Selvam', 'Kannan', 'Pillai', 'Nadar', 'Iyer', 'Das'];
const TAGS = [
  'VIP-Retail',
  'Diwali-Shopper',
  'Location-Tirunelveli',
  'Wholesale',
  'Repeat-Customer',
];
const DEPARTMENTS = ['Sales counter', 'Support desk', 'Billing desk'];
const SUBJECTS = [
  'Order status for Saturday function',
  'Need price list for 300 g bridal set',
  'Appointment for measurement fitting',
  'Report not received on WhatsApp',
  'Bulk order enquiry for 2 kg halwa',
  'Invoice copy required',
  'Delivery address change request',
  'Course fee and batch timings',
  'Return exchange for stitched blouse',
  'Balance payment reminder query',
];
const MESSAGE_LINES_IN = [
  'Sir, is the order ready?',
  'Can you send the catalogue pictures?',
  'What is the total for 5 kg?',
  'We need it before 6 pm today.',
  'Please share the invoice PDF.',
  'Is home delivery available to Palayamkottai?',
  'Can I change the appointment to Friday?',
];
const MESSAGE_LINES_OUT = [
  'Good news — your order is confirmed for 5:30 pm.',
  'Sharing the latest bridal catalogue now.',
  'Total for 5 kg is ₹4,250 including GST.',
  'Invoice attached. Please confirm the GST number.',
  'Yes, delivery to Palayamkottai is available tomorrow morning.',
  'Appointment moved to Friday 4:00 pm.',
];

const MEDIA_CAPTIONS = [
  'Bridal silk — bottle green with gold zari',
  'This is the shade we discussed.',
  'Please confirm the border width.',
  'Sample stitching reference.',
];

const DOCUMENT_NAMES = [
  { fileName: 'Invoice-INV-2481.pdf', mimeType: 'application/pdf', fileSize: 184_320 },
  { fileName: 'Price-list-2026.xlsx', mimeType: 'application/vnd.ms-excel', fileSize: 46_080 },
  { fileName: 'Measurement-form.pdf', mimeType: 'application/pdf', fileSize: 92_160 },
  { fileName: 'Halwa-bulk-order.docx', mimeType: 'application/msword', fileSize: 28_672 },
];

const STICKERS = ['🙏', '❤️', '🎉', '👍', '😍', '🥳', '🙌', '😊'];
const STICKER_ANIMATIONS = ['pulse', 'bounce', 'wiggle', 'spin', 'heartbeat', 'shake'];

const LOCATION_SEEDS = [
  {
    name: 'Nazeel Silks & Bridal',
    address: '12 West Car Street, Tirunelveli 627001',
    latitude: 8.7139,
    longitude: 77.7567,
  },
  {
    name: 'Nellai Sweets — Junction',
    address: '84 Trivandrum Road, Palayamkottai',
    latitude: 8.7294,
    longitude: 77.7412,
  },
  {
    name: 'Scanwell Diagnostics',
    address: '3 High Ground, Tirunelveli 627002',
    latitude: 8.7265,
    longitude: 77.7512,
  },
];

/**
 * Meta message templates a tenant has submitted. Approval state is randomised
 * per tenant so the composer's "approved only" gate is exercised.
 */
const TEMPLATE_SEEDS: {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  body: string;
  header?: { type: 'text' | 'image'; text?: string } | null;
  footer?: string | null;
  buttons?: TemplateButtonPayload[];
  variables: string[];
}[] = [
  {
    name: 'order_confirmation',
    category: 'UTILITY',
    language: 'en',
    header: { type: 'text', text: 'Order confirmed' },
    body: 'Hi {{1}}, your order {{2}} is confirmed and will reach {{3}} by 6 pm. Reply here if you need to change anything.',
    footer: 'Reply STOP to opt out',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Track order' },
      { type: 'QUICK_REPLY', text: 'Talk to agent' },
    ],
    variables: ['Customer name', 'Order number', 'Delivery area'],
  },
  {
    name: 'invoice_ready',
    category: 'UTILITY',
    language: 'en',
    header: { type: 'image' },
    body: 'Hi {{1}}, invoice {{2}} for ₹{{3}} is ready. Tap the button to download the PDF.',
    footer: 'Include GST number for business orders',
    buttons: [{ type: 'URL', text: 'Download invoice', url: 'https://example.com/invoice' }],
    variables: ['Customer name', 'Invoice number', 'Amount'],
  },
  {
    name: 'appointment_reminder',
    category: 'UTILITY',
    language: 'en',
    body: 'Hello {{1}}, this is a reminder for your {{2}} appointment on {{3}}. Reply YES to confirm.',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirm' },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
    ],
    variables: ['Customer name', 'Service', 'Date & time'],
  },
  {
    name: 'catalogue_weekly',
    category: 'MARKETING',
    language: 'en',
    header: { type: 'image' },
    body: 'Fresh arrivals this week, {{1}}! Explore the {{2}} collection — prices start at ₹{{3}}.',
    footer: 'Valid until stocks last',
    buttons: [{ type: 'URL', text: 'View catalogue', url: 'https://example.com/catalogue' }],
    variables: ['First name', 'Collection', 'Starting price'],
  },
  {
    name: 'delivery_update',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{1}}, your parcel {{2}} is out for delivery and will arrive by {{3}} today.',
    buttons: [{ type: 'QUICK_REPLY', text: 'Share live location' }],
    variables: ['Customer name', 'Tracking id', 'Time'],
  },
  {
    name: 'payment_followup',
    category: 'MARKETING',
    language: 'en',
    body: '{{1}}, balance of ₹{{2}} is pending against order {{3}}. Pay before the 5th to keep your credit terms.',
    footer: 'Ignore if already paid',
    variables: ['Customer name', 'Amount', 'Order number'],
  },
  {
    name: 'login_verification',
    category: 'AUTHENTICATION',
    language: 'en',
    body: '{{1}} is your BUGConnect verification code. It expires in 10 minutes.',
    buttons: [{ type: 'URL', text: 'Copy code', url: 'https://example.com/otp' }],
    variables: ['Code'],
  },
];

/** Message objects the contact can originate, with relative frequency. */
const INBOUND_TYPE_WEIGHTS: [WhatsAppMessageType, number][] = [
  ['text', 58],
  ['image', 14],
  ['voice', 8],
  ['document', 6],
  ['sticker', 5],
  ['location', 4],
  ['video', 3],
  ['contacts', 1],
  ['audio', 1],
];

/** Message objects the business can originate. */
const OUTBOUND_TYPE_WEIGHTS: [WhatsAppMessageType, number][] = [
  ['text', 52],
  ['template', 12],
  ['interactive', 12],
  ['image', 10],
  ['document', 6],
  ['video', 3],
  ['sticker', 2],
  ['audio', 2],
  ['flow', 1],
];

/**
 * A deterministic placeholder photo. The demo has no CDN, so seeded media
 * renders as a generated gradient JPEG-ish SVG instead of a broken <img>.
 */
function sampleImage(rng: Rng, label: string): string {
  const hueA = rng.int(140, 200);
  const hueB = (hueA + rng.int(30, 90)) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hueA} 42% 72%)"/>` +
    `<stop offset="1" stop-color="hsl(${hueB} 48% 44%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="480" height="360" fill="url(#g)"/>` +
    `<circle cx="${rng.int(120, 360)}" cy="${rng.int(90, 240)}" r="${rng.int(50, 120)}" fill="hsl(${hueB} 60% 92%)" opacity="0.28"/>` +
    `<text x="24" y="332" font-family="sans-serif" font-size="22" fill="rgba(255,255,255,.92)">${label}</text>` +
    `</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function nameFor(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

function emailFor(name: string, tenant: { subdomain: string }): string {
  // Digits and spaces collapse into dots; the trim keeps the address valid when
  // the name ends in a number (`…pillai4` used to seed `…pillai.@…`).
  const local = name
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${local}@${tenant.subdomain.replace(/[^a-z0-9]/g, '')}.example`;
}

function weightedPick<T>(rng: Rng, entries: [T, number][]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;

  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      return value;
    }
  }

  return entries[entries.length - 1]![0];
}

type MessageSeed = {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  deliveryStatus: Message['deliveryStatus'];
  createdByUserId: string | null;
  sentAt: string;
  whisper: boolean;
  contactName: string;
  template: MessageTemplate | null;
};

/**
 * Builds one Cloud API-shaped message. Whispers (internal notes) are always
 * plain text — they are ours, not Meta's.
 */
function buildMessage(rng: Rng, seed: MessageSeed): Message {
  const inbound = seed.direction === 'inbound';
  const firstName = seed.contactName.split(' ')[0] ?? 'there';
  const type = seed.whisper
    ? 'text'
    : weightedPick(rng, inbound ? INBOUND_TYPE_WEIGHTS : OUTBOUND_TYPE_WEIGHTS);

  const payload: MessagePayload = {};
  let mediaUrl: string | null = null;

  switch (type) {
    case 'image': {
      const url = sampleImage(rng, inbound ? 'Customer photo' : 'Catalogue');
      payload.media = {
        mimeType: 'image/jpeg',
        fileName: `photo-${rng.int(1000, 9999)}.jpg`,
        fileSize: rng.int(180, 2200) * 1024,
        width: 1280,
        height: 960,
        url,
      };
      payload.caption = rng.chance(0.55) ? rng.pick(MEDIA_CAPTIONS) : null;
      mediaUrl = url;
      break;
    }

    case 'video': {
      payload.media = {
        mimeType: 'video/mp4',
        fileName: `clip-${rng.int(1000, 9999)}.mp4`,
        fileSize: rng.int(1, 12) * 1024 * 1024,
        durationSeconds: rng.int(6, 78),
        thumbnailUrl: sampleImage(rng, 'Video'),
      };
      payload.caption = rng.chance(0.4) ? rng.pick(MEDIA_CAPTIONS) : null;
      mediaUrl = payload.media.thumbnailUrl ?? null;
      break;
    }

    case 'audio': {
      payload.media = {
        mimeType: 'audio/mpeg',
        fileName: `audio-${rng.int(1000, 9999)}.mp3`,
        fileSize: rng.int(120, 4800) * 1024,
        durationSeconds: rng.int(12, 240),
      };
      break;
    }

    case 'voice': {
      payload.media = {
        mimeType: 'audio/ogg; codecs=opus',
        fileSize: rng.int(18, 220) * 1024,
        durationSeconds: rng.int(3, 42),
      };
      break;
    }

    case 'document': {
      const doc = rng.pick(DOCUMENT_NAMES);
      payload.media = { ...doc };
      payload.caption = rng.chance(0.5) ? 'Please check and confirm.' : null;
      break;
    }

    case 'sticker': {
      const animated = rng.chance(0.35);
      payload.media = {
        mimeType: 'image/webp',
        fileSize: rng.int(12, animated ? 180 : 96) * 1024,
        animated,
        glyph: rng.pick(animated ? STICKERS.slice(4) : STICKERS.slice(0, 4)),
        animation: animated ? rng.pick(STICKER_ANIMATIONS) : undefined,
      };
      break;
    }

    case 'location': {
      const place = rng.pick(LOCATION_SEEDS);
      payload.location = place;
      break;
    }

    case 'contacts': {
      payload.contacts = [
        {
          name: seed.contactName,
          phone: `+91 9${rng.int(100000000, 999999999)}`.slice(0, 14),
          email: `${firstName.toLowerCase()}@example.com`,
        },
      ];
      break;
    }

    case 'template': {
      const template = seed.template;
      if (template) {
        payload.template = {
          name: template.name,
          language: template.language,
          category: template.category,
          header: template.header
            ? {
                type: 'image',
                mediaUrl: sampleImage(rng, template.name.replace(/_/g, ' ')),
              }
            : null,
          body: template.body,
          footer: template.footer ?? null,
          buttons: template.buttons ?? [],
          variables: template.variableLabels?.map((label, index) =>
            templateVariableValue(label, index, firstName, rng),
          ) ?? [],
        };
      } else {
        payload.text = rng.pick(MESSAGE_LINES_OUT);
      }
      break;
    }

    case 'interactive': {
      payload.interactive = rng.chance(0.5)
        ? {
            subtype: 'button',
            body: `Hi ${firstName}, how would you like to continue?`,
            footer: 'Powered by BUGConnect',
            buttons: [
              { id: 'opt-1', title: 'Confirm order' },
              { id: 'opt-2', title: 'Change size' },
              { id: 'opt-3', title: 'Call me back' },
            ],
          }
        : {
            subtype: 'list',
            body: `Choose a slot for your ${rng.pick(['fitting', 'delivery', 'callback'])}.`,
            footer: 'Tap to open the list',
            actionLabel: 'View slots',
            buttons: [],
            sections: [
              {
                title: 'Today',
                rows: [
                  { id: 'slot-1', title: '11:00 AM', description: 'Counter 2' },
                  { id: 'slot-2', title: '4:30 PM', description: 'Counter 1' },
                ],
              },
              {
                title: 'Tomorrow',
                rows: [{ id: 'slot-3', title: '10:00 AM', description: 'Counter 3' }],
              },
            ],
          };
      break;
    }

    case 'flow': {
      payload.flow = {
        name: 'Appointment booking',
        screen: 'DETAILS',
        response: {
          'Preferred date': isoAt(rng.int(1, 6) * 24 * 60 * 60_000).slice(0, 10),
          'Time slot': rng.pick(['Morning', 'Afternoon', 'Evening']),
          Notes: 'First-time customer',
        },
      };
      break;
    }

    default: {
      payload.text = seed.whisper
        ? `@supervisor Can we offer 5% on this order? (internal note)`
        : inbound
          ? rng.pick(MESSAGE_LINES_IN)
          : rng.pick(MESSAGE_LINES_OUT);
      break;
    }
  }

  return {
    id: seed.id,
    conversationId: seed.conversationId,
    direction: seed.direction,
    type,
    payload,
    content: payloadPreview(type, payload),
    mediaUrl,
    deliveryStatus: seed.deliveryStatus,
    isInternalWhisper: seed.whisper,
    createdByUserId: seed.createdByUserId,
    sentAt: seed.sentAt,
    replyToMessageId: null,
    reactions: [],
    waMessageId: inbound ? `wamid.inbound-${seed.id}` : null,
  };
}

/** Plausible filler for a template variable, so rendered bodies read naturally. */
function templateVariableValue(
  label: string,
  index: number,
  firstName: string,
  rng: Rng,
): string {
  if (index === 0) {
    return firstName;
  }

  const pool: Record<string, string[]> = {
    'Order number': ['ORD-4821', 'ORD-5177', 'ORD-6304'],
    'Invoice number': ['INV-2481', 'INV-3012'],
    'Delivery area': ['Palayamkottai', 'Tirunelveli Town', 'Vannarpettai'],
    Amount: ['4,250', '12,800', '1,150'],
    'Starting price': ['1,499', '2,999', '899'],
    Service: ['measurement fitting', 'trial session', 'report collection'],
    'Date & time': ['Sat 4:00 pm', 'Mon 11:00 am', 'Wed 6:30 pm'],
    'Tracking id': ['AWB-77213', 'AWB-44890'],
    Code: [`${rng.int(100000, 999999)}`],
    Time: ['4:00 pm', '11:30 am'],
    Collection: ['bridal silk', 'festive halwa', 'coaching batch'],
  };

  const options = pool[label];
  return options ? rng.pick(options) : label;
}

export type Dataset = {
  tenants: Tenant[];
  workspaceUsers: WorkspaceUser[];
  platformStaff: PlatformStaffUser[];
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  flows: ChatFlow[];
  templates: MessageTemplate[];
  campaigns: Campaign[];
  webhookEvents: WebhookEvent[];
  subscriptionEvents: SubscriptionEvent[];
  invoices: Invoice[];
  teams: Team[];
  quickReplies: QuickReply[];
  segments: ContactSegment[];
  businessProfiles: BusinessProfile[];
  /** Wave 5 audit trail: per-tenant and platform-wide, oldest first. */
  auditEvents: AuditEvent[];
  /** Wave 6: the editable graph behind each flow, plus its published snapshots. */
  flowGraphs: FlowGraph[];
  flowVersions: FlowVersion[];
  /** Wave 6: native WhatsApp forms and the delivery series of each broadcast. */
  whatsappFlows: WhatsAppFlowForm[];
  campaignSamples: CampaignSample[];
};

/** The node set a freshly seeded flow starts from, keyed to its position. */
const FLOW_VERSION_NOTES = [
  'Published from the canvas',
  'Menu copy reworked after the beta review',
  'Added the after-hours branch',
  'Split the topic menu into two steps',
  'Router weights tuned to the team rota',
  'Trimmed the greeting to one line',
  'Second option added to the first menu',
];

/**
 * One flow's starter graph: the five engine nodes wired left to right, with the
 * menu handing off to the router and the close node ending the trip.
 *
 * Positions are canvas pixels — the visualiser renders them absolutely rather
 * than laying the graph out, so a saved node keeps the spot the author put it.
 */
function buildFlowNodes(flow: ChatFlow, flowIndex: number): FlowNode[] {
  const prefix = `${flow.id}-node`;
  const selection: FlowNode = {
    id: `${prefix}-selection`,
    kind: 'selection',
    title: 'Selection · topic',
    message: 'Open the topic you need and I will pull up the details.',
    options: [
      { id: `${prefix}-selection-a`, label: 'Show me the details', nextNodeId: `${prefix}-close` },
      { id: `${prefix}-selection-b`, label: 'Something else', nextNodeId: `${prefix}-router` },
    ],
    nextNodeId: `${prefix}-close`,
    condition: null,
    x: 720,
    y: 70,
  };
  const router: FlowNode = {
    id: `${prefix}-router`,
    kind: 'router',
    title: 'Weighted router',
    message: 'Finding the right team member for you…',
    options: [],
    nextNodeId: `${prefix}-close`,
    condition: flowIndex % 2 === 0 ? 'Outside 09:00–21:00 or no agent online' : 'No agent free within 3 minutes',
    x: 720,
    y: 310,
  };
  const close: FlowNode = {
    id: `${prefix}-close`,
    kind: 'close',
    title: 'Close · handoff',
    message: 'Thanks! A team member has the context and will continue here.',
    options: [],
    nextNodeId: null,
    condition: null,
    x: 1060,
    y: 190,
  };

  return [
    {
      id: `${prefix}-inbound`,
      kind: 'inbound',
      title: 'Inbound trigger',
      message: 'Hi! Welcome — I can help with orders, appointments and delivery updates.',
      options: [],
      nextNodeId: `${prefix}-menu`,
      condition: null,
      x: 40,
      y: 190,
    },
    {
      id: `${prefix}-menu`,
      kind: 'menu',
      title: 'Interactive menu',
      message: 'What would you like to do?',
      options: [
        { id: `${prefix}-menu-a`, label: 'Track my order', nextNodeId: `${prefix}-selection` },
        { id: `${prefix}-menu-b`, label: 'Talk to a human', nextNodeId: `${prefix}-router` },
        { id: `${prefix}-menu-c`, label: 'See our hours', nextNodeId: `${prefix}-close` },
      ],
      nextNodeId: `${prefix}-close`,
      condition: null,
      x: 380,
      y: 190,
    },
    selection,
    router,
    close,
  ];
}

/**
 * An older snapshot of the same graph. Dropping the newest branch first keeps the
 * history legible in the versions table: fewer nodes, and the menu rewired to
 * the node that still exists.
 */
function snapshotNodes(nodes: FlowNode[], ageInVersions: number): FlowNode[] {
  let copy = nodes.map((node) => ({
    ...node,
    options: node.options.map((option) => ({ ...option })),
  }));

  const dropOrder: FlowNodeKind[] = ['router', 'selection'];
  for (let step = 0; step < ageInVersions && step < dropOrder.length; step += 1) {
    const kind = dropOrder[step] as FlowNodeKind;
    copy = copy.filter((node) => node.kind !== kind);
  }

  const close = copy.find((node) => node.kind === 'close');
  if (close) {
    copy = copy.map((node) => ({
      ...node,
      options: node.options.map((option) =>
        copy.some((candidate) => candidate.id === option.nextNodeId)
          ? option
          : { ...option, nextNodeId: close.id },
      ),
      nextNodeId: copy.some((candidate) => candidate.id === node.nextNodeId)
        ? node.nextNodeId
        : close.id,
    }));
  }

  return copy;
}

/* ── Wave 6: WhatsApp Flows (native in-chat forms) ─────────────── */

/**
 * A form as a blueprint: plain data, hydrated per tenant below so every screen
 * and field gets a stable id inside its workspace. The studio edits the
 * hydrated record; the generator in `whatsapp-flows.ts` turns it back into
 * Meta's flow JSON.
 */
type WaFormBlueprintField = {
  type: WaFormComponentType;
  label: string;
  /** Data key the response posts under; empty for text-only components. */
  name: string;
  required?: boolean;
  inputType?: WaFormInputType;
  options?: [string, string][];
  placeholder?: string;
};

type WaFormBlueprintScreen = {
  id: string;
  title: string;
  subtitle: string | null;
  terminal: boolean;
  footerLabel: string;
  nextScreenId: string | null;
  fields: WaFormBlueprintField[];
};

interface WaFormBlueprint {
  name: string;
  category: WaFormCategory;
  screens: WaFormBlueprintScreen[];
}

/** Two screens: details, then a confirmation that carries the consent checkbox. */
function appointmentForm(
  name: string,
  slots: [string, string][],
  serviceLabel: string,
  services: [string, string][],
): WaFormBlueprint {
  return {
    name,
    category: 'APPOINTMENT_BOOKING',
    screens: [
      {
        id: 'BOOKING',
        title: name,
        subtitle: 'Takes under a minute. We confirm on WhatsApp.',
        terminal: false,
        footerLabel: 'Continue',
        nextScreenId: 'CONFIRM',
        fields: [
          { type: 'TextInput', label: 'Full name', name: 'full_name', inputType: 'text' },
          {
            type: 'TextInput',
            label: 'WhatsApp number',
            name: 'phone',
            inputType: 'phone',
            placeholder: '+91',
          },
          { type: 'Dropdown', label: serviceLabel, name: 'service', options: services },
          { type: 'DatePicker', label: 'Preferred date', name: 'preferred_date' },
          { type: 'RadioButtonsGroup', label: 'Preferred time', name: 'slot', options: slots },
        ],
      },
      {
        id: 'CONFIRM',
        title: 'Confirm your visit',
        subtitle: 'Check the details and send them to the store team.',
        terminal: true,
        footerLabel: 'Confirm booking',
        nextScreenId: null,
        fields: [
          { type: 'OptIn', label: 'Send me reminders and new arrivals on WhatsApp', name: 'consent' },
        ],
      },
    ],
  };
}

/** One terminal screen: the classic advert-reply lead capture. */
function leadForm(
  name: string,
  interestLabel: string,
  interests: [string, string][],
  budgetLabel: string,
  budgets: [string, string][],
): WaFormBlueprint {
  return {
    name,
    category: 'LEAD_GENERATION',
    screens: [
      {
        id: 'LEAD_CAPTURE',
        title: name,
        subtitle: 'Share a few details and our team calls you back the same day.',
        terminal: true,
        footerLabel: 'Send',
        nextScreenId: null,
        fields: [
          { type: 'TextInput', label: 'Your name', name: 'full_name', inputType: 'text' },
          { type: 'TextInput', label: 'Phone number', name: 'phone', inputType: 'phone' },
          {
            type: 'CheckboxGroup',
            label: interestLabel,
            name: 'interests',
            required: false,
            options: interests,
          },
          { type: 'Dropdown', label: budgetLabel, name: 'budget', required: false, options: budgets },
          {
            type: 'TextArea',
            label: 'Anything we should know?',
            name: 'notes',
            required: false,
            placeholder: 'Occasion, sizes, delivery city…',
          },
          { type: 'OptIn', label: 'I agree to be contacted about this enquiry', name: 'consent' },
        ],
      },
    ],
  };
}

/** Two screens: what went wrong, then how to reach the customer. */
function supportForm(
  name: string,
  issueLabel: string,
  issues: [string, string][],
  referenceLabel: string,
): WaFormBlueprint {
  return {
    name,
    category: 'CUSTOMER_SUPPORT',
    screens: [
      {
        id: 'ISSUE',
        title: name,
        subtitle: 'Tell us what happened and we will pick it up from here.',
        terminal: false,
        footerLabel: 'Next',
        nextScreenId: 'CONTACT',
        fields: [
          {
            type: 'TextInput',
            label: referenceLabel,
            name: 'reference',
            required: false,
            inputType: 'text',
          },
          { type: 'RadioButtonsGroup', label: issueLabel, name: 'issue', options: issues },
          {
            type: 'TextArea',
            label: 'What happened?',
            name: 'details',
            placeholder: 'Dates, sizes, what you were promised…',
          },
        ],
      },
      {
        id: 'CONTACT',
        title: 'How should we reach you?',
        subtitle: null,
        terminal: true,
        footerLabel: 'Send to support',
        nextScreenId: null,
        fields: [
          { type: 'TextInput', label: 'Best number to call', name: 'callback_number', inputType: 'phone' },
          {
            type: 'Dropdown',
            label: 'Best time to call',
            name: 'callback_window',
            required: false,
            options: [
              ['morning', 'Morning (10–1)'],
              ['afternoon', 'Afternoon (1–5)'],
              ['evening', 'Evening (5–8)'],
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Forms per workspace, keyed by subdomain so each tenant's forms read like its
 * own business. Tenants added later fall back to the generic set.
 */
const WA_FORM_SETS: Record<string, WaFormBlueprint[]> = {
  nazeel: [
    appointmentForm(
      'Bridal trial booking',
      [
        ['morning', 'Morning (10–1)'],
        ['afternoon', 'Afternoon (1–5)'],
        ['evening', 'Evening (5–8)'],
      ],
      'Trial for',
      [
        ['bridal', 'Bridal lehenga'],
        ['silk', 'Kanjivaram silk'],
        ['groom', 'Groom wear'],
      ],
    ),
    leadForm(
      'Catalogue request',
      'What are you looking for?',
      [
        ['bridal', 'Bridal collection'],
        ['silk', 'Silk sarees'],
        ['mens', "Men's wear"],
        ['kids', 'Kids wear'],
      ],
      'Budget range',
      [
        ['u10', 'Under ₹10,000'],
        ['10_50', '₹10,000 – ₹50,000'],
        ['50p', 'Above ₹50,000'],
      ],
    ),
    supportForm(
      'Order enquiry',
      'What is this about?',
      [
        ['delivery', 'Delivery not received'],
        ['wrong_item', 'Wrong item or size'],
        ['refund', 'Refund or exchange'],
        ['other', 'Something else'],
      ],
      'Order number',
    ),
  ],
  'nellai-sweets': [
    appointmentForm(
      'Bulk order enquiry',
      [
        ['morning', 'Morning pickup'],
        ['afternoon', 'Afternoon pickup'],
        ['evening', 'Evening pickup'],
      ],
      'Order type',
      [
        ['wedding', 'Wedding return gifts'],
        ['corporate', 'Corporate gifting'],
        ['festival', 'Festival bulk order'],
      ],
    ),
    leadForm(
      'Festival pre-order',
      'Which boxes interest you?',
      [
        ['halwa', 'Tirunelveli halwa'],
        ['laddu', 'Laddu assortment'],
        ['mixture', 'Mixture and snacks'],
        ['dryfruit', 'Dry fruit boxes'],
      ],
      'Approximate quantity',
      [
        ['u25', 'Under 25 boxes'],
        ['25_100', '25 – 100 boxes'],
        ['100p', 'Over 100 boxes'],
      ],
    ),
    supportForm(
      'Delivery issue',
      'What went wrong?',
      [
        ['late', 'Delivery is late'],
        ['damaged', 'Damaged on arrival'],
        ['missing', 'Items missing'],
        ['other', 'Something else'],
      ],
      'Order number',
    ),
  ],
  scanwell: [
    appointmentForm(
      'Test appointment',
      [
        ['early', '6:30 – 9:00 am'],
        ['morning', '9:00 – 12:00'],
        ['evening', '4:00 – 7:00 pm'],
      ],
      'Test',
      [
        ['full_body', 'Full body check-up'],
        ['diabetes', 'Diabetes profile'],
        ['thyroid', 'Thyroid profile'],
        ['single', 'Single test'],
      ],
    ),
    leadForm(
      'Health package request',
      'Who is the check-up for?',
      [
        ['self', 'Myself'],
        ['parents', 'Parents'],
        ['family', 'Whole family'],
        ['corporate', 'Company staff'],
      ],
      'Preferred package',
      [
        ['basic', 'Basic'],
        ['advanced', 'Advanced'],
        ['premium', 'Premium'],
      ],
    ),
    supportForm(
      'Report request',
      'What do you need?',
      [
        ['copy', 'Copy of an old report'],
        ['missing', 'Report not received'],
        ['correction', 'Correction in a report'],
        ['other', 'Something else'],
      ],
      'Patient ID',
    ),
  ],
  venkateswara: [
    appointmentForm(
      'Demo class booking',
      [
        ['weekday_morning', 'Weekday morning'],
        ['weekday_evening', 'Weekday evening'],
        ['saturday', 'Saturday batch'],
      ],
      'Course',
      [
        ['neet', 'NEET foundation'],
        ['jee', 'JEE foundation'],
        ['board', 'Board exam batch'],
      ],
    ),
    leadForm(
      'Course enquiry',
      'Which exam?',
      [
        ['neet', 'NEET'],
        ['jee', 'JEE'],
        ['board', 'Board exams'],
        ['olympiad', 'Olympiads'],
      ],
      'Current class',
      [
        ['8', 'Class 8'],
        ['9', 'Class 9'],
        ['10', 'Class 10'],
        ['11', 'Class 11'],
        ['12', 'Class 12'],
      ],
    ),
    supportForm(
      'Fee plan request',
      'What do you need help with?',
      [
        ['instalment', 'Instalment plan'],
        ['refund', 'Refund'],
        ['receipt', 'Fee receipt copy'],
        ['other', 'Something else'],
      ],
      'Student ID',
    ),
  ],
};

const DEFAULT_WA_FORMS: WaFormBlueprint[] = WA_FORM_SETS['nazeel'] as WaFormBlueprint[];

/** Give a blueprint's screens and fields workspace-unique, stable ids. */
function hydrateWhatsAppForm(
  blueprint: WaFormBlueprint,
  tenantId: string,
  index: number,
): { name: string; category: WaFormCategory; screens: WaFormScreen[] } {
  const formId = `${tenantId}-waf-${index + 1}`;

  const screens: WaFormScreen[] = blueprint.screens.map((screen) => ({
    id: screen.id,
    title: screen.title,
    subtitle: screen.subtitle,
    terminal: screen.terminal,
    nextScreenId: screen.nextScreenId,
    footerLabel: screen.footerLabel,
    fields: screen.fields.map((field, fieldIndex) => ({
      id: `${formId}-s${screen.id.toLowerCase()}-f${fieldIndex + 1}`,
      type: field.type,
      label: field.label,
      name: field.name,
      required: field.required ?? true,
      ...(field.inputType ? { inputType: field.inputType } : {}),
      ...(field.placeholder ? { placeholder: field.placeholder } : {}),
      ...(field.options
        ? { options: field.options.map(([id, title]) => ({ id, title })) }
        : {}),
    })),
  }));

  return { name: blueprint.name, category: blueprint.category, screens };
}

export function buildDataset(seed = SEED): Dataset {
  const rng = new Rng(seed);
  const tenants: Tenant[] = [];
  const workspaceUsers: WorkspaceUser[] = [];
  const contacts: Contact[] = [];
  const conversations: Conversation[] = [];
  const messages: Message[] = [];
  const flows: ChatFlow[] = [];
  const templates: MessageTemplate[] = [];
  const campaigns: Campaign[] = [];
  const webhookEvents: WebhookEvent[] = [];
  const subscriptionEvents: SubscriptionEvent[] = [];
  const invoices: Invoice[] = [];
  const teams: Team[] = [];
  const quickReplies: QuickReply[] = [];
  const segments: ContactSegment[] = [];
  const businessProfiles: BusinessProfile[] = [];
  const auditEvents: AuditEvent[] = [];
  const flowGraphs: FlowGraph[] = [];
  const flowVersions: FlowVersion[] = [];
  const whatsappFlows: WhatsAppFlowForm[] = [];
  const campaignSamples: CampaignSample[] = [];

  TENANT_SEEDS.forEach((seedTenant, tenantIndex) => {
    const tenantId = `tenant-${tenantIndex + 1}`;
    const tenantContacts: Contact[] = [];

    // Hoisted so the customer-facing number derives from the same digits: the
    // shared stream consumes exactly the two ids it always has.
    const metaWabaId =
      seedTenant.status === 'active' ? `10${rng.int(100000000, 999999999)}` : null;
    const metaPhoneNumberId =
      seedTenant.status === 'active' ? `10${rng.int(100000000, 999999999)}` : null;

    tenants.push({
      id: tenantId,
      businessName: seedTenant.businessName,
      subdomain: seedTenant.subdomain,
      metaWabaId,
      metaPhoneNumberId,
      phoneNumber: metaPhoneNumberId
        ? `+91 ${metaPhoneNumberId.slice(2, 7)} ${metaPhoneNumberId.slice(7)}`
        : null,
      subscriptionTier: seedTenant.tier,
      isActive: seedTenant.status !== 'suspended' && seedTenant.status !== 'archived',
      status: seedTenant.status,
      industry: seedTenant.industry,
      city: 'Tirunelveli',
      seatsUsed: 0,
      contactCount: 0,
      monthlyMessages: rng.int(1800, 9400),
      createdAt: isoAt(-rng.int(40, 260) * 24 * HOUR),
      connectedAt: seedTenant.status === 'active' ? isoAt(-rng.int(20, 190) * 24 * HOUR) : null,
    });

    // ---- users: 1 admin, 1 supervisor, the rest agents
    const userCount = rng.int(4, 8);
    const tenantUsers: WorkspaceUser[] = [];

    for (let i = 0; i < userCount; i += 1) {
      const fullName = nameFor(rng);
      // Seats 2 and 3 are pinned so the developer and agent demo logins resolve
      // in every tenant. The discarded roll keeps the shared stream identical
      // to the unpinned sequence — downstream seeds are unaffected.
      const developerRoll = i >= 2 ? rng.chance(0.2) : false;
      const role =
        i === 0
          ? 'admin'
          : i === 1
            ? 'supervisor'
            : i === 2
              ? 'developer'
              : i === 3
                ? 'agent'
                : developerRoll
                  ? 'developer'
                  : 'agent';
      const isOnline = rng.chance(0.45);
      const capacity = role === 'supervisor' ? rng.int(6, 10) : rng.int(3, 8);
      const user: WorkspaceUser = {
        id: `${tenantId}-user-${i + 1}`,
        tenantId,
        fullName,
        email: emailFor(`${fullName}${i}`, { subdomain: seedTenant.subdomain }),
        role,
        roleId: `role-${role}`,
        maxActiveChatCapacity: capacity,
        activeChats: isOnline ? rng.int(0, capacity) : 0,
        isOnline,
        status: isOnline ? 'online' : rng.chance(0.4) ? 'away' : 'offline',
        department: rng.pick(DEPARTMENTS),
        phone: `+91 9${rng.int(100000000, 999999999)}`.slice(0, 17),
        lastLoginAt: isoAt(-rng.int(1, 72) * HOUR),
        createdAt: isoAt(-rng.int(10, 200) * 24 * HOUR),
        invited: rng.chance(0.12),
      };
      tenantUsers.push(user);
      workspaceUsers.push(user);
    }

    // Wave 5: at least one seat per tenant is always waiting on an invitation,
    // so the accept-invite flow is walkable in every demo workspace. Pure
    // post-processing — no extra draws, so earlier tenants stay byte-identical.
    if (!tenantUsers.some((user) => user.invited) && tenantUsers.length > 3) {
      (tenantUsers[tenantUsers.length - 1] as WorkspaceUser).invited = true;
    }

    const agents = tenantUsers.filter(
      (user) => user.role === 'agent' || user.role === 'supervisor',
    );
    const tenant = tenants[tenantIndex] as Tenant;
    tenant.seatsUsed = tenantUsers.length;

    // ---- contacts
    const contactCount = Math.round(300 / TENANT_SEEDS.length) + rng.int(-6, 12);

    for (let i = 0; i < contactCount; i += 1) {
      const displayName = nameFor(rng);
      const contact: Contact = {
        id: `${tenantId}-contact-${i + 1}`,
        tenantId,
        waId: `919${rng.int(100000000, 999999999)}`,
        displayName,
        customAttributes: {
          source: rng.pick(['Advertisement', 'Walk-in', 'Referral', 'Campaign']),
          locality: rng.pick([
            'Town',
            'West Car Street',
            'Vannarpettai',
            'High Ground',
            'Palayamkottai',
          ]),
        },
        optInStatus: !rng.chance(0.09),
        assignedUserId: rng.chance(0.55) ? (rng.pick(agents)?.id ?? null) : null,
        tags: rng.some(TAGS, 0, 2),
        conversationCount: rng.int(1, 9),
        createdAt: isoAt(-rng.int(1, 300) * 24 * HOUR),
        lastSeenAt: isoAt(-rng.int(1, 60 * 24) * HOUR),
      };
      contacts.push(contact);
      tenantContacts.push(contact);
    }

    tenant.contactCount = tenantContacts.length;

    // ---- Meta message templates (seeded before conversations so a thread can
    // quote a template the tenant actually owns)
    for (const [templateIndex, template] of TEMPLATE_SEEDS.entries()) {
      // The roll is always consumed; the first template pins to approved so the
      // composer gate ("approved only") never faces an empty shelf by chance.
      const rolled = rng.pick([
        'draft',
        'pending',
        'approved',
        'approved',
        'approved',
        'rejected',
        'paused',
      ] as const);
      const status = templateIndex === 0 ? 'approved' : rolled;

      templates.push({
        id: `${tenantId}-tpl-${template.name}`,
        tenantId,
        name: template.name,
        category: template.category,
        language: template.language,
        status,
        body: template.body,
        variables: template.variables.length,
        header: template.header ?? null,
        footer: template.footer ?? null,
        buttons: template.buttons ?? [],
        variableLabels: template.variables,
        updatedAt: isoAt(-rng.int(1, 60) * 24 * HOUR),
        submittedAt: status === 'draft' ? null : isoAt(-rng.int(2, 90) * 24 * HOUR),
      });
    }

    // ---- conversations + messages
    const conversationCount = Math.round(120 / TENANT_SEEDS.length);

    for (let i = 0; i < conversationCount; i += 1) {
      const contact = rng.pick(tenantContacts) as Contact;
      const status = rng.pick(['flow', 'open', 'pending', 'resolved'] as const);
      const assigned =
        status === 'flow' ? null : (rng.pick(agents)?.id ?? (tenantUsers[0] as WorkspaceUser).id);
      const flow = rng.chance(0.4) ? `${tenantId}-flow-${rng.int(1, 3)}` : null;
      const conversation: Conversation = {
        id: `${tenantId}-conv-${i + 1}`,
        tenantId,
        contactId: contact.id,
        channel: 'WhatsApp',
        status,
        currentActiveFlowId: flow,
        currentActiveNodeId: flow ? `node-${rng.int(1, 5)}` : null,
        assignedUserId: assigned,
        lastMessageAt: isoAt(-rng.int(1, 72) * HOUR),
        unreadCount: status === 'open' ? rng.int(0, 4) : 0,
        subject: rng.pick(SUBJECTS),
        priority: rng.pick(['low', 'normal', 'normal', 'high'] as const),
        tags: rng.some(TAGS, 0, 1),
      };
      conversations.push(conversation);

      const turnCount = rng.int(2, 7);
      const thread: Message[] = [];
      // Threads stretch over a few days so the thread's day separators are real.
      const startMinutesAgo = rng.int(0, 3) * 24 * 60;

      for (let turn = 0; turn < turnCount; turn += 1) {
        const inbound = turn % 2 === 0;
        const whisper = !inbound && rng.chance(0.18);

        const message = buildMessage(rng, {
          id: `${conversation.id}-msg-${turn + 1}`,
          conversationId: conversation.id,
          direction: inbound ? 'inbound' : 'outbound',
          deliveryStatus: inbound
            ? 'read'
            : rng.pick(['sent', 'delivered', 'read', 'failed'] as const),
          createdByUserId: inbound ? null : assigned,
          sentAt: isoAt(-(startMinutesAgo + (turnCount - turn) * 40 + rng.int(0, 30)) * 60_000),
          whisper,
          contactName: contact.displayName,
          template: inbound ? null : (rng.pick(templates) ?? null),
        });

        // A few threads show the contact reacting to the business reply, which
        // is how reactions arrive on the webhook.
        if (!inbound && !whisper && rng.chance(0.16)) {
          message.reactions = [
            {
              emoji: rng.pick(['❤️', '👍', '🙏', '😍']),
              userId: null,
              displayName: contact.displayName,
            },
          ];
        }

        thread.push(message);
        messages.push(message);
      }

      // Quote-reply context: later messages occasionally reply to the opener.
      if (thread.length > 2 && rng.chance(0.22)) {
        const target = thread[thread.length - 1];
        if (target) {
          target.replyToMessageId = thread[0]!.id;
        }
      }

      // The queue's "last activity" must agree with the newest message.
      const newest = thread[thread.length - 1];
      if (newest) {
        conversation.lastMessageAt = newest.sentAt;
      }
    }

    // ---- flows
    const flowNames = [
      'Main greeting & routing',
      'Order status self-service',
      'Appointment booking',
      'Enquiry qualification',
      'After-hours fallback',
    ];

    for (let i = 0; i < rng.int(3, 5); i += 1) {
      flows.push({
        id: `${tenantId}-flow-${i + 1}`,
        tenantId,
        name: flowNames[i] as string,
        triggerKeyword:
          i === 0 ? 'hi' : rng.chance(0.5) ? rng.pick(['menu', 'order', 'info']) : null,
        isActive: i < 2,
        version: rng.int(1, 7),
        sessions30d: rng.int(40, 1200),
        handoffRate: rng.int(8, 62),
        updatedAt: isoAt(-rng.int(1, 45) * 24 * HOUR),
      });
    }

    // ---- campaigns
    for (let i = 0; i < rng.int(1, 3); i += 1) {
      const size = rng.int(200, 2400);
      const sent = rng.int(Math.round(size * 0.5), size);
      const delivered = Math.round((sent * rng.int(88, 99)) / 100);
      const read = Math.round((delivered * rng.int(41, 86)) / 100);
      campaigns.push({
        id: `${tenantId}-camp-${i + 1}`,
        tenantId,
        name: rng.pick([
          'Navaratri collection preview',
          'Diwali bulk order drive',
          'Post-session counselling invites',
          'Health package reminders',
        ]) as string,
        status: rng.pick(['draft', 'scheduled', 'sending', 'paused', 'completed'] as const),
        audienceSize: size,
        sent,
        delivered,
        read,
        replied: Math.round((read * rng.int(6, 28)) / 100),
        optOuts: Math.round((size * rng.int(1, 7)) / 1000),
        // Placeholders: the wave-6 post-processing pass below fills these in on
        // a private stream, so the shared sequence is not disturbed.
        failed: 0,
        templateId: null,
        segmentId: null,
        createdBy: '',
        createdAt: '',
        pacePerHour: rng.pick([120, 250, 500, 1000]),
        qualityRating: rng.pick(['high', 'high', 'medium', 'low'] as const),
        scheduledAt: rng.chance(0.5) ? isoAt(rng.int(-10, 96) * HOUR) : null,
      });
    }

    // ---- webhook events for platform health
    for (let i = 0; i < rng.int(6, 14); i += 1) {
      const failed = rng.chance(0.14);
      webhookEvents.push({
        id: `${tenantId}-evt-${i + 1}`,
        tenantId,
        type: rng.pick(['messages', 'messages', 'statuses', 'auth'] as const),
        receivedAt: isoAt(-rng.int(1, 240) * 60_000),
        ackMs: rng.int(18, 142),
        outcome: failed ? 'failed' : rng.pick(['processed', 'queued', 'duplicate'] as const),
        error: failed ? 'Tenant resolver cache miss for phone-number id' : null,
      });
    }

    // ---- subscription lifecycle: every tenant starts on trial, then follows
    // its seeded status. Newest last, so the log reads top-down.
    const tenantCreatedAt = (tenants[tenantIndex] as Tenant).createdAt;
    const lifecycle: { to: SubscriptionEvent['to']; reason: string; actor: string; at: string }[] = [
      { to: 'trial', reason: 'Workspace provisioned with a 14-day trial.', actor: 'system', at: tenantCreatedAt },
    ];

    if (seedTenant.status === 'active') {
      lifecycle.push({
        to: 'active',
        reason: `Trial converted to the ${seedTenant.tier} plan after WhatsApp connection.`,
        actor: 'Zira Developer',
        at: (tenants[tenantIndex] as Tenant).connectedAt ?? tenantCreatedAt,
      });
    }

    for (let i = 0; i < lifecycle.length; i += 1) {
      const step = lifecycle[i]!;
      subscriptionEvents.push({
        id: `${tenantId}-sub-${i + 1}`,
        tenantId,
        from: i === 0 ? null : lifecycle[i - 1]!.to,
        to: step.to,
        reason: step.reason,
        actor: step.actor,
        createdAt: step.at,
      });
    }

    // ---- invoices: one per month since provisioning, newest first. Rolled on a
    // private stream so the shared sequence — and every earlier tenant's story
    // — is byte-identical to builds that predate billing.
    const billing = new Rng(SEED + 1000 + tenantIndex);
    const invoiceCount = billing.int(2, 4);
    const baseAmount = seedTenant.tier === 'Scale' ? 49900 : seedTenant.tier === 'Growth' ? 14900 : 0;

    for (let i = 0; i < invoiceCount; i += 1) {
      const issuedAt = isoAt(-billing.int(8 + i * 28, 30 + i * 30) * 24 * HOUR);
      const status =
        baseAmount === 0
          ? 'paid'
          : i === 0 && billing.chance(0.4)
            ? billing.pick(['due', 'overdue'] as const)
            : 'paid';
      const issued = new Date(issuedAt);

      invoices.push({
        id: `${tenantId}-inv-${i + 1}`,
        tenantId,
        number: `INV-2026-${String(tenantIndex * 4 + 41 - i).padStart(4, '0')}`,
        period: issued.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
        amountInr: baseAmount,
        status,
        issuedAt,
        dueAt: new Date(issued.getTime() + 14 * 24 * HOUR).toISOString(),
        paidAt:
          status === 'paid'
            ? new Date(issued.getTime() + billing.int(1, 12) * 24 * HOUR).toISOString()
            : null,
      });
    }

    // ---- wave 3 workspace collections. Fully deterministic: no shared-rng
    // draw happens here, so tenants — and the platform staff seeded after this
    // loop — keep byte-identical stories to builds that predate wave 3.
    const TEAM_SEEDS = [
      { name: 'Support Desk', description: 'Owns escalations and open threads.', weight: 5, icon: '☎' },
      { name: 'Sales Counter', description: 'Quotes, catalogues and bulk orders.', weight: 3, icon: '◭' },
      { name: 'Billing Desk', description: 'Invoices, payments and receipts.', weight: 2, icon: '▤' },
    ];

    for (const [teamIndex, teamSeed] of TEAM_SEEDS.entries()) {
      teams.push({
        id: `${tenantId}-team-${teamIndex + 1}`,
        tenantId,
        name: teamSeed.name,
        description: teamSeed.description,
        // Round-robin seat split — deterministic from user ids, zero draws.
        memberUserIds: tenantUsers
          .filter((_, userIndex) => userIndex % TEAM_SEEDS.length === teamIndex)
          .map((user) => user.id),
        weight: teamSeed.weight,
        isDefault: teamIndex === 0,
        icon: teamSeed.icon,
        updatedAt: isoAt(-(teamIndex + 2) * 24 * HOUR),
      });
    }

    // The composer catalogue becomes per-workspace rows (same order, so `/…`
    // expansion behaves identically) plus two workspace-flavoured snippets.
    const EXTRA_REPLIES: { shortcut: string; label: string; body: string }[] = [
      {
        shortcut: '/festive',
        label: 'Festive offer',
        body: `Festive greetings from ${seedTenant.businessName}! Reply FESTIVE and we will share this week's offers.`,
      },
      {
        shortcut: '/visit',
        label: 'Store visit',
        body: `You are welcome to visit our Tirunelveli store any day 10 am – 8:30 pm. Shall we book a slot for you?`,
      },
    ];

    for (const [replyIndex, reply] of [...QUICK_REPLIES, ...EXTRA_REPLIES].entries()) {
      quickReplies.push({
        id: `${tenantId}-qr-${replyIndex + 1}`,
        tenantId,
        trigger: reply.shortcut,
        title: reply.label,
        body: reply.body,
        usageCount: (tenantIndex * 13 + replyIndex * 29) % 180,
        updatedAt: isoAt(-(replyIndex + 1) * 9 * HOUR),
      });
    }

    segments.push(
      {
        id: `${tenantId}-seg-vip`,
        tenantId,
        name: 'VIP repeat buyers',
        description: 'High-value regulars for early access and personal drops.',
        match: 'all',
        rules: [
          { field: 'tag', operator: 'has', value: 'VIP-Retail' },
          { field: 'conversations', operator: 'moreThan', value: '2' },
        ],
        createdAt: isoAt(-21 * 24 * HOUR),
        updatedAt: isoAt(-21 * 24 * HOUR),
      },
      {
        id: `${tenantId}-seg-festive`,
        tenantId,
        name: 'Festive campaign reach',
        description: 'Opted-in seasonal shoppers for broadcast offers.',
        match: 'all',
        rules: [
          { field: 'tag', operator: 'has', value: 'Diwali-Shopper' },
          { field: 'optIn', operator: 'is', value: 'opted-in' },
        ],
        createdAt: isoAt(-12 * 24 * HOUR),
        updatedAt: isoAt(-4 * 24 * HOUR),
      },
      {
        id: `${tenantId}-seg-winback`,
        tenantId,
        name: 'Needs re-engagement',
        description: 'Gone quiet or opted out — win back, never broadcast.',
        match: 'any',
        rules: [
          { field: 'inactiveDays', operator: 'moreThan', value: '30' },
          { field: 'optIn', operator: 'is', value: 'opted-out' },
        ],
        createdAt: isoAt(-9 * 24 * HOUR),
        updatedAt: isoAt(-9 * 24 * HOUR),
      },
    );

    businessProfiles.push({
      tenantId,
      displayName: seedTenant.businessName,
      about: `${seedTenant.industry} — serving customers across Tirunelveli on WhatsApp.`,
      address: 'Main Road, Tirunelveli, Tamil Nadu 627001',
      email: `hello@${seedTenant.subdomain}.example.com`,
      timezone: 'Asia/Kolkata',
      hours: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => ({
        day,
        open: true,
        start: '10:00',
        end: '20:30',
      })).concat([{ day: 'Sun', open: false, start: '10:00', end: '20:30' }]),
      greetingText: `Welcome to ${seedTenant.businessName}! How can we help you today?`,
      autoResponderEnabled: true,
      autoResponderText:
        'Thanks for messaging us! We are currently closed and will reply when we reopen at 10 am.',
      updatedAt: isoAt(-3 * 24 * HOUR),
    });

    // ---- reconciliation (no draws): the rolled conversationCount was
    // decorative, so threads, the hub summary and segment rules re-derive it
    // from the conversations actually attached to each contact.
    const threadsPerContact = new Map<string, number>();
    for (const conversation of conversations) {
      if (conversation.tenantId === tenantId) {
        threadsPerContact.set(
          conversation.contactId,
          (threadsPerContact.get(conversation.contactId) ?? 0) + 1,
        );
      }
    }
    for (const contact of tenantContacts) {
      contact.conversationCount = threadsPerContact.get(contact.id) ?? 0;
    }

    // ---- wave 5: the audit trail. Rolled on a private stream per tenant
    // (SEED + 2000 + index), so the shared sequence — and every earlier
    // tenant's story — stays byte-identical to builds that predate the log.
    const recentAuditRng = new Rng(SEED + 2000 + tenantIndex);
    const admin = tenantUsers.find((user) => user.role === 'admin') ?? tenantUsers[0];
    const adminName = admin?.fullName ?? 'Workspace Administrator';
    const invitedUser = tenantUsers.find((user) => user.invited);
    const namedTemplate =
      templates.find((template) => template.tenantId === tenantId)?.name ?? 'Order update';

    const tenantAudit: {
      area: AuditArea;
      action: string;
      target: string;
      level: AuditLevel;
    }[] = [
      {
        area: 'auth',
        action: 'Signed in to the workspace console',
        target: `${adminName} · password`,
        level: 'info',
      },
      {
        area: 'users',
        action: invitedUser
          ? `Invited ${invitedUser.fullName} to the workspace`
          : 'Resent an invitation that had expired',
        target: invitedUser?.email ?? `${seedTenant.subdomain}.admin@example.com`,
        level: 'info',
      },
      {
        area: 'templates',
        action: `Submitted the “${namedTemplate}” template to Meta for approval`,
        target: namedTemplate,
        level: 'info',
      },
      {
        area: 'settings',
        action: 'Updated operating hours and the out-of-hours auto-responder',
        target: `${seedTenant.businessName} · business profile`,
        level: 'info',
      },
      {
        area: 'connections',
        action: tenant.metaWabaId
          ? `Connected WhatsApp Business Account ${tenant.metaWabaId}`
          : 'Started the WhatsApp connection through Embedded Signup',
        target: tenant.phoneNumber ?? `${seedTenant.subdomain} · WABA`,
        level: tenant.metaWabaId ? 'critical' : 'warning',
      },
      {
        area: 'roles',
        action: 'Changed a role capability: campaigns.manage → view',
        target: 'Supervisor',
        level: 'warning',
      },
      {
        area: 'billing',
        action: `Moved the workspace to the ${seedTenant.tier} plan`,
        target: `${seedTenant.tier} plan`,
        level: 'warning',
      },
      {
        area: 'inbox',
        action: 'Reassigned the open queue after an agent went offline',
        target: 'Support Desk team',
        level: 'info',
      },
    ];

    tenantAudit.forEach((entry, index) => {
      auditEvents.push({
        id: `${tenantId}-audit-${index + 1}`,
        tenantId,
        actor: adminName,
        actorRole: 'Workspace Administrator',
        area: entry.area,
        action: entry.action,
        target: entry.target,
        level: entry.level,
        createdAt: isoAt(-recentAuditRng.int(1 + index * 2, 3 + index * 3) * 24 * HOUR),
      });
    });
  });

  // ---- wave 5: platform-wide audit entries. A private stream again, and they
  // land after the per-tenant rows so every tenant's ids stay stable.
  const platformAuditRng = new Rng(SEED + 3000);
  const owner = 'Zira Developer';

  const platformAudit: {
    area: AuditArea;
    action: string;
    target: string;
    level: AuditLevel;
    actor: string;
    actorRole: string;
    tenantId: string | null;
  }[] = [
    {
      area: 'auth',
      action: 'Signed in to the platform console',
      target: 'admin console · password',
      level: 'info',
      actor: owner,
      actorRole: 'Platform Owner',
      tenantId: null,
    },
    {
      area: 'clients',
      action: `Provisioned ${tenants[0]?.businessName ?? 'a workspace'} on trial`,
      target: `${tenants[0]?.businessName ?? 'Workspace'} · ${tenants[0]?.subscriptionTier ?? 'Pilot'}`,
      level: 'critical',
      actor: owner,
      actorRole: 'Platform Owner',
      tenantId: tenants[0]?.id ?? null,
    },
    {
      area: 'platform',
      action: `Opened support view-as for ${tenants[1]?.businessName ?? 'a workspace'}`,
      target: `${tenants[1]?.businessName ?? 'Workspace'} · impersonation`,
      level: 'critical',
      actor: 'Platform Operations',
      actorRole: 'Platform Operations',
      tenantId: tenants[1]?.id ?? null,
    },
    {
      area: 'meta',
      action: 'Rotated the webhook verify token',
      target: 'Meta app · callback verification',
      level: 'warning',
      actor: owner,
      actorRole: 'Platform Owner',
      tenantId: null,
    },
    {
      area: 'plans',
      action: 'Saved Pilot limits: 5 seats, 5,000 messages / month',
      target: 'Pilot plan',
      level: 'warning',
      actor: owner,
      actorRole: 'Platform Owner',
      tenantId: null,
    },
    {
      area: 'clients',
      action: `Re-activated ${tenants[1]?.businessName ?? 'a workspace'} after the invoice cleared`,
      target: `${tenants[1]?.businessName ?? 'Workspace'} · suspended → active`,
      level: 'warning',
      actor: 'Platform Operations',
      actorRole: 'Platform Operations',
      tenantId: tenants[1]?.id ?? null,
    },
    {
      area: 'platform',
      action: 'Updated platform settings: 14-day trial, maintenance mode off',
      target: 'Platform settings',
      level: 'info',
      actor: owner,
      actorRole: 'Platform Owner',
      tenantId: null,
    },
  ];

  platformAudit.forEach((entry, index) => {
    auditEvents.push({
      id: `audit-platform-${index + 1}`,
      tenantId: entry.tenantId,
      actor: entry.actor,
      actorRole: entry.actorRole,
      area: entry.area,
      action: entry.action,
      target: entry.target,
      level: entry.level,
      createdAt: isoAt(-platformAuditRng.int(1 + index, 4 + index * 3) * 24 * HOUR),
    });
  });

  const platformStaff: PlatformStaffUser[] = [
    {
      id: 'staff-1',
      fullName: 'Zira Developer',
      email: 'owner@bugconnect.example',
      role: 'owner',
      roleId: 'role-platform-owner',
      isActive: true,
      lastLoginAt: isoAt(-2 * HOUR),
      createdAt: isoAt(-300 * 24 * HOUR),
    },
  ];

  for (let i = 0; i < 5; i += 1) {
    const fullName = nameFor(rng);
    platformStaff.push({
      id: `staff-${i + 2}`,
      fullName,
      email: emailFor(fullName, { subdomain: 'bugconnect' }),
      role: 'operations',
      roleId: 'role-platform-operations',
      isActive: !rng.chance(0.15),
      lastLoginAt: isoAt(-rng.int(1, 90) * HOUR),
      createdAt: isoAt(-rng.int(5, 240) * 24 * HOUR),
    });
  }

  // ---- wave 6: flow graphs + published versions. Post-processed from the flow
  // rows with a private stream per flow, so every earlier seed keeps its exact
  // draws and the demo story does not shift.
  const userById = new Map(workspaceUsers.map((user) => [user.id, user]));

  flows.forEach((flow, flowIndex) => {
    const graphRng = new Rng(SEED + 4000 + flowIndex);
    const nodes = buildFlowNodes(flow, flowIndex);
    const updatedAt = flow.updatedAt;

    flowGraphs.push({
      id: `${flow.id}-graph`,
      tenantId: flow.tenantId,
      flowId: flow.id,
      nodes,
      updatedAt,
    });

    const authors = workspaceUsers.filter((user) => user.tenantId === flow.tenantId);

    for (let version = 1; version <= flow.version; version += 1) {
      const ageInVersions = flow.version - version;
      const author = authors.length
        ? (userById.get((authors[graphRng.int(0, authors.length - 1)] as WorkspaceUser).id)?.fullName ??
          'Workspace admin')
        : 'Workspace admin';

      flowVersions.push({
        id: `${flow.id}-v${version}`,
        tenantId: flow.tenantId,
        flowId: flow.id,
        version,
        note: version === flow.version
          ? FLOW_VERSION_NOTES[0] as string
          : (FLOW_VERSION_NOTES[version % FLOW_VERSION_NOTES.length] as string),
        author,
        nodeCount: snapshotNodes(nodes, ageInVersions).length,
        publishedAt: isoAt(-(ageInVersions * graphRng.int(2, 9) + graphRng.int(0, 3)) * 24 * HOUR),
        nodes: snapshotNodes(nodes, ageInVersions),
      });
    }

    // The newest snapshot must match what the canvas shows.
    const newest = flowVersions
      .filter((version) => version.flowId === flow.id)
      .sort((a, b) => b.version - a.version)[0];
    if (newest) {
      newest.nodes = nodes.map((node) => ({ ...node, options: node.options.map((option) => ({ ...option })) }));
      newest.nodeCount = nodes.length;
      newest.publishedAt = updatedAt;
    }
  });

  // ---- wave 6: native WhatsApp forms. The blueprints above are hydrated per
  // tenant and their status and traffic roll on a private stream
  // (SEED + 5000 + index), so no existing seed shifts by a single draw.
  const adminNameByTenant = new Map<string, string>();
  for (const user of workspaceUsers) {
    if (user.role === 'admin' && !adminNameByTenant.has(user.tenantId)) {
      adminNameByTenant.set(user.tenantId, user.fullName);
    }
  }

  tenants.forEach((tenant, tenantIndex) => {
    const blueprints = WA_FORM_SETS[tenant.subdomain] ?? DEFAULT_WA_FORMS;
    const formRng = new Rng(SEED + 5000 + tenantIndex);
    const tenantFlows = flows.filter((flow) => flow.tenantId === tenant.id);
    // Meta only accepts a flow once the WABA is connected.
    const canPublish = tenant.status === 'active';

    blueprints.forEach((blueprint, formIndex) => {
      const hydrated = hydrateWhatsAppForm(blueprint, tenant.id, formIndex);
      const createdAt = isoAt(-formRng.int(20, 170) * 24 * HOUR);
      const updatedAt = isoAt(-formRng.int(1, 19) * 24 * HOUR);
      const status: WaFormStatus = !canPublish
        ? 'draft'
        : formIndex < 2
          ? 'published'
          : formRng.chance(0.5)
            ? 'pending'
            : 'draft';

      whatsappFlows.push({
        id: `${tenant.id}-waf-${formIndex + 1}`,
        tenantId: tenant.id,
        name: hydrated.name,
        metaFlowId: `${formRng.int(100_000_000_000_000, 999_999_999_999_999)}`,
        category: hydrated.category,
        language: 'en',
        status,
        screens: hydrated.screens,
        linkedFlowId:
          status === 'published' && tenantFlows.length
            ? (tenantFlows[formIndex % tenantFlows.length] as ChatFlow).id
            : null,
        submissions30d: status === 'published' ? formRng.int(24, 940) : 0,
        completionRate: status === 'published' ? formRng.int(41, 92) : 0,
        createdAt,
        updatedAt,
        publishedAt: status === 'published' ? updatedAt : null,
      });
    });
  });

  // ---- wave 6: campaign wiring + the delivery series the monitor polls. Also
  // post-processed (SEED + 6000 + index) so the seeded counters stay as rolled.
  const templatesByTenant = new Map<string, MessageTemplate[]>();
  for (const template of templates) {
    if (template.status !== 'approved') {
      continue;
    }
    const list = templatesByTenant.get(template.tenantId) ?? [];
    list.push(template);
    templatesByTenant.set(template.tenantId, list);
  }
  const segmentsByTenant = new Map<string, ContactSegment[]>();
  for (const segment of segments) {
    const list = segmentsByTenant.get(segment.tenantId) ?? [];
    list.push(segment);
    segmentsByTenant.set(segment.tenantId, list);
  }

  campaigns.forEach((campaign, campaignIndex) => {
    const campaignRng = new Rng(SEED + 6000 + campaignIndex);
    const approved = templatesByTenant.get(campaign.tenantId) ?? [];
    const tenantSegments = segmentsByTenant.get(campaign.tenantId) ?? [];
    const pickFrom = <T,>(list: T[]): T | undefined =>
      list.length ? list[campaignRng.int(0, list.length - 1)] : undefined;

    const template = pickFrom(approved);
    const segment = pickFrom(tenantSegments);

    campaign.templateId = campaign.status === 'draft' ? null : (template?.id ?? null);
    campaign.segmentId = segment?.id ?? null;
    campaign.createdBy =
      adminNameByTenant.get(campaign.tenantId) ?? 'Workspace Administrator';
    campaign.createdAt = campaign.scheduledAt
      ? new Date(
          Date.parse(campaign.scheduledAt) - campaignRng.int(6, 96) * HOUR,
        ).toISOString()
      : isoAt(-campaignRng.int(2, 70) * 24 * HOUR);
    campaign.failed =
      campaign.sent > 0
        ? Math.max(1, Math.round((campaign.sent * campaignRng.int(4, 26)) / 1000))
        : 0;

    if (campaign.sent === 0) {
      return;
    }

    // A short series that ends exactly on the campaign's current counters, so
    // the monitor's first poll continues the line instead of restarting it.
    const steps = Math.min(8, Math.max(3, Math.round(campaign.sent / 240)));
    const startStamp = Date.parse(campaign.createdAt);
    const endStamp = startStamp + campaignRng.int(4, 40) * HOUR;

    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      campaignSamples.push({
        id: `${campaign.id}-s${step}`,
        tenantId: campaign.tenantId,
        campaignId: campaign.id,
        at: new Date(startStamp + (endStamp - startStamp) * ratio).toISOString(),
        sent: Math.round(campaign.sent * ratio),
        delivered: Math.round(campaign.delivered * ratio),
        read: Math.round(campaign.read * ratio),
        failed: Math.round(campaign.failed * ratio),
      });
    }
  });

  messages.sort((a, b) => a.sentAt.localeCompare(b.sentAt));

  return {
    tenants,
    workspaceUsers,
    platformStaff,
    contacts,
    conversations,
    messages,
    flows,
    templates,
    campaigns,
    webhookEvents,
    subscriptionEvents,
    invoices,
    teams,
    quickReplies,
    segments,
    businessProfiles,
    auditEvents,
    flowGraphs,
    flowVersions,
    whatsappFlows,
    campaignSamples,
  };
}
