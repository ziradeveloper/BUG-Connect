import type {
  TenantStatus,
  Campaign,
  ChatFlow,
  Contact,
  Conversation,
  Message,
  MessageTemplate,
  PlatformStaffUser,
  Tenant,
  WebhookEvent,
  WorkspaceUser,
} from './entities';
import {
  payloadPreview,
  type MessagePayload,
  type TemplateButtonPayload,
  type WhatsAppMessageType,
} from './whatsapp';

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
  const local = name.toLowerCase().replace(/[^a-z]+/g, '.');
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
};

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

  TENANT_SEEDS.forEach((seedTenant, tenantIndex) => {
    const tenantId = `tenant-${tenantIndex + 1}`;
    const tenantContacts: Contact[] = [];

    tenants.push({
      id: tenantId,
      businessName: seedTenant.businessName,
      subdomain: seedTenant.subdomain,
      metaWabaId: seedTenant.status === 'active' ? `10${rng.int(100000000, 999999999)}` : null,
      metaPhoneNumberId:
        seedTenant.status === 'active' ? `10${rng.int(100000000, 999999999)}` : null,
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
      const role =
        i === 0 ? 'admin' : i === 1 ? 'supervisor' : rng.chance(0.2) ? 'developer' : 'agent';
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
    for (const template of TEMPLATE_SEEDS) {
      const status = rng.pick([
        'draft',
        'pending',
        'approved',
        'approved',
        'approved',
        'rejected',
        'paused',
      ] as const);

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
  };
}
