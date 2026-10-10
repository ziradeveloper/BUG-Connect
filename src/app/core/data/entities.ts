import type {
  MessagePayload,
  MessageReaction,
  TemplateButtonPayload,
  WhatsAppMessageType,
} from './whatsapp';

export type TenantStatus =
  | 'active'
  | 'onboarding'
  | 'whatsapp_pending'
  | 'suspended'
  | 'archived'
  | 'lead_trial';

export interface Tenant {
  id: string;
  businessName: string;
  subdomain: string;
  metaWabaId: string | null;
  metaPhoneNumberId: string | null;
  /** The WhatsApp number customers message, once the workspace connects. */
  phoneNumber: string | null;
  subscriptionTier: string;
  isActive: boolean;
  status: TenantStatus;
  industry: string;
  city: string;
  seatsUsed: number;
  contactCount: number;
  monthlyMessages: number;
  createdAt: string;
  connectedAt: string | null;
}

export interface WorkspaceUser {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  role: 'admin' | 'supervisor' | 'agent' | 'developer';
  roleId: string;
  maxActiveChatCapacity: number;
  activeChats: number;
  isOnline: boolean;
  status: 'online' | 'away' | 'offline';
  department: string;
  phone: string;
  lastLoginAt: string;
  createdAt: string;
  invited: boolean;
}

export interface PlatformStaffUser {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'operations' | 'support';
  roleId: string;
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  tenantId: string;
  waId: string;
  displayName: string;
  customAttributes: Record<string, string>;
  optInStatus: boolean;
  assignedUserId: string | null;
  tags: string[];
  conversationCount: number;
  createdAt: string;
  lastSeenAt: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  contactId: string;
  channel: string;
  status: 'flow' | 'open' | 'pending' | 'resolved';
  currentActiveFlowId: string | null;
  currentActiveNodeId: string | null;
  assignedUserId: string | null;
  lastMessageAt: string;
  unreadCount: number;
  subject: string;
  priority: 'low' | 'normal' | 'high';
  tags: string[];
}

/**
 * A message row. `type` is the Cloud API message object; `payload` is that
 * object's body. `content` stays a plain-text mirror so existing search,
 * queue previews and CSV exports keep working unchanged.
 */
export interface Message {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  /** Which Cloud API object this row represents. */
  type: WhatsAppMessageType;
  payload: MessagePayload;
  /** Plain-text mirror of `payload` — searchable, and the fallback renderer. */
  content: string;
  mediaUrl: string | null;
  deliveryStatus: 'sent' | 'delivered' | 'read' | 'failed';
  isInternalWhisper: boolean;
  createdByUserId: string | null;
  sentAt: string;
  /** Id of the message being quoted, when the agent replies in context. */
  replyToMessageId?: string | null;
  /** Reactions left on this message by the contact or the team. */
  reactions?: MessageReaction[];
  /** Meta's own message id, stamped once the Cloud API accepts the send. */
  waMessageId?: string | null;
}

export interface ChatFlow {
  id: string;
  tenantId: string;
  name: string;
  triggerKeyword: string | null;
  isActive: boolean;
  version: number;
  sessions30d: number;
  handoffRate: number;
  updatedAt: string;
}

/**
 * A Meta message template. `body` is the approved text with `{{n}}`
 * placeholders; `variables` counts them; `components` carries the approved
 * header/footer/buttons the composer can send with it.
 */
export interface MessageTemplate {
  id: string;
  tenantId: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paused';
  body: string;
  variables: number;
  /** Approved header, rendered above the body when the agent sends it. */
  header?: { type: 'text' | 'image' | 'video' | 'document'; text?: string } | null;
  footer?: string | null;
  buttons?: TemplateButtonPayload[];
  /** Per-variable sample values, shown as placeholders in the composer. */
  variableLabels?: string[];
  updatedAt: string;
  submittedAt: string | null;
}

export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed';
  audienceSize: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  optOuts: number;
  pacePerHour: number;
  qualityRating: 'high' | 'medium' | 'low';
  scheduledAt: string | null;
}

