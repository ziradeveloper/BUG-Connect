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

function nameFor(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

function emailFor(name: string, tenant: { subdomain: string }): string {
  const local = name.toLowerCase().replace(/[^a-z]+/g, '.');
  return `${local}@${tenant.subdomain.replace(/[^a-z0-9]/g, '')}.example`;
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
      for (let turn = 0; turn < turnCount; turn += 1) {
        const inbound = turn % 2 === 0;
        const whisper = !inbound && rng.chance(0.18);
        messages.push({
          id: `${conversation.id}-msg-${turn + 1}`,
          conversationId: conversation.id,
          direction: inbound ? 'inbound' : 'outbound',
          type: rng.chance(0.12) ? 'media' : rng.chance(0.2) ? 'interactive' : 'text',
          content: whisper
            ? `@supervisor Can we offer 5% on this order? (internal note)`
            : inbound
              ? (rng.pick(MESSAGE_LINES_IN) as string)
              : (rng.pick(MESSAGE_LINES_OUT) as string),
          mediaUrl: null,
          deliveryStatus: inbound
            ? 'read'
            : rng.pick(['sent', 'delivered', 'read', 'failed'] as const),
          isInternalWhisper: whisper,
          createdByUserId: inbound ? null : assigned,
          sentAt: isoAt(-((turnCount - turn) * 40 + rng.int(0, 30)) * 60_000),
        });
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

    // ---- templates
    const templateNames = [
      'order_confirmation',
      'invoice_ready',
      'appointment_reminder',
      'catalogue_weekly',
      'delivery_update',
      'report_ready',
      'payment_followup',
      'welcome_message',
    ];

    for (let i = 0; i < rng.int(5, 8); i += 1) {
      const status = rng.pick([
        'draft',
        'pending',
        'approved',
        'approved',
        'rejected',
        'paused',
      ] as const);
      templates.push({
        id: `${tenantId}-tpl-${i + 1}`,
        tenantId,
        name: (templateNames[i] ?? `template_${i}`) as string,
        category: rng.pick(['MARKETING', 'UTILITY', 'UTILITY'] as const),
        language: rng.chance(0.35) ? 'ta_IN' : 'en',
        status,
        body: 'Hi {{1}}, your order {{2}} is {{3}}. Reply here to speak with our team.',
        variables: rng.int(1, 3),
        updatedAt: isoAt(-rng.int(1, 60) * 24 * HOUR),
        submittedAt: status === 'draft' ? null : isoAt(-rng.int(2, 90) * 24 * HOUR),
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
