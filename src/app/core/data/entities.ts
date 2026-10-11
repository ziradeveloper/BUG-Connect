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
  /** Template sends that Meta rejected (unsubscribed number, template paused). */
  failed: number;
  pacePerHour: number;
  qualityRating: 'high' | 'medium' | 'low';
  scheduledAt: string | null;
  /** The approved template the broadcast sends; null on a draft. */
  templateId: string | null;
  /** The saved audience it targets, evaluated again at send time. */
  segmentId: string | null;
  createdBy: string;
  createdAt: string;
}

/**
 * One delivery sample of a running broadcast, oldest first. The monitor polls
 * `tickCampaign()` and appends a row, so the chart is a real time series rather
 * than four static numbers — the dummy layer's stand-in for a websocket.
 */
export interface CampaignSample {
  id: string;
  tenantId: string;
  campaignId: string;
  at: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
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

/**
 * Which part of the product an audited action belongs to. The log filters on
 * this, and the platform view adds a tenant column on top.
 */
export type AuditArea =
  | 'auth'
  | 'users'
  | 'roles'
  | 'settings'
  | 'billing'
  | 'platform'
  | 'clients'
  | 'plans'
  | 'meta'
  | 'templates'
  | 'inbox'
  | 'connections'
  | 'flows'
  | 'campaigns'
  | 'developer';

export type AuditLevel = 'info' | 'warning' | 'critical';

/**
 * One recorded administrative action (wave 5). Written by the same mutations
 * that change state — a role edit, a suspension, a plan change — so the log is
 * a by-product of doing the work rather than a hand-maintained list.
 */
export interface AuditEvent {
  id: string;
  /** Null for platform-wide actions; set when the action targets a workspace. */
  tenantId: string | null;
  actor: string;
  actorRole: string;
  area: AuditArea;
  action: string;
  /** What was acted on, in human terms: a user, a tier, a workspace. */
  target: string;
  level: AuditLevel;
  createdAt: string;
}

/**
 * A pending seat invitation. `token` is what an invite link carries to
 * `/accept-invite`; accepting it clears `WorkspaceUser.invited` and stamps the
 * account so it can sign in.
 */
export interface InviteToken {
  token: string;
  userId: string;
  tenantId: string;
  email: string;
  roleId: string;
  issuedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

/**
 * A self-service password reset request. Dummy layer: nothing is emailed, the
 * page surfaces the simulated link so the flow stays walkable end to end.
 */
export interface PasswordResetToken {
  token: string;
  email: string;
  /** Which console the account belongs to. */
  scope: 'client' | 'platform';
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

/**
 * Platform-wide configuration edited at `/settings` on the admin console:
 * identity, domains, onboarding defaults and the feature switches.
 */
export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  defaultTier: PlanTier;
  trialDays: number;
  sessionTimeoutMinutes: number;
  apexDomain: string;
  tenantSuffix: string;
  adminSubdomain: string;
  allowSelfServiceSignup: boolean;
  allowWhatsAppSelfConnect: boolean;
  maintenanceMode: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/* ── Wave 6: Flow Builder ──────────────────────────────────────── */

/**
 * The five node kinds the flow engine runs, in the order a conversation walks
 * them. `inbound` opens on a keyword, `menu` shows choices, `selection` records
 * what was chosen, `router` decides between an agent and automation, and
 * `close` ends the journey with a handoff or a resolution.
 */
export type FlowNodeKind = 'inbound' | 'menu' | 'selection' | 'router' | 'close';

/** One choice on a `menu` node. `nextNodeId` null ends the conversation. */
export interface FlowOption {
  id: string;
  label: string;
  nextNodeId: string | null;
}

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  title: string;
  /** The message the contact sees when the engine reaches this node. */
  message: string;
  options: FlowOption[];
  /**
   * Where the engine goes when the contact has nothing to pick — the trigger
   * continues into the menu, a router continues into the handoff. Null ends the
   * journey once the node has run.
   */
  nextNodeId: string | null;
  /** Human-readable rule for `router` nodes, e.g. "outside 09:00–21:00". */
  condition: string | null;
  /** Canvas position in the visualiser's grid, in pixels. */
  x: number;
  y: number;
}

/**
 * The editable graph behind a `ChatFlow`. Kept beside the flow summary rather
 * than on it so list screens stay cheap and the canvas owns the heavy record.
 */
export interface FlowGraph {
  id: string;
  tenantId: string;
  flowId: string;
  nodes: FlowNode[];
  updatedAt: string;
}

/**
 * A published snapshot of a flow. Versions carry their own copy of the nodes, so
 * restoring one is a real rollback rather than a pointer swap into a graph that
 * has since been edited.
 */
export interface FlowVersion {
  id: string;
  tenantId: string;
  flowId: string;
  version: number;
  note: string;
  author: string;
  nodeCount: number;
  publishedAt: string;
  nodes: FlowNode[];
}

/* ── Wave 6: WhatsApp Flows (native in-chat forms) ─────────────── */

/**
 * Component types the form studio can place on a screen. Names are Meta's own —
 * the studio edits this model and the generator emits the matching flow JSON,
 * so nothing is renamed on the way out.
 */
export type WaFormComponentType =
  | 'TextHeading'
  | 'TextBody'
  | 'TextInput'
  | 'TextArea'
  | 'Dropdown'
  | 'RadioButtonsGroup'
  | 'CheckboxGroup'
  | 'DatePicker'
  | 'OptIn';

/** `TextInput` flavours Meta accepts, kept as its `input-type` enum. */
export type WaFormInputType = 'text' | 'number' | 'email' | 'password' | 'passcode' | 'phone';

/** One option in a choice component: Meta's `data-source` entry. */
export interface WaFormChoice {
  id: string;
  title: string;
}

/**
 * A single form component as the studio holds it. Which properties apply
 * depends on `type` — the generator in `whatsapp-flows.ts` decides what to emit,
 * so the editor can keep one flat record.
 */
export interface WaFormField {
  id: string;
  type: WaFormComponentType;
  /** Displayed in the form; also the heading/body copy for the text components. */
  label: string;
  /** Data key in the response payload, unique per screen. Empty for text blocks. */
  name: string;
  required: boolean;
  inputType?: WaFormInputType;
  options?: WaFormChoice[];
  placeholder?: string;
  helperText?: string;
}

/**
 * One screen of a WhatsApp form. Meta renders it as a `SingleColumnLayout`;
 * `nextScreenId` null plus `terminal` true is how a form posts its response.
 */
export interface WaFormScreen {
  /** Meta screen id: uppercase snake case, unique inside the flow. */
  id: string;
  title: string;
  /** Optional intro rendered as a TextBody above the fields. */
  subtitle: string | null;
  fields: WaFormField[];
  /** Terminal screens collect nothing more and send the response. */
  terminal: boolean;
  /** Screen the footer button navigates to; null means "complete". */
  nextScreenId: string | null;
  footerLabel: string;
}

/** Meta's own flow categories, as accepted by the Flows API. */
export type WaFormCategory =
  | 'APPOINTMENT_BOOKING'
  | 'LEAD_GENERATION'
  | 'CUSTOMER_SUPPORT'
  | 'ORDER_MANAGEMENT'
  | 'OTHER';

export type WaFormStatus = 'draft' | 'pending' | 'published' | 'archived';

/**
 * A native WhatsApp form. Separate from `ChatFlow` on purpose: a chat flow is a
 * conversation tree the engine walks, while a WhatsApp form is one JSON document
 * Meta renders inside the chat and posts back in a single response.
 */
export interface WhatsAppFlowForm {
  id: string;
  tenantId: string;
  name: string;
  /** The id Meta returns when the flow is created on the WABA. */
  metaFlowId: string;
  category: WaFormCategory;
  language: string;
  status: WaFormStatus;
  screens: WaFormScreen[];
  /** Chat flow that sends this form as an interactive Flow message. */
  linkedFlowId: string | null;
  submissions30d: number;
  /** Percentage of opened forms that reached a terminal screen. */
  completionRate: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