export interface WebhookEvent {
  id: string;
  tenantId: string;
  type: 'messages' | 'statuses' | 'auth';
  receivedAt: string;
  ackMs: number;
  outcome: 'processed' | 'queued' | 'duplicate' | 'failed';
  error: string | null;
}

/**
 * One metered dimension of a subscription tier. `null` means the plan does not
 * cap it (Scale), which the UI renders as "Unlimited".
 */
export interface PlanLimits {
  seats: number | null;
  whatsappNumbers: number;
  flows: number | null;
  campaignsPerMonth: number | null;
  contacts: number | null;
  messagesPerMonth: number | null;
}

export type PlanTier = 'Pilot' | 'Growth' | 'Scale';

/**
 * A subscription tier. `modules` is the feature matrix row: menus this tier
 * unlocks in the client sidebar, layered on top of role gating.
 */
export interface Plan {
  tier: PlanTier;
  tagline: string;
  monthlyPriceInr: number | null;
  limits: PlanLimits;
  modules: string[];
  supportSla: string;
}

export type SubscriptionState = 'trial' | 'active' | 'grace' | 'expired' | 'suspended';

/** One lifecycle transition of a tenant's subscription, newest last. */
export interface SubscriptionEvent {
  id: string;
  tenantId: string;
  from: SubscriptionState | null;
  to: SubscriptionState;
  reason: string;
  actor: string;
  createdAt: string;
}

export type InvoiceStatus = 'paid' | 'due' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  tenantId: string;
  number: string;
  period: string;
  amountInr: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
}

/**
 * The single Meta Business app the platform embeds signup through. Values are
 * references the operator pastes from Meta's dashboard — with dummy data there
 * is nothing live to read, so the form holds them in memory only.
 */
export interface MetaAppConfig {
  appId: string;
  appSecretRef: string;
  apiVersion: string;
  callbackUrl: string;
  verifyToken: string;
  testNumber: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * A routing group inside a workspace. The weighted router (wave 2) hands new
 * chats to online members; `weight` is that member pool's share of the
 * round-robin, and exactly one team per tenant is the `isDefault` fallback.
 */
export interface Team {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  memberUserIds: string[];
  /** Round-robin share, 1–10. Normalised against the other teams at send time. */
  weight: number;
  isDefault: boolean;
  /** Glyph shown on the team chip. */
  icon: string;
  updatedAt: string;
}

/** A `/trigger` snippet an agent expands in the inbox composer. */
export interface QuickReply {
  id: string;
  tenantId: string;
  /** Includes the leading slash, unique per tenant. */
  trigger: string;
  title: string;
  body: string;
  usageCount: number;
  updatedAt: string;
}

export type SegmentRuleField = 'tag' | 'optIn' | 'conversations' | 'name' | 'inactiveDays';

export type SegmentRuleOperator =
  | 'has'
  | 'lacks'
  | 'is'
  | 'contains'
  | 'moreThan'
  | 'fewerThan';

/** One predicate inside a contact segment. */
export interface SegmentRule {
  field: SegmentRuleField;
  operator: SegmentRuleOperator;
  value: string;
}

/**
 * A saved audience definition. Campaigns (wave 6) send to these; the hub
 * evaluates them live so the count on the card is never stale.
 */
export interface ContactSegment {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  /** 'all' = AND every rule, 'any' = OR them. */
  match: 'all' | 'any';
  rules: SegmentRule[];
  createdAt: string;
  updatedAt: string;
}

export interface DayHours {
  day: string;
  open: boolean;
  start: string;
  end: string;
}

/**
 * The workspace's business profile (wave 3). Flow conditions read the hours;
 * the greeting and auto-responder feed the out-of-hours behaviour.
 */
export interface BusinessProfile {
  tenantId: string;
  displayName: string;
  about: string;
  address: string;
  email: string;
  timezone: string;
  hours: DayHours[];
  greetingText: string;
  autoResponderEnabled: boolean;
  autoResponderText: string;
  updatedAt: string;
}
