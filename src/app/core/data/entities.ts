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

export interface Message {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'media' | 'interactive';
  content: string;
  mediaUrl: string | null;
  deliveryStatus: 'sent' | 'delivered' | 'read' | 'failed';
  isInternalWhisper: boolean;
  createdByUserId: string | null;
  sentAt: string;
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

export interface MessageTemplate {
  id: string;
  tenantId: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paused';
  body: string;
  variables: number;
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
