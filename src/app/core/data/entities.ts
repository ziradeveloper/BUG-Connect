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
